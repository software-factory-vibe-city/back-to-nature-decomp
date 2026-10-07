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

import { existsSync, readFileSync } from "node:fs";
import { children, declaratorName, field, namedChildren, parseC, walk, type Node } from "./residual-source-search/tree-sitter-c.ts";

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

  tree.delete();
  return {
    parses,
    embeddable: parses && dangling.length === 0 && spanningLiterals.length === 0,
    reasons,
    includeAsm,
  };
}

export interface RegisterBindingSite {
  name: string;
  start: number;
  end: number;
  line: number;
  binding: string;
  register: string;
  declarationStart: number;
  declarationEnd: number;
}

export interface MatchingConstructs {
  localRegisterBindings: RegisterBindingSite[];
  fileRegisterBindings: RegisterBindingSite[];
  otherAsm: Array<{ line: number; scope: "file" | "function"; text: string; start: number; end: number }>;
}

/** Local hard-register bindings, NOT assembler symbol labels. A declaration
 * such as `extern int data asm("alias")` must never be mistaken for a pin.
 * Guard all tokens first, then use storage/declarator/scope nodes from the
 * pinned C AST. File-scope register context is deliberately not rewritten. */
export function matchingConstructs(source: string): MatchingConstructs {
  const guard = analyzeCSource(source);
  if (!guard.parses) throw new Error(`Cannot inspect register bindings: ${guard.reasons.join("; ")}`);
  const tree = parseC(source);
  const result: MatchingConstructs = { localRegisterBindings: [], fileRegisterBindings: [], otherAsm: [] };
  try {
    walkActiveC(tree.rootNode, node => {
      if (node.type !== "gnu_asm_expression") return true;
      let scope: Node | null = node.parent;
      while (scope && scope.type !== "function_definition" && scope.type !== "translation_unit") scope = scope.parent;
      /* Labels belong directly to a declaration or its function declarator.
         Do not exempt asm buried in an initializer just because a declaration
         is an ancestor. */
      const declaration = node.parent?.type === "function_declarator" ? node.parent.parent : node.parent;
      const operands = namedChildren(node);
      if (declaration?.type === "declaration" && operands.length === 1 && operands[0]?.type === "string_literal") {
        /* A non-register declarator asm is a symbol alias, not instructions
         * and not a pin. Never erase or diagnose it as either. */
        if (!namedChildren(declaration).some(c => c.type === "storage_class_specifier" && c.text === "register")) return true;
        const preceding = namedChildren(declaration).filter(c => c.endIndex <= node.startIndex).at(-1);
        const name = declaratorName(preceding);
        if (!name) return true;
        const site = { name: name.text, start: node.startIndex, end: node.endIndex, line: node.startPosition.row + 1, binding: node.text,
          register: operands[0]!.text.slice(1, -1), declarationStart: declaration.startIndex, declarationEnd: declaration.endIndex };
        if (scope?.type === "function_definition") result.localRegisterBindings.push(site);
        else result.fileRegisterBindings.push(site);
      } else result.otherAsm.push({ line: node.startPosition.row + 1, scope: scope?.type === "function_definition" ? "function" : "file", text: node.text, start: node.startIndex, end: node.endIndex });
      return true;
    });
  } finally { tree.delete(); }
  return result;
}

/** Only function-local bindings are eligible for a pin-erasure probe. */
export function localRegisterBindings(source: string): RegisterBindingSite[] {
  return matchingConstructs(source).localRegisterBindings;
}

/** Active AST walk, shared by injectors/policy. Literal disabled arms are
 * pruned; unknown preprocessor conditions stay visible to inspection, but
 * rewriting one requires the injector to refuse that conditional context. */
export function walkActiveC(root: Node, visit: (node: Node) => boolean): void {
  const disabled: Array<{ start: number; end: number }> = [];
  walk(root, node => {
    if (disabled.some(r => r.start <= node.startIndex && node.endIndex <= r.end)) return false;
    if (node.type === "preproc_if" || node.type === "preproc_elif") {
      const condition = field(node, "condition"), alternative = field(node, "alternative");
      if (condition?.type === "number_literal" && condition.text === "0") disabled.push({ start: condition.endIndex, end: alternative?.startIndex ?? node.endIndex });
      else if (condition?.type === "number_literal" && condition.text === "1" && alternative) disabled.push({ start: alternative.startIndex, end: alternative.endIndex });
    }
    return visit(node);
  });
}
export interface CaptureSite {
  name: string | null; scope: "file" | "function"; function: string | null;
  start: number; end: number; line: number; valid: boolean;
}
/** Only standalone, one-identifier invocations are the approved construct.
 * Comments, strings, disabled arms and same-named declarations are not uses. */
