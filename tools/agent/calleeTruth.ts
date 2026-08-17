#!/usr/bin/env npx tsx
/**
 * calleeTruth.ts — confront the declarations a translation unit makes about
 * its callees with the evidence that can refute them.
 *
 * Every other instrument in this repository takes the declarations as the
 * fixed background and varies the source against them. The residual, the
 * pipeline reversal, the allocation oracles, the residual source search: all
 * of them answer "is the current source's output reachable", and all of them
 * are conditioned on prototypes nothing checks. A wrong prototype is therefore
 * invisible to the entire stack — it is not a point in the space those tools
 * search, it is the coordinate system they search in. It manufactures
 * call-setup moves that no rewrite can remove, and every failed experiment
 * afterwards reads as evidence that the residual is hard.
 *
 * That failure mode is not hypothetical and it is not cheap. A session
 * declared a three-argument SDK call that the vendored header gives two
 * arguments, then spent days proving the resulting argument-setup instruction
 * could not be eliminated. The proof was sound. The premise was invented. The
 * file even carried a comment noting that the vendored prototype disagreed —
 * and resolved the disagreement against the vendor.
 *
 * So this tool asks the one question the rest of the stack cannot: is what we
 * told the compiler about each callee *true*? It answers from evidence that
 * does not depend on our own source:
 *
 *   1. the vendored SDK headers      — authoritative for an SDK entry point
 *   2. the callee's own definition   — authoritative for a matched function
 *   3. the callee's own target code  — an arity floor and, where the callee
 *                                      never writes $v0, a proof of void
 *
 * `include/functions.h` is deliberately NOT a witness. It is generated from
 * the definitions in `src/`, so a wrong signature written into a source file
 * comes back out of it wearing the authority of a project header. A derived
 * artifact cannot corroborate the thing it was derived from.
 *
 * Usage:
 *   npx tsx tools/agent/calleeTruth.ts func_80020E58
 *   npx tsx tools/agent/calleeTruth.ts func_80020E58 --src /tmp/variant.c --json
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import {
  ROOT,
  assembleTarget,
  disassembleObject,
  normalizeFunctionName,
  preprocessOnly,
  resolveSource,
  type DisassembledInstruction,
} from "./decompToolchain.js";
import { analyzeFrame, analyzeReturnValue, maximumArity, minimumArity } from "./frameMap.js";
import { children, field, parseC, subtreeIsBroken, walk, type Node } from "./residual-source-search/tree-sitter-c.js";

/* ------------------------------------------------------------------ */
/* Prototypes                                                          */
/* ------------------------------------------------------------------ */

export interface Prototype {
  name: string;
  /** Normalized one-line spelling, for reporting. */
  signature: string;
  /**
   * Declared parameter count, or `null` for a K&R `()` list.
   *
   * The distinction is the whole point: `f()` in C89 declares nothing about
   * the parameters, so it can neither be corroborated nor contradicted. A
   * reader that collapsed it to zero would invent contradictions.
   */
  parameters: number | null;
  variadic: boolean;
  returnsVoid: boolean;
  /**
   * A definition is authoritative about the function; a declaration is only
   * somebody's claim about it, and a claim is what is under audit here.
   */
  kind: "definition" | "declaration";
  /** Project-relative file the declaration was read from. */
  where: string;
  /** 1-based line within `where`. */
  line: number;
}

/** Collapse a subtree to its token text, comments and whitespace removed. */
function flatten(node: Node): string {
  const tokens: string[] = [];
  const collect = (item: Node): void => {
    if (isTriviaNode(item)) return;
    const kids = children(item);
    if (kids.length === 0) {
      tokens.push(item.text);
      return;
    }
    for (const kid of kids) collect(kid);
  };
  collect(node);
  return tokens
    .join(" ")
    .replace(/\s+([,)\];])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .replace(/\*\s+/g, "*")
    .trim();
}

function isTriviaNode(node: Node): boolean {
  return node.type === "comment";
}

function unwrapPointers(declarator: Node): { stars: number; core: Node } {
  let stars = 0;
  let core = declarator;
  while (core.type === "pointer_declarator") {
    stars += 1;
    const inner = field(core, "declarator");
    if (!inner) break;
    core = inner;
  }
  return { stars, core };
}

