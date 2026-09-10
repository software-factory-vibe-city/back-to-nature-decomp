/**
 * Unit tests for control-structure.ts — DAG → structured C.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DagArena, canon, binary, constExpr } from "./exec.js";
import { structureDag, computeDagStats, collectAllAtomsAndExprs, isSequentialGuard, sequentialGuardDepth, type DagArenaLike } from "./control-structure.js";
import type { DagRef, Predicate, SymExpr, StoreEffect } from "./types.js";

/* ---- Helper: build unique leaves ---------------------------------------- */

function makeArena(): DagArena {
  return new DagArena();
}

function leaf(arena: DagArena, value: number): DagRef {
  return arena.leaf({ kind: "const", value } as SymExpr);
}

function v0leaf(arena: DagArena): DagRef {
  return arena.leaf({ kind: "entry", register: "v0" } as SymExpr);
}

function unaryLeaf(arena: DagArena, op: string, inner: SymExpr): DagRef {
  return arena.leaf({ kind: "unary", op, operand: inner } as SymExpr);
}

function loadLeaf(arena: DagArena, address: number, signed: boolean): DagRef {
  return arena.leaf({
    kind: "load", address, width: 4, signed,
    base: { kind: "entry", register: "a0" },
  } as SymExpr);
}

/* ---- computeDagStats ---------------------------------------------------- */

test("computeDagStats: single leaf", () => {
  const arena = makeArena();
  const lf = leaf(arena, 42);
  const stats = computeDagStats(arena, lf);
  assert.equal(stats.leafCount, 1);
  assert.equal(stats.testCount, 0);
  assert.equal(stats.estimatedStmts, 1);
  assert.equal(stats.hasJoins, false);
});

test("computeDagStats: simple test with two distinct leaves", () => {
  const arena = makeArena();
  const l1 = leaf(arena, 1);
  const l2 = leaf(arena, 2);
  const t = arena.test(
    { op: "eq", left: { kind: "entry", register: "a0" }, right: constExpr(0) },
    l1, l2,
  );
  const stats = computeDagStats(arena, t);
  assert.equal(stats.leafCount, 2);
  assert.equal(stats.testCount, 1);
  assert.equal(stats.estimatedStmts, 3);
  assert.equal(stats.hasJoins, false);
});

test("computeDagStats: detects join (shared leaf with indegree > 1)", () => {
  const arena = makeArena();
  const shared = leaf(arena, 1);
  const l2 = leaf(arena, 2);
  const l3 = leaf(arena, 3);
  /* Build: outer -> onTrue=shared, onFalse=inner
   *        inner -> onTrue=l2, onFalse=shared
   * shared is reached from outer.onTrue AND from inner.onFalse
   * -> indegree 2. All 3 leaves are distinct and reachable. */
  const inner = arena.test(
    { op: "eq", left: { kind: "entry", register: "a1" }, right: constExpr(0) },
    l2, shared,
  );
  const outer = arena.test(
    { op: "eq", left: { kind: "entry", register: "a0" }, right: constExpr(0) },
    shared, inner,  /* onTrue=shared, onFalse=inner */
  );
  const stats = computeDagStats(arena, outer);
  assert.equal(stats.leafCount, 2); /* only shared and l2 are reachable; l3 is orphaned */
  assert.equal(stats.testCount, 2);
  assert.equal(stats.hasJoins, true);  /* shared has indegree 2 */
});

test("computeDagStats: detects spine (chain of tests)", () => {
  const arena = makeArena();
  const leaves = [0, 1, 2, 3, 4].map(v => leaf(arena, v));
  /* Chain: test3 -> leaf3 ; test3 -> test2 -> leaf2 ; test2 -> test1 -> leaf1 ; test1 -> test0 -> leaf0 ; test0 -> leaf4 */
  let current = leaves[4]!;
  for (let i = 3; i >= 0; i--) {
    current = arena.test(
      { op: "eq", left: { kind: "entry", register: "a0" }, right: constExpr(i) },
      leaves[i]!, current,
    );
  }
  const stats = computeDagStats(arena, current);
  assert.equal(stats.testCount, 4);
  assert.equal(stats.leafCount, 5);
  /* maxSpineDepth: test0->test1->test2 are chain (test3 both arms leaf, terminates) */
  assert.ok(stats.maxSpineDepth >= 2);
  assert.equal(stats.hasJoins, false);
});

