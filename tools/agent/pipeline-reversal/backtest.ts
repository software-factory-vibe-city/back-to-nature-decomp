/**
 * Backtest — does the chain name the right pass?
 *
 * Round-tripping the inverse against the compiler's dumps proves the chain
 * reconstructs a waypoint. It does not prove the *conclusion* is right: that a
 * residual attributed to allocation really is allocation's. For that we need
 * residuals whose cause we already know.
 *
 * Perturbations supply them. Each one is a mechanical edit to a source that
 * already matches, chosen so that its stage is known in advance:
 *
 *  - reordering two declarations cannot change which values the program
 *    computes, so the instruction population must survive and the residual must
 *    belong to scheduling or allocation;
 *  - adding a redundant statement changes the population, so the residual must
 *    belong to the passes before allocation.
 *
 * A perturbation that leaves the bytes identical is not evidence and is
 * reported as such rather than counted as a pass.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, resolveSource } from "../decompToolchain.js";
import { declaratorName, field, namedChildren, parseC, walk, type Node } from "../residual-source-search/tree-sitter-c.js";
import { reversePipeline } from "./reverse.js";

export type PerturbationKind = "declaration-order" | "statement-order" | "constant-value";

export interface BacktestCase {
  functionName: string;
  kind: PerturbationKind;
  /** What the chain must say owns the residual. */
  expectedStage: "sched" | "lreg" | "combine";
  status: "confirmed" | "wrong-stage" | "no-effect" | "not-applicable" | "error";
  detail: string;
  residualOwner?: string;
  decisions?: number;
  matchedWords?: number;
  totalWords?: number;
}

/**
 * Uninitialized local declarations, in source order, inside function bodies.
 *
 * The C front end is the authority on what a declaration is. A regular
 * expression cannot tell a local from a file-scope tentative definition or a
 * struct member, and swapping one of those is not the semantics-preserving edit
 * this backtest depends on — it changes which translation unit owns a global,
 * which changes the code.
 */
function localDeclarations(source: string): Array<{ start: number; end: number; name: string }> {
  const tree = parseC(source);
  const result: Array<{ start: number; end: number; name: string }> = [];
  walk(tree.rootNode, (node) => {
    if (node.type !== "function_definition") return true;
    const body = field(node, "body");
    if (!body) return false;
    for (const statement of namedChildren(body)) {
      if (statement.type !== "declaration") continue;
      const declarators = namedChildren(statement).filter((child) => child.type !== "type_qualifier" &&
        child.type !== "primitive_type" && child.type !== "type_identifier" && child.type !== "sized_type_specifier" &&
        child.type !== "struct_specifier" && child.type !== "storage_class_specifier");
      /* One declarator, no initializer: the only shape with no order
       * dependence at all. */
      if (declarators.length !== 1) continue;
      if (declarators[0].type === "init_declarator") continue;
      const name = declaratorName(declarators[0]);
      if (!name) continue;
      result.push({ start: statement.startIndex, end: statement.endIndex, name: name.text });
    }
    return false;
  });
  return result;
}

/**
 * Swap the first pair of adjacent uninitialized local declarations.
 *
 * Uninitialized is the whole point: two declarations with no initializer have
 * no order dependence, so the edit is semantics-preserving by construction and
 * any difference it produces belongs to a later pass.
 */
export function reorderDeclarations(source: string): string | null {
  const declarations = localDeclarations(source);
  for (let index = 0; index + 1 < declarations.length; index++) {
    const first = declarations[index];
    const second = declarations[index + 1];
    if (first.name === second.name) continue;
    /* Adjacent in the body: nothing but whitespace between them. */
    if (source.slice(first.end, second.start).trim() !== "") continue;
    return source.slice(0, first.start) + source.slice(second.start, second.end) +
      source.slice(first.end, second.start) + source.slice(first.start, first.end) +
      source.slice(second.end);
  }
  return null;
}

/** Top-level statements of every function body, in source order. */
function bodyStatements(source: string): Node[] {
  const tree = parseC(source);
  const result: Node[] = [];
  walk(tree.rootNode, (node) => {
    if (node.type !== "function_definition") return true;
    const body = field(node, "body");
    if (body) for (const statement of namedChildren(body)) result.push(statement);
    return false;
  });
  return result;
}

function identifiersIn(node: Node): Set<string> {
  const names = new Set<string>();
  walk(node, (item) => {
    if (item.type === "identifier") names.add(item.text);
    return true;
  });
  return names;
}

/** An assignment whose destination is a plain named object. */
function plainAssignment(statement: Node): { target: string; node: Node } | null {
  if (statement.type !== "expression_statement") return null;
  const expression = namedChildren(statement)[0];
  if (!expression || expression.type !== "assignment_expression") return null;
  const left = field(expression, "left");
  if (!left || left.type !== "identifier") return null;
  return { target: left.text, node: statement };
}

/**
 * Swap two adjacent assignments to distinct named objects that share no
 * identifier.
 *
 * Distinct destinations and disjoint reads make the two statements independent,
 * so the swap cannot change what the program computes — but it does change the
 * order in which the expander creates the values, which is the input to every
 * scheduling and allocation decision downstream. Exactly the edit whose
 * residual must NOT be attributed to the source.
 */