/**
 * Read a parameter list without flattening away what it does not say.
 *
 * `(void)` is zero parameters and is a claim. `()` is the absence of a claim.
 * `(int, ...)` claims one fixed parameter and refuses to bound the rest.
 */
function readParameters(params: Node): { count: number | null; variadic: boolean } {
  const declarations = children(params).filter((child) => child.type === "parameter_declaration");
  const variadic = children(params).some(
    (child) => child.type === "variadic_parameter" || child.text === "...",
  );
  if (declarations.length === 0) {
    /* Either `()` — unspecified — or an old-style identifier list, which
     * likewise declares no types. Both constrain nothing. */
    return { count: variadic ? 0 : null, variadic };
  }
  if (declarations.length === 1 && flatten(declarations[0]!) === "void") {
    return { count: 0, variadic: false };
  }
  return { count: declarations.length, variadic };
}

function prototypeFrom(
  returnType: Node,
  declarator: Node,
  kind: Prototype["kind"],
  where: string,
  lineOf: (row: number) => { file: string; line: number },
): Prototype | undefined {
  if (subtreeIsBroken(returnType) || subtreeIsBroken(declarator)) return undefined;

  const { stars, core } = unwrapPointers(declarator);
  if (core.type !== "function_declarator") return undefined;
  const nameNode = field(core, "declarator");
  const params = field(core, "parameters");
  if (!nameNode || !params || nameNode.type !== "identifier") return undefined;

  const { count, variadic } = readParameters(params);
  const origin = lineOf(returnType.startPosition.row);
  const inner = flatten(params).replace(/^\(/, "").replace(/\)$/, "").trim();
  return {
    name: nameNode.text,
    signature:
      `${flatten(returnType)}${stars > 0 ? ` ${"*".repeat(stars)}` : ""} ` +
      `${nameNode.text}(${inner});`,
    parameters: count,
    variadic,
    kind,
    returnsVoid: stars === 0 && flatten(returnType) === "void",
    where: origin.file || where,
    line: origin.line,
  };
}

/**
 * Every function declaration and definition in a translation unit.
 *
 * `lineOf` maps a parse row back to a real file and line, so a scan of
 * preprocessed text can still say which header a declaration came from.
 */
export function prototypesIn(
  source: string,
  where: string,
  lineOf: (row: number) => { file: string; line: number } = (row) => ({ file: where, line: row + 1 }),
): Prototype[] {
  const found: Prototype[] = [];
  let tree;
  try {
    tree = parseC(source);
  } catch {
    return found;
  }

  walk(tree.rootNode, (node) => {
    if (node.type === "function_definition") {
      const returnType = field(node, "type");
      const declarator = field(node, "declarator");
      if (returnType && declarator) {
        const prototype = prototypeFrom(returnType, declarator, "definition", where, lineOf);
        if (prototype) found.push(prototype);
      }
      return false;
    }
    if (node.type !== "declaration") return true;
    const returnType = field(node, "type");
    if (!returnType) return false;
    for (const declarator of node.childrenForFieldName("declarator")) {
      if (!declarator) continue;
      const prototype = prototypeFrom(returnType, declarator, "declaration", where, lineOf);
      if (prototype) found.push(prototype);
    }
    return false;
  });

  return found;
}

/* ------------------------------------------------------------------ */
/* What the compiler actually saw                                      */
/* ------------------------------------------------------------------ */

/**
 * Strip `cpp` line markers while preserving line numbering, and build the
 * row -> (file, line) map they encode.
 *
 * Scanning the headers on disk answers a different question: it counts
 * declarations this translation unit never includes. The `.i` is the only
 * text that is exactly what the compiler read.
 */
