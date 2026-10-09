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
 *   2. the callee's own definition   — a reconstruction, not a witness for
 *                                      parameters its target never reads
 *   3. the callee's own target code  — per-slot reads, an arity floor and,
 *                                      where it never writes $v0, proof of void
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
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  ROOT,
  assembleTarget,
  disassembleObject,
  normalizeFunctionName,
  preprocessOnly,
  resolveSource,
  sourceDirFor,
  sourcePathFor,
  type DisassembledInstruction,
  configuredCppFlags,
  compileSource,
} from "./decompToolchain.js";
import { analyzeFrame, analyzeRegisterParameters, analyzeReturnValue, maximumArity, minimumArity, memoryOperand } from "./frameMap.js";
import { BRANCH_MNEMONICS, defUse } from "./webAnalysis.js";
import { originalIndex } from "./type-propagation/graph.js";
import { decodeBytes } from "./matching-reconstruction/exec.js";
import { definedRegister, type DecodedInsn } from "./matching-reconstruction/decode.js";
import { buildCfg } from "./machine-ir/cfg.js";
import { containerTargetPath, vramToRom } from "../lib/container.js";
import { compareFunction } from "../lib/functionOracle.js";
import { cachedPreprocess, withPreprocessorMetadata, preprocessingTools } from "./preprocessedCache.js";
import { digest, snapshot, readCache, writeCache } from "../lib/contentCache.js";
import { declaredFunction } from "./sdkTypes.js";
import { inspectType } from "./type-propagation/c-types.js";
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
  /** Complete source types; absent only in legacy manually constructed witnesses. */
  returnType?: string;
  paramTypes?: string[];
  /** Zero-based incoming ABI positions, including unused earlier slots. */
  slots?: Array<number | null>;
  /** Seed admission only: reads of defining C parameters, resolved by AST. */
  usedParameters?: boolean[];
  /** Declaration identities of named type dependencies, not the caller TU. */
  typeScopes?: { parameters: string[]; result: string };
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

/** O32 scalar slot positions, without assigning an invented width to typedefs
 * or by-value records. Later positions become unknown after such a parameter. */
export function incomingSlots(types: string[]): Array<number | null> {
  let slot: number | null = 0;
  return types.map((type) => {
    const width = inspectType(type).abiWords;
    if (slot === null || width === null) { slot = null; return null; }
    if (width === 2 && slot % 2) slot++;
    const position = slot; slot += width; return position;
  });
}

