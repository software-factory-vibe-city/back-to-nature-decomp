/**
 * sdkTypes.ts — Harvest C type definitions for the m2c context.
 *
 * `include/functions.h` publishes signatures for every matched function. Those
 * signatures name types, and m2c parses the context as one plain-C scope with
 * no preprocessor, so every named type must be defined in that scope or the
 * whole context fails to parse and m2c refuses *every* function.
 *
 * The type set the signatures draw on is open; a hand-maintained list of
 * definitions is closed. This module closes the gap by resolving type names
 * against the vendored SDK headers and the project's own sources, so the
 * definitions follow the signatures automatically.
 *
 * Parsing is done with the repository's pinned tree-sitter C grammar. A regex
 * cannot see nesting, comments, or the difference between a declared name and
 * the underlying type it aliases.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseC, walk, children, field, isTrivia, subtreeIsBroken, type Node } from "./residual-source-search/tree-sitter-c.js";

/**
 * Emitted verbatim at the top of the generated type header. These are the
 * project's scalar aliases; they are excluded from resolution so that a
 * harvested definition of the same name cannot be emitted a second time and
 * turn the context into a redefinition error.
 */
export const PREAMBLE_TYPES: ReadonlyMap<string, string> = new Map([
  ["u8", "typedef unsigned char u8;"],
  ["u16", "typedef unsigned short u16;"],
  ["u32", "typedef unsigned int u32;"],
  ["s8", "typedef signed char s8;"],
  ["s16", "typedef signed short s16;"],
  ["s32", "typedef signed int s32;"],
]);

/**
 * Generated m2c context headers. They are never harvested: they contain this
 * module's own output, so re-ingesting them lets a placeholder emitted once
 * shadow the real definition forever, with no visible symptom.
 */
export const GENERATED_CONTEXT_HEADERS: readonly string[] = ["functions.h", "sdk_types.h"];

/** Names tree-sitter reports as types that are C keywords, not typedefs. */
const KEYWORD_TYPES = new Set([
  "void", "char", "short", "int", "long", "float", "double",
  "signed", "unsigned", "const", "volatile", "struct", "union", "enum",
]);

/* ------------------------------------------------------------------ */
/* Harvest                                                             */
/* ------------------------------------------------------------------ */

/**
 * Every type name appearing in a type position within `source`.
 *
 * Type positions only: a parameter's *name* is an `identifier`, while its type
 * is a `type_identifier`, so this does not mistake `arg0` for a type.
 */
export function typeNamesIn(source: string): Set<string> {
  const names = new Set<string>();
  let tree;
  try {
    tree = parseC(source);
  } catch {
    return names;
  }
  walk(tree.rootNode, (node) => {
    if (node.type === "type_identifier" && !KEYWORD_TYPES.has(node.text)) {
      names.add(node.text);
    }
    return true;
  });
  return names;
}

/** The name(s) a `type_definition` node declares. */
function declaredNames(node: Node): string[] {
  const names: string[] = [];
  /* The declared name lives in the `declarator` field. Reading any named
   * child instead would also pick up the `type` field — the underlying type
   * being aliased — and register a definition under the wrong name. */
  for (const declarator of node.childrenForFieldName("declarator")) {
    if (!declarator) continue;
    const id = declarator.type === "type_identifier"
      ? declarator
      : declarator.descendantsOfType("type_identifier")[0];
    if (id) names.push(id.text);
  }
  return names;
}

/**
 * Collect the typedefs in one translation unit into `into`.
 * An existing entry is never overwritten, so callers control precedence by
 * harvest order.
 */
export function collectTypedefs(source: string, into: Map<string, string>): void {
  let tree;
  try {
    tree = parseC(source);
  } catch {
    return;
  }
  walk(tree.rootNode, (node) => {
    if (node.type !== "type_definition") return true;
    /* A definition that did not parse cleanly would be emitted truncated,
     * which is worse than falling through to the unresolved backstop. */
    if (subtreeIsBroken(node)) return false;
    for (const name of declaredNames(node)) {
      if (!into.has(name)) into.set(name, node.text);
    }
    return false;
  });
}

/** All `.h` files under `dir`, recursively. */
function headersUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...headersUnder(path));
    else if (entry.endsWith(".h")) out.push(path);
  }
  return out;
}