/* ---- structureDag ------------------------------------------------------- */

test("structureDag: single leaf returns no control statements", () => {
  const arena = makeArena();
  const lf = leaf(arena, 1);
  const result = structureDag(arena, lf);
  assert.ok(!("invalid" in result));
  if ("invalid" in result) return;
  assert.equal(result.stmts.length, 0);
  assert.equal(result.leafReturns.size, 1);
  assert.equal(result.leafIsVoid.size, 0);
  assert.equal(result.hasControl, false);
});

test("structureDag: void leaf recorded correctly", () => {
  const arena = makeArena();
  const lf = v0leaf(arena);
  const result = structureDag(arena, lf);
  assert.ok(!("invalid" in result));
  if ("invalid" in result) return;
  assert.equal(result.leafIsVoid.size, 1);
  assert.ok(result.leafIsVoid.has(lf));
});

test("structureDag: simple test produces if/else structure", () => {
  const arena = makeArena();
  const l1 = leaf(arena, 1);
  const l2 = leaf(arena, 2);
  const t = arena.test(
    { op: "eq", left: { kind: "entry", register: "a0" }, right: constExpr(0) },
    l1, l2,
  );
  const result = structureDag(arena, t);
  assert.ok(!("invalid" in result));
  if ("invalid" in result) return;
  assert.equal(result.stmts.length, 1);
  assert.equal(result.stmts[0]!.kind, "if");
  assert.equal(result.leafReturns.size, 2);
  assert.equal(result.leafIsVoid.size, 0);
});

test("structureDag: unrolled-loop spine is refused", () => {
  const arena = makeArena();
  const leaves = Array.from({ length: 12 }, (_, i) => leaf(arena, i));
  /* Create a chain of 10 tests: each tests a0 against a value. */
  let current = leaves[11]!;
  for (let i = 10; i >= 1; i--) {
    current = arena.test(
      { op: "eq", left: { kind: "entry", register: "a0" }, right: constExpr(i) },
      leaves[i]!, current,
    );
  }
  /* The last test (test1) has leaf1 and the leaf11 continuation */
  const result = structureDag(arena, current, { spineThreshold: 8, costBound: 200 });
  assert.ok("invalid" in result);
  if ("invalid" in result) {
    assert.match(result.invalid, /unrolled-loop spine/);
  }
});

test("structureDag: dispatch node produces switch", () => {
  const arena = makeArena();
  const l1 = leaf(arena, 1);
  const l2 = leaf(arena, 2);
  const l3 = leaf(arena, 3);
  const d = arena.dispatch(
    { kind: "entry", register: "a0" },
    [l1, l2, l3],
  );
  const result = structureDag(arena, d);
  assert.ok(!("invalid" in result));
  if ("invalid" in result) return;
  assert.equal(result.stmts.length, 1);
  assert.equal(result.stmts[0]!.kind, "switch");
  const sw = result.stmts[0]! as { kind: "switch"; cases: Array<unknown> };
  assert.equal(sw.cases.length, 3);
});

test("structureDag: cost bound triggers refusal", () => {
  const arena = makeArena();
  const leaves = Array.from({ length: 210 }, (_, i) => leaf(arena, i));
  /* Create 205 test nodes, exceeding costBound 200. */
  let current = leaves[209]!;
  for (let i = 208; i >= 0; i--) {
    current = arena.test(
      { op: "eq", left: { kind: "entry", register: "a0" }, right: constExpr(i) },
      leaves[i]!, current,
    );
  }
  const result = structureDag(arena, current, { costBound: 200, spineThreshold: 1000 });
  assert.ok("invalid" in result);
  if ("invalid" in result) {
    assert.match(result.invalid, /structure too large/);
  }
});

