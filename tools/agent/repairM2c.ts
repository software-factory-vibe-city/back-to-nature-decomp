/**
 * repairM2c.ts — m2c-repair layer, via tree-sitter AST (not regex).
 *
 * Takes m2c's draft for one function and repairs it against **recovered
 * context** — parameters, call signatures, globals and field geometry derived
 * from the target's own words by `matching-reconstruction/context-product.ts`.
 *
 * Two defects this replaces:
 *
 *   1. It read and wrote `src/<function>.c`. Every overlay function lives in
 *      `src/overlays/<id>/`, so every overlay invocation reported "source not
 *      found" for a source that exists. Paths now come from the container
 *      model, which is the same answer the build uses.
 *   2. It obtained "engine context" by parsing a winning or best-effort C
 *      string. That made the analysis available only when construction had
 *      already succeeded — exactly backwards, since a failed construction is
 *      when the draft most needs repairing. Context now comes from the
 *      context product, which exists for every function whose words decode.
 *
 * Four passes, each reporting what it changed and on what evidence:
 *
 *   1. Extern declarations for `D_XXXXXXXX` globals m2c references but nothing
 *      declares; conflicting m2c guesses for header-declared symbols dropped.
 *   2. `?` unknown-type markers replaced — with `void *` where the recovered
 *      context *proves* that parameter is dereferenced, `s32` otherwise.
 *   3. Callee-signature reconciliation: a prototype in the draft whose arity
 *      or return disagrees with a proved or declared signature is replaced,
 *      and a called function with a recovered signature and no declaration in
 *      scope gets one.
 *   4. Recovered view types for object bases with witnessed field geometry.
 *
 * What it deliberately does not do: rewrite pointer *uses*. m2c's casts at
 * the use sites are usually already correct, and rewriting an integer
 * parameter into a pointer changes the meaning of every arithmetic expression
 * that reads it. Where the evidence says a declaration is wrong but the repair
 * is not safe, the report says so rather than guessing.
 *
 * Usage:
 *   npx tsx tools/agent/repairM2c.ts <functionName> [--write] [--compile]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, compileSource, preprocessOnly, sourcePathFor } from "./decompToolchain.js";
import { requireFunctionLocation } from "../lib/symbolIndex.js";
import { compareFunction } from "../lib/functionOracle.js";
import { children, parseC, field, namedChildren, declaratorName, walk, type Node } from "./residual-source-search/tree-sitter-c.js";
import {
  calleePrototypes,
  recoverContext,
  type RecoveredContext,
} from "./matching-reconstruction/context-product.js";

/**
 * Every global name the project's generated headers already put in scope.
 *
 * m2c's output includes "common.h", which pulls in globals.h and
 * globals_override.h, so any name those provide is in scope when the draft is
 * compiled — and m2c's own guessed `extern` for the same symbol is a
 * *conflict*, not a fix.
 *
 * Three spellings count, and missing any one of them makes the repair insert a
 * duplicate that breaks a translation unit that compiled before:
 *
 *   - an ordinary declaration whose declarator is the symbol;
 *   - an object-like `#define` of the symbol — the override header's standard
 *     shape is `extern s32 _D_X[3] __asm__("D_X"); #define D_X (*(s32*)_D_X)`,
 *     where nothing is *declared* under the symbol's own name at all;
 *   - an `__asm__("name")` assembler-name binding, which is what makes such a
 *     declaration resolve to the symbol.
 *
 * Read from the AST, never from a regular expression over the text, so a
 * mention inside a comment is not a declaration.
 */
let projectGlobalsCache: Set<string> | undefined;
const GLOBAL_NAME = /^D_[0-9A-Fa-f]{8}$/;