export function scopeFromPreprocessed(text: string): {
  source: string;
  lineOf: (row: number) => { file: string; line: number };
} {
  const lines = text.split("\n");
  const origins: Array<{ file: string; line: number }> = new Array(lines.length);
  let file = "";
  let line = 1;
  const cleaned = lines.map((raw, index) => {
    const marker = raw.match(/^#\s*(\d+)\s+"([^"]*)"/);
    if (marker) {
      line = parseInt(marker[1]!, 10);
      const path = marker[2]!;
      file = path.startsWith("/") ? displayPath(path) : path;
      origins[index] = { file, line };
      return "";
    }
    if (raw.startsWith("#")) {
      origins[index] = { file, line };
      return "";
    }
    origins[index] = { file, line };
    line += 1;
    return raw;
  });
  return {
    source: cleaned.join("\n"),
    lineOf: (row) => origins[row] ?? { file, line: row + 1 },
  };
}

/* ------------------------------------------------------------------ */
/* Witnesses                                                           */
/* ------------------------------------------------------------------ */

export type WitnessKind = "sdk" | "definition" | "target";

export interface Witness {
  kind: WitnessKind;
  where: string;
  /** The callee this witness is about, so a message can name it. */
  callee?: string;
  /** Present for prototype witnesses. */
  prototype?: Prototype;
  /** Present for the target witness: what the callee's own code proves. */
  arity?: { min: number; max: number };
  returns?: { type: "void" | "s32" | "unknown"; basis: "proven" | "callers" | "unknown" };
  notes?: string[];
}

/** Project-relative inside the repository, absolute outside it. */
export function displayPath(path: string): string {
  const inside = relative(ROOT, path);
  return inside.startsWith("..") ? path : inside;
}

function headersUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...headersUnder(path));
    else if (entry.name.endsWith(".h")) found.push(path);
  }
  return found;
}

/**
 * Prototypes published by the vendored SDK headers.
 *
 * These are the highest-ranked witness available: they are the vendor's own
 * statement of an entry point, they predate every decision made in this
 * repository, and nothing here can have contaminated them.
 */
export function sdkPrototypes(): Map<string, Prototype> {
  const index = new Map<string, Prototype>();
  for (const header of headersUnder(join(ROOT, "include/psyq"))) {
    const where = relative(ROOT, header);
    for (const prototype of prototypesIn(readFileSync(header, "utf-8"), where)) {
      if (!index.has(prototype.name)) index.set(prototype.name, prototype);
    }
  }
  return index;
}

/** Line-leading `name(` — cheap enough to run over every source file. */
function definesFunction(text: string, callee: string): boolean {
  return new RegExp(`^[A-Za-z_][\\w \\t*]*\\b${callee}\\s*\\(`, "m").test(text);
}

/**
 * The callee's own definition, if this project has matched it.
 *
 * A definition is a stronger witness than any declaration of the same
 * function, because it is the thing the declaration is supposed to describe.
 */
export function definitionPrototype(callee: string): Prototype | undefined {
  const direct = join(ROOT, "src", `${callee}.c`);
  const candidates = existsSync(direct)
    ? [direct]
    : readdirSync(join(ROOT, "src"))
      .filter((name) => name.endsWith(".c"))
      .map((name) => join(ROOT, "src", name))
      .filter((path) => definesFunction(readFileSync(path, "utf-8"), callee));

  for (const path of candidates) {
    const text = readFileSync(path, "utf-8");
    if (/INCLUDE_ASM/.test(text) && !definesFunction(text, callee)) continue;
    const found = prototypesIn(text, relative(ROOT, path))
      .find((item) => item.name === callee && item.kind === "definition");
    if (found) return found;
  }
  return undefined;
}

/**
 * What the callee's own compiled code proves about its interface.
 *
 * This witness exists for every function in the binary, matched or not, and it
 * is the one that survives when no header and no source describes the callee
 * at all. It is deliberately weak where the machine code is weak: the arity is
 * a floor, and only the never-writes-$v0 case proves void.
 */
export function targetWitness(callee: string, scratch: string): Witness | undefined {
  let instructions: DisassembledInstruction[];
  try {
    instructions = disassembleObject(assembleTarget(callee, scratch));
  } catch {
    return undefined;
  }
  const frame = analyzeFrame(instructions);
  const returnValue = analyzeReturnValue(callee, instructions);
  return {
    kind: "target",
    where: `${callee} (target code)`,
    arity: { min: minimumArity(frame), max: maximumArity(frame) },
    returns: { type: returnValue.type, basis: returnValue.basis },
    notes: returnValue.evidence,
  };
}