test("collectAllAtomsAndExprs: collects from all leaves and predicates", () => {
  const arena = makeArena();
  const v1: SymExpr = { kind: "load", address: 0x10, width: 4, signed: true, base: { kind: "entry", register: "a0" } };
  const v2: SymExpr = { kind: "load", address: 0x14, width: 2, signed: false, base: { kind: "entry", register: "a0" } };
  const l1 = arena.leaf(v1);
  const l2 = arena.leaf(v2);
  const pred: Predicate = { op: "eq", left: v1, right: constExpr(0) };
  const root = arena.test(pred, l1, l2);
  const { atoms, exprs } = collectAllAtomsAndExprs(arena, root);
  assert.ok(atoms.size >= 2);
  assert.ok(exprs.length >= 2);
});

test("structureDag: mixed void and valued leaves", () => {
  const arena = makeArena();
  const valued = leaf(arena, 1);
  const voidL = v0leaf(arena);
  const pred: Predicate = { op: "eq", left: { kind: "entry", register: "a0" }, right: constExpr(0) };
  const root = arena.test(pred, valued, voidL);
  const result = structureDag(arena, root);
  assert.ok(!("invalid" in result));
  if ("invalid" in result) return;
  /* Both leaves are recorded (returns map holds every leaf, void included);
   * leafIsVoid marks exactly the unset-$v0 one. */
  assert.equal(result.leafReturns.size, 2);
  assert.equal(result.leafIsVoid.size, 1);
  assert.ok(result.leafIsVoid.has(voidL));
});
/* ---- isSequentialGuard (plan Step 2) ------------------------------------- */

/** A store effect builder for guard-pattern tests. */
function storeEffect(address: number, value: SymExpr, seq = 0): StoreEffect {
  return { kind: "store", address, width: 2, value, seq, vram: 0 };
}

/** A 16-bit unsigned load at `address` with an optional epoch. */
function load16(address: number, epoch?: number): SymExpr {
  return {
    kind: "load",
    address,
    width: 2,
    signed: false,
    ...(epoch !== undefined ? { epoch } : {}),
  };
}

/** add(zext16(v), #5) — the recurring guard-body/return idiom. */
function bump5(value: SymExpr): SymExpr {
  return binary("add", { kind: "unary", op: "zext16", operand: value }, constExpr(5));
}

test("isSequentialGuard: genuine guard returns the single store", () => {
  const arena = makeArena();
  /* onTrue Leaf: one store (field += 5), return field + 5.
   * onFalse Leaf: same return, no store. Epoch differs only because the
   * true side's store precedes the re-read. */
  const trueLeaf = arena.leaf(bump5(load16(0x100, 1)), [
    storeEffect(0x100, bump5(load16(0x100))),
  ]);
  const falseLeaf = arena.leaf(bump5(load16(0x100)));
  const guard = isSequentialGuard(arena, trueLeaf, falseLeaf);
  assert.ok(guard, "expected the extra store to be detected");
  if (guard) {
    assert.equal(guard.kind, "store");
    assert.equal(guard.address, 0x100);
    assert.equal(guard.width, 2);
  }
});

test("isSequentialGuard: real nested branch (different leaf values) is rejected", () => {
  const arena = makeArena();
  const trueLeaf = arena.leaf(bump5(load16(0x100)), [storeEffect(0x100, bump5(load16(0x100)))]);
  const falseLeaf = arena.leaf(constExpr(7));
  assert.equal(isSequentialGuard(arena, trueLeaf, falseLeaf), undefined);
});

test("isSequentialGuard: a true side with two extra stores is rejected", () => {
  const arena = makeArena();
  const trueLeaf = arena.leaf(bump5(load16(0x200)), [
    storeEffect(0x100, bump5(load16(0x100))),
    storeEffect(0x200, bump5(load16(0x200))),
  ]);
  const falseLeaf = arena.leaf(bump5(load16(0x200)));
  assert.equal(isSequentialGuard(arena, trueLeaf, falseLeaf), undefined);
});

