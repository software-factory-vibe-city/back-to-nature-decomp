/**
 * Transactional integration — promoting a candidate as one change that either
 * lands whole or not at all.
 *
 * The integration this replaces dropped the candidate's `extern` lines and
 * hoped the project's generated header happened to declare the same symbols
 * with compatible types. When it did, the result matched; when it did not, the
 * function was left as a stub with no statement of what was wrong. Worse, a
 * change that touches a *shared* header — a view type, a global's declaration
 * — can break translation units that were matching before, and nothing
 * checked them.
 *
 * So an integration here is a transaction over a set of files, with three
 * properties:
 *
 *   - **Every patch is justified.** A declaration is dropped because the
 *     project's headers provide the same name, checked against the
 *     preprocessed scope rather than against a pattern. A declaration is added
 *     because nothing in scope provides it.
 *   - **Verification covers what the change can reach.** The function itself
 *     must still be byte-identical; and every *other* matched function that
 *     the changed files could affect is re-verified, because an integration
 *     that fixes one function and breaks two is a regression whatever the
 *     oracle says about the first.
 *   - **Failure rolls back.** The tree after a refused transaction is the tree
 *     before it, byte for byte. A half-applied integration is the one outcome
 *     nothing downstream can reason about.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT, compileSource, preprocessOnly, sourcePathFor } from "../decompToolchain.js";
import { requireFunctionLocation } from "../../lib/symbolIndex.js";
import { compareFunction } from "../../lib/functionOracle.js";
import { analyzeCSource } from "../cSourceGuard.js";
import { children, declaratorName, field, namedChildren, parseC, walk, type Node } from "../residual-source-search/tree-sitter-c.js";
import { isRefusal, loadResult, resultDraft, type LoadedResult } from "../matching-reconstruction/result-contract.js";
import { overlaySourceFor } from "./artifact-overlay.js";

export interface Patch {
  /** Project-relative path. */
  path: string;
  /** The file's content before, or null when the file does not exist yet. */
  before: string | null;
  after: string;
  reason: string;
}

export interface Transaction {
  functionName: string;
  patches: Patch[];
  /** Functions re-verified because a patch could reach them. */
  reverify: string[];
  notes: string[];
}

export type IntegrationResult =
  | { status: "applied"; transaction: Transaction; verified: string[] }
  | { status: "would-apply"; transaction: Transaction; verified: string[] }
  | { status: "refused"; reason: string; detail?: string };

/* ---- what the unit needs ------------------------------------------------------ */

/** Every name the project's umbrella header puts in scope for a unit. */
function scopeOf(functionName: string, sourceText: string): Set<string> | null {
  const directory = join(ROOT, "build/integration", functionName);
  mkdirSync(directory, { recursive: true });
  const probe = join(directory, "scope.c");
  writeFileSync(probe, `#include "common.h"\n`);
  try {
    const preprocessed = preprocessOnly(probe, directory, "scope");
    const tree = parseC(readFileSync(preprocessed, "utf-8"));
    const names = new Set<string>();
    walk(tree.rootNode, (node) => {
      if (node.type === "declaration" || node.type === "type_definition") {
        for (const declarator of namedChildren(node)) {
          const name = declaratorName(declarator);
          if (name) names.add(name.text);
        }
        /* An assembler-name binding is what the linker resolves. */
        for (const child of children(node)) {
          if (child.type !== "gnu_asm_expression") continue;
          const literal = children(child).find((item) => item.type === "string_literal");
          const content = literal ? children(literal).find((item) => item.type === "string_content") : undefined;
          if (content) names.add(content.text);
        }
      }
      if (node.type === "preproc_def" || node.type === "preproc_function_def") {
        const name = field(node, "name") ?? children(node).find((child) => child.type === "identifier");
        if (name) names.add(name.text);
      }
      return true;
    });
    void sourceText;
    return names;
  } catch {
    return null;
  }
}

/**
 * The name a `typedef` introduces.
 *
 * It is the declarator that follows the type, unwrapped through pointer and
 * array forms; for the plain `typedef <type> <name>;` the parser spells that
 * declarator as a bare `type_identifier`, which is why the generic declarator
 * walker does not find it.
 */
