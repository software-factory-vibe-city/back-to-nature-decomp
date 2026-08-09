/**
 * C source guard — AST answers to the questions a source rewriter must ask
 * before it touches a translation unit.
 *
 * Two of them, both about text a tool is about to move or wrap:
 *
 *   1. Does this source parse, and is it safe to place inside a disabled
 *      preprocessor block? A `#if 0` wrapper is not inert with respect to its
 *      contents: a stray `#endif` closes it early and exposes live code, an
 *      unterminated `#if` swallows the wrapper's own `#endif`, and an
 *      unterminated literal or comment runs past the end of the region. Each
 *      failure produces a translation unit that no longer compiles, so each is
 *      a precondition, not a nicety.
 *
 *   2. Which `INCLUDE_ASM` placeholders does it declare, and for which symbols?
 *      Read off the call expression rather than matched by pattern, so a
 *      mention inside a comment or a string is not a declaration.
 *
 * Both are read from the tree-sitter parse, never from regular expressions
 * over the text.
 *
 * Note on `subtreeIsBroken` in the shared helper: it walks named children only,
 * so it cannot see a MISSING anonymous token — a missing `#endif` or a missing
 * closing quote both read as clean there. This module walks every child,
 * anonymous tokens included, which is what makes the balance checks above work.
 *
 * Usage: npx tsx tools/agent/cSourceGuard.ts <file.c> [more.c ...]
 */

import { readFileSync } from "node:fs";
import { children, parseC, type Node } from "./residual-source-search/tree-sitter-c.ts";

export interface IncludeAsmSite {
  /** First macro argument: the directory holding the extracted assembly. */
  folder: string;
  /** Second macro argument: the symbol the assembler supplies. */
  symbol: string;
}

export interface CSourceReport {
  /** No ERROR node and no MISSING token anywhere in the tree. */
  parses: boolean;
  /** Safe to place verbatim inside a `#if 0` … `#endif` wrapper. */
  embeddable: boolean;
  /** Why not, when either answer is false. One line per defect. */
  reasons: string[];
  includeAsm: IncludeAsmSite[];
}

/** Every child, anonymous tokens included — a MISSING `#endif` is anonymous. */
function everyChild(node: Node, visit: (item: Node) => void): void {
  visit(node);
  for (const child of children(node)) everyChild(child, visit);
}

const CONDITIONAL_TYPES = new Set(["preproc_if", "preproc_ifdef"]);

/** A directive that closes or branches a conditional it does not own. */
function danglingDirective(node: Node): string | undefined {
  if (node.type !== "preproc_call") return undefined;
  const directive = children(node).find((child) => child.type === "preproc_directive");
  const text = directive?.text.trim();
  return text && ["#endif", "#else", "#elif"].includes(text) ? text : undefined;
}

export function analyzeCSource(source: string): CSourceReport {
  const tree = parseC(source);
  const root = tree.rootNode;
  const reasons: string[] = [];
  const includeAsm: IncludeAsmSite[] = [];

  let errors = 0;
  const missing: string[] = [];
  const dangling: string[] = [];
  const unterminatedConditionals: string[] = [];
  const spanningLiterals: string[] = [];

  everyChild(root, (node) => {
    if (node.type === "ERROR") {
      errors++;
      return;
    }
    if (node.isMissing) {
      missing.push(`${node.type} at line ${node.startPosition.row + 1}`);
      if (CONDITIONAL_TYPES.has(node.parent?.type ?? "") && node.type === "#endif") {
        unterminatedConditionals.push(`line ${(node.parent?.startPosition.row ?? 0) + 1}`);
      }
      return;
    }

    const stray = danglingDirective(node);
    if (stray) dangling.push(`${stray} at line ${node.startPosition.row + 1}`);

    if (
      (node.type === "string_literal" || node.type === "char_literal") &&
      node.startPosition.row !== node.endPosition.row
    ) {
      spanningLiterals.push(`line ${node.startPosition.row + 1}`);
    }

    if (node.type === "call_expression") {
      const callee = node.childForFieldName("function");
      if (callee?.type !== "identifier" || callee.text !== "INCLUDE_ASM") return;
      const args = node.childForFieldName("arguments");
      if (!args) return;
      const folder = children(args).find((child) => child.type === "string_literal");
      const symbol = children(args).find((child) => child.type === "identifier");
      if (folder && symbol) {
        includeAsm.push({ folder: folder.text.replace(/^"|"$/g, ""), symbol: symbol.text });
      }
    }
  });

  if (errors > 0) reasons.push(`${errors} parse error(s)`);
  for (const item of missing) reasons.push(`missing token: ${item}`);
  const parses = errors === 0 && missing.length === 0;

  for (const item of dangling) {
    reasons.push(`dangling ${item} would close an enclosing conditional early`);
  }
  for (const item of unterminatedConditionals) {
    reasons.push(`unterminated conditional opened at ${item} would swallow an enclosing #endif`);
  }
  for (const item of spanningLiterals) {
    reasons.push(`literal at ${item} is not terminated on its own line`);
  }

  return {
    parses,
    embeddable: parses && dangling.length === 0 && spanningLiterals.length === 0,
    reasons,
    includeAsm,
  };
}

export function analyzeCFile(path: string): CSourceReport {
  return analyzeCSource(readFileSync(path, "utf8"));
}

function main(argv: string[]): void {
  const paths = argv.slice(2);
  if (paths.length === 0) {
    console.error("Usage: npx tsx tools/agent/cSourceGuard.ts <file.c> [more.c ...]");
    process.exit(2);
  }
  const reports = paths.map((path) => ({ path, ...analyzeCFile(path) }));
  console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
  process.exit(reports.every((report) => report.parses) ? 0 : 1);
}

if (process.argv[1]?.endsWith("cSourceGuard.ts")) main(process.argv);