test("isSequentialGuard: identical leaves are not a guard (no extra store)", () => {
  const arena = makeArena();
  const l1 = arena.leaf(bump5(load16(0x100)));
  const l2 = arena.leaf(bump5(load16(0x100)));
  assert.equal(isSequentialGuard(arena, l1, l2), undefined);
});

test("isSequentialGuard: two-level guard chain is detected across tests", () => {
  const arena = makeArena();
  /* Two sequential guards: if (f1 < 255) f1 += 5; if (f2 < 255) f2 += 5;
   * The first guard's TRUE side runs guard2 with bumped epochs; its FALSE
   * side runs the structurally identical guard2 with carry-0 epochs. */
  const s1 = storeEffect(0x100, bump5(load16(0x100)));
  const s2 = storeEffect(0x200, bump5(load16(0x200, 1)));

  /* FALSE side of guard1: guard2 with epoch 0. */
  const g2FTrue = arena.leaf(bump5(load16(0x200, 1)), [s2]);
  const g2FFalse = arena.leaf(bump5(load16(0x200)));
  const t2F = arena.test(
    { op: "ltS", left: load16(0x200), right: constExpr(255) },
    g2FTrue, g2FFalse,
  );

  /* TRUE side of guard1: guard2 with epoch 1 (after store1). */
  const g2TTrue = arena.leaf(bump5(load16(0x200, 2)), [s1, s2]);
  const g2TFalse = arena.leaf(bump5(load16(0x200, 1)), [s1]);
  const t2T = arena.test(
    { op: "ltS", left: load16(0x200, 1), right: constExpr(255) },
    g2TTrue, g2TFalse,
  );

  const root = arena.test(
    { op: "ltS", left: load16(0x100), right: constExpr(255) },
    t2T, t2F,
  );
  const guard = isSequentialGuard(arena, arena.node(root).onTrue, arena.node(root).onFalse);
  assert.ok(guard, "expected the first guard's store to be detected for a chain");
  if (guard) assert.equal(guard.address, 0x100);
});

/* ---- sequentialGuardDepth / flat guard estimate (plan Step 3) ------------ */

test("sequentialGuardDepth: counts a linear guard chain", () => {
  const arena = makeArena();
  /* Two sequential guards: if (f1 < 255) f1 += 5; if (f2 < 255) f2 += 5;
   * The root's TRUE side runs guard2 with bumped epochs; FALSE side runs
   * the structurally identical guard2 with carry-0 epochs. */
  const s1 = storeEffect(0x100, bump5(load16(0x100)));
  const s2 = storeEffect(0x200, bump5(load16(0x200, 1)));

  const g2FTrue = arena.leaf(bump5(load16(0x200, 1)), [s2]);
  const g2FFalse = arena.leaf(bump5(load16(0x200)));
  const t2F = arena.test(
    { op: "ltS", left: load16(0x200), right: constExpr(255) },
    g2FTrue, g2FFalse,
  );

  const g2TTrue = arena.leaf(bump5(load16(0x200, 2)), [s1, s2]);
  const g2TFalse = arena.leaf(bump5(load16(0x200, 1)), [s1]);
  const t2T = arena.test(
    { op: "ltS", left: load16(0x200, 1), right: constExpr(255) },
    g2TTrue, g2TFalse,
  );

  const root = arena.test(
    { op: "ltS", left: load16(0x100), right: constExpr(255) },
    t2T, t2F,
  );

  /* The chain walks the root, then its FALSE side (guard2), which bottoms
   * out at the leaf — two guards deep. */
  assert.equal(sequentialGuardDepth(arena, root), 2);
  /* A plain leaf is depth 0. */
  assert.equal(sequentialGuardDepth(arena, g2FFalse), 0);
});
