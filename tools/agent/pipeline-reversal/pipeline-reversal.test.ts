import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";
import { inverseAlloc } from "./inverse-alloc.js";
import { inverseAssembler } from "./inverse-assembler.js";
import { inverseDbr } from "./inverse-dbr.js";
import { reversePipeline } from "./reverse.js";
import type { MirBlock, MirInsn, MirProgram } from "./types.js";

/* A hand-built program, so the unit tests do not depend on a build. */
function insn(partial: Partial<MirInsn> & { id: number; mnemonic: string }): MirInsn {
  return {
    index: partial.id,
    text: `${partial.mnemonic} ${(partial.operands ?? []).join(",")}`.trim(),
    shape: `${partial.mnemonic} <shape>`,
    operands: [],
    defs: [],
    uses: [],
    isCall: false,
    isBranch: false,
    isJump: false,
    isLoad: false,
    isStore: false,
    isNop: false,
    block: 0,
    ...partial,
  };
}

function program(insns: MirInsn[], blocks: MirBlock[]): MirProgram {
  insns.forEach((entry, index) => { entry.index = index; });
  return { waypoint: "machine", functionName: "test", insns, blocks, caveats: [] };
}

test("g_assembler removes an unfilled delay slot and keeps everything else", () => {
  const insns = [
    insn({ id: 0, mnemonic: "lw", defs: ["v0"], uses: ["gp"], operands: ["v0", "0(gp)"], isLoad: true }),
    insn({ id: 1, mnemonic: "jr", uses: ["ra"], operands: ["ra"], isJump: true }),
    insn({ id: 2, mnemonic: "nop", isNop: true, delaySlotOf: 1 }),
  ];
  const result = inverseAssembler(program(insns, [
    { index: 0, insns: [0, 1, 2], successors: [], predecessors: [] },
  ]));
  assert.equal(result.program.insns.length, 2);
  assert.equal(result.removed.length, 1);
  assert.equal(result.removed[0].reason, "unfilled delay slot");
});

test("g_assembler folds an assembler load macro but not a split address", () => {
  const macro = program([
    insn({ id: 0, mnemonic: "lui", defs: ["v0"], operands: ["v0", "0x8006"], symbol: "D_80060000", symbolAddress: 0x80060000 }),
    insn({ id: 1, mnemonic: "lw", defs: ["v0"], uses: ["v0"], operands: ["v0", "0(v0)"], isLoad: true, symbol: "D_80060000", symbolAddress: 0x80060000 }),
  ], [{ index: 0, insns: [0, 1], successors: [], predecessors: [] }]);
  assert.equal(inverseAssembler(macro).program.insns.length, 1, "the load macro is one compiler instruction");

  /* The same two mnemonics with different registers are cc1's HIGH and LO_SUM,
   * which the scheduler may separate; folding them would delete a decision. */
  const split = program([
    insn({ id: 0, mnemonic: "lui", defs: ["v1"], operands: ["v1", "0x8006"], symbol: "D_80060000", symbolAddress: 0x80060000 }),
    insn({ id: 1, mnemonic: "lw", defs: ["v0"], uses: ["v1"], operands: ["v0", "0(v1)"], isLoad: true, symbol: "D_80060000", symbolAddress: 0x80060000 }),
  ], [{ index: 0, insns: [0, 1], successors: [], predecessors: [] }]);
  assert.equal(inverseAssembler(split).program.insns.length, 2, "a split address stays two instructions");
});

test("g_dbr keeps the branch condition last when un-filling a slot", () => {
  /* `sltu` sets the register the branch reads, so `fill_simple_delay_slots`
   * rejected it and took the store from before it. */
  const insns = [
    insn({ id: 0, mnemonic: "sw", uses: ["s1", "sp"], operands: ["s1", "28(sp)"], isStore: true }),
    insn({ id: 1, mnemonic: "sltu", defs: ["v0"], uses: ["v1"], operands: ["v0", "v1", "61"] }),
    insn({ id: 2, mnemonic: "beqz", uses: ["v0"], operands: ["v0", "target"], isBranch: true }),
    insn({ id: 3, mnemonic: "sw", uses: ["s0", "sp"], operands: ["s0", "24(sp)"], isStore: true, delaySlotOf: 2 }),
  ];
  const result = inverseDbr(program(insns, [
    { index: 0, insns: [0, 1, 2, 3], successors: [], predecessors: [] },
  ]));
  const order = result.program.insns.map((entry) => entry.id);
  assert.deepEqual(order, [0, 3, 1, 2], "the slot returns before the condition, which was examined first and rejected");
});