function projectDeclaredGlobals(): Set<string> {
  if (projectGlobalsCache) return projectGlobalsCache;
  const declared = new Set<string>();
  for (const rel of ["include/globals.h", "include/globals_override.h"]) {
    const path = join(ROOT, rel);
    if (!existsSync(path)) continue;
    let tree;
    try { tree = parseC(readFileSync(path, "utf-8")); } catch { continue; }
    everyChild(tree.rootNode, (node) => {
      if (node.type === "preproc_def" || node.type === "preproc_function_def") {
        const name = field(node, "name") ?? children(node).find((child) => child.type === "identifier");
        if (name && GLOBAL_NAME.test(name.text)) declared.add(name.text);
        return;
      }
      if (node.type === "gnu_asm_expression") {
        /* `extern s32 _D_X[3] __asm__("D_X");` — the assembler name, not the
         * declarator, is what the linker resolves, so it is the name in scope. */
        const literal = children(node).find((child) => child.type === "string_literal");
        const content = literal ? children(literal).find((child) => child.type === "string_content") : undefined;
        if (content && GLOBAL_NAME.test(content.text)) declared.add(content.text);
        return;
      }
      if (node.type !== "declaration") return;
      for (const d of namedChildren(node)) {
        const nameNode = declaratorName(d);
        if (nameNode && GLOBAL_NAME.test(nameNode.text)) declared.add(nameNode.text);
      }
    });
  }
  projectGlobalsCache = declared;
  return declared;
}

/**
 * Type names this translation unit can actually see.
 *
 * A repair that writes a recovered signature must not name a type the unit
 * does not include: the reconciled prototype `void CopyVec3(Vec3 *, Vec3 *)`
 * is the *correct* signature and still fails to compile in a draft that
 * includes only `common.h`, because `Vec3` lives in the SDK headers. Scope is
 * read from the preprocessed text — the only sound answer to "what is
 * declared here", since a scan of headers on disk answers a different
 * question.
 *
 * When a recovered type is out of scope the prototype is left alone and the
 * report says which type is missing. Substituting `s32` would compile and be
 * wrong, which is the failure mode this whole layer exists to stop.
 */
const BUILTIN_TYPES = new Set([
  "void", "char", "short", "int", "long", "float", "double", "signed", "unsigned",
  "s8", "u8", "s16", "u16", "s32", "u32", "vs8", "vu8", "vs16", "vu16", "vs32", "vu32",
]);

function typesInScope(sourcePath: string, functionName: string): Set<string> | null {
  const scope = new Set(BUILTIN_TYPES);
  try {
    const outDir = join(ROOT, "build", "m2cRepair", functionName);
    mkdirSync(outDir, { recursive: true });
    const preprocessed = preprocessOnly(sourcePath, outDir, `${functionName}.scope`);
    const tree = parseC(readFileSync(preprocessed, "utf-8"));
    walk(tree.rootNode, (node) => {
      if (node.type === "type_definition") {
        for (const declarator of node.childrenForFieldName("declarator")) {
          const name = declaratorName(declarator ?? undefined);
          if (name) scope.add(name.text);
        }
        return true;
      }
      if (node.type === "struct_specifier" || node.type === "union_specifier" || node.type === "enum_specifier") {
        const name = field(node, "name");
        if (name) scope.add(name.text);
      }
      return true;
    });
    return scope;
  } catch {
    return null;
  }
}

/** Every identifier a type expression names, so scope can be checked. */
function typeNamesOf(type: string): string[] {
  return type
    .replace(/[*\[\]()]/g, " ")
    .split(/\s+/)
    .filter((token) => /^[A-Za-z_]\w*$/.test(token));
}

/** One repair, with the evidence tier it rests on. */
export interface RepairNote {
  pass: 1 | 2 | 3 | 4;
  /** `proved` when the target's words settle it; `default` when nothing did. */
  basis: "proved" | "declared" | "default" | "conflict" | "observation";
  message: string;
}

export interface M2cRepair {
  originalSource: string;
  repairedSource: string;
  repairs: string[];
  notes: RepairNote[];
  /** Present when the recovered-context product could not be derived. */
  contextError?: string;
}

/* ---- helpers --------------------------------------------------------------- */

/** Every child, anonymous tokens included — needed to see ERROR and MISSING. */
function everyChild(node: Node, visit: (item: Node) => void): void {
  visit(node);
  for (const child of children(node)) everyChild(child, visit);
}

