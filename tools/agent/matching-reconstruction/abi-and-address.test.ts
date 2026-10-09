/**
 * Complete ABI call snapshots, preserved signature types, call-result pointer
 * bases, and compositional address recovery.
 *
 * Each of these replaced a place where the engine manufactured missing context
 * rather than admitting it did not have it: a fifth argument invented as zero,
 * a pointer parameter re-declared `s32`, a dereferenced call result refused, a
 * two-subscript address called "computed". The tests hold the corrected
 * behaviour *and* the refusals — a slot the caller never wrote must still be a
 * refusal, not a new default.
 */

import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";
import { executeFunction, canon, splitIndexedAddress, constExpr, binary } from "./exec.js";
import { decodeFunction } from "./decode.js";
import { abiArguments, argumentsForArity, calleeDeclarations, expressibleType } from "./effect-construct.js";
import { inferSignatureRange, resolveSignature } from "./callee-signature.js";
import { recognizeConstantMultiply } from "./idioms.js";
import { recoverContext } from "./context-product.js";
import { reconstructFunction } from "./engine.js";
import { requireFunctionLocation } from "../../lib/symbolIndex.js";
import type { CallEffect, SymExpr } from "./types.js";
import { assemble } from "./fixture-asm.js";
import { parseC, field } from "../residual-source-search/tree-sitter-c.js";

const configured = existsSync(join(ROOT, "configs/splat"));
const projectTest = configured ? test : test.skip;

const call = (overrides: Partial<CallEffect> = {}): CallEffect => ({
  kind: "call",
  callee: "callee",
  seq: 0,
  vram: 0x80010000,
  args: [
    { kind: "entry", register: "a0" },
    { kind: "const", value: 1 },
    { kind: "const", value: 2 },
    { kind: "const", value: 3 },
  ],
  resultUsed: false,
  ...overrides,
});

/* ---- the ABI snapshot ----------------------------------------------------- */

test("the ABI list is register slots then the outgoing-area slots", () => {
  const fifth: SymExpr = { kind: "binary", op: "add", left: { kind: "entry", register: "a0" }, right: { kind: "const", value: 0x2a } };
  const full = abiArguments(call({ stackArgs: [fifth] }));
  assert.equal(full.length, 5);
  assert.equal(canon(full[4]!), canon(fifth));
});

test("a slot the caller never wrote is a refusal, never a zero", () => {
  const selected = argumentsForArity(call({ stackArgs: [null] }), 5);
  assert.ok("missing" in selected, "an unestablished slot must fail the arity hypothesis");
  assert.deepEqual((selected as { missing: number[] }).missing, [4]);
});

test("an arity the snapshot covers yields exactly that many arguments", () => {
  const fifth: SymExpr = { kind: "const", value: 0x55 };
  const selected = argumentsForArity(call({ stackArgs: [fifth] }), 5);
  assert.ok(!("missing" in selected));
  assert.equal((selected as { args: SymExpr[] }).args.length, 5);
});

test("a written outgoing slot raises the inferred arity past four", () => {
  const args: Array<SymExpr | null> = [
    { kind: "entry", register: "a0" },
    { kind: "const", value: 1 },
    { kind: "const", value: 2 },
    { kind: "const", value: 3 },
    { kind: "const", value: 4 },
  ];
  const range = inferSignatureRange(null, undefined, { id: "exe" } as never, args, new Set(), 0);
  assert.equal(range.arityHi, 5, "the fifth slot is explicit evidence of a fifth argument");
  assert.equal(range.arityLo, 5, "and it is a lower bound, not only an upper hint");
});

test("an untouched argument register is not counted as an argument", () => {
  const args: Array<SymExpr | null> = [
    { kind: "entry", register: "a0" },
    { kind: "entry", register: "a1" },
    { kind: "entry", register: "a2" },
    { kind: "entry", register: "a3" },
  ];
  const range = inferSignatureRange(null, undefined, { id: "exe" } as never, args, new Set(), 0);
  assert.equal(range.arityHi, 0, "the caller established nothing, so nothing is claimed");
});

