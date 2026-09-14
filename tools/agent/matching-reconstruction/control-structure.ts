/**
 * control-structure.ts — DAG → structured C for general control-flow functions.
 *
 * Turns a reducible test/dispatch/leaf DAG from bounded symex over a
 * read-only, call-free function into a structured statement tree (CStmt[]),
 * with support for:
 *
 *   - test → if/else
 *   - dispatch → switch
 *   - leaf → return (or fall-through for unset-$v0)
 *   - Joins (shared successors) → tail-duplicated or shared-block forms
 *   - Unrolled-loop spines → honest refusal
 *
 * Reuses the existing translate, buildStorageMap, deriveParamPlans, and
 * collectAtoms machinery from effect-construct.ts for per-leaf expressions.
 *
 * This file is the general constructor; constructGuardedCandidates remains
 * the narrow predecessor and runs alongside it.
 */

import { loadSymbolIndex } from "../../lib/symbolIndex.js";
import type { Container } from "../../lib/container.js";
import { canon, type LoadMeta } from "./exec.js";
import type {
  CExpr,
  CStmt,
} from "./construct.js";
import {
  STANDALONE_TYPEDEF_BLOCK,
  castForParameter,
  elementType,
  id,
  int,
  renderExpr,
  renderStmts,
} from "./construct.js";
import type {
  DagNode,
  DagRef,
  Effect,
  Predicate,
  StoreEffect,
  SymExpr,
} from "./types.js";

import {
  abiArguments,
  argumentsForArity,
  buildStorageMap,
  collectAtoms,
  deriveParamPlans,
  translate,
  resolveCallSignatures,
  calleeDeclarations,
  expressibleType,
  type Atom,
  type CellUse,
  type EffectCandidate,
  type ParamPlan,
  type StorageMap,
} from "./effect-construct.js";

/* ---- Arena wrapper for DAG querying -------------------------------------- */

export interface DagArenaLike {
  node(ref: DagRef): DagNode;
}

/** DAG statistics for cost bounds. */
export interface DagStats {
  testCount: number;
  dispatchCount: number;
  leafCount: number;
  voidLeafCount: number;
  valuedLeafCount: number;
  /** Estimated CStmt count (heuristic: each test/dispatch/leaf emits ~1 statement). */
  estimatedStmts: number;
  /** Whether any node has in-degree > 1 (has joins). */
  hasJoins: boolean;
  /** Maximum test chain depth (for unrolled loop detection). */
  maxSpineDepth: number;
}

/**
 * Compute DAG statistics — walks the DAG once, counts, and detects joins
 * and unrolled-loop spines. Pure function, no side effects.
 */
export function computeDagStats(arena: DagArenaLike, root: DagRef): DagStats {
  let testCount = 0;
  let dispatchCount = 0;
  let leafCount = 0;
  let voidLeafCount = 0;
  let valuedLeafCount = 0;
  const visited = new Set<DagRef>();
  const indeg = new Map<DagRef, number>();
  let maxSpine = 0;

  /* Compute in-degrees. */
  const computeIndeg = (ref: DagRef): void => {
    if (visited.has(ref)) return;
    visited.add(ref);
    const node = arena.node(ref);
    if (node.kind === "test") {
      indeg.set(node.onTrue, (indeg.get(node.onTrue) ?? 0) + 1);
      computeIndeg(node.onTrue);
      indeg.set(node.onFalse, (indeg.get(node.onFalse) ?? 0) + 1);
      computeIndeg(node.onFalse);
    } else if (node.kind === "dispatch") {
      for (const t of node.targets) {
        indeg.set(t, (indeg.get(t) ?? 0) + 1);
        computeIndeg(t);
      }
    }
  };
  computeIndeg(root);

  /* Count nodes. */
  visited.clear();
  const count = (ref: DagRef): void => {
    if (visited.has(ref)) return;
    visited.add(ref);
    const node = arena.node(ref);
    if (node.kind === "leaf") {
      leafCount++;
      const isVoid = canon(node.value) === "@v0" || canon(node.value) === "@__continue";
      if (isVoid) voidLeafCount++; else valuedLeafCount++;
      return;
    }
    if (node.kind === "test") { testCount++; count(node.onTrue); count(node.onFalse); }
    else if (node.kind === "dispatch") { dispatchCount++; for (const t of node.targets) count(t); }
    else if (node.kind === "loop") { count(node.body); }
  };
  count(root);

  /* Max spine depth: linear chain of test nodes. */
  const measureSpine = (ref: DagRef, depth: number): void => {
    if (depth > maxSpine) maxSpine = depth;
    const node = arena.node(ref);
    if (node.kind !== "test") return;
    const trueIsLeaf = arena.node(node.onTrue).kind === "leaf";
    const falseIsLeaf = arena.node(node.onFalse).kind === "leaf";
    if (trueIsLeaf && !falseIsLeaf) measureSpine(node.onFalse, depth + 1);
    else if (!trueIsLeaf && falseIsLeaf) measureSpine(node.onTrue, depth + 1);
  };
  measureSpine(root, 0);

  /* Has joins: any node other than root with indegree > 1. */
  let hasJoins = false;
  for (const [ref, deg] of indeg) {
    if (ref !== root && deg > 1) { hasJoins = true; break; }
  }

  const estimatedStmts = testCount + dispatchCount + leafCount;

  return {
    testCount,
    dispatchCount,
    leafCount,
    voidLeafCount,
    valuedLeafCount,
    estimatedStmts,
    hasJoins,
    maxSpineDepth: maxSpine,
  };
}

/* ---- Sequential guard spine counting -------------------------------------- */

/**
 * Walk the decision-DAG spine (the FALSE-then-FALSE chain) and count
 * how many sequential guards precede the first non-guard node. Uses
 * isSequentialGuard on each spine test. When the function is a chain
 * of sequential guards, the flat emitted code has a tiny statement
 * count instead of the exponential 2^N tree.
 */
export function sequentialGuardDepth(arena: DagArenaLike, root: DagRef): number {
  let depth = 0;
  let ref = root;
  while (true) {
    const node = arena.node(ref);
    if (node.kind !== "test") break;
    /* isSequentialGuard tells us onTrue = onFalse + one store, which is
     * exactly the guard pattern. The continuation is onFalse. */
    if (!isSequentialGuard(arena, node.onTrue, node.onFalse)) break;
    depth++;
    ref = node.onFalse;
  }
  return depth;
}

