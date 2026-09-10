/**
 * T0 — Sub-census of the 907 read-only, call-free unmatched functions.
 *
 * Reads the existing census.json, loads each function's bytes, builds the DAG
 * via the existing executor, and tallies the shape distributions the general
 * constructor must cover.
 *
 *   npx tsx tools/agent/matching-reconstruction/subcensus.ts
 *
 * Output: a written breakdown in build/matchingReconstruction/subcensus.json
 * and the probe set printed to stderr.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { loadContainers, containerTargetPath, vramToRom, type Container } from "../../lib/container.js";
import { loadSymbolIndex, loadFunctionSpans, requireFunctionLocation } from "../../lib/symbolIndex.js";
import { decodeBytes, executeFunction, canon, UnsupportedTarget, DagArena, type ExecResult, type LoadMeta } from "./exec.js";
import { resolveAddress } from "../../lib/symbolIndex.js";
import type { DagNode, DagRef, SymExpr } from "./types.js";
import { fitScanRelation } from "./scan-relation.js";
import { constructGuardedCandidates } from "./effect-construct.js";

/* ---- shape analysis ------------------------------------------------------ */

interface ShapeStats {
  testCount: number;
  dispatchCount: number;
  leafCount: number;
  /** Leaves that return entry v0 (unset). */
  voidLeaves: number;
  /** Leaves that return a proper value. */
  valuedLeaves: number;
  /** Whether any node has in-degree > 1 (join). */
  hasJoins: boolean;
  /** Whether the structure is a shallow tree (every leaf reachable by exactly one path). */
  isShallowTree: boolean | undefined;
  /** Max operator depth among leaf value expressions. */
  maxExpressionDepth: number;
  /** Leaf expression kinds used: params, constants, loads, binary, unary. */
  leafKinds: Set<string>;
  /** Detected as unrolled loop spine (long test chain with affine-varying live state). */
  isUnrolledLoop: boolean | undefined;
}

interface ProbeEntry {
  functionName: string;
  containerId: string;
  sizeBytes: number;
  detail: string;
  stats: ShapeStats | null;
  dagShape: string;
}

interface SubcensusResult {
  totalFunctions: number;
  byContainer: Record<string, number>;
  testCounts: number[];
  dispatchCounts: number[];
  leafCounts: number[];
  shallowTreeCount: number;
  hasJoinsCount: number;
  mixedReturnVoidCount: number;
  unrolledLoopCount: number;
  genuineWideCount: number;
  maxExpressionDepths: number[];
  leafKindUsage: Record<string, number>;
  probes: ProbeEntry[];
  categoryBreakdown: Record<string, number>;
}

function expressionDepth(expr: SymExpr): number {
  switch (expr.kind) {
    case "const": case "entry": case "iv": return 1;
    case "load": {
      const baseDepth = expr.base ? expressionDepth(expr.base) : 0;
      const idxDepth = expr.index ? expressionDepth(expr.index.expr) : 0;
      return 1 + Math.max(baseDepth, idxDepth);
    }
    case "unary": return 1 + expressionDepth(expr.operand);
    case "binary": return 1 + Math.max(expressionDepth(expr.left), expressionDepth(expr.right));
    case "call-result": return 1;
  }
}

function collectLeafKinds(expr: SymExpr, kinds: Set<string>): void {
  switch (expr.kind) {
    case "const": kinds.add("const"); return;
    case "entry": kinds.add("param"); return;
    case "iv": kinds.add("iv"); return;
    case "load": {
      kinds.add("load");
      if (expr.base) collectLeafKinds(expr.base, kinds);
      if (expr.index) collectLeafKinds(expr.index.expr, kinds);
      return;
    }
    case "unary":
      kinds.add("unary");
      collectLeafKinds(expr.operand, kinds);
      return;
    case "binary":
      kinds.add("binary");
      collectLeafKinds(expr.left, kinds);
      collectLeafKinds(expr.right, kinds);
      return;
    case "call-result": kinds.add("call-result"); return;
  }
}

/** Count in-degree for every DAG ref by walking from root. */
function computeInDegrees(arena: DagArena, root: DagRef): Map<DagRef, number> {
  const indeg = new Map<DagRef, number>();
  const seen = new Set<DagRef>();
  const walk = (ref: DagRef): void => {
    if (seen.has(ref)) { indeg.set(ref, (indeg.get(ref) ?? 0) + 1); return; }
    seen.add(ref);
    indeg.set(ref, (indeg.get(ref) ?? 0));
    const node = arena.node(ref);
    if (node.kind === "test") { walk(node.onTrue); walk(node.onFalse); }
    else if (node.kind === "dispatch") { for (const t of node.targets) walk(t); }
    else if (node.kind === "loop") { walk(node.body); }
  };
  walk(root);
  return indeg;
}

