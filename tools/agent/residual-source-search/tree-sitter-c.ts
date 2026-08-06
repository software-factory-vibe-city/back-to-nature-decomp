import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Language, Parser, type Node, type Tree } from "web-tree-sitter";
import { ROOT, } from "../decompToolchain.js";
import { sha256File } from "../variant-lab/artifacts.js";

const VENDOR = join(ROOT, "tools/vendor/tree-sitter-c");

interface GrammarPin {
  name: string;
  version: string;
  file: string;
  sha256: string;
  languageAbi: number;
}

const pin = JSON.parse(readFileSync(join(VENDOR, "pin.json"), "utf8")) as GrammarPin;
const wasmPath = join(VENDOR, pin.file);
const wasmHash = sha256File(wasmPath);
if (wasmHash !== pin.sha256) {
  throw new Error(
    `${pin.name} grammar drift: ${pin.file} hashes ${wasmHash}, pin.json expects ${pin.sha256}. ` +
    "Update the pin deliberately — the hash is part of every search run's identity.",
  );
}

await Parser.init();
const language = await Language.load(wasmPath);
if (language.abiVersion !== pin.languageAbi) {
  throw new Error(`${pin.name} ABI drift: loaded ${language.abiVersion}, pin.json expects ${pin.languageAbi}`);
}

/**
 * Identity of the C front end. It enters the run identity next to the compiler
 * and the implementation, so a grammar change cannot silently move a result.
 */
export const C_FRONTEND_IDENTITY = {
  parser: pin.name,
  version: pin.version,
  languageAbi: language.abiVersion,
  wasmSha256: wasmHash,
} as const;

const parser = new Parser();
parser.setLanguage(language);

/** Parse one complete translation unit. Never throws on malformed C. */
export function parseC(source: string): Tree {
  const tree = parser.parse(source);
  if (!tree) throw new Error("tree-sitter returned no tree for the supplied source");
  return tree;
}

export type { Node, Tree };

/* ------------------------------------------------------------------ */
/* Small tree helpers                                                  */
/* ------------------------------------------------------------------ */

export function namedChildren(node: Node): Node[] {
  const result: Node[] = [];
  for (let index = 0; index < node.namedChildCount; index++) {
    const child = node.namedChild(index);
    if (child) result.push(child);
  }
  return result;
}

export function children(node: Node): Node[] {
  const result: Node[] = [];
  for (let index = 0; index < node.childCount; index++) {
    const child = node.child(index);
    if (child) result.push(child);
  }
  return result;
}

export function field(node: Node, name: string): Node | undefined {
  return node.childForFieldName(name) ?? undefined;
}

/** Comments and preprocessor lines are not statements. */
export function isTrivia(node: Node): boolean {
  return node.type === "comment";
}

/**
 * The declared name of a declarator, unwrapping pointers, arrays, function
 * declarators, parenthesised declarators, and initialisers.
 */
export function declaratorName(node: Node | undefined): Node | undefined {
  let current = node;
  while (current) {
    if (current.type === "identifier" || current.type === "field_identifier") return current;
    const next = field(current, "declarator") ?? namedChildren(current)[0];
    if (!next || next.id === current.id) return undefined;
    current = next;
  }
  return undefined;
}

/** True when the declarator introduces a pointer or an array. */
export function declaratorIsPointer(node: Node | undefined): boolean {
  let current = node;
  while (current) {
    if (current.type === "pointer_declarator" || current.type === "array_declarator") return true;
    if (current.type === "identifier" || current.type === "field_identifier") return false;
    const next = field(current, "declarator") ?? namedChildren(current)[0];
    if (!next || next.id === current.id) return false;
    current = next;
  }
  return false;
}

/** True when the declarator introduces an array; its name is an address. */
export function declaratorIsArray(node: Node | undefined): boolean {
  let current = node;
  while (current) {
    if (current.type === "array_declarator") return true;
    if (current.type === "identifier" || current.type === "field_identifier") return false;
    const next = field(current, "declarator") ?? namedChildren(current)[0];
    if (!next || next.id === current.id) return false;
    current = next;
  }
  return false;
}

/** Depth-first walk that lets the visitor prune whole subtrees. */
export function walk(node: Node, visit: (item: Node) => boolean): void {
  if (!visit(node)) return;
  for (const child of namedChildren(node)) walk(child, visit);
}

/** True when the subtree contains a parse error or a missing token. */
export function subtreeIsBroken(node: Node): boolean {
  if (!node.hasError) return false;
  let broken = false;
  walk(node, (item) => {
    if (item.type === "ERROR" || item.isMissing) {
      broken = true;
      return false;
    }
    return true;
  });
  return broken;
}