test("g_dbr refuses a gp-relative instruction as a slot candidate", () => {
  /* cc1 declares length 2 for a bare-symbol memory reference, and the machine
   * description admits only length-1 instructions into a delay slot. */
  const insns = [
    insn({ id: 0, mnemonic: "lw", defs: ["a1"], uses: ["gp"], operands: ["a1", "0(gp)"], isLoad: true }),
    insn({ id: 1, mnemonic: "jal", operands: ["memcpy"], isCall: true, defs: ["ra"] }),
    insn({ id: 2, mnemonic: "subu", defs: ["a2"], uses: ["a3", "a2"], operands: ["a2", "a3", "a2"], delaySlotOf: 1 }),
  ];
  const result = inverseDbr(program(insns, [
    { index: 0, insns: [0, 1, 2], successors: [], predecessors: [] },
  ]));
  const restoration = result.restorations[0];
  assert.ok(restoration, "the call's slot was restored");
  assert.equal(restoration.origin, "own-block");
  /* Both sides of the load are admissible precisely because the load itself is
   * not a candidate: were it eligible, the backward scan would have taken it
   * and the only surviving position would be after it. */
  assert.deepEqual(restoration.fiber, [0, 1]);
});

test("g_alloc joins a value across a copy and stops it at a call", () => {
  const insns = [
    insn({ id: 0, mnemonic: "lw", defs: ["v0"], uses: ["gp"], operands: ["v0", "0(gp)"], isLoad: true }),
    insn({ id: 1, mnemonic: "addu", defs: ["v1"], uses: ["v0"], operands: ["v1", "v0", "zero"] }),
    insn({ id: 2, mnemonic: "jal", operands: ["f"], isCall: true, defs: ["ra"] }),
    insn({ id: 3, mnemonic: "addiu", defs: ["v0"], uses: ["v0"], operands: ["v0", "v0", "1"] }),
  ];
  const result = inverseAlloc(program(insns, [
    { index: 0, insns: [0, 1, 2, 3], successors: [], predecessors: [] },
  ]));
  const loaded = result.webs.find((web) => web.defs.includes(0));
  assert.ok(loaded, "the loaded value is a web");
  assert.deepEqual(loaded.uses, [1], "its only use is the copy; the post-call read is a different value");
  const postCall = result.webs.find((web) => web.uses.includes(3) && web.register === "v0");
  assert.ok(postCall, "the read after the call attaches to the call's own definition");
  assert.notEqual(postCall.id, loaded.id, "a call ends every caller-saved web");
});

/* End-to-end. A function whose bytes already match must produce an empty
 * decision list: the chain reporting work to do on a solved function would make
 * every non-empty report unreadable. */
test("a matching function yields no decisions", { skip: !existsSync(join(ROOT, "build/src/func_800136D4.c.o")) }, () => {
  const artifacts = reversePipeline({ functionName: "func_800136D4", replay: false });
  assert.equal(artifacts.report.exact, true, "the benchmark function still matches");
  assert.deepEqual(artifacts.report.decisions, []);
  assert.equal(artifacts.report.residualOwner.startsWith("none"), true);
});

/* The round trip is the licence for every claim the chain makes about the
 * target, and it is checkable on the candidate because its dumps exist. */
test("the backward chain reproduces the compiler's own pre-dbr order", { skip: !existsSync(join(ROOT, "build/src/func_800136D4.c.o")) }, () => {
  const artifacts = reversePipeline({ functionName: "func_800136D4", replay: true });
  const check = artifacts.report.replay.find((entry) => entry.subject.startsWith("pre-dbr"));
  assert.ok(check, "the pre-dbr replay ran");
  assert.equal(check.status, "verified", check.detail);
});