/** Detect an unrolled-loop spine: a chain of test nodes with affine-varying
 *  live state, more than 8 deep. */
function detectUnrolledSpine(arena: DagArena, root: DagRef): boolean {
  /* Walk the DAG. A "spine" is a linear chain of test nodes where the onFalse
   * (or onTrue) leads immediately to a leaf and the other arm continues the
   * chain. Count consecutive tests. */
  let maxChain = 0;
  const walkChain = (ref: DagRef, depth: number): void => {
    if (depth > maxChain) maxChain = depth;
    const node = arena.node(ref);
    if (node.kind !== "test") return;
    /* Check if one arm is a leaf (chain continues on the other arm). */
    const trueIsLeaf = arena.node(node.onTrue).kind === "leaf";
    const falseIsLeaf = arena.node(node.onFalse).kind === "leaf";
    if (trueIsLeaf && !falseIsLeaf) {
      walkChain(node.onFalse, depth + 1);
    } else if (!trueIsLeaf && falseIsLeaf) {
      walkChain(node.onTrue, depth + 1);
    } else if (trueIsLeaf && falseIsLeaf) {
      /* Both leaves — end of chain. */
    } else {
      /* Both continue — this is a branch, not a chain spine. Don't follow. */
    }
  };
  walkChain(root, 0);
  return maxChain >= 8;
}

/* ---- main ---------------------------------------------------------------- */

