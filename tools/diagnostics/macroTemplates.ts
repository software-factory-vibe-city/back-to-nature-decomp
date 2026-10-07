/** Extract asm-origin macro templates from C headers, not a transcribed SDK
 * catalogue. Uses the project's pinned C AST for defines, asm statements,
 * constraints and composite calls. Unsupported definitions remain diagnostics.
 * Header alternatives are separate environments, not last-definition-wins. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parseC, field, namedChildren, walk, type Node } from "../agent/residual-source-search/tree-sitter-c.js";
import { registerNumber, type AtomKind } from "./macroInstructions.js";

export interface PatternAtom { kind: AtomKind; value: number | string }
export interface InstructionPattern { op: string; args: PatternAtom[]; literal: string }
export interface AsmTemplateBlock { literal: string; instructions: InstructionPattern[]; clobbers: string[] }
export interface MacroTemplate {
  id: string;
  macro: string;
  parameters: string[];
  header: string;
  headerSha256: string;
  line: number;
  vintage: string;
  /** Alternative environments connected by shared macro names; unrelated
   * project headers can coexist without becoming a mixed-SDK-vintage finding. */
  vintageFamily: string;
  blocks: AsmTemplateBlock[];
  dependencies: string[];
  encodingEvidence: CommandEncodingEvidence[];
}
export interface CommandEncodingEvidence {
  header: string;
  headerSha256: string;
  line: number;
  macro: string;
  from: number;
  to: number;
  assemblerStatement: string;
  containerKind: "exe" | "overlay";
  probeObject: string;
  probeObjectSha256: string;
  probeOffset: number;
}
export interface TemplateDiagnostic { header: string; macro: string; line: number; reason: string }
export interface TemplateLibrary { templates: MacroTemplate[]; diagnostics: TemplateDiagnostic[] }
export interface MacroHeader { path: string; source: string }
interface Definition { name: string; parameters: string[]; body: string; header: string; hash: string; line: number }
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Directory inputs are recursive, sorted, and limited to C headers. */
export function loadMacroHeaders(paths: readonly string[]): MacroHeader[] {
  const files = new Set<string>();
  const add = (path: string): void => {
    if (statSync(path).isDirectory()) for (const child of readdirSync(path).sort()) add(join(path, child));
    else if (/\.h$/i.test(path)) files.add(path);
  };
  for (const path of paths) {
    if (!statSync(path).isDirectory() && !/\.h$/i.test(path)) throw new Error(`Not a C header: ${path}`);
    add(path);
  }
  return [...files].sort().map(path => ({ path, source: readFileSync(path, "utf8") }));
}