/**
 * Extern types the recovered context can justify for a `D_XXXXXXXX` symbol.
 *
 * The width the machine loaded a cell at is real evidence about the cell; it
 * is not evidence about the whole object, so the type names the cell and
 * nothing larger. An address the context saw at several widths is left to the
 * scalar default rather than picking one.
 */
function contextGlobalTypes(context: RecoveredContext | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!context) return map;
  const widths = new Map<string, Set<string>>();
  for (const global of context.globals) {
    if (!global.symbol || global.offset) continue;
    const type = global.width === 4 ? (global.signed ? "s32" : "u32")
      : global.width === 2 ? (global.signed ? "s16" : "u16")
      : (global.signed ? "s8" : "u8");
    widths.set(global.symbol, (widths.get(global.symbol) ?? new Set()).add(type));
  }
  for (const [symbol, types] of widths) {
    if (types.size === 1) map.set(symbol, [...types][0]!);
  }
  return map;
}

/* ---- repair passes -------------------------------------------------------- */

/**
 * Pass 1 — Insert missing extern declarations for D_XXXXXXXX globals.
 *
 * Walks the AST for identifier references that look like D_XXXXXXXX and
 * checks whether each is declared (extern, parameter, local, or typedef).
 * Undeclared ones get an `extern` line inserted.
 */
function passUndeclaredGlobals(
  source: string,
  context: RecoveredContext | null,
  notes: RepairNote[],
): { source: string; repairs: string[] } {
  const repairs: string[] = [];
  const lines = source.split("\n");

  /* Already repaired? Skip. */
  if (lines.some((l) => l.includes("repair: added extern") || l.includes("repair: removed extern"))) {
    return { source, repairs: ["already repaired — skipping pass 1"] };
  }

  const recovered = contextGlobalTypes(context);
  const projectDeclared = projectDeclaredGlobals();

  let tree;
  try { tree = parseC(source); } catch {
    return { source, repairs: ["parse failed — cannot AST-scan for undeclared globals"] };
  }

  /* m2c's own `extern D_XXXX;` lines. A symbol the project header also
   * declares is a CONFLICT (m2c guessed a type; the header has the real one) —
   * drop m2c's line and let common.h provide it. A symbol only m2c declares is
   * kept. */
  const m2cDeclared = new Set<string>();
  const dropRows = new Set<number>();
  everyChild(tree.rootNode, (node) => {
    if (node.type !== "declaration") return;
    if (!(node.firstChild?.type === "storage_class_specifier" && node.firstChild.text === "extern")) return;
    for (const d of namedChildren(node)) {
      const nameNode = declaratorName(d);
      if (!nameNode || !/^D_[0-9A-Fa-f]{8}$/.test(nameNode.text)) continue;
      m2cDeclared.add(nameNode.text);
      if (projectDeclared.has(nameNode.text)) {
        for (let r = node.startPosition.row; r <= node.endPosition.row; r++) dropRows.add(r);
        repairs.push(`removed extern for ${nameNode.text} — conflicts with project header declaration`);
        notes.push({ pass: 1, basis: "conflict", message: `${nameNode.text} is declared by the project headers` });
      }
    }
  });

  /* D_XXXX symbols referenced (not in a declaration context). */
  const globalRefs = new Set<string>();
  everyChild(tree.rootNode, (node) => {
    if (node.type !== "identifier" || !/^D_[0-9A-Fa-f]{8}$/.test(node.text)) return;
    const parent = node.parent;
    if (parent && (parent.type === "declaration" || parent.type === "parameter_declaration" ||
        parent.type === "init_declarator" || parent.type === "field_declaration")) return;
    globalRefs.add(node.text);
  });

  /* Add a declaration only for a symbol NEITHER m2c nor the project headers
   * declare. The recovered context's witnessed access width is preferred;
   * otherwise a scalar (`s32`), never `u8[]`: m2c uses these as scalars
   * (`sym = 0`), and an array type makes that assignment a hard error. */
  const toInsert: string[] = [];
  for (const sym of [...globalRefs].sort()) {
    if (projectDeclared.has(sym) || m2cDeclared.has(sym)) continue;
    const type = recovered.get(sym);
    if (type) {
      toInsert.push(`extern ${type} ${sym};`);
      repairs.push(`added extern for ${sym} (witnessed access width: ${type})`);
      notes.push({ pass: 1, basis: "proved", message: `${sym} is accessed at one width in the target` });
    } else {
      toInsert.push(`extern s32 ${sym};`);
      repairs.push(`added extern for ${sym} (scalar default: s32)`);
      notes.push({ pass: 1, basis: "default", message: `${sym} has no single witnessed width` });
    }
  }

  if (dropRows.size === 0 && toInsert.length === 0) return { source, repairs };

  const newLines = lines.filter((_, i) => !dropRows.has(i));
  if (toInsert.length > 0) {
    const insertAt = afterIncludes(newLines);
    newLines.splice(insertAt, 0, "", "/* ---- repair: added extern declarations ---- */", ...toInsert, "");
    repairs.push(`inserted ${toInsert.length} extern(s) after line ${insertAt}`);
  }
  return { source: newLines.join("\n"), repairs };
}