projectTest("forwarding the caller's own arguments does not narrow the callee's floor", () => {
  /* `CopyVec3` reads two arguments, which its own machine code proves. A
   * caller that forwards `$a0` and `$a1` untouched writes no instruction at
   * all, so the call site looks silent — and silence is not evidence of
   * absence. Reading it as a bound is how a two-argument callee is reported as
   * taking none, and every hypothesis built from the range then calls it with
   * the wrong arity. */
  const container = requireFunctionLocation("func_8001F190").container;
  const forwarded: Array<SymExpr | null> = [0, 1, 2, 3].map((index) => ({ kind: "entry", register: `a${index}` }));
  const range = inferSignatureRange("CopyVec3", undefined, container, forwarded, new Set(), 0);
  const independent = resolveSignature("CopyVec3", undefined, container);
  assert.ok(!("unknown" in independent));
  assert.equal(range.arityLo, (independent as { arity: number }).arity);
  assert.ok(range.arityHi >= range.arityLo, "the upper bound never falls below the floor");
});

projectTest("the distance wrapper reconstructs, as it did before the rewrite", () => {
  /* A census regression: this matched, then stopped, with "no parameter plan
   * could express the relation's values". The cause was the shared scratch
   * directory `targetWitness` assembles into — under concurrent workers the
   * witness for `SquareRoot0` came back garbled or absent, its arity collapsed,
   * and no plan could pass the argument. Held here because the function is
   * small and its shape — four `s16` parameters, one call, a narrowed return —
   * is the one that broke. */
  const result = reconstructFunction({ functionName: "ovl_23_func_800BA30C", notify: () => {} });
  assert.equal(result.state, "exact-candidate", result.unresolved?.detail);
  assert.match(result.winner!.source, /SquareRoot0\(/);
});

projectTest("a clobbered argument register is not a consumed call result", () => {
  /* Two calls in a row. The executor marks every caller-saved register the
   * first call clobbers with a `call-result` atom, so the second call's `$a0`
   * slot holds one — and reading any `call-result` as consumption reports the
   * first call's *return value* as used by the second. The candidate then
   * declares a temporary nothing reads, and a callee correctly declared `void`
   * invalidates the whole hypothesis: this function reconstructed only while
   * its callees' signatures were the weaker ABI guess. */
  const result = reconstructFunction({ functionName: "func_8001FE7C", notify: () => {} });
  assert.equal(result.state, "exact-candidate", result.unresolved?.detail);
  assert.ok(!/callRet/.test(result.winner!.source),
    `no call result is consumed here, so no temporary holds one:\n${result.winner!.source}`);
});

/* ---- preserved signature types -------------------------------------------- */

test("a pointer parameter stays a pointer in the declaration", () => {
  const decls = calleeDeclarations(new Map([[0, {
    arity: 2, calleeName: "CopyVec3", returnsValue: false, returnType: "void",
    paramTypes: ["Vec3 *", "Vec3 *"],
  }]]));
  assert.ok(Array.isArray(decls));
  assert.match((decls as string[])[0]!, /void CopyVec3\(void \*arg0, void \*arg1\);/);
});

test("an aggregate passed by value is refused rather than re-typed s32", () => {
  const declared = calleeDeclarations(new Map([[0, {
    arity: 1, calleeName: "TakesStruct", returnsValue: false, returnType: "void",
    paramTypes: ["Vec3"],
  }]]));
  assert.ok(!Array.isArray(declared), "an aggregate by value changes the calling sequence");
  assert.match((declared as { invalid: string }).invalid, /cannot name/);
});

test("expressible types keep scalars, collapse pointers, refuse aggregates", () => {
  assert.equal(expressibleType("u16"), "u16");
  assert.equal(expressibleType("Vec3 *"), "void *");
  assert.equal(expressibleType("Vec3"), null);
});

/* ---- compositional addresses ---------------------------------------------- */

test("two scaled index terms split into an outer and an inner subscript", () => {
  /* base + (i << 3) + (j << 1) + 4 */
  const base: SymExpr = { kind: "entry", register: "a0" };
  const i: SymExpr = { kind: "entry", register: "a1" };
  const j: SymExpr = { kind: "entry", register: "a2" };
  const address = binary("add",
    binary("add", binary("add", base, binary("sll", i, constExpr(3))), binary("sll", j, constExpr(1))),
    constExpr(4));
  const split = splitIndexedAddress(address);
  assert.ok(split, "a two-subscript address is not a computed address");
  assert.equal(split!.offset, 4);
  assert.equal(split!.outerIndex?.scale, 8, "the wider stride is the outer subscript");
  assert.equal(split!.index?.scale, 2);
});

test("two subscripts of equal stride have no nesting order and are refused", () => {
  const base: SymExpr = { kind: "entry", register: "a0" };
  const address = binary("add",
    binary("add", base, binary("sll", { kind: "entry", register: "a1" }, constExpr(2))),
    binary("sll", { kind: "entry", register: "a2" }, constExpr(2)));
  assert.equal(splitIndexedAddress(address), null);
});

test("three subscripts are refused rather than read as two", () => {
  const base: SymExpr = { kind: "entry", register: "a0" };
  const address = binary("add", binary("add", binary("add", base,
    binary("sll", { kind: "entry", register: "a1" }, constExpr(4))),
    binary("sll", { kind: "entry", register: "a2" }, constExpr(3))),
    binary("sll", { kind: "entry", register: "a3" }, constExpr(1)));
  assert.equal(splitIndexedAddress(address), null);
});

/* ---- recovered operations -------------------------------------------------- */

test("a shift-and-add expansion is read back as the multiply it came from", () => {
  /* ((i << 2) + i) << 3 — the compiler's expansion of i * 40. */
  const i: SymExpr = { kind: "entry", register: "a0" };
  const expansion = binary("sll", binary("add", binary("sll", i, constExpr(2)), i), constExpr(3));
  const recognized = recognizeConstantMultiply(expansion);
  assert.ok(recognized, "the expansion is linear in one value");
  assert.equal(recognized!.factor, 40);
  assert.equal(canon(recognized!.operand), "@a0");
});

test("a power of two stays a shift, and a sum of two values is not a multiply", () => {
  const i: SymExpr = { kind: "entry", register: "a0" };
  assert.equal(recognizeConstantMultiply(binary("sll", i, constExpr(3))), null);
  const j: SymExpr = { kind: "entry", register: "a1" };
  assert.equal(recognizeConstantMultiply(binary("add", binary("sll", i, constExpr(2)), j)), null);
});

test("an expansion with an additive term is not spelled as a scale", () => {
  const i: SymExpr = { kind: "entry", register: "a0" };
  const withOffset = binary("add", binary("sll", binary("add", binary("sll", i, constExpr(2)), i), constExpr(3)), constExpr(7));
  assert.equal(recognizeConstantMultiply(withOffset), null);
});

/* ---- end to end against the project --------------------------------------- */

projectTest("a dereferenced call result becomes a typed local, not a refusal", () => {
  const result = reconstructFunction({ functionName: "ovl_11_func_800BF3D0", notify: () => {} });
  assert.equal(result.state, "exact-candidate", result.unresolved?.detail);
  assert.match(result.winner!.source, /void \*func_8001EF98\(void\);/, "the callee returns a pointer and is declared as one");
});

projectTest("a member array at a constant offset reaches a compiling draft", () => {
  const result = reconstructFunction({ functionName: "ovl_11_func_80116878", notify: () => {} });
  assert.ok(result.bestEffort, `expected a draft; state ${result.state}: ${result.unresolved?.detail}`);
  assert.match(result.bestEffort!.source, /\(u16 \*\)\(\(\(u8 \*\)arg0\) \+ 0x28\)/);
});

projectTest("a two-subscript address reaches a compiling draft", () => {
  const result = reconstructFunction({ functionName: "ovl_11_func_800D5D38", notify: () => {} });
  assert.ok(result.bestEffort, `expected a draft; state ${result.state}: ${result.unresolved?.detail}`);
  assert.match(result.bestEffort!.source, /arg0 \* 40 \+ arg1 \* 2 \+ 0x4/, "both witnessed strides appear, at source scale");
});

projectTest("the handler family's fifth argument keeps its real value", () => {
  /* The call passes a pointer in the outgoing argument area. Zero padding
   * could only produce `, 0)`; the snapshot produces the pointer. */
  const result = reconstructFunction({ functionName: "ovl_11_func_800D41A4", notify: () => {} });
  assert.ok(result.bestEffort, `expected a draft; state ${result.state}: ${result.unresolved?.detail}`);
  /* The matched callee now has pointer parameters. Inspect the address
     beneath its pointer cast rather than requiring the old s32 spelling. */
  const tree = parseC(result.bestEffort!.source);
  try {
    const calls = tree.rootNode.descendantsOfType("call_expression")
      .filter((n) => field(n, "function")?.text === "ovl_11_func_800D04D4");
    assert.ok(calls.length);
    for (const call of calls) {
      const args = field(call, "arguments")!.namedChildren;
      assert.equal(args.length, 5);
      assert.ok(args[4]!.descendantsOfType("binary_expression")
        .some((n) => field(n, "left")?.text === "((s32)arg0)" && field(n, "right")?.text === "0x2A"),
      "the fifth argument retains arg0 + 0x2A, under any required pointer cast");
    }
  } finally { tree.delete(); }
  assert.ok(!/, 0\)/.test(result.bestEffort!.source), "no argument was completed with a fabricated zero");
});