function analyze(): SubcensusResult {
  const censusPath = join(ROOT, "build/matchingReconstruction/census.json");
  const census = JSON.parse(readFileSync(censusPath, "utf-8")) as {
    functions: Array<{
      functionName: string;
      containerId: string;
      sizeBytes: number;
      state: string;
      category: string;
      detail?: string;
    }>;
  };

  /* Select the 907 read-only, call-free functions.
   * The relevant categories:
   *   "read-only, call-free, but not a fixed-stride scan"
   *   "other: no parameter plan could express the relation's values"
   *   "other: structure too large for the guarded class (...)"
   *   "other: some paths return a value and some leave it unset"
   * Also include "domain-exhausted" (relation fits, grammar lacks witness) 
   * and "context-unresolved" since they're in the same bucket. */
  const roCategories = [
    "read-only, call-free, but not a fixed-stride scan",
    "domain-exhausted (relation fits; grammar lacks a witness)",
  ];
  const targetFunctions = census.functions.filter((fn) => {
    if (fn.category.startsWith("other:")) {
      const d = fn.detail ?? "";
      if (d.includes("no parameter plan") || d.includes("structure too large") ||
          d.includes("some paths return") || d.includes("not a fixed-stride scan") ||
          d.includes("unconditional return") || d.includes("constant") ||
          d.includes("affine")) {
        return true;
      }
    }
    if (roCategories.includes(fn.category)) return true;
    if (fn.state === "domain-exhausted") return true;
    return false;
  });

  const result: SubcensusResult = {
    totalFunctions: targetFunctions.length,
    byContainer: {},
    testCounts: [],
    dispatchCounts: [],
    leafCounts: [],
    shallowTreeCount: 0,
    hasJoinsCount: 0,
    mixedReturnVoidCount: 0,
    unrolledLoopCount: 0,
    genuineWideCount: 0,
    maxExpressionDepths: [],
    leafKindUsage: {},
    probes: [],
    categoryBreakdown: {},
  };

  /* Deduplicate by functionName */
  const seen = new Set<string>();
  const unique = targetFunctions.filter((fn) => {
    if (seen.has(fn.functionName)) return false;
    seen.add(fn.functionName);
    return true;
  });

  for (const fn of unique) {
    result.byContainer[fn.containerId] = (result.byContainer[fn.containerId] ?? 0) + 1;
    result.categoryBreakdown[fn.category] = (result.categoryBreakdown[fn.category] ?? 0) + 1;
  }

  /* Decode and analyze each function's DAG. */
  const containers = new Map<string, Container>();
  for (const container of loadContainers()) containers.set(container.id, container);

  let analyzed = 0;
  for (const fn of unique) {
    analyzed++;
    if (analyzed % 50 === 0) console.error(`subcensus: ${analyzed}/${unique.length}`);

    const probe: ProbeEntry = {
      functionName: fn.functionName,
      containerId: fn.containerId,
      sizeBytes: fn.sizeBytes,
      detail: fn.detail ?? "",
      stats: null,
      dagShape: "unreachable",
    };

    try {
      const container = containers.get(fn.containerId);
      if (!container) { result.probes.push(probe); continue; }

      const location = requireFunctionLocation(fn.functionName);
      const span = location.span;
      const image = readFileSync(containerTargetPath(container));
      const rom = vramToRom(container, span.vram);
      const insns = decodeBytes(image.subarray(rom, rom + span.size), span.vram);

      const symbolIndex = loadSymbolIndex(container);
      const executed: ExecResult = executeFunction(insns, {
        gpValue: container.gpValue || undefined,
        readWord: (vram) => {
          const rrom = vramToRom(container, vram);
          if (rrom < 0 || rrom + 4 > image.length) return undefined;
          return image.readUInt32LE(rrom);
        },
        resolveCallTarget: (address) => {
          const resolved = resolveAddress(symbolIndex, address >>> 0);
          return resolved ? resolved.symbol : null;
        },
      });

      const arena = executed.arena;
      const root = executed.root;
      const stats: ShapeStats = {
        testCount: 0,
        dispatchCount: 0,
        leafCount: 0,
        voidLeaves: 0,
        valuedLeaves: 0,
        hasJoins: false,
        isShallowTree: true,
        maxExpressionDepth: 0,
        leafKinds: new Set(),
        isUnrolledLoop: false,
      };

      /* Walk the DAG once to count nodes. */
      const visited = new Set<DagRef>();
      const indeg = computeInDegrees(arena, root);
      const walk = (ref: DagRef): void => {
        if (visited.has(ref)) return;
        visited.add(ref);
        const node = arena.node(ref);
        if (node.kind === "leaf") {
          stats.leafCount++;
          const isVoid = canon(node.value) === "@v0" || canon(node.value) === "@__continue";
          if (isVoid) stats.voidLeaves++; else stats.valuedLeaves++;
          const depth = expressionDepth(node.value);
          if (depth > stats.maxExpressionDepth) stats.maxExpressionDepth = depth;
          collectLeafKinds(node.value, stats.leafKinds);
          return;
        }
        if (node.kind === "test") { stats.testCount++; walk(node.onTrue); walk(node.onFalse); }
        else if (node.kind === "dispatch") { stats.dispatchCount++; for (const t of node.targets) walk(t); }
        else if (node.kind === "loop") { walk(node.body); }
      };
      walk(root);

      /* Joins: any node with indegree > 1 after the root. */
      for (const [ref, deg] of indeg) {
        if (ref !== root && deg > 1) { stats.hasJoins = true; break; }
      }

      /* Shallow tree: every leaf reached by exactly one path.
       * If there are joins, it's not a shallow tree. */
      stats.isShallowTree = !stats.hasJoins;

      /* Unrolled loop spine detection. */
      stats.isUnrolledLoop = detectUnrolledSpine(arena, root);

      if (stats.isUnrolledLoop) result.unrolledLoopCount++;
      else if (stats.testCount + stats.dispatchCount > 4) result.genuineWideCount++;

      result.testCounts.push(stats.testCount);
      result.dispatchCounts.push(stats.dispatchCount);
      result.leafCounts.push(stats.leafCount);
      result.maxExpressionDepths.push(stats.maxExpressionDepth);
      if (stats.isShallowTree) result.shallowTreeCount++;
      if (stats.hasJoins) result.hasJoinsCount++;
      if (stats.voidLeaves > 0 && stats.valuedLeaves > 0) result.mixedReturnVoidCount++;
      for (const kind of stats.leafKinds) {
        result.leafKindUsage[kind] = (result.leafKindUsage[kind] ?? 0) + 1;
      }

      /* Categorize DAG shape. */
      const dagShape = root === undefined ? "unreachable"
        : arena.node(root).kind === "leaf" ? "straight-line"
        : stats.testCount === 0 && stats.dispatchCount > 0 ? "dispatch-only"
        : stats.dispatchCount > 0 ? "test-dispatch-mixed"
        : stats.testCount > 0 && stats.isUnrolledLoop ? "unrolled-loop-spine"
        : stats.testCount > 0 && stats.hasJoins ? "tree-with-joins"
        : stats.testCount > 0 ? "pure-decision-tree"
        : "other";
      probe.dagShape = dagShape;
      probe.stats = stats;

    } catch (error) {
      probe.dagShape = error instanceof Error ? `error: ${error.message.slice(0, 80)}` : "unknown error";
    }
    result.probes.push(probe);
  }

  return result;
}

/* ---- output -------------------------------------------------------------- */

const result = analyze();

const breakdownLines: string[] = [];
breakdownLines.push(`Sub-census of ${result.totalFunctions} read-only, call-free unmatched functions`);
breakdownLines.push("");

breakdownLines.push("=== Category breakdown ===");
for (const [cat, count] of Object.entries(result.categoryBreakdown).sort((a, b) => b[1] - a[1])) {
  breakdownLines.push(`  ${String(count).padStart(5)}  ${cat}`);
}