/** The line after the source's leading `#include` block. */
function afterIncludes(lines: string[]): number {
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!.trimStart();
    if (text.startsWith("#include")) { insertAt = i + 1; continue; }
    if (text === "") continue;
    break;
  }
  return insertAt;
}

/**
 * Pass 2 — Replace `?` type markers.
 *
 * tree-sitter cannot parse `?` as a type, so it produces ERROR or MISSING
 * nodes at the position. A marker at a parameter position whose index the
 * recovered context proves is dereferenced becomes `void *`; everything else
 * falls back to `s32`, and the report says which of the two happened.
 */
function passUnknownTypes(
  source: string,
  context: RecoveredContext | null,
  notes: RepairNote[],
): { source: string; repairs: string[] } {
  const repairs: string[] = [];
  let tree;
  try { tree = parseC(source); } catch {
    return { source, repairs: ["parse failed — cannot AST-scan for unknown types"] };
  }

  const pointerParameters = new Set(
    (context?.parameters ?? []).filter((parameter) => parameter.usedAsPointerBase).map((parameter) => parameter.index),
  );

  /* Collect replacement sites: line:col positions where an ERROR/MISSING
   * node contains `?`. */
  const sites: Array<{ line: number; col: number; length: number; replacement: string }> = [];

  everyChild(tree.rootNode, (node) => {
    if (node.type !== "ERROR" && !node.isMissing) return;
    const text = node.text;
    if (!text.includes("?")) return;
    const idx = text.indexOf("?");
    /* A `?` inside the function's own parameter list maps to an ABI position;
     * anywhere else there is no index to consult and the default applies. */
    const position = parameterPositionOf(node);
    const isPointer = position !== undefined && pointerParameters.has(position);
    const replacement = isPointer ? "void *" : "s32";
    sites.push({ line: node.startPosition.row, col: node.startPosition.column + idx, length: 1, replacement });
    repairs.push(
      `? marker at line ${node.startPosition.row + 1}, col ${idx} — replacing with ${replacement.trim()}` +
      (isPointer ? ` (parameter ${position} is dereferenced in the target)` : ""),
    );
    notes.push({
      pass: 2,
      basis: isPointer ? "proved" : "default",
      message: isPointer
        ? `parameter ${position} is a pointer: the target dereferences $a${position}`
        : `no evidence for the type at line ${node.startPosition.row + 1}; defaulted to s32`,
    });
  });

  if (sites.length === 0) return { source, repairs };

  /* Apply replacements in reverse order (so offsets don't shift). */
  const lines = source.split("\n");
  let text = source;
  for (const site of sites.sort((a, b) => (b.line - a.line) || (b.col - a.col))) {
    const lineStart = lines.slice(0, site.line).join("\n").length + (site.line > 0 ? 1 : 0);
    const pos = lineStart + site.col;
    text = text.slice(0, pos) + site.replacement + text.slice(pos + site.length);
  }

  return { source: text, repairs };
}

/**
 * The ABI position of a parameter an ERROR node sits inside, if any.
 *
 * Walks up to the enclosing `parameter_list` and counts the parameters before
 * this one. Returns undefined when the node is not in a parameter list, which
 * is the ordinary case for a local declaration.
 */