projectTest("the recovered context reports the fifth argument too", () => {
  const context = recoverContext("ovl_11_func_800D41A4");
  const site = context.calls.find((entry) => entry.callee === "ovl_11_func_800D04D4");
  assert.ok(site, "the call site is in the context product");
  assert.ok((site!.argExprs?.length ?? 0) >= 5, `five arguments captured, got ${site!.argExprs?.length}`);
});

/* ---- the executor's own snapshot ------------------------------------------ */

test("the outgoing area is read relative to the open frame, not the entry sp", () => {
  /* A prologue that opens a frame, writes the fifth argument into the
   * outgoing area, calls, and returns. Read against the entry `$sp` the slot
   * is at -24, not +16, and the fifth argument disappears. */
  const insns = decodeFunction(assemble([
    ["addiu", "sp", "sp", -40],
    ["sw", "ra", 32, "sp"],
    ["addiu", "v0", "zero", 85],
    ["sw", "v0", 16, "sp"],
    ["addiu", "a0", "zero", 1],
    ["jal", 0x80020000],
    ["nop"],
    ["lw", "ra", 32, "sp"],
    ["addiu", "sp", "sp", 40],
    ["jr", "ra"],
    ["nop"],
  ], 0x80010000));
  const executed = executeFunction(insns);
  const root = executed.arena.node(executed.root);
  assert.equal(root.kind, "leaf");
  const effects = root.kind === "leaf" ? root.effects : [];
  const callEffect = effects.find((effect) => effect.kind === "call") as CallEffect | undefined;
  assert.ok(callEffect, "the call is in the effect log");
  assert.equal(canon(abiArguments(callEffect!)[4]!), "#85", "the fifth argument is the value the caller stored");
});

test("a saved register in the frame is not read as an argument", () => {
  const insns = decodeFunction(assemble([
    ["addiu", "sp", "sp", -40],
    ["sw", "s0", 16, "sp"],
    ["addiu", "a0", "zero", 1],
    ["jal", 0x80020000],
    ["nop"],
    ["lw", "s0", 16, "sp"],
    ["addiu", "sp", "sp", 40],
    ["jr", "ra"],
    ["nop"],
  ], 0x80010000));
  const executed = executeFunction(insns);
  const root = executed.arena.node(executed.root);
  const effects = root.kind === "leaf" ? root.effects : [];
  const callEffect = effects.find((effect) => effect.kind === "call") as CallEffect | undefined;
  assert.ok(callEffect);
  assert.equal(abiArguments(callEffect!).length, 4, "a spilled $s0 is frame bookkeeping, not a fifth argument");
});
