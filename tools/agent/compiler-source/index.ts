/**
 * Index of a vendored compiler source tree (tools/vendor/gcc/<version>).
 *
 * Which version is project configuration, read from the Makefile's
 * GCC_VERSION — the same variable the build compiles with — so the source
 * being read and the compiler that produced the dumps cannot drift apart.
 *
 * This is the source cc1 is built from, so it is the authority on every
 * pass-level question the project asks. The index exists to make it queryable
 * without either grepping 470 files by hand or trusting a remembered table.
 *
 * Soundness rules, because an answer from here gets cited in research notes:
 *
 *  - The tree hash in pin.json is verified before anything is indexed. A
 *    drifted tree refuses rather than answering.
 *  - C is parsed with the project's tree-sitter front end, never with regexes.
 *    The hand-rolled scanner this project used to run silently shaped derived
 *    domains for weeks (see the residual-source-search README); a definition
 *    index built the same way would be wrong in the same invisible way.
 *  - Every file that fails to parse is recorded by name. "No results" and
 *    "not indexed" are different answers and the CLI prints which one it is.
 *  - Nothing is inferred. The dump-suffix -> pass map is read out of
 *    toplev.c's own open_dump_file call sites; there is no hardcoded table.
 */

import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";
import { ROOT, configuredGccVersion } from "../decompToolchain.js";
import { parseC, namedChildren, field, declaratorName, walk, type Node } from "../residual-source-search/tree-sitter-c.js";

/** Vendored trees live one per version, keyed by the Makefile's GCC_VERSION. */
export const VENDOR_ROOT = join(ROOT, "tools/vendor/gcc");
const CACHE_DIR = join(ROOT, "build/compilerSource");

export function vendoredVersions(): string[] {
  if (!existsSync(VENDOR_ROOT)) return [];
  return readdirSync(VENDOR_ROOT)
    .filter((entry) => existsSync(join(VENDOR_ROOT, entry, "pin.json")))
    .sort();
}

/**
 * Resolve which vendored tree to read. Default is whatever the project is
 * configured to compile with, so the source and the compiler cannot drift
 * apart silently; an explicit version is for cross-version questions ("does
 * 2.8.1 even have gcse.c?"), which the research notes have needed.
 */
export function resolveVersion(requested?: string): string {
  const version = requested ?? configuredGccVersion();
  if (existsSync(join(VENDOR_ROOT, version, "pin.json"))) return version;
  const available = vendoredVersions();
  throw new Error(
    `No vendored source for GCC ${version} at tools/vendor/gcc/${version}. ` +
    (available.length
      ? `Vendored: ${available.join(", ")}. `
      : "Nothing is vendored yet. ") +
    (requested
      ? "Pass a vendored version, or vendor this one (see any pin.json for the recipe)."
      : `The Makefile's GCC_VERSION is ${version}; vendor that version or change GCC_VERSION.`),
  );
}

export function vendorDir(version?: string): string {
  return join(VENDOR_ROOT, resolveVersion(version));
}

export function sourceDir(version?: string): string {
  return join(vendorDir(version), "src");
}

export interface Pin {
  name: string;
  correspondsTo: { binary: string; recipe: string; target: string };
  upstream: { url: string; sha256: string };
  tree: { root: string; sha256: string; algorithm: string; files: number };
  included: string[];
  excluded: string[];
  exclusionRisk: string;
}

export type DefinitionKind =
  | "function" | "macro" | "variable" | "prototype"
  | "typedef" | "struct" | "union" | "enum";

export interface Definition {
  name: string;
  kind: DefinitionKind;
  file: string;
  /** 1-based inclusive line range of the whole definition. */
  line: number;
  endLine: number;
  /** Byte range, so `body` can print the exact text without re-parsing. */
  start: number;
  end: number;
}

/** A define_insn / define_expand / … from a machine description. */
export interface MachinePattern {
  name: string;
  form: string;
  file: string;
  line: number;
  endLine: number;
  start: number;
  end: number;
}

/**
 * One `open_dump_file (".suffix", …)` site in toplev.c, with its context.
 *
 * The RTL is written by the matching `close_dump_file`, not by the open, so
 * a dump shows the state *after* everything between the two. `writtenAfter`
 * is that span; `stateEntering` is what ran just before the open, which is
 * what a dump whose block contains only dump helpers (`.lreg`) is showing.
 * Both are read from the source — the three dump shapes in toplev.c do not
 * share a syntactic pattern, so neither is inferred from one of them.
 */
export interface DumpPass {
  suffix: string;
  file: string;
  line: number;
  closeLine?: number;
  /** Conditions of every enclosing `if`, outermost first. */
  guards: string[];
  writtenAfter: Array<{ name: string; line: number }>;
  stateEntering: Array<{ name: string; line: number }>;
}

