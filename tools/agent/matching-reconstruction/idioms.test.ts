/**
 * Tests for the constant-divisor recognition module (D2).
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { evaluateConcrete, recognizeDivision } from "./idioms.js";
import type { SymExpr } from "./types.js";

/* ---- evaluateConcrete tests ----------------------------------------------- */

test("evaluateConcrete evaluates a simple const", () => {
  assert.equal(evaluateConcrete({ kind: "const", value: 42 }, new Map()), 42);
});

test("evaluateConcrete evaluates binary add", () => {
  const expr: SymExpr = {
    kind: "binary", op: "add",
    left: { kind: "entry", register: "a0" },
    right: { kind: "const", value: 5 },
  };
  const env = new Map<string, number>([["@a0", 10]]);
  assert.equal(evaluateConcrete(expr, env), 15);
});

test("evaluateConcrete evaluates mulLo and mulHiS", () => {
  const left: SymExpr = { kind: "entry", register: "a0" };
  const right: SymExpr = { kind: "entry", register: "a1" };
  const mulHi: SymExpr = { kind: "binary", op: "mulHiS", left, right };
  const mulLo: SymExpr = { kind: "binary", op: "mulLo", left, right };
  const env = new Map<string, number>([["@a0", 7], ["@a1", 6]]);
  assert.equal(evaluateConcrete(mulLo, env), 42);
  assert.equal(evaluateConcrete(mulHi, env), 0);
});

test("evaluateConcrete returns null for unknown atoms", () => {
  const expr: SymExpr = { kind: "entry", register: "a0" };
  assert.equal(evaluateConcrete(expr, new Map()), null);
});

/* ---- recognizeDivision tests ---------------------------------------------- */

test("recognizeDivision rejects a simple add (no division marker)", () => {
  const expr: SymExpr = {
    kind: "binary", op: "add",
    left: { kind: "entry", register: "a0" },
    right: { kind: "const", value: 1 },
  };
  assert.equal(recognizeDivision(expr), null);
});

test("recognizeDivision rejects expressions with two distinct leaves", () => {
  const expr: SymExpr = {
    kind: "binary", op: "add",
    left: { kind: "entry", register: "a0" },
    right: { kind: "entry", register: "a1" },
  };
  assert.equal(recognizeDivision(expr), null);
});

test("recognize unsigned division via srl (power of 2)", () => {
  const x: SymExpr = { kind: "entry", register: "a0" };
  const expr: SymExpr = {
    kind: "binary", op: "srl",
    left: x,
    right: { kind: "const", value: 3 },
  };
  const result = recognizeDivision(expr);
  assert.ok(result !== null, "should recognize srl-based division");
  assert.equal(result.op, "/");
  assert.equal(result.divisor, 8);
});

test("recognize signed division via compiler adjustment pattern", () => {
  const x: SymExpr = { kind: "entry", register: "a0" };
  const sign: SymExpr = { kind: "binary", op: "sra", left: x, right: { kind: "const", value: 31 } };
  const adj: SymExpr = { kind: "binary", op: "srl", left: sign, right: { kind: "const", value: 29 } };
  const sum: SymExpr = { kind: "binary", op: "add", left: x, right: adj };
  const expr: SymExpr = { kind: "binary", op: "sra", left: sum, right: { kind: "const", value: 3 } };
  const result = recognizeDivision(expr);
  assert.ok(result !== null, "should recognize signed power-of-two division");
  assert.equal(result.op, "/");
  assert.equal(result.divisor, 8);
});

test("recognize remainder (unsigned) via sub of mulLo", () => {
  /* x % 8 = x - ((x / 8) * 8). Compiler emits mulLo for the multiply by 8. */
  const x: SymExpr = { kind: "entry", register: "a0" };
  const quot: SymExpr = { kind: "binary", op: "srl", left: x, right: { kind: "const", value: 3 } };
  const times8: SymExpr = { kind: "binary", op: "mulLo", left: quot, right: { kind: "const", value: 8 } };
  const rem: SymExpr = { kind: "binary", op: "sub", left: x, right: times8 };
  const result = recognizeDivision(rem);
  assert.ok(result !== null, "should recognize unsigned remainder");
  assert.equal(result.op, "%");
  assert.equal(result.divisor, 8);
});

test("recognizeDivision on bare sra does NOT match division", () => {
  const x: SymExpr = { kind: "entry", register: "a0" };
  const expr: SymExpr = { kind: "binary", op: "sra", left: x, right: { kind: "const", value: 3 } };
  assert.equal(recognizeDivision(expr), null, "bare sra should NOT be recognized");
});

test("recognize unsigned division by 10 via mulHiU + srl", () => {
  const x: SymExpr = { kind: "entry", register: "a0" };
  const mulHi: SymExpr = {
    kind: "binary", op: "mulHiU",
    left: x,
    right: { kind: "const", value: 0xCCCCCCCD },
  };
  const expr: SymExpr = {
    kind: "binary", op: "srl",
    left: mulHi,
    right: { kind: "const", value: 3 },
  };
  const result = recognizeDivision(expr);
  assert.ok(result !== null, "should recognize unsigned division by 10 via mulHiU+srl");
  assert.equal(result.op, "/");
  assert.equal(result.divisor, 10);
});