/**
 * Estimate the flat statement count when emitting sequential guards.
 * Used instead of the tree-node count when the DAG is a guard chain.
 */
function flatGuardEstimate(arena: DagArenaLike, root: DagRef): number | undefined {
  const guardDepth = sequentialGuardDepth(arena, root);
  if (guardDepth === 0) return undefined;
  /* Walk past the guard chain to count remaining non-guard nodes. */
  let ref = root;
  for (let i = 0; i < guardDepth; i++) {
    const node = arena.node(ref);
    if (node.kind !== "test") break;
    ref = node.onFalse;
  }
  /* Count remaining distinct nodes below the last guard's continuation.
   * Memoized: a shared join point is counted once, not once per path that
   * reaches it — without this, a heavily-joined DAG re-counts exponentially. */
  const counted = new Set<DagRef>();
  const countNodes = (r: DagRef): number => {
    if (counted.has(r)) return 0;
    counted.add(r);
    const n = arena.node(r);
    if (n.kind === "test") return 1 + countNodes(n.onTrue) + countNodes(n.onFalse);
    if (n.kind === "dispatch") return 1 + n.targets.reduce((s, t) => s + countNodes(t), 0);
    return 1;
  };
  return guardDepth + countNodes(ref);
}

/* ---- Cost-bounded construction ------------------------------------------- */

const DEFAULT_COST_BOUND = 200;
const SPINE_REFUSE_THRESHOLD = 8;

/**
 * Result of structureDag: the structured C statements (with leaf placeholders),
 * per-leaf return expressions and effect lists.
 */
export interface StructuredResult {
  stmts: CStmt[];
  leafReturns: Map<DagRef, SymExpr>;
  leafEffects: Map<DagRef, Effect[]>;
  leafIsVoid: Set<DagRef>;
  hasControl: boolean;
  notes: string[];
}

class StructuringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructuringError";
  }
}

export function structureDag(
  arena: DagArenaLike,
  root: DagRef,
  options: { costBound?: number; spineThreshold?: number } = {},
): StructuredResult | { invalid: string } {
  const costBound = options.costBound ?? DEFAULT_COST_BOUND;
  const spineThreshold = options.spineThreshold ?? SPINE_REFUSE_THRESHOLD;

  const stats = computeDagStats(arena, root);

  /* Refuse unrolled-loop spines. */
  if (stats.maxSpineDepth >= spineThreshold && stats.testCount >= spineThreshold) {
    return { invalid: `unrolled-loop spine detected: ${stats.maxSpineDepth} consecutive tests` };
  }

  /* Cost bound. */
  if (stats.estimatedStmts > costBound) {
    return { invalid: `structure too large: ~${stats.estimatedStmts} statements exceeds bound of ${costBound}` };
  }

  const leafReturns = new Map<DagRef, SymExpr>();
  const leafEffects = new Map<DagRef, Effect[]>();
  const leafIsVoid = new Set<DagRef>();
  const notes: string[] = [];

  /* Reachability for join detection. */
  const reachMemo = new Map<DagRef, Set<DagRef>>();
  const reach = (ref: DagRef): Set<DagRef> => {
    const known = reachMemo.get(ref);
    if (known) return known;
    const set = new Set<DagRef>([ref]);
    reachMemo.set(ref, set);
    const node = arena.node(ref);
    if (node.kind === "test") {
      const testNode = node;
      for (const r of reach(testNode.onTrue)) set.add(r);
      for (const r of reach(testNode.onFalse)) set.add(r);
    } else if (node.kind === "dispatch") {
      for (const t of node.targets) for (const r of reach(t)) set.add(r);
    } else if (node.kind === "loop") {
      for (const r of reach(node.body)) set.add(r);
    }
    return set;
  };

  const joinOf = (onTrue: DagRef, onFalse: DagRef): DagRef | undefined => {
    const reachTrue = reach(onTrue);
    const reachFalse = reach(onFalse);
    if (reachFalse.has(onTrue)) return onTrue;
    if (reachTrue.has(onFalse)) return onFalse;
    const shared = [...reachTrue].filter((r) => reachFalse.has(r));
    for (const candidate of shared) {
      const covered = reach(candidate);
      if (shared.every((r) => covered.has(r))) return candidate;
    }
    return undefined;
  };

  let emittedCount = 0;
  const checkCost = (): void => {
    if (emittedCount > costBound * 2) {
      throw new StructuringError(`emission budget exhausted at ${emittedCount} statements`);
    }
  };

  const isContinue = (ref: DagRef): boolean => {
    const node = arena.node(ref);
    return node.kind === "leaf" && canon(node.value) === "@__continue";
  };

  const emit = (ref: DagRef, stopAt?: DagRef): CStmt[] => {
    if (stopAt !== undefined && ref === stopAt) return [];
    if (isContinue(ref)) return [{ kind: "continue" }];

    const node = arena.node(ref);

    if (node.kind === "leaf") {
      const isVoid = canon(node.value) === "@v0";
      leafReturns.set(ref, node.value);
      leafEffects.set(ref, node.effects);
      if (isVoid) leafIsVoid.add(ref);
      emittedCount++;
      return [];
    }

    if (node.kind === "dispatch") {
      emittedCount++;
      const cases: Array<{ values: CExpr[]; body: CStmt[] }> = [];
      for (let i = 0; i < node.targets.length; i++) {
        const body = emit(node.targets[i]!, stopAt);
        cases.push({ values: [int(i)], body });
      }
      checkCost();
      return [{ kind: "switch", expr: id("__idx"), cases }];
    }

    if (node.kind === "loop") {
      /* Loop nodes are handled by the guarded constructor; for the general
       * constructor, delegate to the existing loop handling. */
      return [];
    }

    /* node.kind === "test" */
    emittedCount++;

    const join = joinOf(node.onTrue, node.onFalse);
    if (join !== undefined && join !== stopAt) {
      notes.push(`join: sharing block at leaf#${arena.node(join).kind}`);
      if (join === node.onTrue) {
        const elseArm = emit(node.onFalse, join);
        if (elseArm.length > 0) {
          return [{ kind: "if", cond: id("__cond"), body: [], elseBody: elseArm }];
        }
        return [];
      }
      if (join === node.onFalse) {
        const thenArm = emit(node.onTrue, join);
        if (thenArm.length > 0) {
          return [{ kind: "if", cond: id("__cond"), body: thenArm }];
        }
        return [];
      }
      const thenArm = emit(node.onTrue, join);
      const elseArm = emit(node.onFalse, join);
      return [{
        kind: "if",
        cond: id("__cond"),
        body: thenArm,
        ...(elseArm.length > 0 ? { elseBody: elseArm } : {}),
      }];
    }

    const thenArm = emit(node.onTrue, stopAt);
    const elseArm = emit(node.onFalse, stopAt);
    return [{
      kind: "if",
      cond: id("__cond"),
      body: thenArm,
      ...(elseArm.length > 0 ? { elseBody: elseArm } : {}),
    }];
  };

  try {
    const stmts = emit(root);
    checkCost();

    return {
      stmts,
      leafReturns,
      leafEffects,
      leafIsVoid,
      hasControl: stats.testCount > 0 || stats.dispatchCount > 0,
      notes,
    };
  } catch (error) {
    if (error instanceof StructuringError) {
      return { invalid: error.message };
    }
    throw error;
  }
}