/* ------------------------------------------------------------------ */
/* Adjudication                                                        */
/* ------------------------------------------------------------------ */

export type CalleeStatus = "contradicted" | "disputed" | "unwitnessed" | "corroborated" | "undeclared";

export interface Contradiction {
  witness: WitnessKind;
  /**
   * Whether the evidence settles it.
   *
   * A proven contradiction changes the code the compiler emits at the call
   * site, so it invalidates every measurement taken under it. An unproven one
   * is a disagreement between two reconstructions where either side could be
   * the wrong one, and it may cost nothing at all — a trailing parameter the
   * callee ignores, or a return value the caller discards, leaves no trace in
   * either function's machine code. Both are worth knowing. Only one is a
   * reason to stop.
   */
  proven: boolean;
  message: string;
}

export interface CalleeReport {
  callee: string;
  declared?: Prototype;
  witnesses: Witness[];
  contradictions: Contradiction[];
  /** Whether this translation unit uses the call's value anywhere. */
  resultUsed: boolean;
  status: CalleeStatus;
}

/**
 * Compare one declaration against one witness, and say only what follows.
 *
 * The evidence is not all of one strength, so the verdicts are not either.
 * A vendored header and the callee's own register reads settle a question
 * outright. Another reconstruction in `src/` does not: a parameter the callee
 * never reads is invisible in its machine code, so two byte-exact functions
 * can disagree about the arity between them and both still be byte-exact.
 *
 * Return types carry their own materiality rule. A wrong return type changes
 * nothing at a call site that discards the value — the call clobbers $v0
 * either way — and changes the emitted code only where the value is consumed.
 * So the same disagreement is a blocker in one file and hygiene in the next,
 * and `resultUsed` is what separates them.
 */
export function contradictionsAgainst(
  declared: Prototype,
  witness: Witness,
  resultUsed: boolean,
): Contradiction[] {
  const found: Contradiction[] = [];
  const authoritative = witness.kind === "sdk";

  if (witness.prototype) {
    const other = witness.prototype;
    if (
      declared.parameters !== null && other.parameters !== null &&
      !declared.variadic && !other.variadic &&
      declared.parameters !== other.parameters
    ) {
      found.push({
        witness: witness.kind,
        proven: authoritative,
        message:
          `declared with ${declared.parameters} parameter(s); ${witness.where} declares ` +
          `${other.parameters} — ${other.signature}` +
          (authoritative ? "" : " (either reconstruction could be the wrong one)"),
      });
    }
    if (declared.returnsVoid !== other.returnsVoid) {
      found.push({
        witness: witness.kind,
        proven: resultUsed,
        message:
          `declared ${declared.returnsVoid ? "void" : "value-returning"}; ${witness.where} declares ` +
          `${other.returnsVoid ? "void" : "value-returning"}` +
          (resultUsed
            ? " and this file consumes the result"
            : " — this file discards the result, so the emitted code is the same either way") +
          ` — ${other.signature}`,
      });
    }
    return found;
  }

  /* The floor is proven: the callee reads that incoming register before
   * writing it, so a caller that does not set it passes garbage. */
  if (witness.arity && declared.parameters !== null && declared.parameters < witness.arity.min) {
    found.push({
      witness: witness.kind,
      proven: true,
      message:
        `declared with ${declared.parameters} parameter(s), but ${witness.callee ?? witness.where} ` +
        `reads incoming argument ${witness.arity.min - 1} before writing it — arity is at least ` +
        `${witness.arity.min}`,
    });
  }
  /* There is deliberately no ceiling rule. A trailing parameter the callee
   * never reads leaves no trace in its machine code, so no disassembly can
   * refute a declaration for being too long — only for being too short. */

  /* Only `proven` void is absolute: a void function is free to leave junk in
   * $v0, so "something writes $v0" refutes nothing. */
  if (witness.returns?.basis === "proven" && witness.returns.type === "void" && !declared.returnsVoid) {
    found.push({
      witness: witness.kind,
      proven: resultUsed,
      message:
        `declared value-returning, but no instruction in ${witness.callee ?? witness.where} writes ` +
        "$v0 and control never leaves the function — it cannot return anything" +
        (resultUsed
          ? "; this file consumes the result, so it reads a $v0 the target never sets"
          : "; this file discards the result, so the emitted code is the same either way"),
    });
  }
  return found;
}

