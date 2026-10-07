/** Deterministic prep seam: byte finding -> AST edit -> provenance -> oracle
 * claim gate. Live sources and original m2c streams are never rewritten here.
 * Ambiguous body/scope/call correspondence is surfaced, not guessed. */
import { analyzeCSource, applyCSourceEdits, capturePrevRetSites, matchingConstructs, walkActiveC, type CSourceEdit } from "./cSourceGuard.js";
import { parseC, field, namedChildren, declaratorName, type Node } from "./residual-source-search/tree-sitter-c.js";
import { scanChainFunction, type ChainRow, type ChainCall } from "../diagnostics/nestedFunctionScan.js";
import { hex } from "../diagnostics/macroInstructions.js";
import type { OracleResult } from "../lib/functionOracle.js";

export interface ChainInjection {
  source: string; changed: boolean; row: ChainRow | null;
  status: "not-needed" | "pending-oracle" | "verified" | "failed" | "incomplete";
  findings: string[]; claims: Array<{ kind: "entry" | "spill" | "save" | "caller" | "forward"; address: number; offset?: number; register?: number; target?: number; placement?: ChainCall["placement"] }>;
}
const provenance = (row: ChainRow, fingerprint: string, address: number) =>
  `/* Static-chain ${fingerprint} at ${hex(address)}; census ${row.id} (${row.verdict}). */`;
function inConditional(node: Node): boolean {
  for (let p = node.parent; p; p = p.parent) if (p.type.startsWith("preproc_")) return true;
  return false;
}
function declarationLike(node: Node): boolean {
  return node.type === "declaration" || node.type === "comment" ||
    (node.type === "expression_statement" && field(namedChildren(node)[0]!, "function")?.text === "CAPTURE_PREV_RET");
}
/** m2c explicitly marks the missing entry register. A unique top-level dead
 * scalar assignment is a byte-proven spill, not a real call to M2C_ERROR.
 * Reuse that AST slot rather than leaving an unresolved call in the draft.
 * Any live/conditional/multiple occurrence is outside this bounded recipe. */
function unsetV0Spill(body: Node): { declaration: Node; left: Node; error: Node; statement: Node } | null {
  const errors = body.descendantsOfType("call_expression").filter(node => field(node, "function")?.text === "M2C_ERROR" &&
    namedChildren(field(node, "arguments")!).length === 1 &&
    namedChildren(field(node, "arguments")!)[0]?.type === "comment" &&
    namedChildren(field(node, "arguments")!)[0]?.text === "/* Read from unset register $v0 */");
  if (errors.length !== 1) return null;
  const error = errors[0]!, assignment = error.parent, statement = assignment?.parent;
  const left = assignment && field(assignment, "left");
  if (assignment?.type !== "assignment_expression" || field(assignment, "operator")?.text !== "=" ||
      field(assignment, "right")?.startIndex !== error.startIndex || left?.type !== "identifier" ||
      statement?.type !== "expression_statement" || statement.parent?.startIndex !== body.startIndex || inConditional(error)) return null;
  const declaration = namedChildren(body).find(node => node.type === "declaration" && field(node, "type")?.text === "s32" &&
    field(node, "declarator")?.type === "identifier" && field(node, "declarator")?.text === left.text &&
    !node.children.some(child => child.type === ","));
  if (!declaration || body.descendantsOfType("identifier").filter(node => node.text === left.text).length !== 2) return null;
  return { declaration, left, error, statement };
}
function statementOf(node: Node, body: Node): Node | null {
  let p = node.parent;
  while (p && p.parent?.type !== "compound_statement") p = p.parent;
  // Injecting outside a loop condition would move the install off its call.
  if (!p || ["for_statement", "while_statement", "do_statement"].includes(p.type) || inConditional(p)) return null;
  return p.startIndex >= body.startIndex && p.endIndex <= body.endIndex ? p : null;
}
/** Prototype transfer changes only AST storage/name/asm-label spans. Complete
 * prototypes come from prep's audited context, never ABI arity guesses. */