/* ---- Atom helpers ------------------------------------------------------- */

function atomGroup(atom: Atom): string {
  if (atom.base) {
    const base = canon(atom.base);
    if (atom.index) return `${base}[${canon(atom.index.expr)}*${atom.index.scale}]`;
    return base;
  }
  return "";
}

function cellKey(group: string, offset: number, width: number): string {
  return `${group}|${offset}|${width}`;
}

/* ---- Expression and atom collection (T2) --------------------------------- */

export function collectAllAtomsAndExprs(
  arena: DagArenaLike,
  root: DagRef,
): { atoms: Map<string, Atom>; exprs: SymExpr[] } {
  const atoms = new Map<string, Atom>();
  const exprs: SymExpr[] = [];
  const visited = new Set<DagRef>();

  const walk = (ref: DagRef): void => {
    if (visited.has(ref)) return;
    visited.add(ref);
    const node = arena.node(ref);
    if (node.kind === "leaf") {
      if (canon(node.value) !== "@v0" && canon(node.value) !== "@__continue") {
        exprs.push(node.value);
        collectAtoms(node.value, atoms);
      }
      for (const effect of node.effects) {
        if (effect.kind === "call") {
          for (const arg of abiArguments(effect)) {
            if (!arg) continue;
            exprs.push(arg);
            collectAtoms(arg, atoms);
          }
        } else {
          exprs.push(effect.value);
          collectAtoms(effect.value, atoms);
          if (effect.base) collectAtoms(effect.base, atoms);
        }
      }
      return;
    }
    if (node.kind === "test") {
      collectAtoms(node.pred.left, atoms);
      exprs.push(node.pred.left);
      if (node.pred.right) { collectAtoms(node.pred.right, atoms); exprs.push(node.pred.right); }
      walk(node.onTrue);
      walk(node.onFalse);
    } else if (node.kind === "dispatch") {
      collectAtoms(node.index, atoms);
      exprs.push(node.index);
      for (const t of node.targets) walk(t);
    } else if (node.kind === "loop") {
      walk(node.body);
    }
  };
  walk(root);

  return { atoms, exprs };
}

/* ---- Full control-flow constructor --------------------------------------- */

export interface ControlFlowCandidate {
  label: string;
  source: string;
  integrationPlan: string[];
}

/** True when any node reachable from root is a loop node. */
function hasLoopNode(arena: DagArenaLike, root: DagRef): boolean {
  const seen = new Set<DagRef>();
  const walk = (ref: DagRef): boolean => {
    if (seen.has(ref)) return false;
    seen.add(ref);
    const node = arena.node(ref);
    if (node.kind === "loop") return true;
    if (node.kind === "test") return walk(node.onTrue) || walk(node.onFalse);
    if (node.kind === "dispatch") return node.targets.some((t) => walk(t));
    return false;
  };
  return walk(root);
}