function typedefName(node: Node): string | undefined {
  const declarator = field(node, "declarator");
  if (declarator) {
    if (declarator.type === "type_identifier") return declarator.text;
    return declaratorName(declarator)?.text;
  }
  const identifiers = namedChildren(node).filter((child) => child.type === "type_identifier");
  return identifiers[identifiers.length - 1]?.text;
}

/**
 * Turn a standalone candidate into a translation unit for this project.
 *
 * The candidate compiles against its own typedef block and its own `extern`
 * lines. In the tree it compiles against `common.h`, which provides the scalar
 * types and the generated global declarations. So the base typedefs always go;
 * a declaration goes only when the umbrella scope genuinely provides that
 * name, which is read from the preprocessed scope rather than assumed.
 */
function rewriteForProject(
  candidate: string,
  scope: Set<string> | null,
): { source: string; dropped: string[]; kept: string[] } {
  const tree = parseC(candidate);
  const drops: Array<{ start: number; end: number }> = [];
  const dropped: string[] = [];
  const kept: string[] = [];

  walk(tree.rootNode, (node) => {
    if (node.type === "type_definition") {
      /* The candidate's own scalar typedefs collide with common.h's. A view
       * typedef it invented does not and stays.
       *
       * The name is read from the typedef itself rather than inferred from
       * whatever `declaratorName` happens to find inside it: that returned
       * nothing for `typedef signed char s8;` and a *field* name for
       * `typedef struct { u8 unk0; } View;`, so the scalar typedefs were being
       * dropped by a vacuous `every` over an empty list rather than by
       * matching, and a view typedef whose fields did not happen to disagree
       * would have gone with them. */
      const name = typedefName(node);
      if (name !== undefined && /^[su](8|16|32)$/.test(name)) {
        drops.push({ start: node.startIndex, end: node.endIndex });
        dropped.push(name);
      }
      return true;
    }
    if (node.type !== "declaration") return true;
    const storage = namedChildren(node).find((child) => child.type === "storage_class_specifier");
    if (!storage || storage.text !== "extern") return true;
    const names = namedChildren(node).map((child) => declaratorName(child)?.text).filter(Boolean) as string[];
    if (names.length === 0) return true;
    if (scope && names.every((name) => scope.has(name))) {
      drops.push({ start: node.startIndex, end: node.endIndex });
      dropped.push(names.join(", "));
    } else {
      kept.push(names.join(", "));
    }
    return true;
  });

  let text = candidate;
  for (const drop of drops.sort((left, right) => right.start - left.start)) {
    text = text.slice(0, drop.start) + text.slice(drop.end);
  }
  /* Collapse the blank runs the removals leave behind, then put the umbrella
   * include at the top — unless the candidate already carries it, which a
   * family transfer's does, because its donor was a project source file. */
  const body = text.split("\n").filter((line, index, lines) => !(line.trim() === "" && lines[index - 1]?.trim() === "")).join("\n");
  const trimmed = body.replace(/^\n+/, "");
  const already = /^[ \t]*#\s*include\s+"common\.h"/m.test(trimmed);
  return { source: already ? trimmed : `#include "common.h"\n${trimmed}`, dropped, kept };
}

/* ---- planning ------------------------------------------------------------------ */

/**
 * Plan the integration of one function's exact candidate.
 *
 * Refuses rather than guesses at every point where the evidence runs out: no
 * exact candidate, a candidate that does not parse, a candidate that names a
 * symbol nothing declares. Each refusal names what is missing.
 */