/**
 * Every typedef reachable from the project sources and the vendored SDK.
 *
 * Project definitions are harvested first and win name collisions: where the
 * project has its own view of a type, that view is the one the decompiled
 * sources were written against.
 */
export function harvestTypedefs(rootDir: string): Map<string, string> {
  const defs = new Map<string, string>();
  const srcDir = join(rootDir, "src");
  const includeDir = join(rootDir, "include");

  const inputs: string[] = [];
  if (existsSync(srcDir)) {
    inputs.push(...readdirSync(srcDir).sort().filter((f) => f.endsWith(".c")).map((f) => join(srcDir, f)));
  }
  if (existsSync(includeDir)) {
    inputs.push(...readdirSync(includeDir).sort()
      .filter((f) => f.endsWith(".h") && !GENERATED_CONTEXT_HEADERS.includes(f))
      .map((f) => join(includeDir, f)));
  }
  inputs.push(...headersUnder(join(includeDir, "psyq")));

  for (const path of inputs) {
    /* The vendored SDK headers are CRLF; the generated context is LF. */
    collectTypedefs(readFileSync(path, "utf-8").replace(/\r\n/g, "\n"), defs);
  }
  return defs;
}

/* ------------------------------------------------------------------ */
/* Signatures                                                          */
/* ------------------------------------------------------------------ */

export interface ExtractedSignature {
  /** The declared function name, used as the publication key. */
  name: string;
  /** A prototype, normalized to one line and terminated with a semicolon. */
  signature: string;
}

/** Collapse whitespace and drop comments, which carry no meaning in a prototype. */
function flatten(node: Node): string {
  const tokens: string[] = [];
  /* Every child, not just the named ones: commas and parentheses are
   * anonymous nodes, and a traversal that skips them silently reassembles
   * `(a, b)` as `(a b)`. */
  const collect = (item: Node): void => {
    if (isTrivia(item)) return;
    const kids = children(item);
    if (kids.length === 0) {
      tokens.push(item.text);
      return;
    }
    for (const kid of kids) collect(kid);
  };
  collect(node);

  /* Punctuation reads naturally without the spaces a token join inserts. */
  return tokens
    .join(" ")
    .replace(/\s+([,)\];])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .replace(/\*\s+/g, "*")
    /* Bind a declarator to what follows it: `(*cb) (int)` and `grid [4]` are
     * one construct each. Narrow on purpose — a blanket rule would also close
     * up `void (*cb)`, where the space is conventional. */
    .replace(/\)\s+\(/g, ")(")
    .replace(/\s+\[/g, "[")
    .trim();
}

/** Strip the pointer layers off a declarator, returning the count and the core. */
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

/** Build a prototype from a declaration's type and declarator nodes. */
function signatureFrom(returnType: Node, declarator: Node): ExtractedSignature | undefined {
  /* Brokenness is checked on the declaration alone, never on a whole function
   * definition. Bodies legitimately carry constructs the grammar rejects —
   * `register s32 x asm("$16")` pinning, for one — and the signature is fully
   * determined without ever descending into the body. */
  if (subtreeIsBroken(returnType) || subtreeIsBroken(declarator)) return undefined;

  const { stars, core } = unwrapPointers(declarator);
  if (core.type !== "function_declarator") return undefined;

  const nameNode = field(core, "declarator");
  const params = field(core, "parameters");
  if (!nameNode || !params) return undefined;
  /* Anything other than a plain identifier here is a function returning a
   * function pointer, which has no place in this project's signatures. */
  if (nameNode.type !== "identifier") return undefined;

  const inner = flatten(params).replace(/^\(/, "").replace(/\)$/, "").trim();
  return {
    name: nameNode.text,
    signature:
      `${flatten(returnType)}${stars > 0 ? ` ${"*".repeat(stars)}` : ""} ` +
      `${nameNode.text}(${inner === "" ? "void" : inner});`,
  };
}

/**
 * Every function *definition* in a translation unit, as a prototype.
 *
 * Reconstructed from the parse tree rather than matched with a regex: a
 * pattern for the parameter list cannot balance the parentheses of a function
 * pointer parameter, and cannot tell a comment containing `)` from the real
 * end of the list. Both cases made the old extractor silently publish nothing
 * for the whole file, which is invisible until the missing prototype degrades
 * some caller's decompilation.
 */
