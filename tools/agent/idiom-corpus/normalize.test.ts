import { strict as assert } from "node:assert";
import { test } from "node:test";
import { align, ngrams } from "./align.js";
import { bucketImmediate, registerClass, tier0, tier1, tokensAt } from "./normalize.js";
import type { MirInsn } from "../pipeline-reversal/types.js";

function insn(overrides: Partial<MirInsn> & Pick<MirInsn, "mnemonic" | "operands">): MirInsn {
  return {
    index: 0,
    id: 0,
    text: "",
    shape: "",
    defs: [],
    uses: [],
    isCall: false,
    isBranch: false,
    isJump: false,
    isLoad: false,
    isStore: false,
    isNop: false,
    block: 0,
    ...overrides,
  } as MirInsn;
}

test("register class keeps caller-saved apart from callee-saved", () => {
  assert.equal(registerClass("s0"), "<s>");
  assert.equal(registerClass("s7"), "<s>");
  /* `fp` is `s8`: the same callee-saved class, and a frame pointer in one
     function is an ordinary saved register in another. */
  assert.equal(registerClass("fp"), "<s>");
  assert.equal(registerClass("v0"), "<v>");
  assert.equal(registerClass("a3"), "<a>");
  assert.equal(registerClass("zero"), "<zero>");
  assert.notEqual(registerClass("s0"), registerClass("v0"));
});

test("immediates bucket so one idiom over two globals is one shape", () => {
  /* The pair that motivated the whole thing: the same array walk over
     `D_800BBA4C` and over `D_800BB99C`. */
  assert.equal(bucketImmediate(-17844), bucketImmediate(-18324));
  /* …while a stride stays distinct from an offset. */
  assert.notEqual(bucketImmediate(1), bucketImmediate(-17844));
  assert.notEqual(bucketImmediate(1), bucketImmediate(16));
  assert.equal(bucketImmediate(0xff), "<mask>");
  assert.equal(bucketImmediate(4, { stackRelative: true }), "<stkoff>");
});

test("a bare small immediate is not read as a register", () => {
  /* `addiu a0,sp,16`: without the `$` requirement, `16` parses as register 16
     and every frame displacement in the corpus is indexed as a register. */
  const shape = tier0(insn({ mnemonic: "addiu", operands: ["a0", "sp", "16"] }));
  assert.equal(shape, "addiu <a>,<sp>,<pow2>");
  assert.equal(tier0(insn({ mnemonic: "addiu", operands: ["s0", "s0", "1"] })), "addiu <s>,<s>,1");
});

test("the same loop over two different globals normalizes to one shape", () => {
  const left = tier0(insn({ mnemonic: "addiu", operands: ["s0", "s5", "-17844"] }));
  const right = tier0(insn({ mnemonic: "addiu", operands: ["s1", "s4", "-18324"] }));
  assert.equal(left, right);
});

test("a memory operand carries its base class and bucketed displacement", () => {
  assert.equal(tier0(insn({ mnemonic: "lw", operands: ["ra", "68(sp)"] })), "lw <ra>,<stkoff>(<sp>)");
  assert.equal(tier0(insn({ mnemonic: "lbu", operands: ["a2", "0(s1)"] })), "lbu <a>,0(<s>)");
});

test("op classes collapse an addressing-macro difference", () => {
  const hi = insn({ mnemonic: "lui", operands: ["v0", "0x800c"], symbol: "D_800BBA4C" });
  const lo = insn({ mnemonic: "addiu", operands: ["v0", "v0", "-17844"], symbol: "D_800BBA4C" });
  assert.equal(tier1(hi), "ADDR_HI");
  assert.equal(tier1(lo), "ADDR_LO");
  /* The same encoding with no symbol is arithmetic, not addressing. */
  assert.equal(tier1(insn({ mnemonic: "addiu", operands: ["s0", "s0", "1"] })), "ADD");
});

test("alignment reports what it proved, in order", () => {
  const result = align(["a", "b", "c", "d"], ["a", "x", "c", "d"]);
  assert.equal(result.common, 3);
  assert.equal(result.ratio, 0.75);
  assert.deepEqual(result.pairs, [[0, 0], [2, 2], [3, 3]]);
});

test("n-grams overlap so a shared run is a shared token however it is embedded", () => {
  const grams = ngrams(["a", "b", "c", "d"], 3);
  assert.equal(grams.length, 2);
  assert.deepEqual(grams.map((gram) => gram.split("\u0001")), [["a", "b", "c"], ["b", "c", "d"]]);
  /* A sequence shorter than n still produces one token rather than none. */
  assert.equal(ngrams(["a", "b"], 3).length, 1);
  assert.deepEqual(ngrams([], 3), []);
  /* Two different runs must not collide into one token. */
  assert.notDeepEqual(ngrams(["ab", "c"], 2), ngrams(["a", "bc"], 2));
});

test("tokensAt selects one tier and tier 2 is one token for the whole run", () => {
  const run = [
    insn({ mnemonic: "lui", operands: ["v0", "0x800c"], symbol: "D_1" }),
    insn({ mnemonic: "lw", operands: ["v0", "0(v0)"], isLoad: true }),
  ];
  assert.equal(tokensAt(run, 0).length, 2);
  assert.equal(tokensAt(run, 1).length, 2);
  assert.equal(tokensAt(run, 2).length, 1);
  assert.match(tokensAt(run, 2)[0]!, /^blk\(/);
});