export function reorderStatements(source: string): string | null {
  const statements = bodyStatements(source);
  for (let index = 0; index + 1 < statements.length; index++) {
    const first = plainAssignment(statements[index]);
    const second = plainAssignment(statements[index + 1]);
    if (!first || !second) continue;
    if (first.target === second.target) continue;
    const left = identifiersIn(first.node);
    const right = identifiersIn(second.node);
    if ([...left].some((name) => right.has(name))) continue;
    const a = first.node;
    const b = second.node;
    return source.slice(0, a.startIndex) + source.slice(b.startIndex, b.endIndex) +
      source.slice(a.endIndex, b.startIndex) + source.slice(a.startIndex, a.endIndex) +
      source.slice(b.endIndex);
  }
  return null;
}

/**
 * Change the constant an assignment stores.
 *
 * The instruction that materializes a constant carries it in its immediate
 * field, so a different value is a different instruction — a population
 * difference by construction, and one no allocator or scheduler could produce.
 * Unlike a repeated store, which the compiler simply deletes, this survives to
 * the bytes.
 */
export function changeConstant(source: string): string | null {
  for (const statement of bodyStatements(source)) {
    const assignment = plainAssignment(statement);
    if (!assignment) continue;
    const expression = namedChildren(statement)[0];
    const right = field(expression, "right");
    if (!right || right.type !== "number_literal") continue;
    const value = Number(right.text);
    if (!Number.isFinite(value)) continue;
    const replacement = String(value === 0 ? 4660 : value + 4660);
    return source.slice(0, right.startIndex) + replacement + source.slice(right.endIndex);
  }
  return null;
}

const PERTURBATIONS: Record<PerturbationKind, {
  apply: (source: string) => string | null;
  expected: BacktestCase["expectedStage"];
  reason: string;
}> = {
  "declaration-order": {
    apply: reorderDeclarations,
    expected: "lreg",
    reason: "two uninitialized declarations swapped; no value changes, so no instruction can",
  },
  "statement-order": {
    apply: reorderStatements,
    expected: "lreg",
    reason: "two independent assignments swapped; the same values in a different birth order",
  },
  "constant-value": {
    apply: changeConstant,
    expected: "combine",
    reason: "a stored constant changed; the instruction that carries it differs",
  },
};

export function runBacktestCase(functionName: string, kind: PerturbationKind): BacktestCase {
  const perturbation = PERTURBATIONS[kind];
  const base: BacktestCase = {
    functionName,
    kind,
    expectedStage: perturbation.expected,
    status: "not-applicable",
    detail: perturbation.reason,
  };
  let edited: string | null;
  try {
    edited = perturbation.apply(readFileSync(resolveSource(functionName), "utf-8"));
  } catch (error) {
    return { ...base, status: "error", detail: error instanceof Error ? error.message : String(error) };
  }
  if (!edited) return { ...base, detail: `${perturbation.reason} — no site in this source` };

  const directory = join(ROOT, "build/pipelineReversal", functionName, "backtest", kind);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${functionName}.c`);
  writeFileSync(path, edited);

  try {
    const artifacts = reversePipeline({
      functionName,
      source: path,
      outputDirectory: directory,
      replay: false,
    });
    const report = artifacts.report;
    const result: BacktestCase = {
      ...base,
      residualOwner: report.residualOwner,
      decisions: report.decisions.length,
      matchedWords: report.matchedWords,
      totalWords: report.totalWords,
      status: "no-effect",
      detail: perturbation.reason,
    };
    if (report.exact) {
      return { ...result, status: "no-effect", detail: "the edit produced identical bytes, so it is not evidence" };
    }
    const populationDiffers = report.decisions.some((decision) => decision.stage === "combine");
    const observed: BacktestCase["expectedStage"] = populationDiffers
      ? "combine"
      : report.decisions.some((decision) => decision.stage === "sched" || decision.stage === "sched2")
        ? "sched"
        : "lreg";
    /* A declaration swap may land in either scheduling or allocation — both are
     * "after the program was fixed", which is the claim under test. */
    const acceptable = perturbation.expected === "combine"
      ? observed === "combine"
      : observed !== "combine";
    return {
      ...result,
      status: acceptable ? "confirmed" : "wrong-stage",
      detail: `${perturbation.reason}; chain says ${observed}`,
    };
  } catch (error) {
    return { ...base, status: "error", detail: error instanceof Error ? error.message : String(error) };
  }
}

export function runBacktest(functionNames: string[], kinds: PerturbationKind[]): BacktestCase[] {
  const results: BacktestCase[] = [];
  for (const functionName of functionNames) {
    for (const kind of kinds) results.push(runBacktestCase(functionName, kind));
  }
  return results;
}

export function renderBacktest(cases: BacktestCase[]): string {
  const lines: string[] = [];
  const counts = new Map<BacktestCase["status"], number>();
  for (const entry of cases) counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
  lines.push("pipeline-reversal backtest");
  lines.push([...counts.entries()].map(([status, count]) => `${status}: ${count}`).join("  "));
  lines.push("");
  for (const entry of cases) {
    if (entry.status === "not-applicable") continue;
    const words = entry.matchedWords === undefined ? "" : ` ${entry.matchedWords}/${entry.totalWords}`;
    lines.push(`  [${entry.status}] ${entry.functionName} ${entry.kind}${words}`);
    lines.push(`      ${entry.detail}`);
    if (entry.residualOwner) lines.push(`      owner: ${entry.residualOwner}`);
    if (entry.decisions !== undefined) lines.push(`      decisions: ${entry.decisions}`);
  }
  return lines.join("\n");
}