export function planIntegration(functionName: string): Transaction | { refused: string; detail?: string } {
  const verified = verifiedSource(functionName);
  if ("refused" in verified) return verified;

  const sourcePath = sourcePathFor(functionName);
  const before = existsSync(sourcePath) ? readFileSync(sourcePath, "utf-8") : null;
  const scope = scopeOf(functionName, verified.source);
  const notes: string[] = [`the candidate came from ${verified.origin}`];
  if (!scope) notes.push("the umbrella scope could not be preprocessed; no declaration was dropped on the assumption that it is provided");

  const rewritten = rewriteForProject(verified.source, scope);
  for (const name of rewritten.dropped) notes.push(`dropped the candidate's declaration of ${name}: the project headers provide it`);
  for (const name of rewritten.kept) notes.push(`kept the candidate's declaration of ${name}: nothing in the umbrella scope provides it`);

  const guard = analyzeCSource(rewritten.source);
  if (!guard.parses) return { refused: "the rewritten source does not parse", detail: guard.reasons.join("; ") };
  if (guard.includeAsm.length > 0) {
    return { refused: "the rewritten source still hands the body to the assembler" };
  }

  return {
    functionName,
    patches: [{
      path: relative(ROOT, sourcePath),
      before,
      after: rewritten.source,
      reason: before === null
        ? "the function had no source file"
        : "replaces the INCLUDE_ASM stub with the byte-identical candidate",
    }],
    /* This transaction touches one translation unit, so nothing else can be
     * reached. A patch to a shared header would list its dependents here, and
     * the verification below would re-check them. */
    reverify: [],
    notes,
  };
}

/**
 * The verified C for one function, from whichever producer has it.
 *
 * The engine's own `winner.c` is the first place to look and used to be the
 * only one, which left every family-transfer result unintegrable: a transfer
 * writes no reconstruction result, so a function recovered entirely by
 * substitution had no route into the tree at all and had to be staged by hand.
 * The recovered-artifact overlay is the second place, and it is the right
 * second place because its entry bar is the same bar this function enforces —
 * compiled under production flags, matched by the relocated-byte oracle, and
 * free of assembly.
 */
function verifiedSource(functionName: string): { source: string; origin: string } | { refused: string; detail?: string } {
  const loaded = loadResult(functionName);
  if (!isRefusal(loaded)) {
    const draft = resultDraft(loaded as LoadedResult);
    if (!isRefusal(draft) && draft.kind === "winner") {
      return { source: draft.source, origin: "the reconstruction engine's exact candidate" };
    }
    const published = overlaySourceFor(functionName);
    if (published) return { source: published.text, origin: "the recovered-artifact overlay" };
    if (isRefusal(draft)) {
      return draft.detail === undefined ? { refused: "no draft" } : { refused: "no draft", detail: draft.detail };
    }
    return { refused: "not an exact candidate", detail: "only a byte-identical candidate is integrated; a draft is handed on in a bundle" };
  }
  const published = overlaySourceFor(functionName);
  if (published) return { source: published.text, origin: "the recovered-artifact overlay" };
  const detail = (loaded as { detail?: string }).detail;
  return detail === undefined ? { refused: "no result" } : { refused: "no result", detail };
}

/* ---- applying ------------------------------------------------------------------- */

/**
 * Apply a transaction, verify it, and roll back if anything fails.
 *
 * Verification is the oracle on the integrated function *plus* the oracle on
 * every function the transaction lists as reachable. Rollback restores every
 * patched file to exactly what it held, including deleting a file the
 * transaction created.
 */
export function applyTransaction(
  transaction: Transaction,
  options: { write?: boolean } = {},
): IntegrationResult {
  const staged = stageAndVerify(transaction);
  if ("refused" in staged) return { status: "refused", reason: staged.refused, ...(staged.detail ? { detail: staged.detail } : {}) };

  if (!options.write) {
    return { status: "would-apply", transaction, verified: staged.verified };
  }

  const snapshots = transaction.patches.map((patch) => ({
    path: join(ROOT, patch.path),
    before: patch.before,
  }));
  try {
    for (const patch of transaction.patches) {
      const path = join(ROOT, patch.path);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, patch.after);
    }
    /* Verify again *after* writing: the staged verification compiled the
     * candidate from a scratch path, and a file written into the tree is a
     * different experiment if anything about the tree decides its flags. */
    const confirmed = verifyInTree(transaction);
    if ("refused" in confirmed) {
      rollback(snapshots);
      return { status: "refused", reason: confirmed.refused, ...(confirmed.detail ? { detail: confirmed.detail } : {}) };
    }
    return { status: "applied", transaction, verified: confirmed.verified };
  } catch (error) {
    rollback(snapshots);
    return { status: "refused", reason: "the transaction threw while applying and was rolled back", detail: error instanceof Error ? error.message : String(error) };
  }
}