breakdownLines.push("");
breakdownLines.push("=== Test count distribution ===");
const tHist = new Map<number, number>();
for (const c of result.testCounts) tHist.set(c, (tHist.get(c) ?? 0) + 1);
for (const [count, freq] of [...tHist.entries()].sort((a, b) => a[0] - b[0])) {
  breakdownLines.push(`  ${String(count).padStart(4)} tests: ${String(freq).padStart(4)} functions`);
}

breakdownLines.push("");
breakdownLines.push("=== Dispatch count distribution ===");
const dHist = new Map<number, number>();
for (const c of result.dispatchCounts) dHist.set(c, (dHist.get(c) ?? 0) + 1);
for (const [count, freq] of [...dHist.entries()].sort((a, b) => a[0] - b[0])) {
  breakdownLines.push(`  ${String(count).padStart(4)} dispatches: ${String(freq).padStart(4)} functions`);
}

breakdownLines.push("");
breakdownLines.push("=== Leaf count distribution ===");
const lHist = new Map<number, number>();
for (const c of result.leafCounts) lHist.set(c, (lHist.get(c) ?? 0) + 1);
for (const [count, freq] of [...lHist.entries()].sort((a, b) => a[0] - b[0])) {
  breakdownLines.push(`  ${String(count).padStart(4)} leaves: ${String(freq).padStart(4)} functions`);
}

breakdownLines.push("");
breakdownLines.push(`Shallow trees (no joins): ${result.shallowTreeCount}`);
breakdownLines.push(`Trees with joins:         ${result.hasJoinsCount}`);
breakdownLines.push(`Mixed return/void:        ${result.mixedReturnVoidCount}`);
breakdownLines.push(`Unrolled loop spines:     ${result.unrolledLoopCount}`);
breakdownLines.push(`Genuine wide trees:       ${result.genuineWideCount}`);

breakdownLines.push("");
breakdownLines.push("=== Leaf expression depth distribution ===");
const eHist = new Map<number, number>();
for (const d of result.maxExpressionDepths) eHist.set(d, (eHist.get(d) ?? 0) + 1);
for (const [depth, freq] of [...eHist.entries()].sort((a, b) => a[0] - b[0])) {
  breakdownLines.push(`  depth ${depth}: ${String(freq).padStart(4)} functions`);
}

breakdownLines.push("");
breakdownLines.push("=== Leaf expression kinds ===");
for (const [kind, count] of Object.entries(result.leafKindUsage).sort((a, b) => b[1] - a[1])) {
  breakdownLines.push(`  ${kind}: ${String(count).padStart(4)} functions`);
}

/* Select probes spanning the shapes. */
const shapeProbes: ProbeEntry[] = [];
const shapeMap = new Map<string, ProbeEntry[]>();
for (const probe of result.probes) {
  if (!probe.stats) continue;
  const shapeCat = probe.dagShape;
  const arr = shapeMap.get(shapeCat) ?? [];
  arr.push(probe);
  shapeMap.set(shapeCat, arr);
}

/* Pick up to 2 from each shape category, preferring smaller functions. */
for (const [shapeCat, probes] of [...shapeMap.entries()].sort()) {
  const sorted = probes.sort((a, b) => a.sizeBytes - b.sizeBytes);
  shapeProbes.push(...sorted.slice(0, 2));
}

breakdownLines.push("");
breakdownLines.push("=== Probe set (8 functions spanning shapes) ===");
for (const probe of shapeProbes.slice(0, 8)) {
  const s = probe.stats;
  breakdownLines.push(`  ${probe.functionName} (${probe.sizeBytes} B, ${probe.dagShape})`);
  if (s) {
    breakdownLines.push(`    tests=${s.testCount} dispatches=${s.dispatchCount} leaves=${s.leafCount} ` +
      `void=${s.voidLeaves} valued=${s.valuedLeaves} joins=${s.hasJoins} depth=${s.maxExpressionDepth}`);
  } else {
    breakdownLines.push(`    (unreachable)`);
  }
}

console.log(breakdownLines.join("\n"));

/* Write JSON result. */
const outputDir = join(ROOT, "build/matchingReconstruction");
mkdirSync(outputDir, { recursive: true });
const jsonResult = {
  ...result,
  maxExpressionDepths: undefined,
  leafKindUsage: Object.fromEntries(
    Object.entries(result.leafKindUsage).sort((a, b) => b[1] - a[1])
  ),
  probes: result.probes.slice(0, 200), /* cap output size */
};
writeFileSync(join(outputDir, "subcensus.json"), JSON.stringify(jsonResult, null, 2));
console.error(`written: build/matchingReconstruction/subcensus.json`);