function nestedPrototype(context: string, callee: string, local: string): string | null {
  if (!analyzeCSource(context).parses) return null;
  const tree = parseC(context), declarations: string[] = [];
  try { walkActiveC(tree.rootNode, node => {
    if (node.type !== "declaration" || inConditional(node)) return true;
    const declarator = field(node, "declarator"), name = declaratorName(declarator);
    if (declarator?.type !== "function_declarator" || name?.text !== callee) return true;
    const params = field(declarator, "parameters");
    if (!params || !namedChildren(params).length || namedChildren(params).some(p => p.type === "variadic_parameter" || p.type === "identifier")) return true;
    if (node.descendantsOfType("gnu_asm_expression").length) return true;
    const edits: CSourceEdit[] = [{ start: name.startIndex - node.startIndex, end: name.endIndex - node.startIndex, text: local }];
    for (const storage of namedChildren(node).filter(n => n.type === "storage_class_specifier")) edits.push({ start: storage.startIndex - node.startIndex, end: storage.endIndex - node.startIndex, text: "" });
    const text = applyCSourceEdits(node.text, edits);
    // Last token is the declaration's semicolon, not a text search.
    declarations.push(`auto ${text.slice(0, -1).trim()} __asm__("${callee}");`);
    return false;
  }); } finally { tree.delete(); }
  const unique = [...new Set(declarations)];
  return unique.length === 1 ? unique[0]! : null;
}