/**
 * Does this translation unit consume the value of any call to `callee`?
 *
 * Read from the parse tree, because the answer is entirely about the syntactic
 * position of the call: a call whose parent is the statement itself is
 * discarded, and anything else — an initializer, an assignment, an argument,
 * a condition — consumes it.
 */
export function callResultUsed(source: string, callee: string): boolean {
  let tree;
  try {
    tree = parseC(source);
  } catch {
    return true;
  }
  let used = false;
  walk(tree.rootNode, (node) => {
    if (used) return false;
    if (node.type !== "call_expression") return true;
    if (field(node, "function")?.text !== callee) return true;
    const parent = node.parent;
    if (parent && parent.type !== "expression_statement" && parent.type !== "comma_expression") {
      used = true;
    }
    return true;
  });
  return used;
}

export interface TruthReport {
  function: string;
  source: string;
  callees: CalleeReport[];
  /** Callees reached through a register, which no declaration scan can name. */
  indirectCalls: number;
}

/** Direct callees, read from the target's own relocations. */
export function calleesOf(instructions: DisassembledInstruction[]): { direct: string[]; indirect: number } {
  const direct = new Set<string>();
  let indirect = 0;
  for (const insn of instructions) {
    if (insn.mnemonic === "jalr") indirect += 1;
    if (insn.mnemonic !== "jal") continue;
    const symbol = insn.relocation?.symbol ?? insn.operands[0];
    if (symbol) direct.add(symbol.replace(/^0x[0-9a-f]+\s*<(.*)>$/, "$1").trim());
  }
  return { direct: [...direct].sort(), indirect };
}