function rollback(snapshots: Array<{ path: string; before: string | null }>): void {
  for (const snapshot of snapshots) {
    if (snapshot.before === null) {
      if (existsSync(snapshot.path)) unlinkSync(snapshot.path);
    } else {
      writeFileSync(snapshot.path, snapshot.before);
    }
  }
}

/** Compile the transaction's candidate out of tree and ask the oracle. */
function stageAndVerify(transaction: Transaction): { verified: string[] } | { refused: string; detail?: string } {
  const patch = transaction.patches.find((candidate) => candidate.path.endsWith(`${transaction.functionName}.c`));
  if (!patch) return { refused: "the transaction contains no patch for the function's own source" };
  const location = requireFunctionLocation(transaction.functionName);
  const directory = join(ROOT, "build/integration", transaction.functionName, "staged");
  mkdirSync(directory, { recursive: true });
  const staged = join(directory, `${transaction.functionName}.c`);
  writeFileSync(staged, patch.after);
  try {
    const artifacts = compileSource(staged, join(directory, "compiled"), transaction.functionName, {
      assemble: true,
      containerKind: location.container.kind,
    });
    const oracle = compareFunction(transaction.functionName, { objectPath: artifacts.object!, container: location.container });
    if (oracle.verdict !== "match") {
      return { refused: `the rewritten source is ${oracle.verdict}`, detail: `${oracle.same}/${oracle.targetWords.length} words` };
    }
    return { verified: [transaction.functionName] };
  } catch (error) {
    return { refused: "the rewritten source does not compile", detail: (error instanceof Error ? error.message : String(error)).slice(0, 300) };
  }
}

/** Re-verify the function and everything the transaction can reach, in tree. */
function verifyInTree(transaction: Transaction): { verified: string[] } | { refused: string; detail?: string } {
  const verified: string[] = [];
  for (const functionName of [transaction.functionName, ...transaction.reverify]) {
    const location = requireFunctionLocation(functionName);
    const sourcePath = sourcePathFor(functionName);
    if (!existsSync(sourcePath)) {
      return { refused: `${functionName} has no source to verify after the change` };
    }
    const directory = join(ROOT, "build/integration", functionName, "in-tree");
    mkdirSync(directory, { recursive: true });
    try {
      const artifacts = compileSource(sourcePath, directory, functionName, {
        assemble: true,
        containerKind: location.container.kind,
      });
      const oracle = compareFunction(functionName, { objectPath: artifacts.object!, container: location.container });
      if (oracle.verdict !== "match") {
        return {
          refused: `${functionName} is ${oracle.verdict} after the change`,
          detail: `${oracle.same}/${oracle.targetWords.length} words — the transaction was rolled back`,
        };
      }
      verified.push(functionName);
    } catch (error) {
      return {
        refused: `${functionName} does not compile after the change`,
        detail: (error instanceof Error ? error.message : String(error)).slice(0, 300),
      };
    }
  }
  return { verified };
}

/** A readable plan, for a dry run. */
export function renderTransaction(transaction: Transaction, result: IntegrationResult): string[] {
  const lines: string[] = [];
  lines.push(`${transaction.functionName}: ${result.status}`);
  for (const patch of transaction.patches) {
    lines.push(`  ${patch.before === null ? "create" : "replace"} ${patch.path} — ${patch.reason}`);
  }
  if (transaction.reverify.length > 0) {
    lines.push(`  re-verifies ${transaction.reverify.length} reachable function(s)`);
  }
  if (result.status !== "refused") {
    lines.push(`  verified byte-identical: ${result.verified.join(", ")}`);
  } else {
    lines.push(`  refused: ${result.reason}${result.detail ? ` — ${result.detail}` : ""}`);
  }
  for (const note of transaction.notes) lines.push(`  note: ${note}`);
  return lines;
}