export function injectStaticChain(source: string, row: ChainRow | null, context: string): ChainInjection {
  const result: ChainInjection = { source, changed: false, row, status: "not-needed", findings: [], claims: [] };
  if (!row || (!row.callee && !row.calls.some(c => c.verdict === "confirmed-pair"))) return result;
  const guard = analyzeCSource(source);
  if (!guard.parses || !guard.embeddable) { result.status = "incomplete"; result.findings.push("Static-chain injection unavailable: candidate does not safely parse"); return result; }
  const tree = parseC(source), edits: CSourceEdit[] = [];
  try {
    const definitions: Node[] = [];
    walkActiveC(tree.rootNode, node => {
      if (node.type === "function_definition" && declaratorName(field(node, "declarator"))?.text === row.function) definitions.push(node);
      return true;
    });
    const definition = definitions.length === 1 ? definitions[0] : undefined;
    const body = definition && field(definition, "body");
    if (!definition || !body || inConditional(definition)) { result.status = "incomplete"; result.findings.push("No unique unconditional target definition for static-chain AST injection"); return result; }
    const identifiers = new Set(tree.rootNode.descendantsOfType("identifier").map(n => n.text));
    const fresh = (base: string): string => { let name = base, i = 0; while (identifiers.has(name)) name = `${base}_${++i}`; identifiers.add(name); return name; };
    const decls: string[] = [], initializers: string[] = [];
    const children = namedChildren(body);
    const firstStatement = children.find(n => !declarationLike(n));
    const initializerAt = firstStatement?.startIndex ?? body.endIndex - 1;
    const captures = capturePrevRetSites(source).filter(s => s.valid && (s.scope === "file" && s.start < definition.startIndex || s.function === row.function));
    const rawPins = [...matchingConstructs(source).fileRegisterBindings, ...matchingConstructs(source).localRegisterBindings];
    if (row.callee && !captures.length) {
      if (rawPins.some(s => ["$2", "$v0", "v0", "2"].includes(s.register))) {
        result.findings.push("Raw entry-$2 binding already present: migrate with CAPTURE_PREV_RET; do not double-insert"); result.status = "incomplete";
      } else {
        const callee = row.callee, phantom = fresh("phantom"), address = callee.entryReads[0]!;
        const comment = provenance(row, callee.form, address);
        result.claims.push({ kind: "entry", address });
        if (callee.form === "save-forward") edits.push({ start: definition.startIndex, end: definition.startIndex, text: `${comment}\nCAPTURE_PREV_RET(${phantom});\n\n` });
        else decls.push(`${comment}\n    CAPTURE_PREV_RET(${phantom});`);
        if (callee.form === "undetermined") {
          result.findings.push(`${callee.guidance} No spill or re-install injected without sub-form proof.`); result.status = "incomplete";
        } else {
          if (callee.spills.length !== 1 || callee.spills[0]!.offset < 0 || callee.spills[0]!.offset % 4) {
            result.findings.push("No unique aligned target spill slot; capture only"); result.status = "incomplete";
          } else {
            const spill = callee.spills[0]!, slot = fresh("chain_spill");
            // GCC places a two-word dead local at the frame's local-area base.
            // Do not pretend declaration order fixes its byte offset: the
            // oracle below MUST witness sw $v0,N($sp) or staging is refused.
            const existingSpill = callee.form === "dead-spill" && callee.entryReads.length === 1 ? unsetV0Spill(body) : null;
            const comment = provenance(row, `spill N=${spill.offset} (verify local placement)`, spill.address);
            if (existingSpill) {
              edits.push({ start: existingSpill.declaration.startIndex, end: existingSpill.declaration.endIndex, text: `s32 ${existingSpill.left.text}[2];` },
                { start: existingSpill.left.startIndex, end: existingSpill.left.endIndex, text: `${existingSpill.left.text}[0]` },
                { start: existingSpill.error.startIndex, end: existingSpill.error.endIndex, text: phantom },
                { start: existingSpill.statement.startIndex, end: existingSpill.statement.startIndex, text: `${comment}\n    ` });
            } else {
              decls.push(`s32 ${slot}[2];`);
              initializers.push(`${comment}\n    ${slot}[0] = ${phantom};`);
            }
            result.claims.push({ kind: "spill", address: spill.address, offset: spill.offset });
          }
          if (callee.form === "save-forward") {
            const saved = fresh("chain_saved"); decls.push(`s32 ${saved};`); initializers.push(`${saved} = ${phantom};`);
            for (const register of callee.savedRegisters) result.claims.push({ kind: "save", address, register });
            const targets = new Set(callee.forwards.filter(c => c.verdict === "confirmed-pair").map(c => c.callee));
            for (const target of targets) {
              const calls = body.descendantsOfType("call_expression").filter(n => field(n, "function")?.text === target);
              const sites = [...new Map(callee.forwards.filter(c => c.callee === target).map(c => [c.call, c])).values()];
              const unresolved = (site: ChainCall) => decls.push(`${provenance(row, `save-forward placeholder for call ${hex(site.call)}: matching tier must position`, site.setup)}\n    /* TODO: ${phantom} = ${saved}; before ${target}. */`);
              if (calls.length !== sites.length) {
                result.findings.push(`Save/forward call correspondence unresolved for ${target}`);
                sites.forEach(unresolved); continue;
              }
              calls.forEach((node, n) => {
                const statement = statementOf(node, body), site = sites[n]!;
                if (!statement) { result.findings.push(`Cannot safely scaffold forward at ${hex(site.call)}`); unresolved(site); return; }
                edits.push({ start: statement.startIndex, end: statement.startIndex,
                  text: `${provenance(row, "save-forward placeholder: matching tier must position", site.setup)}\n    ${phantom} = ${saved};\n    ` });
                result.claims.push({ kind: "forward", address: site.setup, target: site.target! });
              });
            }
            result.findings.push("Save/forward scaffold is visibly incomplete: matching tier must position re-installs and verify the full function before staging"); result.status = "incomplete";
          }
        }
      }
    }
    /* Idempotency is not an oracle exemption. A resumed draft may contain a
       previous injection whose compilation failed, or an incomplete scaffold.
       Reissue the byte claims even when there is nothing to insert. */
    if (row.callee && captures.length) {
      const callee = row.callee;
      result.claims.push({ kind: "entry", address: callee.entryReads[0]! });
      for (const spill of callee.spills) result.claims.push({ kind: "spill", address: spill.address, offset: spill.offset });
      for (const register of callee.savedRegisters) result.claims.push({ kind: "save", address: callee.entryReads[0]!, register });
      for (const site of callee.forwards) result.claims.push({ kind: "forward", address: site.setup, target: site.target ?? undefined });
      if (callee.form !== "dead-spill") {
        result.status = "incomplete";
        result.findings.push(callee.form === "save-forward" ?
          "Save/forward emulation requires matching-tier positioning and full-function verification before staging" : callee.guidance);
      } else result.status = "pending-oracle";
    }
    for (const target of new Set(row.calls.filter(c => c.verdict === "confirmed-pair").map(c => c.callee!))) {
      const sites = row.calls.filter(c => c.callee === target && c.verdict === "confirmed-pair");
      // Existing local auto + asm label is idempotent, even after renaming.
      const aliases = body.descendantsOfType("declaration").filter(n => namedChildren(n).some(c => c.type === "storage_class_specifier" && c.text === "auto") &&
        n.descendantsOfType("gnu_asm_expression").some(a => field(a, "assembly_code")?.text === `"${target}"`));
      if (aliases.length) {
        for (const site of sites) result.claims.push({ kind: "caller", address: site.setup, offset: site.offset!, target: site.target!, placement: site.placement });
        if (result.status === "not-needed") result.status = "pending-oracle";
        continue;
      }
      const calls = body.descendantsOfType("call_expression").filter(n => field(n, "function")?.type === "identifier" && field(n, "function")!.text === target);
      if (calls.length !== sites.length || sites.some(c => c.targetCallCount !== sites.length) || calls.some(inConditional)) {
        result.findings.push(`Caller injection for ${target} withheld: no complete one-to-one paired call correspondence`); result.status = "incomplete"; continue;
      }
      const local = fresh(`nested_${target}`), declaration = nestedPrototype(context, target, local);
      if (!declaration) { result.findings.push(`Caller injection for ${target} withheld: unique complete prototype unavailable in prep context`); result.status = "incomplete"; continue; }
      decls.push(`${sites.map(c => provenance(row, "caller frame-address/call-boundary-dead", c.setup)).join("\n    ")}\n    ${declaration}`);
      for (const node of calls) { const name = field(node, "function")!; edits.push({ start: name.startIndex, end: name.endIndex, text: local }); }
      for (const site of sites) result.claims.push({ kind: "caller", address: site.setup, offset: site.offset!, target: site.target!, placement: site.placement });
    }
    if (decls.length) edits.push({ start: body.startIndex + 1, end: body.startIndex + 1, text: `\n    ${decls.join("\n    ")}\n` });
    if (initializers.length) edits.push({ start: initializerAt, end: initializerAt, text: `${initializers.join("\n    ")}\n    ` });
    if (edits.length) { result.source = applyCSourceEdits(source, edits); result.changed = result.source !== source; if (result.status !== "incomplete") result.status = "pending-oracle"; }
    if (row.callee?.form === "undetermined" && !result.findings.length) { result.findings.push(row.callee.guidance); result.status = "incomplete"; }
  } finally { tree.delete(); }
  return result;
}