export function auditCallees(name: string, sourcePath: string, scratch: string): TruthReport {
  const targetInstructions = disassembleObject(assembleTarget(name, scratch));
  const { direct, indirect } = calleesOf(targetInstructions);

  const sourceText = readFileSync(sourcePath, "utf-8");
  const preprocessed = preprocessOnly(sourcePath, scratch, `${name}.scope`);
  const { source, lineOf } = scopeFromPreprocessed(readFileSync(preprocessed, "utf-8"));
  const inScope = new Map<string, Prototype>();
  for (const prototype of prototypesIn(source, displayPath(sourcePath), lineOf)) {
    /* A later declaration of the same name is a redeclaration, not a second
     * function; the first one is what the earliest call site saw. */
    if (!inScope.has(prototype.name)) inScope.set(prototype.name, prototype);
  }

  const sdk = sdkPrototypes();
  const callees: CalleeReport[] = [];

  for (const callee of direct) {
    if (callee === name) continue;
    const declared = inScope.get(callee);
    const witnesses: Witness[] = [];

    const fromSdk = sdk.get(callee);
    if (fromSdk) witnesses.push({ kind: "sdk", where: fromSdk.where, prototype: fromSdk });

    const fromDefinition = definitionPrototype(callee);
    if (fromDefinition && fromDefinition.where !== displayPath(sourcePath)) {
      witnesses.push({ kind: "definition", where: fromDefinition.where, prototype: fromDefinition });
    }

    const fromTarget = targetWitness(callee, scratch);
    if (fromTarget) witnesses.push({ ...fromTarget, callee });

    const resultUsed = callResultUsed(sourceText, callee);
    const contradictions = declared
      ? witnesses.flatMap((witness) => contradictionsAgainst(declared, witness, resultUsed))
      : [];

    const hasPrototypeWitness = witnesses.some((witness) => witness.prototype !== undefined);
    const status: CalleeStatus = declared === undefined
      ? "undeclared"
      : contradictions.some((item) => item.proven)
        ? "contradicted"
        : contradictions.length > 0
          ? "disputed"
          : hasPrototypeWitness
            ? "corroborated"
            : "unwitnessed";

    callees.push({
      callee,
      ...(declared === undefined ? {} : { declared }),
      witnesses,
      contradictions,
      resultUsed,
      status,
    });
  }

  return { function: name, source: displayPath(sourcePath), callees, indirectCalls: indirect };
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function describeWitness(witness: Witness): string {
  if (witness.prototype) return `${witness.kind}: ${witness.where} — ${witness.prototype.signature}`;
  const arity = witness.arity
    ? (witness.arity.min === witness.arity.max
      ? `reads ${witness.arity.min} incoming argument(s), and a stack argument fixes the count there`
      : `reads ${witness.arity.min} incoming argument(s), so arity >= ${witness.arity.min}; nothing bounds it above`)
    : "arity undetermined";
  const returns = witness.returns
    ? `returns ${witness.returns.type} (${witness.returns.basis})`
    : "return undetermined";
  return `target: ${witness.where} — ${arity}, ${returns}`;
}

export function renderTruthReport(report: TruthReport): string {
  const lines: string[] = [];
  const of = (status: CalleeStatus) => report.callees.filter((item) => item.status === status);
  const contradicted = of("contradicted");
  const disputed = of("disputed");
  const unwitnessed = of("unwitnessed");
  const undeclared = of("undeclared");

  lines.push(
    `callee truth ${report.function} — ${report.callees.length} direct callee(s) from ${report.source}` +
    (report.indirectCalls > 0 ? `, ${report.indirectCalls} indirect call site(s) not covered here` : ""),
  );
  lines.push(
    `  ${contradicted.length} contradicted, ${disputed.length} disputed, ${undeclared.length} undeclared, ` +
    `${unwitnessed.length} unwitnessed, ${of("corroborated").length} corroborated`,
  );

  for (const item of report.callees) {
    if (item.status === "corroborated") continue;
    lines.push("", `[${item.status}] ${item.callee}`);
    lines.push(
      `  in scope: ${item.declared ? item.declared.signature : "(none — C89 implicit int)"}` +
      (item.declared ? `   from ${item.declared.where}:${item.declared.line}` : ""),
    );
    for (const witness of item.witnesses) lines.push(`  ${describeWitness(witness)}`);
    for (const contradiction of item.contradictions) {
      lines.push(`  ${contradiction.proven ? "!!" : "??"} ${contradiction.message}`);
    }
    if (item.status === "unwitnessed") {
      lines.push(
        "  no header and no matched definition describes this callee: the signature in scope was",
        "  authored, and only the target evidence above constrains it.",
      );
    }
  }

  if (contradicted.length > 0) {
    lines.push(
      "",
      "!! A proven contradiction is not a style defect. It changes the argument setup or the",
      "   return handling at the call site, so it adds or removes instructions the target does not",
      "   have and rotates every register web downstream of the call. No rewrite of the function",
      "   body can undo it, and every measurement taken before it is fixed was taken against a",
      "   different program. Fix the declaration first, then re-measure from scratch.",
    );
  }
  if (disputed.length > 0) {
    lines.push(
      "",
      "?? A disputed callee costs nothing today: the two sources disagree about an interface in a",
      "   way that leaves no trace in either function's machine code. It is still one of them being",
      "   wrong about what the original author wrote, and it will cost something in whichever file",
      "   next depends on it.",
    );
  }
  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const srcFlag = args.indexOf("--src");
  const srcOverride = srcFlag >= 0 ? args[srcFlag + 1] : undefined;
  const positional = args.filter((a, i) => !a.startsWith("--") && !(srcFlag >= 0 && i === srcFlag + 1));
  if (positional.length !== 1 || (srcFlag >= 0 && !srcOverride)) {
    console.error("Usage: npx tsx tools/agent/calleeTruth.ts <func_name> [--src <path.c>] [--json]");
    process.exit(1);
  }

  const name = normalizeFunctionName(positional[0]!);
  const scratch = join(ROOT, "build/calleeTruth", name);
  mkdirSync(scratch, { recursive: true });
  try {
    const report = auditCallees(name, resolveSource(name, srcOverride), scratch);
    console.log(json ? JSON.stringify(report, null, 2) : renderTruthReport(report));
  } catch (error) {
    console.error(`calleeTruth: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
