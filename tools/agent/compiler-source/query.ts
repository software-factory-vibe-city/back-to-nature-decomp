/**
 * Queries over the vendored compiler source index.
 *
 * Every query reports how it found what it found, so a result can be cited and
 * a non-result can be told apart from an unindexed one.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sourceDir, type CompilerSourceIndex, type Definition, type MachinePattern, type DumpPass } from "./index.js";
import { parseC, namedChildren, walk, type Node } from "../residual-source-search/tree-sitter-c.js";

/** Read a file out of one version's vendored tree. */
export function readSource(version: string, file: string): string {
  return readFileSync(join(sourceDir(version), file), "utf8");
}

/** The exact text of a definition, from its recorded byte range. */
export function definitionText(index: CompilerSourceIndex, definition: Definition): string {
  return readSource(index.version, definition.file).slice(definition.start, definition.end);
}

export function patternText(index: CompilerSourceIndex, pattern: MachinePattern): string {
  return readSource(index.version, pattern.file).slice(pattern.start, pattern.end);
}

/* ------------------------------------------------------------------ */

export function findDefinitions(index: CompilerSourceIndex, name: string): Definition[] {
  const order: Record<string, number> = {
    function: 0, macro: 1, variable: 2, typedef: 3, struct: 4, union: 5, enum: 6, prototype: 7,
  };
  return index.definitions
    .filter((definition) => definition.name === name)
    .sort((left, right) => (order[left.kind]! - order[right.kind]!) || left.file.localeCompare(right.file));
}

export function findPatterns(index: CompilerSourceIndex, name: string): MachinePattern[] {
  return index.patterns.filter((pattern) => pattern.name === name);
}

export function findDumpPass(index: CompilerSourceIndex, suffix: string): DumpPass[] {
  const wanted = suffix.replace(/^\./, "");
  return index.dumpPasses.filter((pass) => pass.suffix === wanted);
}

/* ------------------------------------------------------------------ */
/* References                                                          */
/* ------------------------------------------------------------------ */

export type ReferenceContext = "code" | "macro-body";

export interface Reference {
  file: string;
  line: number;
  context: ReferenceContext;
  text: string;
}

/**
 * Identifier occurrences, comments and string literals excluded by
 * construction — they are separate node types and never reach the match.
 *
 * Macro bodies are a second pass: tree-sitter keeps a `#define`'s replacement
 * list as one raw `preproc_arg` token, so identifiers inside it are not
 * identifier nodes. They are scanned lexically and labelled `macro-body`,
 * rather than being silently absent.
 */
export function referencesIn(source: string, file: string, name: string): Reference[] {
  const out: Reference[] = [];
  const lines = source.split("\n");
  const tree = parseC(source);
  const wordwise = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);

  walk(tree.rootNode, (node: Node) => {
    if (node.type === "comment") return false;
    if (node.type === "identifier" || node.type === "field_identifier" || node.type === "type_identifier") {
      if (node.text === name) {
        const line = node.startPosition.row + 1;
        out.push({ file, line, context: "code", text: (lines[line - 1] ?? "").trim() });
      }
      return false;
    }
    if (node.type === "preproc_arg" || node.type === "preproc_params") {
      const body = node.text;
      if (!wordwise.test(body)) return false;
      const base = node.startPosition.row;
      body.split("\n").forEach((text, offset) => {
        if (!wordwise.test(text)) return;
        const line = base + offset + 1;
        out.push({ file, line, context: "macro-body", text: (lines[line - 1] ?? "").trim() });
      });
      return false;
    }
    return true;
  });
  return out;
}

export function references(index: CompilerSourceIndex, name: string): Reference[] {
  const out: Reference[] = [];
  for (const health of index.health) {
    if (!health.parsed) continue;
    const source = readSource(index.version, health.file);
    if (!source.includes(name)) continue;
    out.push(...referencesIn(source, health.file, name));
  }
  return out.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
}

/* ------------------------------------------------------------------ */
/* Scoped regex search                                                 */
/* ------------------------------------------------------------------ */

export interface GrepHit {
  file: string;
  line: number;
  text: string;
}

export function grep(index: CompilerSourceIndex, pattern: RegExp, files?: string[]): GrepHit[] {
  const out: GrepHit[] = [];
  const scope = files ?? index.health.map((entry) => entry.file);
  for (const file of scope) {
    const source = readSource(index.version, file);
    source.split("\n").forEach((text, offset) => {
      pattern.lastIndex = 0;
      if (pattern.test(text)) out.push({ file, line: offset + 1, text: text.trim() });
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Enclosing definition of a line — "what function is toplev.c:3905 in?"  */
/* ------------------------------------------------------------------ */

export function enclosingDefinition(index: CompilerSourceIndex, file: string, line: number): Definition | undefined {
  return index.definitions
    .filter((definition) => definition.file === file && definition.kind === "function" &&
      definition.line <= line && definition.endLine >= line)
    .sort((left, right) => (right.line - left.line))[0];
}

/** Named children of a node, re-exported so the CLI need not import the parser. */
export { namedChildren };