export function extractSignaturesFromSource(source: string): ExtractedSignature[] {
  const found: ExtractedSignature[] = [];
  let tree;
  try {
    tree = parseC(source);
  } catch {
    return found;
  }

  walk(tree.rootNode, (node) => {
    if (node.type !== "function_definition") return true;
    const returnType = field(node, "type");
    const declarator = field(node, "declarator");
    if (!returnType || !declarator) return false;
    const extracted = signatureFrom(returnType, declarator);
    if (extracted) found.push(extracted);
    /* Do not descend: a nested definition is not valid C89 here. */
    return false;
  });

  return found;
}

/**
 * Every function *prototype* declared in a translation unit.
 *
 * Reading back what this module emits has to be at least as capable as the
 * emitter, or a signature it can write becomes one it cannot re-read — which
 * drops that function's prototype on the next incremental export.
 */
export function extractPrototypesFromSource(source: string): ExtractedSignature[] {
  const found: ExtractedSignature[] = [];
  let tree;
  try {
    tree = parseC(source);
  } catch {
    return found;
  }

  walk(tree.rootNode, (node) => {
    if (node.type === "function_definition") return false;
    if (node.type !== "declaration") return true;
    const returnType = field(node, "type");
    if (!returnType) return false;
    for (const declarator of node.childrenForFieldName("declarator")) {
      if (!declarator) continue;
      const extracted = signatureFrom(returnType, declarator);
      if (extracted) found.push(extracted);
    }
    return false;
  });

  return found;
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

export interface Resolution {
  /** Definitions to emit, dependencies first. */
  ordered: string[];
  /** Referenced names with no definition anywhere. Callers must back these up. */
  unresolved: string[];
}

/**
 * Close `referenced` over its dependencies and order it for emission.
 *
 * Dependency edges come from the type positions inside each definition, so
 * `TILE` is not treated as a dependency of `TILE_1` merely because its name
 * is a substring.
 */
export function resolveTypes(referenced: Iterable<string>, defs: Map<string, string>): Resolution {
  const needed = new Set<string>();
  const unresolved = new Set<string>();
  const depsOf = new Map<string, Set<string>>();

  const queue = [...referenced].filter((name) => !PREAMBLE_TYPES.has(name));
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (needed.has(name) || unresolved.has(name)) continue;

    const def = defs.get(name);
    if (def === undefined) {
      unresolved.add(name);
      continue;
    }
    needed.add(name);

    const deps = new Set<string>();
    for (const dep of typeNamesIn(def)) {
      if (dep === name || PREAMBLE_TYPES.has(dep)) continue;
      deps.add(dep);
      queue.push(dep);
    }
    depsOf.set(name, deps);
  }

  /* Dependency-first order, alphabetical for deterministic tie-breaking.
   * A cycle is only reachable through pointer members, which C resolves via
   * the struct tag rather than emission order, so breaking it here is safe. */
  const ordered: string[] = [];
  const done = new Set<string>();
  const active = new Set<string>();
  const visit = (name: string): void => {
    if (done.has(name) || active.has(name)) return;
    active.add(name);
    for (const dep of [...(depsOf.get(name) ?? [])].sort()) {
      if (needed.has(dep)) visit(dep);
    }
    active.delete(name);
    done.add(name);
    ordered.push(name);
  };
  for (const name of [...needed].sort()) visit(name);

  return { ordered, unresolved: [...unresolved].sort() };
}

/**
 * Render the generated type header.
 *
 * `unresolved` names get an opaque placeholder so the context still parses.
 * A placeholder is a fidelity gap — its layout is a guess — and callers are
 * expected to warn about every one.
 */
export function renderSdkTypesHeader(resolution: Resolution, defs: Map<string, string>): string {
  const lines = [
    "/* Auto-generated by tools/agent/contextExport.ts — do not edit manually */",
    "/* m2c context only: type definitions for include/functions.h.",
    " * Must be passed to m2c *before* functions.h; see tools/agent/m2cFunc.ts. */",
    "",
    ...PREAMBLE_TYPES.values(),
    "",
  ];

  for (const name of resolution.ordered) {
    lines.push(defs.get(name)!, "");
  }

  if (resolution.unresolved.length > 0) {
    lines.push("/* Unresolved: referenced by a signature, defined nowhere.");
    lines.push(" * Layout is a guess — these are placeholders, not definitions. */");
    for (const name of resolution.unresolved) {
      lines.push(`typedef struct { unsigned long pad[1]; } ${name};`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