export interface FileHealth {
  file: string;
  parsed: boolean;
  errorNodes: number;
}

export interface CompilerSourceIndex {
  /** The GCC version this index describes; every query carries it forward. */
  version: string;
  treeSha256: string;
  definitions: Definition[];
  patterns: MachinePattern[];
  dumpPasses: DumpPass[];
  health: FileHealth[];
  fileCount: number;
}

/* ------------------------------------------------------------------ */
/* Tree identity                                                       */
/* ------------------------------------------------------------------ */

export function loadPin(version?: string): Pin {
  return JSON.parse(readFileSync(join(vendorDir(version), "pin.json"), "utf8")) as Pin;
}

/** Every regular file under src/, as paths relative to src/, C-sorted. */
export function treeFiles(version?: string): string[] {
  const root = sourceDir(version);
  const out: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) visit(full);
      else out.push(relative(root, full).split(sep).join("/"));
    }
  };
  visit(root);
  return out.sort();
}

/**
 * pin.json's algorithm, reimplemented exactly: sha256 over C-sorted lines of
 * "<file sha256>  <path relative to src>\n".
 */
export function treeHash(version?: string): string {
  const root = sourceDir(version);
  const outer = createHash("sha256");
  for (const file of treeFiles(version)) {
    const digest = createHash("sha256").update(readFileSync(join(root, file))).digest("hex");
    outer.update(`${digest}  ${file}\n`);
  }
  return outer.digest("hex");
}

export interface VerifyResult {
  version: string;
  ok: boolean;
  expected: string;
  actual: string;
  files: number;
  expectedFiles: number;
}

export function verifyTree(version?: string): VerifyResult {
  const resolved = resolveVersion(version);
  const pin = loadPin(resolved);
  const actual = treeHash(resolved);
  const files = treeFiles(resolved).length;
  return {
    version: resolved,
    ok: actual === pin.tree.sha256 && files === pin.tree.files,
    expected: pin.tree.sha256,
    actual,
    files,
    expectedFiles: pin.tree.files,
  };
}

/* ------------------------------------------------------------------ */
/* C definitions                                                       */
/* ------------------------------------------------------------------ */

const IDENTIFIER_TYPES = new Set(["identifier", "field_identifier", "type_identifier"]);

function countErrors(root: Node): number {
  let errors = 0;
  walk(root, (node) => {
    if (node.type === "ERROR" || node.isMissing) errors++;
    return true;
  });
  return errors;
}

function record(
  into: Definition[],
  name: string | undefined,
  kind: DefinitionKind,
  file: string,
  node: Node,
): void {
  if (!name) return;
  into.push({
    name,
    kind,
    file,
    line: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    start: node.startIndex,
    end: node.endIndex,
  });
}

/** Tag name of a struct/union/enum specifier, when it has one. */
function taggedSpecifier(node: Node): { kind: DefinitionKind; name: string } | undefined {
  const map: Record<string, DefinitionKind> = {
    struct_specifier: "struct",
    union_specifier: "union",
    enum_specifier: "enum",
  };
  const kind = map[node.type];
  if (!kind) return undefined;
  const name = field(node, "name");
  /* A specifier with no body is a reference, not a definition. */
  if (!name || !field(node, "body")) return undefined;
  return { kind, name: name.text };
}

function collectDeclaration(into: Definition[], file: string, node: Node): void {
  const isTypedef = children(node).some((child) => child.type === "storage_class_specifier" && child.text === "typedef");
  for (const child of namedChildren(node)) {
    const tagged = taggedSpecifier(child);
    if (tagged) record(into, tagged.name, tagged.kind, file, node);
    if (child.type !== "init_declarator" && !child.type.endsWith("declarator") && child.type !== "identifier") continue;
    const declarator = child.type === "init_declarator" ? field(child, "declarator") ?? child : child;
    const name = declaratorName(declarator)?.text;
    if (!name) continue;
    if (isTypedef) record(into, name, "typedef", file, node);
    else if (declarator.type === "function_declarator" || hasFunctionDeclarator(declarator)) {
      record(into, name, "prototype", file, node);
    } else record(into, name, "variable", file, node);
  }
}

function children(node: Node): Node[] {
  const out: Node[] = [];
  for (let index = 0; index < node.childCount; index++) {
    const child = node.child(index);
    if (child) out.push(child);
  }
  return out;
}

function hasFunctionDeclarator(node: Node | undefined): boolean {
  let current = node;
  while (current) {
    if (current.type === "function_declarator") return true;
    const next = field(current, "declarator");
    if (!next || next.id === current.id) return false;
    current = next;
  }
  return false;
}