function parameterPositionOf(node: Node): number | undefined {
  let current: Node | null = node;
  let child: Node | null = null;
  while (current) {
    if (current.type === "parameter_list") {
      const parameters = namedChildren(current).filter((item) => item.type === "parameter_declaration" || item.type === "ERROR");
      const index = parameters.findIndex((item) => item.startIndex <= (child ?? node).startIndex && (child ?? node).endIndex <= item.endIndex);
      return index >= 0 ? index : undefined;
    }
    child = current;
    current = current.parent;
  }
  return undefined;
}

/**
 * Pass 3 — Callee-signature reconciliation.
 *
 * Two repairs, both from the context product's resolved signatures:
 *
 *   - a prototype already in the draft whose arity or return disagrees with a
 *     `proved` (matched definition) or `declared` (SDK) signature is replaced
 *     by the recovered one;
 *   - a callee with a recovered signature that nothing in the draft declares
 *     gets a prototype inserted, because an undeclared callee is C89
 *     implicit-int and defines `$v0` even when nothing reads it.
 *
 * A signature whose only evidence is this caller's own argument setup is
 * *reported*, never written: the plan's rule is that a caller's lack of setup
 * does not narrow a callee's proved lower bound.
 */
function passCalleeSignatures(
  source: string,
  context: RecoveredContext | null,
  scope: Set<string> | null,
  notes: RepairNote[],
): { source: string; repairs: string[] } {
  if (!context) return { source, repairs: ["no recovered context — skipping callee reconciliation"] };
  const repairs: string[] = [];

  let tree;
  try { tree = parseC(source); } catch {
    return { source, repairs: ["parse failed — cannot AST-scan for callee prototypes"] };
  }

  /* Callees the draft actually calls, and the prototypes it already carries. */
  const called = new Set<string>();
  const declaredHere = new Map<string, Node>();
  walk(tree.rootNode, (node) => {
    if (node.type === "call_expression") {
      const target = field(node, "function");
      if (target && target.type === "identifier") called.add(target.text);
    }
    if (node.type === "declaration") {
      for (const declarator of namedChildren(node)) {
        let core = declarator;
        while (core.type === "pointer_declarator") {
          const inner = field(core, "declarator");
          if (!inner) break;
          core = inner;
        }
        if (core.type !== "function_declarator") continue;
        const nameNode = field(core, "declarator");
        if (nameNode?.type === "identifier") declaredHere.set(nameNode.text, node);
      }
    }
    return true;
  });

  const prototypes = new Map<string, string>();
  for (const line of calleePrototypes(context)) {
    const name = line.match(/([A-Za-z_]\w*)\s*\(/)?.[1];
    if (name) prototypes.set(name, line);
  }

  const replacements: Array<{ node: Node; text: string }> = [];
  const toInsert: string[] = [];
  for (const call of context.calls) {
    if (!call.signature) {
      if (call.range && called.has(call.callee)) {
        repairs.push(
          `${call.callee}: arity is bounded to ${call.range.arityLo}..${call.range.arityHi} by caller evidence — not written`,
        );
        notes.push({
          pass: 3,
          basis: "observation",
          message: `${call.callee} has no proved signature; a caller's lack of setup does not narrow its lower bound`,
        });
      }
      continue;
    }
    if (call.signature.strength !== "proved" && call.signature.strength !== "declared") continue;
    const prototype = prototypes.get(call.callee);
    if (!prototype) continue;
    /* Only write a prototype whose every type name this unit can see. */
    const unseen = scope
      ? [...new Set(call.signature.paramTypes.concat(call.signature.returnType).flatMap(typeNamesOf))]
        .filter((name) => !scope.has(name))
      : [];
    if (unseen.length > 0) {
      repairs.push(
        `${call.callee}: recovered signature names ${unseen.join(", ")}, which this unit does not include — prototype left alone`,
      );
      notes.push({
        pass: 3,
        basis: "observation",
        message: `${call.callee}: ${prototype} — needs ${unseen.join(", ")} in scope`,
      });
      continue;
    }
    const existing = declaredHere.get(call.callee);
    if (existing) {
      if (normalizeDeclaration(existing.text) === normalizeDeclaration(prototype)) continue;
      replacements.push({ node: existing, text: prototype });
      repairs.push(`replaced the draft's prototype for ${call.callee} with the ${call.signature.strength} signature`);
      notes.push({ pass: 3, basis: call.signature.strength, message: `${call.callee}: ${prototype}` });
      continue;
    }
    if (!called.has(call.callee)) continue;
    toInsert.push(prototype);
    repairs.push(`declared ${call.callee} from its ${call.signature.strength} signature`);
    notes.push({ pass: 3, basis: call.signature.strength, message: `${call.callee}: ${prototype}` });
  }

  let text = source;
  for (const replacement of replacements.sort((a, b) => b.node.startIndex - a.node.startIndex)) {
    text = text.slice(0, replacement.node.startIndex) + replacement.text + text.slice(replacement.node.endIndex);
  }
  if (toInsert.length > 0) {
    const lines = text.split("\n");
    const insertAt = afterIncludes(lines);
    lines.splice(insertAt, 0, "", "/* ---- repair: recovered callee signatures ---- */", ...toInsert, "");
    text = lines.join("\n");
  }
  return { source: text, repairs };
}

/** Collapse whitespace so two spellings of one declaration compare equal. */
function normalizeDeclaration(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s*([(),;*])\s*/g, "$1").trim();
}