function strings(node: Node): string {
  const pieces: string[] = [];
  walk(node, n => {
    if (n.type !== "string_literal") return true;
    // C strings here contain only ASCII asm and standard escapes. Do not eval.
    pieces.push(n.text.slice(1, -1).replace(/\\(?:[\\"nrt]|[0-7]{1,3})/g, escape => {
      if (/^\\[0-7]/.test(escape)) return String.fromCharCode(parseInt(escape.slice(1), 8));
      return ({ '\\n': "\n", '\\r': "\r", '\\t': "\t", '\\\\': "\\", '\\"': '"' } as Record<string, string>)[escape]!;
    }));
    return false;
  });
  if (!pieces.length) throw new Error("Non-literal asm string");
  return pieces.join("");
}

function atom(text: string, kind: AtomKind, bindings: Map<number, string>): PatternAtom {
  const placeholder = text.trim().match(/^%(\d+)$/);
  if (placeholder) {
    const name = bindings.get(Number(placeholder[1]));
    if (!name) throw new Error(`Unresolved asm operand ${text}`);
    return { kind, value: name };
  }
  if (kind === "gpr" || kind === "cop") {
    const reg = registerNumber(text);
    if (reg === null) throw new Error(`Unsupported register ${text}`);
    return { kind, value: reg };
  }
  const value = Number(text.trim());
  if (!Number.isInteger(value)) throw new Error(`Unsupported immediate expression ${text}`);
  return { kind, value: kind === "word" ? value >>> 0 : value };
}

export function parseAsmPattern(literal: string, bindings: Map<number, string>): InstructionPattern[] {
  return literal.split(/[;\n]/).map(s => s.trim()).filter(Boolean).map(text => {
    const split = text.match(/^(\S+)(?:\s+(.*))?$/)!;
    let op = split[1]!.toLowerCase();
    const operands = (split[2] ?? "").split(",").map(s => s.trim()).filter(Boolean);
    let args: PatternAtom[];
    if (op === "nop") args = [];
    else if (op === ".word") {
      args = [atom(operands[0]!, "word", bindings)];
      op = typeof args[0]!.value === "number" && (args[0]!.value >>> 26) === 0x12 ? "cop2" : "literal-word";
    } else if (/^(?:[cm][ft]c2)$/.test(op)) args = [atom(operands[0]!, "gpr", bindings), atom(operands[1]!, "cop", bindings)];
    else if (/^(?:lb|lbu|lh|lhu|lw|lwl|lwr|sb|sh|sw|swl|swr|lwc2|swc2)$/.test(op)) {
      const mem = operands[1]?.match(/^([^()]*)\(\s*([^()]+)\s*\)$/);
      if (!mem) throw new Error(`Unsupported memory operand: ${text}`);
      args = [atom(operands[0]!, op.endsWith("c2") ? "cop" : "gpr", bindings), atom(mem[1]?.trim() || "0", "imm", bindings), atom(mem[2]!, "gpr", bindings)];
    } else if (op === "move") {
      op = "addu"; args = [atom(operands[0]!, "gpr", bindings), atom(operands[1]!, "gpr", bindings), { kind: "gpr", value: 0 }];
    } else if (/^(?:addu|add|subu|sub|and|or|xor|nor|slt|sltu|sllv|srlv|srav)$/.test(op)) args = operands.map(s => atom(s, "gpr", bindings));
    else if (/^(?:sll|srl|sra|addiu|addi|slti|sltiu|andi|ori|xori)$/.test(op)) args = operands.map((s, index) => atom(s, index === 2 ? "imm" : "gpr", bindings));
    else if (op === "lui") args = [atom(operands[0]!, "gpr", bindings), atom(operands[1]!, "imm", bindings)];
    else throw new Error(`Unsupported asm instruction: ${text}`);
    const expected = op === "nop" ? 0 : ["cop2", "literal-word"].includes(op) ? 1 : /^(?:[cm][ft]c2|lui)$/.test(op) ? 2 : 3;
    if (args.length !== expected) throw new Error(`Wrong operand count: ${text}`);
    return { op, args, literal: text };
  });
}

function definitions(headers: readonly MacroHeader[]): Definition[] {
  const result: Definition[] = [];
  for (const header of headers) {
    const tree = parseC(header.source);
    try {
      walk(tree.rootNode, node => {
        if (node.type !== "preproc_function_def") return true;
        const name = field(node, "name"), params = field(node, "parameters"), value = field(node, "value");
        if (name && params && value) result.push({ name: name.text, parameters: namedChildren(params).map(n => n.text), body: value.text.replace(/\\\r?\n/g, ""), header: header.path, hash: sha(header.source), line: node.startPosition.row + 1 });
        return false;
      });
    } finally { tree.delete(); }
  }
  return result;
}

function blockOf(node: Node, substitution: Map<string, string>): AsmTemplateBlock {
  const code = field(node, "assembly_code");
  if (!code) throw new Error("Missing asm literal");
  const bindings = new Map<number, string>();
  let index = 0;
  for (const list of [field(node, "output_operands"), field(node, "input_operands")]) {
    if (!list) continue;
    for (const operand of namedChildren(list)) {
      const value = field(operand, "value");
      if (!value) throw new Error("Missing asm operand value");
      const mapped = substitution.get(value.text);
      if (!mapped) throw new Error(`Asm operand is not a macro parameter: ${value.text}`);
      bindings.set(index++, mapped);
    }
  }
  const literal = strings(code);
  const clobberNode = field(node, "clobbers");
  const clobbers = clobberNode ? namedChildren(clobberNode).map(strings) : [];
  const instructions = parseAsmPattern(literal, bindings);
  if (!instructions.length) throw new Error("Empty asm is not an instruction template");
  return { literal, instructions, clobbers };
}

/** Extract definitions independently in each alternative-header environment.
 * Composites resolve only unambiguous primitives (or the same header's own
 * definition). No partial composite is published when an expansion fails. */
export function extractMacroTemplates(headers: readonly MacroHeader[]): TemplateLibrary {
  const defs = definitions(headers);
  const byName = new Map<string, Definition[]>();
  for (const def of defs) byName.set(def.name, [...(byName.get(def.name) ?? []), def]);
  const library: TemplateLibrary = { templates: [], diagnostics: [] };
  const facts = new Map<Definition, { asm: boolean; calls: string[] }>();
  for (const def of defs) {
    const tree = parseC(`void macro_probe(void) { ${def.body}; }`);
    const fact = { asm: false, calls: [] as string[] };
    try { walk(tree.rootNode, node => {
      if (node.type === "gnu_asm_expression") { fact.asm = true; return false; }
      if (node.type === "call_expression") fact.calls.push(field(node, "function")?.text ?? "");
      return true;
    }); } finally { tree.delete(); }
    facts.set(def, fact);
  }
  const origins = (def: Definition, seen = new Set<Definition>()): Set<string> => {
    if (seen.has(def)) return new Set();
    const next = new Set(seen).add(def), fact = facts.get(def)!;
    if (fact.asm) return new Set([def.header]);
    return new Set(fact.calls.flatMap(name => (byName.get(name) ?? []).flatMap(child => [...origins(child, next)])));
  };
  const parent = new Map<string, string>();
  const root = (header: string): string => {
    if (!parent.has(header)) parent.set(header, header);
    const p = parent.get(header)!;
    if (p === header) return p;
    const r = root(p); parent.set(header, r); return r;
  };
  for (const alternatives of byName.values()) {
    const headers = [...new Set(alternatives.flatMap(d => [...origins(d)]))];
    for (const header of headers.slice(1)) parent.set(root(header), root(headers[0]!));
    headers.forEach(root);
  }
  const families = new Map<string, Set<string>>();
  for (const header of parent.keys()) {
    const key = root(header);
    if (!families.has(key)) families.set(key, new Set());
    families.get(key)!.add(basename(header));
  }
  const familyOf = (header: string): string => [...(families.get(root(header)) ?? new Set([basename(header)]))].sort().join("|");
  function expand(def: Definition, environment: string, substitution: Map<string, string>, chain: string[]): { blocks: AsmTemplateBlock[]; dependencies: string[] } {
    if (chain.includes(`${def.header}:${def.name}`)) throw new Error("Recursive macro expansion");
    const tree = parseC(`void macro_probe(void) { ${def.body}; }`);
    const blocks: AsmTemplateBlock[] = [], dependencies: string[] = [];
    try {
      if (tree.rootNode.hasError) throw new Error("Macro body is outside the supported C AST grammar");
      const body = field(namedChildren(tree.rootNode)[0]!, "body")!;
      const process = (node: Node): void => {
        if (node.type === "comment") return;
        if (node.type === "compound_statement" || node.type === "expression_statement" || node.type === "parenthesized_expression") {
          for (const child of namedChildren(node)) process(child);
        } else if (node.type === "gnu_asm_expression") blocks.push(blockOf(node, substitution));
        else if (node.type === "call_expression") {
          const name = field(node, "function")?.text ?? "";
          const choices = byName.get(name) ?? [];
          const local = choices.filter(d => d.header === def.header);
          const vintage = choices.filter(d => d.header === environment);
          const scoped = local.length ? local : vintage.length ? vintage : choices;
          const chosen = scoped.length === 1 ? scoped[0] : undefined;
          if (!chosen) throw new Error(`Unresolved/ambiguous composite callee ${name}`);
          const args = namedChildren(field(node, "arguments")!).filter(n => n.type !== "comment");
          if (args.length !== chosen.parameters.length) throw new Error(`Composite arity mismatch for ${name}`);
          const childSub = new Map<string, string>();
          for (let index = 0; index < args.length; index++) {
            const mapped = substitution.get(args[index]!.text);
            if (!mapped) throw new Error(`Unsupported composite argument expression ${args[index]!.text}`);
            childSub.set(chosen.parameters[index]!, mapped);
          }
          const child = expand(chosen, environment, childSub, [...chain, `${def.header}:${def.name}`]);
          blocks.push(...child.blocks); dependencies.push(`${chosen.header}:${chosen.name}`, ...child.dependencies);
        } else throw new Error(`Macro contains non-asm computation (${node.type}); not an asm-only template`);
      };
      process(body);
      if (!blocks.length) throw new Error("No asm blocks");
      return { blocks, dependencies: [...new Set(dependencies)] };
    } finally { tree.delete(); }
  }
  for (const def of defs) {
    const environments = [...origins(def)];
    if (!environments.length) continue;
    const failures = new Set<string>();
    for (const environment of environments) {
      try {
        const expanded = expand(def, environment, new Map(def.parameters.map(p => [p, p])), []);
        // A generic .word operand is not evidence for *any* GTE operation. DMPSX
        // sentinel words must not be reinterpreted as final COP2 words.
        const words = expanded.blocks.flatMap(b => b.instructions).filter(p => p.op === "literal-word");
        if (words.some(p => typeof p.args[0]!.value !== "number")) throw new Error("Parameterized .word requires an encoding/inverse-expression oracle");
        const vintage = basename(environment);
        library.templates.push({ id: `${def.header}:${def.line}:${def.name}@${vintage}`, macro: def.name, parameters: def.parameters, header: def.header, headerSha256: def.hash, line: def.line, vintage, vintageFamily: familyOf(environment), encodingEvidence: [], ...expanded });
        if (words.some(p => typeof p.args[0]!.value === "number" && (p.args[0]!.value & 63) === 63)) failures.add("DMPSX sentinel .word retained literally; final GTE encoding not supplied by this header");
      } catch (error) { failures.add((error as Error).message); }
    }
    for (const reason of failures) library.diagnostics.push({ header: def.header, macro: def.name, line: def.line, reason });
  }
  library.templates.sort((a, b) => a.id.localeCompare(b.id));
  return library;
}