export function constructControlFlowCandidates(
  functionName: string,
  arena: DagArenaLike,
  root: DagRef,
  loadsMeta: LoadMeta[],
  container: Container,
): ControlFlowCandidate[] | { invalid: string } | { unresolved: string } {
  /* 0. Refuse if the DAG contains loop nodes — loops are the guarded
   * constructor's domain, not the general control-flow class. */
  if (hasLoopNode(arena, root)) {
    return { invalid: "DAG contains loop nodes — outside the general control-flow class" };
  }

  /* 1. DAG stats and structure check. */
  const stats = computeDagStats(arena, root);

  /* Check whether sequential guard flattening would bring the function
   * inside the cost bound. If the raw spine is deep but the flat guard
   * estimate is small, it's a sequential-guard chain, not an unrolled
   * loop — emit will succeed with a tiny output. */
  const guardEstimate = flatGuardEstimate(arena, root);

  if (stats.maxSpineDepth >= SPINE_REFUSE_THRESHOLD && stats.testCount >= SPINE_REFUSE_THRESHOLD) {
    if (guardEstimate === undefined || guardEstimate > DEFAULT_COST_BOUND) {
      return { invalid: `unrolled-loop spine: ${stats.maxSpineDepth} consecutive tests` };
    }
  }
  if (stats.estimatedStmts > DEFAULT_COST_BOUND) {
    if (guardEstimate === undefined || guardEstimate > DEFAULT_COST_BOUND) {
      return { invalid: `structure too large: ~${stats.estimatedStmts} statements (bound ${DEFAULT_COST_BOUND})` };
    }
  }

  /* 2. Collect atoms and stores. */
  const { atoms: collectedAtoms, exprs } = collectAllAtomsAndExprs(arena, root);

  const gpByCell = new Map(
    loadsMeta.filter((load) => !load.baseCanon).map((load) => {
      const key = `${load.baseCanon ?? ""}|${load.address}|${load.width}`;
      return [key, load.viaGp] as [string, boolean];
    }),
  );

  const cells = new Map<string, CellUse>();
  for (const atom of collectedAtoms.values()) {
    const group = atomGroup(atom);
    const key = cellKey(group, atom.offset, atom.width);
    const existing = cells.get(key);
    if (existing) existing.loaded = true;
    else {
      cells.set(key, {
        ...atom,
        viaGp: gpByCell.get(key) ?? false,
        loaded: true,
        stored: false,
      } as CellUse);
    }
  }

  const visitedEffects = new Set<DagRef>();
  const collectStores = (ref: DagRef): void => {
    if (visitedEffects.has(ref)) return;
    visitedEffects.add(ref);
    const node = arena.node(ref);
    if (node.kind === "leaf") {
      for (const effect of node.effects) {
        if (effect.kind === "store") {
          const group = effect.base ? canon(effect.base) : "";
          const key = `${group}|${effect.address}|${effect.width}`;
          const existing = cells.get(key);
          const cll: CellUse = {
            base: effect.base,
            offset: effect.address,
            width: effect.width as 1 | 2 | 4,
            signed: true,
            index: effect.index,
            viaGp: effect.viaGp ?? false,
            loaded: existing?.loaded ?? false,
            stored: true,
          };
          cells.set(key, cll);
          if (existing) existing.stored = true;
        }
      }
    }
    if (node.kind === "test") { collectStores(node.onTrue); collectStores(node.onFalse); }
    else if (node.kind === "dispatch") { for (const t of node.targets) collectStores(t); }
    else if (node.kind === "loop") { collectStores(node.body); }
  };
  collectStores(root);

  /* 3. Build storage map. */
  const index = loadSymbolIndex(container);
  const map = buildStorageMap(cells, index, new Map(), functionName);
  if ("unresolved" in map) return map;
  if ("invalid" in map) return map;

  /* 4. Parameter plans. Pass the full effect list so deriveParamPlans can tell
   * a register used only as a call argument (a pointer passed through) from a
   * genuine value use — the pointer-and-value relaxation, wired here into the
   * control-flow path as well as the guarded one. */
  const allEffects: Effect[] = [];
  const seenEffectNodes = new Set<DagRef>();
  const collectAllEffects = (ref: DagRef): void => {
    if (seenEffectNodes.has(ref)) return;
    seenEffectNodes.add(ref);
    const node = arena.node(ref);
    if (node.kind === "leaf") { for (const effect of node.effects) allEffects.push(effect); return; }
    if (node.kind === "test") { collectAllEffects(node.onTrue); collectAllEffects(node.onFalse); }
    else if (node.kind === "dispatch") { for (const t of node.targets) collectAllEffects(t); }
    else if (node.kind === "loop") { collectAllEffects(node.body); }
  };
  collectAllEffects(root);
  const plans = deriveParamPlans(exprs, map.pointerParams, allEffects);
  if ("invalid" in plans) return { invalid: `no parameter plan: ${plans.invalid}` };

  /* 5.5. Collect call effects, resolve signatures, build call-result temps. */
  const callEffects: Array<{
    seq: number; callee: string; calleeName?: string | null; calleeAddress?: number;
    args: SymExpr[]; abi: Array<SymExpr | null>; indirect?: boolean;
  }> = [];
  const callResultRefs = new Set<number>();
  const visitedCalls = new Set<DagRef>();
  const collectCallsAndResults = (ref: DagRef): void => {
    if (visitedCalls.has(ref)) return;
    visitedCalls.add(ref);
    const node = arena.node(ref);
    if (node.kind === "leaf") {
      for (const effect of node.effects) {
        if (effect.kind === "call") {
          callEffects.push({
            seq: effect.seq,
            callee: effect.callee,
            /* The complete ABI list — register slots plus any outgoing-area
             * slots the caller wrote — so the signature oracle sees a fifth
             * argument rather than inferring its absence. */
            args: abiArguments(effect).filter((arg): arg is SymExpr => arg !== null),
            abi: abiArguments(effect),
            indirect: effect.indirect || false,
            ...(effect.calleeName !== undefined ? { calleeName: effect.calleeName } : {}),
            ...(effect.calleeAddress !== undefined ? { calleeAddress: effect.calleeAddress } : {}),
          });
          for (const arg of abiArguments(effect)) { if (arg) walkSymExprForCR(arg, callResultRefs); }
        } else {
          walkSymExprForCR(effect.value, callResultRefs);
        }
      }
      if (canon(node.value) !== "@v0" && canon(node.value) !== "@__continue") {
        walkSymExprForCR(node.value, callResultRefs);
      }
      return;
    }
    if (node.kind === "test") {
      walkSymExprForCR(node.pred.left, callResultRefs);
      if (node.pred.right) walkSymExprForCR(node.pred.right, callResultRefs);
      collectCallsAndResults(node.onTrue);
      collectCallsAndResults(node.onFalse);
    } else if (node.kind === "dispatch") {
      walkSymExprForCR(node.index, callResultRefs);
      for (const t of node.targets) collectCallsAndResults(t);
    } else if (node.kind === "loop") {
      collectCallsAndResults(node.body);
    }
  };
  collectCallsAndResults(root);

  /* Effect-constructor-style resolution. */
  const { resolved: baseCallCaps } = resolveCallSignatures(
    callEffects.map((e) => ({
      kind: "call" as const, seq: e.seq, callee: e.callee,
      /* Register slots and outgoing-area slots kept apart, so the signature
       * oracle can tell "the caller wrote a fifth argument" from "the caller
       * left a register untouched". */
      args: e.abi.slice(0, 4).map((arg) => arg ?? ({ kind: "const", value: 0 } as SymExpr)),
      stackArgs: e.abi.slice(4),
      calleeName: e.calleeName, calleeAddress: e.calleeAddress,
      indirect: e.indirect || false, resultUsed: false, vram: 0,
    })),
    container,
  );
  const callCaps = new Map(baseCallCaps);
  const callResultTemps = new Map<string, string>();
  for (const seq of callResultRefs) {
    const cap = callCaps.get(seq);
    if (!cap || !cap.returnsValue) continue;
    const tempName = `callRet${seq}`;
    callResultTemps.set(`CR(${seq},v0)`, tempName);
  }

  /* Helper: walk a SymExpr looking for call-result references. */
  function walkSymExprForCR(expr: SymExpr, into: Set<number>): void {
    /* Only `$v0` is a result. Every other caller-saved register carries a
     * clobber atom for the same call, and reading one of those as consumption
     * makes the next call's argument slot look like a use of the previous
     * call's return value. */
    if (expr.kind === "call-result") { if (expr.register === "v0") into.add(expr.seq); return; }
    if (expr.kind === "unary") { walkSymExprForCR(expr.operand, into); return; }
    if (expr.kind === "binary") {
      walkSymExprForCR(expr.left, into);
      walkSymExprForCR(expr.right, into);
      return;
    }
    if (expr.kind === "load") {
      if (expr.base) walkSymExprForCR(expr.base, into);
      if (expr.index) walkSymExprForCR(expr.index.expr, into);
      return;
    }
  }

  const declaredCallees = calleeDeclarations(callCaps);
  if ("invalid" in declaredCallees) {
    return { invalid: declaredCallees.invalid };
  }
  const calleeDecls = declaredCallees;

  /* 5. Detect mixed return/void. */
  const allReturns = new Map<DagRef, SymExpr>();
  const allVoidLeaves = new Set<DagRef>();
  const visited = new Set<DagRef>();
  const collectReturns = (ref: DagRef): void => {
    if (visited.has(ref)) return;
    visited.add(ref);
    const node = arena.node(ref);
    if (node.kind === "leaf") {
      /* `$v0` after a void call is not a return value: it is the register's
       * liveness at `jr $ra`, and the function is a void wrapper. This is why
       * the classification has to run *after* the callee signatures — before
       * them, such a leaf reads as a returned value the body cannot produce. */
      const voidCallResult = node.value.kind === "call-result"
        && node.value.register === "v0"
        && callCaps.get(node.value.seq)?.returnsValue === false;
      if (canon(node.value) === "@v0" || canon(node.value) === "@__continue" || voidCallResult) {
        allVoidLeaves.add(ref);
      } else {
        allReturns.set(ref, node.value);
      }
      return;
    }
    if (node.kind === "test") { collectReturns(node.onTrue); collectReturns(node.onFalse); }
    else if (node.kind === "dispatch") { for (const t of node.targets) collectReturns(t); }
    else if (node.kind === "loop") { collectReturns(node.body); }
  };
  collectReturns(root);

  const hasVoidLeaves = allVoidLeaves.size > 0;
  const allVoid = hasVoidLeaves && allReturns.size === 0;
  /* Mixed leaves take the *valued* type, not `void`. A void leaf emits no
   * return at all (it falls off the end, which is what its DAG says: that path
   * never defines `$v0`), so a `void` signature here would sit over leaves that
   * still emit `return expr;` — a C89 constraint violation that GCC accepts
   * with a warning and the byte oracle cannot see, because on MIPS the return
   * type is only `$v0` liveness and costs no instruction either way. Declaring
   * the value is therefore free in machine terms and valid in source terms. */
  const returnType = allVoid ? "void" : "s32";


  /* 6. Try emitting candidates through the translation-aware DAG walker. */
  const candidates: ControlFlowCandidate[] = [];
  const errors: string[] = [];

  for (const plan of plans) {
    /* Source-form axes (T4). */
    const exitStyles: Array<"early-return" | "else"> = stats.leafCount <= 2 ? ["early-return", "else"] : ["early-return"];
    const polarityStyles: Array<"normal" | "swapped"> = ["normal", "swapped"];
    const joinStyles: Array<"tail-dup" | "shared"> = stats.hasJoins ? ["tail-dup", "shared"] : ["tail-dup"];

    for (const context of ["standalone", "umbrella"] as const) {
    for (const exitStyle of exitStyles) {
    for (const polarity of polarityStyles) {
    for (const joinStyle of joinStyles) {
      try {
        const temps = new Map<string, string>();
        /* Register call result temps so translate resolves them. */
        for (const [key, name] of callResultTemps) temps.set(key, name);
        const body = emitDagBody(arena, root, map, plan, temps, {
          exitStyle, polarity, joinStyle, isVoid: allVoid, voidLeaves: allVoidLeaves,
        }, callCaps, callResultTemps);

        const paramsList = plan.params.length === 0
          ? "void"
          : plan.params.map((p) => `${p.type}${p.type.endsWith("*") ? "" : " "}${p.name}`).join(", ");
        const signature = `${returnType} ${functionName}(${paramsList})`;

        const integrationPlan = [
          ...map.integration,
          "write the function body into its container's source directory with the project umbrella includes",
        ];

        const source = [
          context === "umbrella" ? `#include "common.h"` : STANDALONE_TYPEDEF_BLOCK,
          "",
          ...map.typedefs.flatMap((t) => [t, ""]),
          ...(context === "standalone" ? map.externDecls.flatMap((d) => [d, ""]) : []),
          ...map.tentativeDefs.flatMap((d) => [d, ""]),
          ...calleeDecls.flatMap((d) => [d, ""]),
          `${signature} {`,
          ...renderStmts(body, "    "),
          "}",
          "",
        ].join("\n");

        const axisTag = `${exitStyle === "else" ? "-else" : ""}${polarity === "swapped" ? "-swap" : ""}${joinStyle === "shared" ? "-shared" : ""}`;
        candidates.push({
          label: `control-${plan.label || "noargs"}${axisTag}-${context}`,
          source,
          integrationPlan,
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }}}}
  }

  if (candidates.length === 0) {
    /* Report dominant error instead of generic refusal. */
    const counts = new Map<string, number>();
    for (const err of errors) {
      const base = err.slice(0, 80);
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const detail = dominant ? `dominant error (${dominant[1]}/${errors.length}): ${dominant[0]}` : "all axis combinations failed";
    return { invalid: `no parameter plan could express the control-flow structure: ${detail}` };
  }

  return candidates;
}

/* ---- Predicate translation (T2) ------------------------------------------- */

/** Stack-frame stores (spills and locals) are calling convention, not source. */
const isSpStore = (effect: { base?: import("./types.js").SymExpr | undefined; kind?: string }): boolean =>
  effect.kind === undefined || effect.kind === "store"
    ? effect.base !== undefined && canon(effect.base) === "@sp"
    : false;

/** Translate a DAG predicate into a C comparison expression. `negate` swaps
 *  the operator so the emitter can flip polarity without re-forking the DAG. */
export function predToC(
  pred: Predicate,
  map: StorageMap,
  plan: ParamPlan,
  temps: Map<string, string>,
  negate = false,
  pairRaw?: Map<string, string>,
): CExpr {
  let left: CExpr;
  if (
    pairRaw && pred.left.kind === "load" && pred.right?.kind === "const" &&
    pairRaw.has(canon({ ...pred.left, epoch: undefined }))
  ) {
    left = id(pairRaw.get(canon({ ...pred.left, epoch: undefined }))!);
  } else {
    left = translate(pred.left, map, plan, temps);
  }
  const right = pred.right ? translate(pred.right, map, plan, temps) : undefined;
  switch (pred.op) {
    case "eq": return { kind: "binary", op: negate ? "!=" : "==", left, right: right! };
    case "ltS": return { kind: "binary", op: negate ? ">=" : "<", left, right: right! };
    case "ltU": return {
      kind: "binary", op: negate ? ">=" : "<",
      left: { kind: "cast", type: "u32", expr: left },
      right: { kind: "cast", type: "u32", expr: right! },
    };
    case "lez": return { kind: "binary", op: negate ? ">" : "<=", left, right: int(0) };
    case "gtz": return { kind: "binary", op: negate ? "<=" : ">", left, right: int(0) };
    case "ltz": return { kind: "binary", op: negate ? ">=" : "<", left, right: int(0) };
    case "gez": return { kind: "binary", op: negate ? "<" : ">=", left, right: int(0) };
  }
}

/* ---- Sequential guard detection ------------------------------------------- */

/**
 * Check whether a test node represents a sequential guard pattern: the
 * true side's subtree is structurally identical to the false side's once
 * you ignore (a) one extra store that the true side adds and (b) the
 * version-epoch differences that exist only because of that store.
 *
 * Returns the single extra store effect when the pattern is detected,
 * or undefined if the two sides differ in any other way (including
 * more than one extra store, different branching structure, or
 * different leaf values).
 */
export function isSequentialGuard(
  arena: DagArenaLike,
  onTrue: DagRef,
  onFalse: DagRef,
): StoreEffect | undefined {
  let guardStore: StoreEffect | undefined;
  const visited = new Set<string>();

  /** Strip epoch from a SymExpr for comparison purposes. */
  const stripEpoch = (expr: SymExpr): SymExpr => {
    if (expr.kind === "load") {
      const result: SymExpr = { ...expr, epoch: undefined };
      return result;
    }
    if (expr.kind === "unary") return { ...expr, operand: stripEpoch(expr.operand) };
    if (expr.kind === "binary") return { ...expr, left: stripEpoch(expr.left), right: stripEpoch(expr.right) };
    return expr;
  };

  /** Canonical key for an effect, with epochs stripped. */
  const effKeyNoEpoch = (effect: Effect): string => {
    if (effect.kind === "store") {
      const base = effect.base ? canon(stripEpoch(effect.base)) : "";
      return `S:${base}|${effect.address}|${effect.width}=${canon(stripEpoch(effect.value))}`;
    }
    return `C:${effect.callee}`;
  };

  /** Canonical key for a predicate, with epochs stripped. */
  const predKeyNoEpoch = (pred: Predicate): string => {
    const leftKey = canon(stripEpoch(pred.left));
    const rightKey = pred.right ? canon(stripEpoch(pred.right)) : "";
    return `${pred.op}:${leftKey}:${rightKey}`;
  };

  /** Walk both subtrees in lockstep comparing structure modulo epochs. */
  const walk = (trueRef: DagRef, falseRef: DagRef): boolean => {
    /* Same node — identical (rare but possible with shared sub-DAGs). */
    if (trueRef === falseRef) return true;

    const pairKey = `${trueRef}|${falseRef}`;
    if (visited.has(pairKey)) return true;
    visited.add(pairKey);

    const tn = arena.node(trueRef);
    const fn = arena.node(falseRef);

    /* Both must be the same node kind. */
    if (tn.kind !== fn.kind) return false;

    if (tn.kind === "leaf" && fn.kind === "leaf") {
      /* Compare return values modulo epoch. */
      if (canon(stripEpoch(tn.value)) !== canon(stripEpoch(fn.value))) return false;

      /* The true side should have all effects the false side has, plus
       * exactly one more store effect. That extra store must be the same
       * across every leaf pair. */
      const trueKeys = tn.effects.map(effKeyNoEpoch);
      const falseKeys = fn.effects.map(effKeyNoEpoch);

      /* Strip matching effects from the front of both lists. Since effects
       * are accumulated in globally consecutive order, the extra store
       * appears at a fixed position. Walk both lists and find the diff. */
      let ti = 0;
      let fi = 0;
      let foundExtra = false;

      while (ti < trueKeys.length && fi < falseKeys.length) {
        if (trueKeys[ti]! === falseKeys[fi]!) {
          ti++;
          fi++;
        } else {
          /* true side has an extra effect at this position. */
          if (foundExtra) return false; /* more than one diff */
          foundExtra = true;

          const extra = tn.effects[ti]!;
          if (extra.kind !== "store") return false; /* extra effect must be a store */

          if (guardStore === undefined) {
            guardStore = extra as StoreEffect;
          } else {
            /* The extra store must be the same across ALL leaf pairs. */
            if (
              guardStore.address !== extra.address ||
              guardStore.width !== extra.width ||
              effKeyNoEpoch(guardStore) !== effKeyNoEpoch(extra)
            ) return false;
          }
          ti++;
        }
      }

      /* If true side has any remaining effects, they're all extra. */
      while (ti < trueKeys.length) {
        if (foundExtra) return false;
        foundExtra = true;
        const extra = tn.effects[ti]!;
        if (extra.kind !== "store") return false;
        if (guardStore === undefined) {
          guardStore = extra as StoreEffect;
        } else {
          if (
            guardStore.address !== extra.address ||
            guardStore.width !== extra.width ||
            effKeyNoEpoch(guardStore) !== effKeyNoEpoch(extra)
          ) return false;
        }
        ti++;
      }

      /* False side must have no remaining effects beyond what we matched. */
      if (fi < falseKeys.length) {
        /* True side is shorter — not a guard (false side has MORE stores). */
        return false;
      }

      if (!foundExtra) {
        /* No extra store — but the true side and false side might
         * be identical leaves (not a guard, just a shared leaf). */
         return true;
      }
      return true;
    }

    if (tn.kind === "test" && fn.kind === "test") {
      /* Compare predicates modulo epoch. */
      if (predKeyNoEpoch(tn.pred) !== predKeyNoEpoch(fn.pred)) return false;

      /* Recurse into corresponding children. Both subtrees must have the
       * same branching structure: TRUE/TRUE, FALSE/FALSE. */
      return walk(tn.onTrue, fn.onTrue) && walk(tn.onFalse, fn.onFalse);
    }

    /* dispatch or loop — not a sequential guard pattern. */
    return false;
  };

  if (!walk(onTrue, onFalse)) return undefined;
  return guardStore;
}

/* ---- Translation-aware DAG emitter (T2/T4) -------------------------------- */

interface EmitOptions {
  exitStyle: "early-return" | "else";
  polarity: "normal" | "swapped";
  joinStyle: "tail-dup" | "shared";
  /** All leaves are void — the function returns nothing on every path. */
  isVoid: boolean;
  voidLeaves: Set<DagRef>;
}

const isContinueMarker = (arena: DagArenaLike, ref: DagRef): boolean => {
  const node = arena.node(ref);
  return node.kind === "leaf" && canon(node.value) === "@__continue";
};

/**
 * Walk the DAG and emit real C statements: if/else for tests (with the
 * source-form axes), switch for dispatches (with the bounds-check merge),
 * stores + return for leaves (with mixed return/void fall-through).
 */
export function emitDagBody(
  arena: DagArenaLike,
  root: DagRef,
  map: StorageMap,
  plan: ParamPlan,
  temps: Map<string, string>,
  options: EmitOptions,
  callCaps?: Map<number, { calleeName: string; arity: number; returnsValue: boolean; returnType: string; paramTypes?: string[] }>,
  callResultTemps?: Map<string, string>,
): CStmt[] {
  /* Names the plan gives pointer type, so an argument or a return can be
   * written with the conversion C89 requires rather than left implicit. */
  const pointerNames = new Set(plan.params.filter((param) => param.type.trim().endsWith("*")).map((param) => param.name));
  /* The "else" exit style renders leaf returns as a shared temp assignment
   * with a single trailing return — a genuinely different C shape from the
   * early-return form. Only valid when every leaf carries a value; void or
   * mixed-return functions keep early-return rendering. */
  const elseMode = options.exitStyle === "else" && options.voidLeaves.size === 0;

  const leavesBelowMemo = new Map<DagRef, DagRef[]>();
  const leavesBelow = (ref: DagRef): DagRef[] => {
    const known = leavesBelowMemo.get(ref);
    if (known) return known;
    const node = arena.node(ref);
    const result = node.kind === "leaf"
      ? (isContinueMarker(arena, ref) ? [] : [ref])
      : node.kind === "dispatch"
        ? node.targets.flatMap((t) => leavesBelow(t))
        : node.kind === "loop"
          ? leavesBelow(node.body)
          : [...leavesBelow(node.onTrue), ...leavesBelow(node.onFalse)];
    leavesBelowMemo.set(ref, result);
    return result;
  };

  /* Per-leaf effects and effect key, for common-prefix factoring. */
  const sourceEffects = new Map<DagRef, import("./types.js").Effect[]>();
  for (const ref of leavesBelow(root)) {
    const node = arena.node(ref);
    if (node.kind === "leaf") {
      sourceEffects.set(ref, node.effects.filter((effect) => !(effect.kind === "store" && isSpStore(effect))));
    }
  }
  const effectKey = (effect: import("./types.js").Effect): string =>
    effect.kind === "call"
      ? `call(${effect.seq},${effect.callee})`
      : `${effect.base ? canon(effect.base) : ""}|${effect.address}|${effect.width}=${canon(effect.value)}`;

  const reachMemo = new Map<DagRef, Set<DagRef>>();
  const reach = (ref: DagRef): Set<DagRef> => {
    const known = reachMemo.get(ref);
    if (known) return known;
    const set = new Set<DagRef>([ref]);
    reachMemo.set(ref, set);
    const node = arena.node(ref);
    if (node.kind === "test") {
      const t = node;
      for (const r of reach(t.onTrue)) set.add(r);
      for (const r of reach(t.onFalse)) set.add(r);
    } else if (node.kind === "dispatch") {
      for (const t of node.targets) for (const r of reach(t)) set.add(r);
    } else if (node.kind === "loop") {
      for (const r of reach(node.body)) set.add(r);
    }
    return set;
  };

  const joinOf = (onTrue: DagRef, onFalse: DagRef): DagRef | undefined => {
    const reachTrue = reach(onTrue);
    const reachFalse = reach(onFalse);
    if (reachFalse.has(onTrue)) return onTrue;
    if (reachTrue.has(onFalse)) return onFalse;
    const shared = [...reachTrue].filter((r) => reachFalse.has(r) && !isContinueMarker(arena, r));
    for (const candidate of shared) {
      const covered = reach(candidate);
      if (shared.every((r) => covered.has(r))) return candidate;
    }
    return undefined;
  };

  const assignStmts = (effects: import("./types.js").Effect[]): CStmt[] => {
    const stmts: CStmt[] = [];
    for (const effect of effects) {
      if (effect.kind === "call") {
        const cap = callCaps?.get(effect.seq);
        const calleeName = effect.calleeName ?? effect.callee;
        const selected = cap
          ? argumentsForArity(effect, cap.arity)
          : { args: abiArguments(effect).filter((arg): arg is SymExpr => arg !== null) };
        if ("missing" in selected) {
          throw new Error(`${calleeName} argument slot(s) ${selected.missing.join(", ")} were never established`);
        }
        /* The cast must name the type the *declaration* names, which is the
         * expressible form — `void *`, not the project's `ObjectState *`,
         * which a standalone candidate has no definition for. */
        const declared = (slot: number): string | undefined => {
          const raw = cap?.paramTypes?.[slot];
          return raw === undefined ? undefined : (expressibleType(raw) ?? undefined);
        };
        const args = selected.args.map((a, slot) =>
          castForParameter(translate(a, map, plan, temps), declared(slot), pointerNames));
        const tempName = callResultTemps?.get(`CR(${effect.seq},v0)`);
        if (tempName) {
          stmts.push({ kind: "assign", target: id(tempName), value: { kind: "call", callee: calleeName, args } });
        } else {
          stmts.push({ kind: "exprstmt", expr: { kind: "call", callee: calleeName, args } });
        }
      } else {
        const target = map.access({ base: effect.base, offset: effect.address, width: effect.width, signed: true });
        stmts.push({ kind: "assign", target, value: translate(effect.value, map, plan, temps) });
      }
    }
    return stmts;
  };

  /* Tail-duplication re-expands shared join points, so a heavily-joined DAG
   * can expand combinatorially. Bound the actual expansion work: a pathological
   * DAG throws here (failing this axis combo fast) instead of grinding for
   * tens of seconds. The bound is far above any real function's statement
   * count, so functions that legitimately match are unaffected. */
  let emitBudget = DEFAULT_COST_BOUND * 100;
  const emit = (ref: DagRef, emitted: number, stopAt?: DagRef): CStmt[] => {
    if (--emitBudget <= 0) throw new Error("tail-duplication expansion exceeded budget");
    if (stopAt !== undefined && ref === stopAt) return [];
    if (isContinueMarker(arena, ref)) return [{ kind: "continue" }];
    const node = arena.node(ref);

    if (node.kind === "loop") {
      /* General-control v1 does not construct loops; the guarded constructor
       * owns them. A loop node reaching this emitter is out of class. */
      throw new Error(`loop node outside the general control-flow class`);
    }

    if (node.kind === "leaf") {
      const effs = sourceEffects.get(ref) ?? [];
      const statements = assignStmts(effs.slice(emitted));
      if (!options.voidLeaves.has(ref)) {
        /* The signature is `s32`, so a returned pointer needs the conversion
         * spelled out; `castForParameter` inserts nothing when it is already
         * a value. */
        const value = castForParameter(translate(node.value, map, plan, temps), "s32", pointerNames);
        if (elseMode) {
          statements.push({ kind: "assign", target: id("__ret"), value });
        } else {
          statements.push({ kind: "return", expr: value });
        }
      }
      return statements;
    }

    if (node.kind === "dispatch") {
      /* The dispatch index, with the `add(x, #-k)` base adjustment. */
      let switchExpr = translate(node.index, map, plan, temps);
      let baseCase = 0;
      if (node.index.kind === "binary" && node.index.op === "add") {
        if (node.index.right.kind === "const" && (node.index.right.value | 0) < 0) {
          switchExpr = translate(node.index.left, map, plan, temps);
          baseCase = -(node.index.right.value | 0);
        } else if (node.index.left.kind === "const" && (node.index.left.value | 0) < 0) {
          switchExpr = translate(node.index.right, map, plan, temps);
          baseCase = -(node.index.left.value | 0);
        }
      }
      const cases: Array<{ values: CExpr[]; body: CStmt[] }> = [];
      for (let i = 0; i < node.targets.length; i++) {
        cases.push({ values: [int(baseCase + i)], body: emit(node.targets[i]!, 0, stopAt) });
      }
      return [{ kind: "switch", expr: switchExpr, cases }];
    }

    /* node.kind === "test" */
    const below = leavesBelow(ref);
    const referenceRef = below[0];
    if (referenceRef === undefined) return [];
    const reference = sourceEffects.get(referenceRef) ?? [];
    let common = emitted;
    while (common < reference.length &&
      below.every((leafRef) => {
        const effs = sourceEffects.get(leafRef);
        return effs && common < effs.length && effectKey(effs[common]!) === effectKey(reference[common]!);
      })) {
      common++;
    }
    const statements = assignStmts(reference.slice(emitted, common));

    /* Polarity: swapped emits the negated predicate with arms reversed. */
    const swap = options.polarity === "swapped";
    const cond = predToC(node.pred, map, plan, temps, swap, undefined);

    /* Sequential guard detection: if the true and false sides are
     * structurally identical modulo one extra store on the true side
     * and the epoch bumps that store causes, emit the guard flat:
     *   if (cond) { guard_store; }
     * followed by the false side's continuation (which lacks the
     * guard's store). Otherwise fall through to the existing nested
     * if/else emitter. */
    const guardStore = isSequentialGuard(arena, node.onTrue, node.onFalse);
    if (guardStore) {
      const guardStmts = assignStmts([guardStore]);
      /* Always use the original (non-swapped) condition for the guard:
       * the guard store is on the onTrue side meaning "execute when the
       * predicate holds". The polarity axis still operates on nested
       * branches below the sequential guard chain. */
      const guardCond = predToC(node.pred, map, plan, temps, false, undefined);
      if (swap) {
        /* Swapped polarity: put the guard in the else arm with the
         * condition negated, matching the swapped form convention. */
        statements.push({ kind: "if", cond, body: [], elseBody: guardStmts });
      } else {
        statements.push({ kind: "if", cond: guardCond, body: guardStmts });
      }
      /* Continue with the FALSE side, which has the same structure but
       * lacks the guard's store. Its effects start at `common` because
       * the guard's store is not among them. */
      statements.push(...emit(node.onFalse, common, stopAt));
      return statements;
    }

    if (options.joinStyle === "shared") {
      const join = joinOf(node.onTrue, node.onFalse);
      if (join !== undefined && join !== stopAt) {
        if (join === node.onTrue) {
          const elseArm = emit(node.onFalse, common, join);
          if (elseArm.length > 0) statements.push({ kind: "if", cond: predToC(node.pred, map, plan, temps, !swap), body: elseArm });
          statements.push(...emit(join, common, stopAt));
          return statements;
        }
        if (join === node.onFalse) {
          const thenArm = emit(node.onTrue, common, join);
          if (thenArm.length > 0) statements.push({ kind: "if", cond, body: thenArm });
          statements.push(...emit(join, common, stopAt));
          return statements;
        }
        const thenArm = emit(node.onTrue, common, join);
        const elseArm = emit(node.onFalse, common, join);
        statements.push({
          kind: "if",
          cond,
          body: thenArm,
          ...(elseArm.length > 0 ? { elseBody: elseArm } : {}),
        });
        statements.push(...emit(join, common, stopAt));
        return statements;
      }
    }

    const thenArm = emit(node.onTrue, common, stopAt);
    const elseArm = emit(node.onFalse, common, stopAt);
    if (thenArm.length === 0 && elseArm.length > 0) {
      /* An empty then-arm is a negated single-arm test — the polarity the
       * machine branches with. */
      statements.push({ kind: "if", cond: predToC(node.pred, map, plan, temps, !swap), body: elseArm });
      return statements;
    }
    statements.push({
      kind: "if",
      cond,
      body: thenArm,
      ...(elseArm.length > 0 ? { elseBody: elseArm } : {}),
    });
    return statements;
  };

  /* Build prologue: call result temp declarations. */
  const prologue: CStmt[] = [];
  if (callResultTemps) {
    for (const [key, name] of callResultTemps) {
      const seq = Number(key.slice(3, key.indexOf(",")));
      const cap = callCaps?.get(seq);
      prologue.push({ kind: "declare", type: cap ? (cap.returnType === "void" ? "s32" : cap.returnType) : "s32", name });
    }
  }

  const body = emit(root, 0);
  if (elseMode) {
    /* Wrap the body in: s32 __ret; <body_for_each_leaf_sets __ret>; return __ret; */
    return [
      ...prologue,
      { kind: "declare", type: "s32", name: "__ret" },
      ...body,
      { kind: "return", expr: id("__ret") },
    ];
  }
  return [...prologue, ...body];
}