/** Top-level forms, descending through preprocessor conditionals. */
function collectTopLevel(into: Definition[], file: string, node: Node): void {
  for (const child of namedChildren(node)) {
    switch (child.type) {
      case "function_definition": {
        const name = declaratorName(field(child, "declarator"))?.text;
        record(into, name, "function", file, child);
        break;
      }
      case "declaration":
        collectDeclaration(into, file, child);
        break;
      case "type_definition": {
        for (const declarator of namedChildren(child)) {
          const tagged = taggedSpecifier(declarator);
          if (tagged) record(into, tagged.name, tagged.kind, file, child);
        }
        const name = declaratorName(field(child, "declarator"))?.text;
        record(into, name, "typedef", file, child);
        break;
      }
      case "preproc_def":
      case "preproc_function_def":
        record(into, field(child, "name")?.text, "macro", file, child);
        break;
      /* GCC wraps large regions in #ifdef; those still contain definitions. */
      case "preproc_if":
      case "preproc_ifdef":
      case "preproc_else":
      case "preproc_elif":
        collectTopLevel(into, file, child);
        break;
      default:
        break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Machine descriptions (.md) — Lisp-shaped, scanned with paren matching */
/* ------------------------------------------------------------------ */

const MD_FORMS = [
  "define_insn", "define_expand", "define_split", "define_peephole",
  "define_attr", "define_function_unit", "define_delay", "define_insn_and_split",
  "define_asm_attributes", "define_cond_exec",
];

/**
 * Exact for this grammar: balance parentheses while skipping string literals
 * (with escapes) and `;` line comments, which is all the syntax .md uses.
 */
export function scanMachineDescription(text: string, file: string): MachinePattern[] {
  const out: MachinePattern[] = [];
  const lineOf = (offset: number): number => {
    let line = 1;
    for (let index = 0; index < offset; index++) if (text.charCodeAt(index) === 10) line++;
    return line;
  };
  for (const form of MD_FORMS) {
    const opener = new RegExp(`\\(${form}\\b`, "g");
    let match: RegExpExecArray | null;
    while ((match = opener.exec(text)) !== null) {
      const start = match.index;
      let depth = 0;
      let index = start;
      let inString = false;
      for (; index < text.length; index++) {
        const ch = text[index]!;
        if (inString) {
          if (ch === "\\") index++;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') { inString = true; continue; }
        if (ch === ";") { while (index < text.length && text[index] !== "\n") index++; continue; }
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      const end = Math.min(index + 1, text.length);
      const head = text.slice(start + match[0].length, Math.min(end, start + 400));
      const named = head.match(/^\s*"((?:[^"\\]|\\.)*)"/);
      const name = named?.[1] ?? "";
      out.push({
        name,
        form,
        file,
        line: lineOf(start),
        endLine: lineOf(end),
        start,
        end,
      });
    }
  }
  return out.sort((left, right) => left.start - right.start);
}

/* ------------------------------------------------------------------ */
/* Dump suffix -> pass, read out of toplev.c                           */
/* ------------------------------------------------------------------ */

const DUMP_PLUMBING = new Set([
  "open_dump_file", "close_dump_file", "print_rtl", "print_rtl_graph_with_bb",
  "clean_dump_file", "finish_graph_dump_file", "clean_graph_dump_file",
  "fflush", "fprintf", "dump_base_name", "IDENTIFIER_POINTER", "DECL_NAME",
  "decl_printable_name", "TIMEVAR",
]);

function enclosingGuards(node: Node): string[] {
  const guards: string[] = [];
  let current: Node | null = node.parent;
  while (current) {
    if (current.type === "if_statement") {
      const condition = current.childForFieldName("condition");
      if (condition) guards.push(condition.text.replace(/\s+/g, " ").replace(/^\(|\)$/g, ""));
    }
    current = current.parent;
  }
  return guards.reverse();
}

interface CallSite { name: string; line: number }

/** Every non-plumbing call in a subtree, in source order. TIMEVAR's payload is
 *  a plain sub-expression, so unwrapping it costs nothing. */
function callSites(region: Node): CallSite[] {
  const out: CallSite[] = [];
  walk(region, (node) => {
    if (node.type !== "call_expression") return true;
    const callee = node.childForFieldName("function");
    if (!callee || !IDENTIFIER_TYPES.has(callee.type)) return true;
    const name = callee.text;
    if (!DUMP_PLUMBING.has(name) && !name.startsWith("dump_")) {
      out.push({ name, line: callee.startPosition.row + 1 });
    }
    return true;
  });
  return out.sort((left, right) => left.line - right.line);
}

function enclosingFunction(node: Node): Node | undefined {
  let current: Node | null = node.parent;
  while (current) {
    if (current.type === "function_definition") return current;
    current = current.parent;
  }
  return undefined;
}

export function collectDumpPasses(source: string, file: string): DumpPass[] {
  const tree = parseC(source);
  const passes: DumpPass[] = [];
  const closes: number[] = [];
  walk(tree.rootNode, (node) => {
    if (node.type !== "call_expression") return true;
    const callee = node.childForFieldName("function");
    if (callee?.text === "close_dump_file") closes.push(callee.startPosition.row + 1);
    return true;
  });
  closes.sort((left, right) => left - right);

  walk(tree.rootNode, (node) => {
    if (node.type !== "call_expression") return true;
    const callee = node.childForFieldName("function");
    if (!callee || callee.text !== "open_dump_file") return true;
    const args = node.childForFieldName("arguments");
    const first = args ? namedChildren(args)[0] : undefined;
    const literal = first?.text.match(/^"\.([A-Za-z0-9_]+)"$/);
    if (!literal) return true;

    const line = node.startPosition.row + 1;
    const closeLine = closes.find((candidate) => candidate > line);
    const owner = enclosingFunction(node);
    const all = owner ? callSites(owner) : [];
    passes.push({
      suffix: literal[1]!,
      file,
      line,
      ...(closeLine !== undefined ? { closeLine } : {}),
      guards: enclosingGuards(node),
      writtenAfter: closeLine === undefined
        ? []
        : all.filter((call) => call.line > line && call.line < closeLine),
      stateEntering: all.filter((call) => call.line < line).slice(-3),
    });
    return true;
  });
  return passes;
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

const C_EXTENSIONS = [".c", ".h"];

export function buildIndex(version?: string): CompilerSourceIndex {
  const verify = verifyTree(version);
  if (!verify.ok) {
    throw new Error(
      `Vendored GCC ${verify.version} source drift: tree hashes ${verify.actual} over ${verify.files} files, ` +
      `pin.json expects ${verify.expected} over ${verify.expectedFiles}. ` +
      "Answers from a drifted tree would be cited as if they came from the compiler that built src/. Refusing.",
    );
  }
  const resolved = verify.version;
  const root = sourceDir(resolved);

  const definitions: Definition[] = [];
  const patterns: MachinePattern[] = [];
  const health: FileHealth[] = [];
  let dumpPasses: DumpPass[] = [];
  const files = treeFiles(resolved);

  for (const file of files) {
    const dot = file.lastIndexOf(".");
    const extension = dot < 0 ? "" : file.slice(dot);
    const absolute = join(root, file);
    if (extension === ".md") {
      patterns.push(...scanMachineDescription(readFileSync(absolute, "utf8"), file));
      continue;
    }
    if (!C_EXTENSIONS.includes(extension)) continue;
    const source = readFileSync(absolute, "utf8");
    let errorNodes = 0;
    try {
      const tree = parseC(source);
      errorNodes = countErrors(tree.rootNode);
      const before = definitions.length;
      collectTopLevel(definitions, file, tree.rootNode);
      /* `static int f PROTO ((rtx));` is a prototype wearing a macro. The
       * grammar cannot parse the macro call, so the declaration node ends at
       * the identifier and lands as a variable. The macro is unambiguous, so
       * read forward to the statement terminator and correct the kind. */
      for (let index = before; index < definitions.length; index++) {
        const definition = definitions[index]!;
        if (definition.kind !== "variable") continue;
        const terminator = source.indexOf(";", definition.start);
        const statement = source.slice(definition.start, terminator < 0 ? definition.end : terminator);
        if (/\b(?:PROTO|VPROTO|PARAMS)\s*\(/.test(statement)) {
          definitions[index] = { ...definition, kind: "prototype" };
        }
      }
      health.push({ file, parsed: true, errorNodes });
      if (file === "gcc/toplev.c") dumpPasses = collectDumpPasses(source, file);
    } catch {
      health.push({ file, parsed: false, errorNodes: 0 });
    }
  }

  return {
    version: resolved,
    treeSha256: verify.actual,
    definitions,
    patterns,
    dumpPasses,
    health,
    fileCount: files.length,
  };
}

/** Build once per tree hash; the hash is the cache key, so drift cannot hit. */
export function loadIndex(version?: string, refresh = false): CompilerSourceIndex {
  const resolved = resolveVersion(version);
  const pin = loadPin(resolved);
  const cache = join(CACHE_DIR, `index-${resolved}-${pin.tree.sha256}.json`);
  if (!refresh && existsSync(cache)) {
    const cached = JSON.parse(readFileSync(cache, "utf8")) as CompilerSourceIndex;
    if (cached.treeSha256 === pin.tree.sha256 && cached.version === resolved) return cached;
  }
  const index = buildIndex(resolved);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cache, JSON.stringify(index));
  return index;
}