/** Partial claim verification uses the oracle's relocated candidate words,
 * never cc1 text or match percentage. It does NOT claim the whole body matches.
 * Unknown relocations, wrong slots/placements and missing motifs refuse staging. */
export function verifyChainInjection(injection: ChainInjection, oracle: Pick<OracleResult, "candidateWords" | "vram">): void {
  if (!injection.claims.length || !injection.row) return;
  if (oracle.candidateWords.some(w => w.undetermined)) { injection.status = "failed"; injection.findings.push("Static-chain oracle gate: unresolved candidate relocation"); return; }
  const bytes = Buffer.alloc(oracle.candidateWords.length * 4);
  oracle.candidateWords.forEach((w, n) => bytes.writeUInt32LE(w.raw >>> 0, n * 4));
  const scanned = scanChainFunction({ name: injection.row.function, container: injection.row.container, vram: oracle.vram, bytes });
  const expectedCallers = injection.claims.filter(c => c.kind === "caller");
  const failures: string[] = [];
  if (injection.row.callee?.form !== "undetermined" && injection.claims.some(c => c.kind === "entry") &&
      scanned.callee?.form !== injection.row.callee?.form) failures.push("callee sub-form not reproduced");
  for (const claim of injection.claims) {
    const ok = claim.kind === "entry" ? !!scanned.callee :
      claim.kind === "spill" ? scanned.callee?.spills.some(s => s.offset === claim.offset) :
      claim.kind === "save" ? scanned.callee?.savedRegisters.includes(claim.register!) :
      claim.kind === "forward" ? scanned.callee?.forwards.some(c => c.target === claim.target) : true;
    if (!ok) failures.push(`${claim.kind} at ${hex(claim.address)} not reproduced`);
  }
  const key = (c: { target?: number | null; offset?: number | null; placement?: string }) => `${c.target}:${c.offset}:${c.placement}`;
  const expected = expectedCallers.map(key).sort();
  const actual = scanned.calls.filter(c => c.verdict === "caller-candidate" && expectedCallers.some(e => e.target === c.target)).map(key).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) failures.push("paired caller setup offset/placement/multiplicity not reproduced");
  const forwardClaims = injection.claims.filter(c => c.kind === "forward");
  if (forwardClaims.length) {
    const groups = (sites: Array<{ address: number; target?: number | null }>) => {
      const webs = new Map<number, Array<number | null | undefined>>();
      for (const site of sites) webs.set(site.address, [...webs.get(site.address) ?? [], site.target]);
      return [...webs.values()].map(targets => targets.sort().join(",")).sort();
    };
    if (JSON.stringify(groups(forwardClaims)) !== JSON.stringify(groups((scanned.callee?.forwards ?? []).map(c => ({ address: c.setup, target: c.target })))))
      failures.push("save-forward setup/call web multiplicity not reproduced");
  }
  if (failures.length) { injection.status = "failed"; injection.findings.push(...failures.map(f => `Static-chain oracle gate: ${f}`)); }
  else if (injection.status !== "incomplete") injection.status = "verified";
}