/**
 * Pass 4 — Recovered view types.
 *
 * An object base with witnessed field geometry becomes a commented record of
 * that geometry, so the next reader (human or agent) sees the offsets, widths
 * and minimum extent the target proves without re-deriving them. It is a
 * comment, not a struct: asserting a layout from a handful of accesses is the
 * standalone-array mistake, and the extent is a floor, not a size.
 */
function passViewTypes(
  source: string,
  context: RecoveredContext | null,
  notes: RepairNote[],
): { source: string; repairs: string[] } {
  if (!context || context.objects.length === 0) return { source, repairs: [] };
  if (source.includes("repair: witnessed field geometry")) return { source, repairs: ["geometry block already present"] };

  const block: string[] = ["", "/* ---- repair: witnessed field geometry (minimum extents; not a layout claim) ----"];
  for (const object of context.objects) {
    if (object.origin === "stack" || object.fields.length === 0) continue;
    block.push(` * ${object.base} (${object.origin}), at least 0x${object.minimumExtent.toString(16)} bytes:`);
    for (const item of object.fields) {
      block.push(
        ` *   +0x${item.offset.toString(16).padStart(2, "0")}  ${item.width}B ${item.signed ? "signed" : "unsigned"} ${item.access}` +
        `${item.indexScale ? `  index stride ${item.indexScale}` : ""}`,
      );
    }
  }
  if (block.length <= 2) return { source, repairs: [] };
  block.push(" */", "");

  const lines = source.split("\n");
  lines.splice(afterIncludes(lines), 0, ...block);
  notes.push({ pass: 4, basis: "proved", message: `${context.objects.length} object base(s) with witnessed geometry` });
  return { source: lines.join("\n"), repairs: [`recorded field geometry for ${context.objects.length} object base(s)`] };
}

/* ---- main repair ---------------------------------------------------------- */