export function capturePrevRetSites(source: string): CaptureSite[] {
  const tree = parseC(source), result: CaptureSite[] = [];
  try { walkActiveC(tree.rootNode, node => {
    if (node.type !== "call_expression" || field(node, "function")?.text !== "CAPTURE_PREV_RET") return true;
    const args = namedChildren(field(node, "arguments")!);
    let scope = node.parent;
    while (scope && scope.type !== "function_definition" && scope.type !== "translation_unit") scope = scope.parent;
    const statement = node.parent;
    const parentType = statement?.parent?.type ?? "";
    const valid = statement?.type === "expression_statement" && (["compound_statement", "translation_unit"].includes(parentType) || parentType.startsWith("preproc_")) && args.length === 1 && args[0]?.type === "identifier";
    result.push({ name: args[0]?.type === "identifier" ? args[0].text : null, scope: scope?.type === "function_definition" ? "function" : "file",
      function: scope?.type === "function_definition" ? declaratorName(field(scope, "declarator"))?.text ?? null : null,
      start: node.startIndex, end: node.endIndex, line: node.startPosition.row + 1, valid });
    return true;
  }); } finally { tree.delete(); }
  return result;
}
export interface CSourceEdit { start: number; end: number; text: string }
/** All locations come from AST nodes, never source-text patterns. Validate the
 * complete result and reject overlapping/stale ranges before publication. */
export function applyCSourceEdits(source: string, edits: readonly CSourceEdit[]): string {
  const before = analyzeCSource(source);
  if (!before.parses || !before.embeddable) throw new Error(`Unsafe C input: ${before.reasons.join("; ")}`);
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let n = 0; n < sorted.length; n++) {
    const edit = sorted[n]!;
    if (edit.start < 0 || edit.end < edit.start || edit.end > source.length || (n && sorted[n - 1]!.end > edit.start)) throw new Error("Invalid or overlapping AST edit");
  }
  let result = source;
  for (const edit of sorted.reverse()) result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  const guard = analyzeCSource(result);
  if (!guard.parses || !guard.embeddable) throw new Error(`AST edit produced unsafe C: ${guard.reasons.join("; ")}`);
  return result;
}
/** Exact scalar entry-$2 declaration migration, at either scope. Non-scalar,
 * initialized/multiple declarators and other register bindings are untouched. */
export function migrateCapturePrevRet(source: string): string {
  const tree = parseC(source), edits: CSourceEdit[] = [];
  try {
    for (const site of [...matchingConstructs(source).fileRegisterBindings, ...matchingConstructs(source).localRegisterBindings]) {
      if (!["$2", "$v0", "2", "v0"].includes(site.register)) continue;
      const declaration = tree.rootNode.descendantsOfType("declaration").find(n => n.startIndex === site.declarationStart);
      if (!declaration || field(declaration, "type")?.text !== "s32" || field(declaration, "declarator")?.type !== "identifier" ||
        children(declaration).some(n => n.type === ",")) continue;
      edits.push({ start: site.declarationStart, end: site.declarationEnd, text: `CAPTURE_PREV_RET(${site.name});` });
    }
  } finally { tree.delete(); }
  return applyCSourceEdits(source, edits);
}

export function analyzeCFile(path: string): CSourceReport {
  return analyzeCSource(readFileSync(path, "utf8"));
}

/**
 * Does this translation unit hand `symbol` to the assembler?
 *
 * The one question every distance-reporting tool has to ask before it reports
 * a distance. An `INCLUDE_ASM` stub `.include`s the extracted disassembly, so
 * its object holds the original words and every oracle scores it a perfect
 * match — of the assembly against itself. Read off the AST, so an
 * `INCLUDE_ASM` inside a comment or a `#if 0` block that tree-sitter parsed as
 * disabled text is not mistaken for a declaration.
 */
export function handsSymbolToAssembler(source: string, symbol: string): boolean {
  return analyzeCSource(source).includeAsm.some((site) => site.symbol === symbol);
}

export function fileHandsSymbolToAssembler(path: string, symbol: string): boolean {
  if (!existsSync(path)) return false;
  return handsSymbolToAssembler(readFileSync(path, "utf8"), symbol);
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