function prototypeFrom(
  returnType: Node,
  declarator: Node,
  kind: Prototype["kind"],
  where: string,
  lineOf: (row: number) => { file: string; line: number },
): Prototype | undefined {
  if (subtreeIsBroken(returnType) || subtreeIsBroken(declarator)) return undefined;

  const core = declaredFunction(declarator);
  if (!core) return undefined;
  const nameNode = field(core, "declarator");
  const params = field(core, "parameters");
  if (!nameNode || !params || nameNode.type !== "identifier") return undefined;

  const { count, variadic } = readParameters(params);
  const origin = lineOf(returnType.startPosition.row);
  const inner = flatten(params).replace(/^\(/, "").replace(/\)$/, "").trim();
  const paramTypes = children(params).filter((n) => n.type === "parameter_declaration")
    .filter((n) => flatten(n) !== "void").map((n) => {
      const declaringName = (d: Node | null | undefined): Node | null => {
        if (!d || d.type === "parameter_list") return null;
        if (d.type === "identifier") return d;
        const inner = field(d, "declarator");
        if (inner) return declaringName(inner);
        return d.namedChildren.map(declaringName).find((x) => x !== null) ?? null;
      };
      const d = declaringName(field(n, "declarator"));
      /* Remove only the parameter's declaring identifier, not callback
         parameters or a type's identifier. */
      return d ? (n.text.slice(0, d.startIndex - n.startIndex) + n.text.slice(d.endIndex - n.startIndex)).trim().replace(/\)\s+\(/g, ")(") : flatten(n);
    });
  const qualifiers = returnType.parent ? children(returnType.parent).filter((n) => n.type === "type_qualifier" && n.endIndex <= declarator.startIndex).map(flatten) : [];
  const prefix = [...qualifiers, flatten(returnType)].join(" ");
  const rendered = flatten(declarator);
  const fullReturnType = `${prefix} ${rendered.replace(flatten(core), "")}`.trim();
  return {
    name: nameNode.text,
    signature: `${prefix} ${rendered};`,
    parameters: count,
    variadic,
    kind,
    returnType: fullReturnType,
    paramTypes,
    slots: incomingSlots(paramTypes),
    returnsVoid: !rendered.replace(flatten(core), "").includes("*") && flatten(returnType) === "void",
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

  tree.delete();
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
  identity: string;
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
    identity: digest(text),
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
  /** Incoming ABI word positions actually read, not the declared C count. */
  reads?: number[];
  /** False for fragments/tail transfers: absence of a read is not established. */
  readsComplete?: boolean;
  /** Incoming registers still live at calls may be forwarded implicitly. */
  undeterminedReads?: number[];
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
function effectiveSource(path: string): string {
  return cachedPreprocess(path).text;
}

let sdkIndexCache: { identity: string; index: Map<string, Prototype>; observed: Record<string, string> } | undefined;
export function sdkPrototypes(): Map<string, Prototype> {
  return withPreprocessorMetadata(buildSdkPrototypes);
}
function buildSdkPrototypes(): Map<string, Prototype> {
  const headers = headersUnder(join(ROOT, "include/psyq"));
  const identity = digest(JSON.stringify([configuredCppFlags(), preprocessingTools(), snapshot(ROOT, ["include", "tools/agent/calleeTruth.ts", "tools/agent/sdkTypes.ts",
    "tools/agent/preprocessedCache.ts", "tools/agent/residual-source-search/tree-sitter-c.ts", "tools/vendor/tree-sitter-c", "package-lock.json",
    execFileSync("which", ["mips-linux-gnu-cpp"], { encoding: "utf8" }).trim()], (p) => !/include\/(?:functions\.h|sdk_types\.h|overlays\/)/.test(p))]));
  const fresh = (observed: Record<string, string>) => JSON.stringify(observed) === JSON.stringify(snapshot(ROOT, Object.keys(observed)));
  if (sdkIndexCache?.identity === identity && fresh(sdkIndexCache.observed)) return structuredClone(sdkIndexCache.index);
  const cache = join(ROOT, "build/cache/sdk-prototypes.json");
  const hit = readCache<{ index: Array<[string, Prototype]>; observed: Record<string, string> }>(cache, identity);
  if (hit && fresh(hit.observed)) { sdkIndexCache = { identity, index: new Map(hit.index), observed: hit.observed }; return structuredClone(sdkIndexCache.index); }
  const index = new Map<string, Prototype>();
  const dependencies = new Set<string>();
  for (const header of headers) {
    const where = relative(ROOT, header);
    const processed = cachedPreprocess(header);
    for (const path of processed.dependencies) dependencies.add(path);
    const scope = scopeFromPreprocessed(processed.text);
    for (const prototype of prototypesIn(scope.source, where, scope.lineOf)) {
      if (!index.has(prototype.name)) index.set(prototype.name, prototype);
    }
  }
  const observed = snapshot(ROOT, [...dependencies]);
  sdkIndexCache = { identity, index, observed };
  writeCache(cache, identity, { index: [...index], observed });
  return structuredClone(index);
}

/** AST inventory, never a name-shaped match in comments or string literals. */
function definesFunction(text: string, callee: string): boolean {
  return prototypesIn(text, "source-inventory").some((p) => p.name === callee && p.kind === "definition");
}

/**
 * The callee's own definition, if this project has matched it.
 *
 * A definition is a stronger witness than any declaration of the same
 * function, because it is the thing the declaration is supposed to describe.
 */
export function definitionPrototype(callee: string): Prototype | undefined {
  /* Source can change inside an interactive process. Never cache a prototype
     solely by symbol name; preparation must observe the defining source now. */
  return computeDefinitionPrototype(callee);
}

function computeDefinitionPrototype(callee: string): Prototype | undefined {
  /* Scoped to the callee's own container: an overlay's translation units live
     under its own source directory, and the executable's under the project's.
     Sweeping the wrong directory answers "no definition" for every overlay
     callee, which reads as an absence of evidence rather than a wrong path. */
  const direct = sourcePathFor(callee);
  const sourceDir = sourceDirFor(callee);
  const candidates = existsSync(direct)
    ? [direct]
    : !existsSync(sourceDir)
      ? []
      : readdirSync(sourceDir)
        .filter((name) => name.endsWith(".c"))
        .map((name) => join(sourceDir, name))
        .filter((path) => definesFunction(readFileSync(path, "utf-8"), callee));

  for (const path of candidates) {
    const scope = scopeFromPreprocessed(effectiveSource(path));
    const found = prototypesIn(scope.source, relative(ROOT, path), scope.lineOf)
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
/** Keep frameMap read-only, but do not mistake its omitted frameless stack
 * loads or implicit call uses for negative evidence. The latter remain unknown,
 * not proofs derived from candidate prototypes. */
type ReadEvidence = Pick<Witness, "reads" | "readsComplete" | "undeterminedReads">;
type CallReadResolver = (insn: DisassembledInstruction) => { reads: number[]; unknown: number[] };

export function targetReadEvidence(instructions: DisassembledInstruction[], resolveCall?: CallReadResolver): ReadEvidence {
  const frame = analyzeFrame(instructions);
  const reads = [...frame.registerParameters, ...frame.incoming].map((p) => Math.floor(p.index));
  if (frame.frameSize === 0 && !instructions.some((i) => defUse(i).defs.includes("sp"))) {
    for (const insn of instructions) {
      const memory = memoryOperand(insn.operands.at(-1) ?? "");
      if (defUse(insn).isLoad && memory?.base === "sp" && memory.offset >= 0x10) reads.push(Math.floor(memory.offset / 4));
    }
  }
  /* To observe potential forwarding without trusting any callee prototype,
     move call-argument reads into the delay slot's post-SET state. The
     synthetic call consumes independently witnessed slots; unresolved calls
     additionally probe all still-incoming arg registers. This is diagnostic
     dataflow only, never emitted assembly or C. */
  const callFacts = new Map(instructions.filter((i) => defUse(i).isCall).map((i) => [i.address,
    resolveCall?.(i) ?? { reads: [], unknown: [0, 1, 2, 3] }]));
  const observe = (includeUnknown: boolean): number[] => {
    const augmented: DisassembledInstruction[] = [];
    const addresses = new Map<number, number>();
    for (let i = 0; i < instructions.length; i++) {
      const insn = instructions[i]!;
      addresses.set(insn.address, augmented.length * 4);
      if (defUse(insn).isCall && instructions[i + 1]) {
        const delay = instructions[++i]!;
        addresses.set(delay.address, augmented.length * 4);
        const facts = callFacts.get(insn.address)!;
        const slots = [...facts.reads, ...(includeUnknown ? facts.unknown : [])].filter((s) => s < 4);
        augmented.push(delay, { ...insn, operands: [...insn.operands, ...slots.map((s) => `a${s}`)] },
          { ...insn, mnemonic: "nop", operands: [] });
      } else augmented.push(insn);
    }
    const remapped = augmented.map((insn, index) => ({ ...insn, address: index * 4,
      operands: insn.operands.map((operand) => {
        if (!BRANCH_MNEMONICS.has(insn.mnemonic)) return operand;
        const target = operand.match(/^(?:0x)?([0-9a-f]+)\s+</i);
        const address = target ? addresses.get(parseInt(target[1]!, 16)) : undefined;
        return address === undefined ? operand : `${address.toString(16)} <local>`;
      }) }));
    return analyzeRegisterParameters(remapped, new Map()).map((p) => p.index);
  };
  reads.push(...observe(false));
  const possible = observe(true);
  const escapes = instructions.some((i) => (i.mnemonic === "j" && i.relocation && i.relocation.symbol !== ".text") || (i.mnemonic === "jr" && i.operands[0]?.replace(/^\$/, "") !== "ra"));
  const hasReturn = instructions.some((i) => i.mnemonic === "jr" && i.operands[0]?.replace(/^\$/, "") === "ra");
  return { reads: [...new Set(reads)].sort((a, b) => a - b), readsComplete: hasReturn && !escapes,
    undeterminedReads: possible.filter((s) => !reads.includes(s)) };
}

/** Bounded transitive call reads. Cycles, indirect calls, unavailable targets
 * and budget stops remain unknown; no reconstruction participates. */
function targetReadObserver(scratch: string,
  load = (callee: string) => disassembleObject(assembleTarget(callee, scratch)),
  sdkIndex?: Map<string, Prototype>): (callee: string, supplied?: DisassembledInstruction[]) => ReadEvidence {
  const memo = new Map<string, ReadEvidence>(), active = new Set<string>();
  const unknown: ReadEvidence = { reads: [], readsComplete: false, undeterminedReads: [0, 1, 2, 3] };
  let visited = 0;
  const read = (callee: string, supplied?: DisassembledInstruction[]): ReadEvidence => {
    const hit = memo.get(callee); if (hit) return hit;
    if (!active.size) visited = 0;
    if (active.has(callee) || visited >= 256 || active.size >= 32) return unknown;
    visited++; active.add(callee);
    try {
      const insns = supplied ?? load(callee);
      const evidence = targetReadEvidence(insns, (insn) => {
        const name = insn.mnemonic === "jal" ? insn.relocation?.symbol : undefined;
        if (!name || name === ".text") return { reads: [], unknown: [0, 1, 2, 3] };
        const sdk = (sdkIndex ??= sdkPrototypes()).get(name);
        if (sdk?.parameters !== null && sdk?.parameters !== undefined && !sdk.variadic && sdk.slots?.every((s) => s !== null))
          return { reads: sdk.slots as number[], unknown: [] };
        const child = read(name);
        return { reads: child.reads ?? [], unknown: child.readsComplete === false ? [0, 1, 2, 3] : child.undeterminedReads ?? [] };
      });
      memo.set(callee, evidence); return evidence;
    } catch { return unknown; }
    finally { active.delete(callee); }
  };
  return read;
}

export function targetWitness(callee: string, scratch: string, observe = targetReadObserver(scratch), supplied?: DisassembledInstruction[]): Witness | undefined {
  let instructions: DisassembledInstruction[];
  try {
    instructions = supplied ?? disassembleObject(assembleTarget(callee, scratch));
  } catch {
    return undefined;
  }
  const frame = analyzeFrame(instructions);
  const returnValue = analyzeReturnValue(callee, instructions);
  const readEvidence = observe(callee, instructions);
  const min = Math.max(minimumArity(frame), ...readEvidence.reads!.map((s) => s + 1));
  return {
    kind: "target",
    where: `${callee} (target code)`,
    arity: { min, max: Math.max(min, maximumArity(frame)) },
    ...readEvidence,
    returns: { type: returnValue.type, basis: returnValue.basis },
    notes: returnValue.evidence,
  };
}

/* ------------------------------------------------------------------ */
/* Adjudication                                                        */
/* ------------------------------------------------------------------ */

export type CalleeStatus = "contradicted" | "unread-argument" | "disputed" | "unwitnessed" | "corroborated" | "undeclared";

export interface ParameterWitness {
  /** C parameter index and its incoming ABI word position (not interchangeable). */
  position: number;
  slot: number | null;
  status: "witnessed" | "unread" | "undetermined";
  basis: string;
}

/** Only SDK declarations and target reads witness a parameter. A later read
 * also establishes the earlier slots. Reconstructions cannot witness themselves. */
export function parameterWitnesses(prototype: Prototype, witnesses: Witness[]): ParameterWitness[] {
  const sdk = witnesses.find((w) => w.kind === "sdk")?.prototype;
  const reads = witnesses.find((w) => w.kind === "target")?.reads;
  const lastRead = reads === undefined ? undefined : Math.max(-1, ...reads);
  const slots = prototype.slots ?? Array.from({ length: prototype.parameters ?? 0 }, (_, i) => i);
  return slots.map((slot, position) => {
    if (sdk?.parameters !== null && sdk?.parameters !== undefined && position < sdk.parameters)
      return { position, slot, status: "witnessed", basis: "authoritative SDK header" };
    if (slot === null || lastRead === undefined || sdk?.variadic || prototype.variadic)
      return { position, slot, status: "undetermined", basis: "no target read set, unknown ABI layout or variadic tail" };
    if (slot <= lastRead) return { position, slot, status: "witnessed", basis: reads!.includes(slot) ? "target reads incoming value" : "later target read establishes this slot" };
    const target = witnesses.find((w) => w.kind === "target");
    if (target?.readsComplete === false || target?.undeterminedReads?.some((s) => s >= slot))
      return { position, slot, status: "undetermined", basis: "incomplete target or possible implicit argument forwarding at a call" };
    return { position, slot, status: "unread", basis: "no target read or SDK witness" };
  });
}

export interface UnreadArgument {
  position: number;
  slot: number;
  calls: number;
  material: true;
  message: string;
}

export interface CallerSiteEvidence {
  slot: number;
  set: number;
  total: number;
  incomplete: boolean;
  message: string;
}

export function argumentLocation(slot: number): string {
  return slot < 4 ? `$a${slot}` : `stack slot sp+0x${(slot * 4).toString(16)}`;
}

export interface Contradiction {
  witness: WitnessKind;
  /**
   * Whether the evidence settles it.
   *
   * A proven contradiction changes the code the compiler emits at the call
   * site, so it invalidates every measurement taken under it. An unproven one
   * is a disagreement between reconstructions. An unread parameter is free
   * in the callee, not in a caller passing a value there. A discarded return
   * value, by contrast, need not affect the caller. Materiality is site-local.
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
  parameters: ParameterWitness[];
  unreadArguments: UnreadArgument[];
  hygiene: string[];
  callerSites: CallerSiteEvidence[];
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

  /* Frame evidence counts WORD SLOTS, not C parameters. An unknown by-value
     layout or a variadic tail prevents a finite source-level upper bound. */
  let capacity = declared.parameters;
  if (capacity !== null && declared.slots && declared.paramTypes) {
    if (declared.slots.some((slot) => slot === null)) capacity = null;
    else {
      const positions = incomingSlots([...declared.paramTypes, "int"]);
      capacity = positions[positions.length - 1] ?? null;
    }
  }
  if (witness.arity && !declared.variadic && capacity !== null && capacity < witness.arity.min) {
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

/** Actual arguments in the compiler's preprocessed AST, including macro calls. */
export function callArgumentCounts(source: string, callee: string): number[] {
  const tree = parseC(source);
  try {
    return tree.rootNode.descendantsOfType("call_expression")
      .filter((n) => field(n, "function")?.type === "identifier" && field(n, "function")?.text === callee)
      .map((n) => field(n, "arguments")?.namedChildren.filter((c) => c.type !== "comment").length ?? 0);
  } finally { tree.delete(); }
}

/** Pure site-local adjudication, shared by the audit and synthetic regressions. */
export function adjudicateCallee(callee: string, declared: Prototype | undefined, witnesses: Witness[], source: string): CalleeReport {
  const counts = callArgumentCounts(source, callee);
  const resultUsed = callResultUsed(source, callee);
  const maxCount = Math.max(0, ...counts);
  const callPrototype: Prototype = declared ? { ...declared,
    parameters: Math.max(declared.parameters ?? 0, maxCount),
    paramTypes: [...(declared.paramTypes ?? Array.from({ length: declared.parameters ?? 0 }, () => "int")),
      ...Array.from({ length: Math.max(0, maxCount - (declared.parameters ?? 0)) }, () => "int")],
  } : { name: callee, signature: `${callee}()`, parameters: maxCount, variadic: false,
    returnsVoid: false, kind: "declaration", where: "implicit", line: 0 };
  /* Preserve supplied typedef-aware slots; unknown layouts must stay unknown. */
  if (declared?.slots) {
    const extraSlots = incomingSlots(callPrototype.paramTypes!);
    callPrototype.slots = [...declared.slots, ...extraSlots.slice(declared.slots.length)];
  }
  const parameters = parameterWitnesses(callPrototype, witnesses);
  const unreadArguments = parameters.filter((p) => p.status === "unread" && counts.some((c) => c > p.position))
    .map((p): UnreadArgument => ({ position: p.position, slot: p.slot!, calls: counts.filter((c) => c > p.position).length,
      material: true, message: `this call writes ${argumentLocation(p.slot!)} (argument ${p.position}) that the callee never reads; the original call site may not have. An incoming value may already occupy the register; this is material caller setup, not an arity proof.` }));
  const hygiene: string[] = [];
  for (const prototype of [declared, ...witnesses.filter((w) => w.kind === "definition").map((w) => w.prototype)]) {
    if (!prototype) continue;
    for (const p of parameterWitnesses(prototype, witnesses).filter((p) => p.status === "unread")) {
      if (!counts.some((c) => c > p.position)) hygiene.push(`${prototype.where}:${prototype.line}: parameter ${p.position} (${argumentLocation(p.slot!)}) is unread; no call here passes it`);
    }
  }
  const contradictions = declared ? witnesses.flatMap((witness) => {
    const found = contradictionsAgainst(declared, witness, resultUsed);
    /* A longer reconstruction's unread tail cannot contradict a shorter,
       witnessed interface. Keep return disagreements and all SDK conflicts. */
    if (witness.kind !== "definition" || !witness.prototype || declared.parameters === null || witness.prototype.parameters === null) return found;
    const longer = declared.parameters > witness.prototype.parameters ? declared : witness.prototype;
    const shorter = Math.min(declared.parameters, witness.prototype.parameters);
    const tail = parameterWitnesses(longer, witnesses).slice(shorter);
    return tail.length && tail.every((p) => p.status === "unread")
      ? found.filter((c) => !c.message.startsWith("declared with")) : found;
  }) : [];
  const status: CalleeStatus = contradictions.some((c) => c.proven) ? "contradicted"
    : unreadArguments.length ? "unread-argument"
      : !declared ? "undeclared"
        : contradictions.length ? "disputed"
          : witnesses.some((w) => w.prototype) &&
            (witnesses.some((w) => w.kind === "sdk" && w.prototype?.variadic) ||
             parameters.filter((p) => counts.some((c) => c > p.position)).every((p) => p.status === "witnessed"))
            ? "corroborated" : "unwitnessed";
  return { callee, ...(declared ? { declared } : {}), witnesses, contradictions, resultUsed,
    parameters, unreadArguments, hygiene: [...new Set(hygiene)], callerSites: [], status };
}

/** Same-block writes, delay slot included. This is a heuristic, not reaching
 * definitions: a register may already hold its value at block entry. */
export function callSiteWrites(insns: DecodedInsn[], target: number, slot: number): boolean[] {
  const cfg = buildCfg(insns);
  return insns.flatMap((insn, index) => {
    if (insn.op !== "jal" || insn.target !== target) return [];
    const block = cfg.blocks[cfg.blockOf[index]!];
    const before = block?.instructions.filter((i) => i <= index + 1) ?? [];
    return [before.some((i) => slot < 4 ? definedRegister(insns[i]!) === slot + 4
      : ["sw", "sh", "sb", "swl", "swr"].includes(insns[i]!.op) && insns[i]!.rs === 29 && insns[i]!.simm === slot * 4)];
  });
}

/** All configured containers, from original bytes rather than a stale worklist. */
function callerSiteObserver(): (callee: string, slots: number[]) => CallerSiteEvidence[] {
  const index = originalIndex(Number.MAX_SAFE_INTEGER);
  const images = new Map<string, Buffer>();
  return (callee, slots) => {
    const target = [...index.nodes.values()].find((n) => n.name === callee);
    if (!target) return [];
    const sites: DecodedInsn[][] = [];
    for (const id of index.incoming.get(target.id) ?? []) {
      const caller = index.nodes.get(id)!;
      const path = containerTargetPath(caller.container);
      let image = images.get(path);
      if (!image) { image = readFileSync(path); images.set(path, image); }
      const rom = vramToRom(caller.container, caller.span.vram);
      const words = decodeBytes(image.subarray(rom, rom + caller.span.size), caller.span.vram);
      /* Overlay RAM addresses collide. The index resolves in caller scope. */
      sites.push(words.map((w) => w.op === "jal" && index.resolve(caller.container.id, w.target!) !== target.id ? { ...w, target: 0 } : w));
    }
    return slots.map((slot) => {
      const writes = sites.flatMap((s) => callSiteWrites(s, target.span.vram, slot));
      const set = writes.filter(Boolean).length, total = writes.length;
      return { slot, set, total, incomplete: !index.complete,
        message: `${set} of ${total} target call sites set ${argumentLocation(slot)} in the call's block (delay slot included). Heuristic, never proof: a value can already be in the register at block entry.${index.complete ? "" : " Container coverage incomplete."}` };
    });
  };
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

interface AuditEvidence {
  sdk?: Map<string, Prototype>;
  definition?: typeof definitionPrototype;
  target?: (callee: string) => Witness | undefined;
  callerSites?: ReturnType<typeof callerSiteObserver>;
}

export function auditCallees(name: string, sourcePath: string, scratch: string, evidence: AuditEvidence = {}): TruthReport {
  const targetInstructions = disassembleObject(assembleTarget(name, scratch));
  const { direct, indirect } = calleesOf(targetInstructions);

  const preprocessed = preprocessOnly(sourcePath, scratch, `${name}.scope`);
  const { source, lineOf } = scopeFromPreprocessed(readFileSync(preprocessed, "utf-8"));
  const inScope = new Map<string, Prototype>();
  for (const prototype of prototypesIn(source, displayPath(sourcePath), lineOf)) {
    /* A later declaration of the same name is a redeclaration, not a second
     * function; the first one is what the earliest call site saw. */
    if (!inScope.has(prototype.name)) inScope.set(prototype.name, prototype);
  }

  const sdk = evidence.sdk ?? sdkPrototypes();
  const callees: CalleeReport[] = [];
  const readTarget = targetReadObserver(scratch);
  let observer: ReturnType<typeof callerSiteObserver> | undefined;
  const callerEvidence = evidence.callerSites ?? ((callee: string, slots: number[]) => (observer ??= callerSiteObserver())(callee, slots));

  for (const callee of direct) {
    if (callee === name) continue;
    const declared = inScope.get(callee);
    const witnesses: Witness[] = [];

    const fromSdk = sdk.get(callee);
    if (fromSdk) witnesses.push({ kind: "sdk", where: fromSdk.where, prototype: fromSdk });

    const fromDefinition = (evidence.definition ?? definitionPrototype)(callee);
    if (fromDefinition && fromDefinition.where !== displayPath(sourcePath)) {
      witnesses.push({ kind: "definition", where: fromDefinition.where, prototype: fromDefinition });
    }

    const fromTarget = evidence.target ? evidence.target(callee) : targetWitness(callee, scratch, readTarget);
    if (fromTarget) witnesses.push({ ...fromTarget, callee });

    const item = adjudicateCallee(callee, declared, witnesses, source);
    if (item.unreadArguments.length || item.hygiene.length) {
      try { item.callerSites = callerEvidence(callee, [...new Set([...item.parameters,
        ...witnesses.filter((w) => w.kind === "definition" && w.prototype).flatMap((w) => parameterWitnesses(w.prototype!, witnesses))]
        .filter((p) => p.status === "unread").map((p) => p.slot!))]); }
      catch (error) { item.hygiene.push(`Caller-site census unavailable: ${String(error)}`); }
    }
    callees.push(item);
  }

  return { function: name, source: displayPath(sourcePath), callees, indirectCalls: indirect };
}

export interface DefinitionAudit {
  matched: number;
  definitions: Array<{ function: string; prototype: Prototype; reads: number[]; trailingUnread: ParameterWitness[]; callerSites: CallerSiteEvidence[] }>;
  callerFindings: Array<{ function: string; source: string; callee: CalleeReport }>;
  unknowns: Array<{ function: string; reason: string }>;
}

/** Census does not edit definitions. A byte match admits a reconstruction;
 * it never witnesses an unread parameter. Caller dependencies must be tested
 * before removing a tail, and match-only-with-tail evidence must be retained. */
export function auditDefinitions(scratch: string, auditCallers = false,
  progress?: (processed: number, total: number, report: DefinitionAudit) => void): DefinitionAudit {
  const index = originalIndex(Number.MAX_SAFE_INTEGER), sdk = sdkPrototypes();
  const observe = callerSiteObserver();
  /* One immutable census view. Reuse each target/definition across its callers,
     never cache by symbol across interactive source edits or separate audits. */
  const instructions = new Map<string, DisassembledInstruction[]>();
  const load = (name: string) => {
    let value = instructions.get(name);
    if (!value) { value = disassembleObject(assembleTarget(name, scratch)); instructions.set(name, value); }
    return value;
  };
  const readTarget = targetReadObserver(scratch, load, sdk);
  const targets = new Map<string, Witness | undefined>(), definitions = new Map<string, Prototype | undefined>();
  const evidence: AuditEvidence = { sdk, callerSites: observe,
    target: (name) => {
      if (!targets.has(name)) {
        try { targets.set(name, targetWitness(name, scratch, readTarget, load(name))); }
        catch { targets.set(name, undefined); }
      }
      return targets.get(name);
    },
    definition: (name) => {
      if (!definitions.has(name)) definitions.set(name, definitionPrototype(name));
      return definitions.get(name);
    },
  };
  const report: DefinitionAudit = { matched: 0, definitions: [], callerFindings: [], unknowns: [] };
  const nodes = [...index.nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  let processed = 0;
  for (const node of nodes) {
    progress?.(processed++, nodes.length, report);
    const source = sourcePathFor(node.name);
    if (!existsSync(source) || !definesFunction(readFileSync(source, "utf8"), node.name)) continue;
    try {
      const scope = scopeFromPreprocessed(effectiveSource(source));
      const prototype = prototypesIn(scope.source, displayPath(source), scope.lineOf).find((p) => p.kind === "definition" && p.name === node.name);
      if (!prototype) continue; /* disabled attempts and stubs are not definitions */
      const artifact = compileSource(source, join(scratch, node.name), node.name, { assemble: true, containerKind: node.container.kind });
      const verdict = compareFunction(node.name, { objectPath: artifact.object!, container: node.container });
      if (verdict.verdict !== "match") { report.unknowns.push({ function: node.name, reason: `definition is not matched: ${verdict.verdict}` }); continue; }
      report.matched++;
      const target = evidence.target!(node.name);
      if (target?.reads === undefined) { report.unknowns.push({ function: node.name, reason: "target read set unavailable" }); continue; }
      const witnesses: Witness[] = [target, ...(sdk.has(node.name) ? [{ kind: "sdk" as const, where: sdk.get(node.name)!.where, prototype: sdk.get(node.name)! }] : [])];
      const parameters = parameterWitnesses(prototype, witnesses);
      let start = parameters.length;
      while (start && parameters[start - 1]!.status === "unread") start--;
      const trailingUnread = parameters.slice(start);
      if (trailingUnread.length) report.definitions.push({ function: node.name, prototype, reads: target.reads, trailingUnread,
        callerSites: observe(node.name, trailingUnread.map((p) => p.slot!)) });
      if (auditCallers) {
        const truth = auditCallees(node.name, source, scratch, evidence);
        for (const callee of truth.callees.filter((c) => c.status === "unread-argument"))
          report.callerFindings.push({ function: node.name, source: truth.source, callee });
      }
    } catch (error) { report.unknowns.push({ function: node.name, reason: String(error) }); }
  }
  progress?.(nodes.length, nodes.length, report);
  return report;
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
  return `target: ${witness.where} — ${arity}, ${returns}` +
    (witness.reads === undefined ? "" : `; read set [${witness.reads.join(", ")}]`) +
    (witness.readsComplete === false ? "; incomplete target: unreadness undetermined" : "") +
    (witness.undeterminedReads?.length ? `; possible forwarded slots [${witness.undeterminedReads.join(", ")}] (undetermined)` : "");
}

export function renderTruthReport(report: TruthReport): string {
  const lines: string[] = [];
  const of = (status: CalleeStatus) => report.callees.filter((item) => item.status === status);
  const contradicted = of("contradicted");
  const disputed = of("disputed");
  const unread = of("unread-argument");
  const unwitnessed = of("unwitnessed");
  const undeclared = of("undeclared");

  lines.push(
    `callee truth ${report.function} — ${report.callees.length} direct callee(s) from ${report.source}` +
    (report.indirectCalls > 0 ? `, ${report.indirectCalls} indirect call site(s) not covered here` : ""),
  );
  lines.push(
    `  ${contradicted.length} contradicted, ${unread.length} unread-argument, ${disputed.length} disputed, ${undeclared.length} undeclared, ` +
    `${unwitnessed.length} unwitnessed, ${of("corroborated").length} corroborated`,
  );

  for (const item of report.callees) {
    if (item.status === "corroborated" && !item.hygiene.length) continue;
    lines.push("", `[${item.status}] ${item.callee}`);
    lines.push(
      `  in scope: ${item.declared ? item.declared.signature : "(none — C89 implicit int)"}` +
      (item.declared ? `   from ${item.declared.where}:${item.declared.line}` : ""),
    );
    for (const witness of item.witnesses) lines.push(`  ${describeWitness(witness)}`);
    for (const argument of item.unreadArguments) lines.push(`  !! MATERIAL: ${argument.message}`);
    for (const note of item.hygiene) lines.push(`  hygiene: ${note}`);
    for (const site of item.callerSites) lines.push(`  heuristic: ${site.message}`);
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
      "?? A disputed arity can be free in the callee, but costs the caller whenever it passes",
      "   the extra argument. Check actual call sites before treating a disagreement as hygiene.",
      "   An unread-argument finding is material, not corroboration of two copies of one guess.",
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
  if (args.includes("--audit-definitions")) {
    if (positional.length || srcFlag >= 0) throw new Error("--audit-definitions does not accept a function or --src");
    const scratch = join(ROOT, "build/calleeTruth/census");
    mkdirSync(scratch, { recursive: true });
    let lastProgress = 0;
    const report = auditDefinitions(scratch, args.includes("--audit-callers"), (processed, total, partial) => {
      if (Date.now() - lastProgress < 5000 && processed < total) return;
      lastProgress = Date.now();
      console.error(`callee census ${processed}/${total}: ${partial.matched} matched, ${partial.definitions.length} unread tails, ${partial.callerFindings.length} material caller findings, ${partial.unknowns.length} unknowns`);
    });
    console.log(json ? JSON.stringify(report, null, 2) : [
      `${report.matched} matched definitions; ${report.definitions.length} unread tails; ${report.callerFindings.length} material caller findings; ${report.unknowns.length} unknowns`,
      ...report.definitions.map((d) => `${d.function}: reads [${d.reads.join(", ")}], unread trailing parameters [${d.trailingUnread.map((p) => p.position).join(", ")}]`),
      ...report.callerFindings.map((f) => `${f.function} -> ${f.callee.callee}: unread-argument`),
      ...report.unknowns.map((u) => `unknown ${u.function}: ${u.reason}`),
    ].join("\n"));
    return;
  }
  if (positional.length !== 1 || (srcFlag >= 0 && !srcOverride)) {
    console.error("Usage: npx tsx tools/agent/calleeTruth.ts <func_name> [--src <path.c>] [--json]\n       calleeTruth.ts --audit-definitions [--audit-callers] [--json]");
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