export function repairM2c(functionName: string): M2cRepair {
  /* Container-aware: an overlay function's source is not under `src/`. */
  const srcPath = sourcePathFor(functionName);
  if (!existsSync(srcPath)) {
    return { originalSource: "", repairedSource: "", repairs: [`source not found: ${srcPath}`], notes: [] };
  }

  const originalSource = readFileSync(srcPath, "utf-8");
  const repairs: string[] = [];
  const notes: RepairNote[] = [];

  /* Recovered context is derived from the target, so it exists whether or not
   * any constructor produced compilable C. */
  let context: RecoveredContext | null = null;
  let contextError: string | undefined;
  try {
    context = recoverContext(functionName);
  } catch (error) {
    contextError = error instanceof Error ? error.message : String(error);
    repairs.push(`recovered context unavailable: ${contextError}`);
  }

  const scope = typesInScope(srcPath, functionName);
  if (!scope) repairs.push("could not preprocess the draft — type scope unknown; signature rewriting is disabled");

  const p1 = passUndeclaredGlobals(originalSource, context, notes);
  repairs.push(...p1.repairs);

  const p2 = passUnknownTypes(p1.source, context, notes);
  repairs.push(...p2.repairs);

  const p3 = passCalleeSignatures(p2.source, context, scope, notes);
  repairs.push(...p3.repairs);

  const p4 = passViewTypes(p3.source, context, notes);
  repairs.push(...p4.repairs);

  return {
    originalSource,
    repairedSource: p4.source,
    repairs,
    notes,
    ...(contextError ? { contextError } : {}),
  };
}

export function compileAndCompareRepaired(
  functionName: string,
  repairedSource: string,
): { verdict: string; matchedWords: number; totalWords: number; error?: string } {
  try {
    const location = requireFunctionLocation(functionName);
    const container = location.container;

    const outDir = join(ROOT, "build", "m2cRepair", functionName);
    mkdirSync(outDir, { recursive: true });
    const srcPath = join(outDir, `${functionName}.c`);
    writeFileSync(srcPath, repairedSource);

    /* The effective build, overrides included: a repair measured under a
     * different flag column is measuring a different translation unit. */
    const artifacts = compileSource(srcPath, join(outDir, "compiled"), functionName, {
      assemble: true,
      containerKind: container.kind,
    });

    if (!artifacts.object) {
      return { verdict: "error", matchedWords: 0, totalWords: 0, error: "no object file" };
    }

    const oracle = compareFunction(functionName, { objectPath: artifacts.object, container });
    const total = Math.max(oracle.targetWords.length, oracle.candidateWords.length);
    return { verdict: oracle.verdict, matchedWords: oracle.same, totalWords: total };
  } catch (error) {
    return { verdict: "error", matchedWords: 0, totalWords: 0, error: (error instanceof Error ? error.message : String(error)).slice(0, 500) };
  }
}

/* ---- CLI ------------------------------------------------------------------ */

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("usage: npx tsx tools/agent/repairM2c.ts <functionName> [--write] [--compile]");
    process.exit(1);
  }

  const functionName = args[0]!;
  const shouldWrite = args.includes("--write");
  const shouldCompile = args.includes("--compile");

  const result = repairM2c(functionName);
  console.log(`=== ${functionName}: m2c repair report ===`);
  console.log();

  if (result.originalSource === "") {
    console.error(result.repairs.join("\n"));
    process.exit(2);
  }

  for (const r of result.repairs) console.log(`  ${r}`);

  if (result.originalSource !== result.repairedSource) {
    const orig = result.originalSource.split("\n");
    const next = result.repairedSource.split("\n");
    let changed = 0;
    for (let i = 0; i < Math.max(orig.length, next.length); i++) {
      if (orig[i] !== next[i]) changed++;
    }
    console.log(`  ${changed} line(s) changed`);
  } else {
    console.log("  no changes needed");
  }

  const defaulted = result.notes.filter((note) => note.basis === "default");
  if (defaulted.length > 0) {
    console.log();
    console.log(`  ${defaulted.length} repair(s) rest on a default, not on evidence:`);
    for (const note of defaulted) console.log(`    pass ${note.pass}: ${note.message}`);
  }
  console.log();

  if (shouldWrite && result.repairedSource !== result.originalSource) {
    const dst = sourcePathFor(functionName);
    writeFileSync(dst, result.repairedSource);
    console.log(`  wrote to ${dst}`);
  }

  if (shouldCompile && result.repairedSource !== "") {
    const comp = compileAndCompareRepaired(functionName, result.repairedSource);
    if (comp.error) console.log(`  COMPILE ERROR: ${comp.error}`);
    else console.log(`  VERDICT: ${comp.verdict} (${comp.matchedWords}/${comp.totalWords})`);
  }
}

if (process.argv[1]?.endsWith("repairM2c.ts")) main();
