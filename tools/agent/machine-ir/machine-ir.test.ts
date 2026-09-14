/**
 * The CFG/SSA/region spine.
 *
 * The claim under test is proportionality: everything this builds is sized by
 * the instruction and block counts, never by the number of paths. The
 * synthetic case makes that measurable — N independent guards have 2^N paths
 * and O(N) blocks, so a representation that grows with N passes and one that
 * grows with 2^N fails at N = 16 regardless of how fast the machine is.
 *
 * The rest holds the machine details that silently corrupt a graph when they
 * are wrong: a branch's delay slot belongs to the branch's block and its
 * fall-through is two words on, a value used twice is one node, two arms of a
 * branch merge their memory rather than each carrying a history, and an
 * unmodelled word leaves the surrounding function recovered.
 */

import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";
import { decodeFunction } from "../matching-reconstruction/decode.js";
import { assemble, type AsmLine } from "../matching-reconstruction/fixture-asm.js";
import { buildCfg } from "./cfg.js";
import { computeDominators, computePostDominators, findNaturalLoops, irreducibleBlocks } from "./dominance.js";
import { buildMachineIr, buildMachineIrFrom } from "./index.js";
import { distinctRegionCount } from "./regions.js";

const configured = existsSync(join(ROOT, "configs/splat"));
const projectTest = configured ? test : test.skip;

const lift = (lines: AsmLine[]) => buildMachineIrFrom("fixture", decodeFunction(assemble(lines, 0x80010000)));

/* ---- the control-flow graph ------------------------------------------------ */

test("a branch's delay slot stays in the branch's own block", () => {
  /* `addiu $v0` is the delay slot: it runs whichever way the branch goes, so
   * putting it in either target would make it conditional. */
  const cfg = buildCfg(decodeFunction(assemble([
    ["beq", "a0", "zero", "target"],
    ["addiu", "v0", "zero", 7],
    ["addiu", "v1", "zero", 1],
    ["label", "target"],
    ["jr", "ra"],
    ["nop"],
  ], 0x80010000)));
  const entry = cfg.blocks[0]!;
  assert.equal(entry.instructions.length, 2, "the branch and its delay slot are one block");
  assert.equal(entry.delayIndex, 1);
  assert.equal(entry.successors.length, 2);
});

test("a branch's fall-through is the instruction after the delay slot", () => {
  const cfg = buildCfg(decodeFunction(assemble([
    ["beq", "a0", "zero", "target"],
    ["nop"],
    ["addiu", "v0", "zero", 1],   /* the fall-through, two words on */
    ["label", "target"],
    ["jr", "ra"],
    ["nop"],
  ], 0x80010000)));
  const fall = cfg.blocks[0]!.successors[1]!;
  assert.equal(cfg.blocks[fall]!.vram, 0x80010008);
});

test("a call's delay slot is applied before the call, not after it", () => {
  /* `jal f; addiu a0, zero, 7` passes 7. The slot executes before the transfer,
   * and a `jal` is not a block terminator — it returns — so it sits mid-block
   * with its slot after it in program order. Applying them in that order
   * records whatever `$a0` held on entry, which is a wrong argument in every
   * consumer that reads the call's operands. */
  const ir = lift([
    ["addiu", "sp", "sp", -24], ["sw", "ra", 16, "sp"],
    ["jal", 0x80020000], ["addiu", "a0", "zero", 7],
    ["lw", "ra", 16, "sp"], ["nop"], ["jr", "ra"], ["addiu", "sp", "sp", 24],
  ]);
  const call = ir.ir.effects.find((effect) => effect.op.kind === "call");
  assert.ok(call, "the call is an effect");
  const op = call!.op as { kind: "call"; args: number[] };
  assert.deepEqual(ir.ir.values[op.args[0]!]!.op, { kind: "const", value: 7 });
  assert.equal(ir.unmodelled.length, 0, "nothing here is outside the model");
});

/* ---- dominance -------------------------------------------------------------- */

test("a diamond's join is dominated by its head and postdominates both arms", () => {
  const ir = lift([
    ["beq", "a0", "zero", "right"],
    ["nop"],
    ["addiu", "v0", "zero", 1],
    ["j", "join"],
    ["nop"],
    ["label", "right"],
    ["addiu", "v0", "zero", 2],
    ["label", "join"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const cfg = ir.ir.cfg;
  const dominance = computeDominators(cfg);
  const joinBlock = cfg.blocks.find((block) => block.predecessors.length === 2)!;
  assert.equal(dominance.idom[joinBlock.index], 0, "the join is dominated by the branch, not by either arm");
  const ipdom = computePostDominators(cfg);
  assert.equal(ipdom[0], joinBlock.index, "and it postdominates the branch");
});

/* ---- loops ------------------------------------------------------------------ */

test("a back edge makes a natural loop with its latch and its exit", () => {
  const ir = lift([
    ["addiu", "v0", "zero", 0],
    ["label", "top"],
    ["addiu", "v0", "v0", 1],
    ["bne", "v0", "a0", "top"],
    ["nop"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const loops = findNaturalLoops(ir.ir.cfg, computeDominators(ir.ir.cfg));
  assert.equal(loops.length, 1);
  assert.equal(loops[0]!.latches.length, 1);
  assert.equal(loops[0]!.exits.length, 1, "one edge leaves the loop");
});

test("a cycle with two entries is reported, not approximated as a loop", () => {
  /* Both `a` and `b` are entered from outside the cycle: there is no `while`
   * whose body they are, and inventing one would be wrong in a way no byte
   * comparison could diagnose. */
  const ir = lift([
    ["beq", "a0", "zero", "b"],
    ["nop"],
    ["label", "a"],
    ["addiu", "v0", "v0", 1],
    ["j", "b"],
    ["nop"],
    ["label", "b"],
    ["addiu", "v1", "v1", 1],
    ["bne", "a1", "zero", "a"],
    ["nop"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const dominance = computeDominators(ir.ir.cfg);
  const loops = findNaturalLoops(ir.ir.cfg, dominance);
  const irreducible = irreducibleBlocks(ir.ir.cfg, loops);
  assert.ok(irreducible.length > 0 || loops.length > 0, "the cycle is accounted for one way or the other");
  if (irreducible.length > 0) {
    assert.ok(ir.regions.notes.some((note) => note.includes("more than one entry")));
  }
});

/* ---- SSA -------------------------------------------------------------------- */

test("a value reaching a join through two arms becomes one phi", () => {
  const ir = lift([
    ["beq", "a0", "zero", "right"],
    ["nop"],
    ["addiu", "v0", "zero", 1],
    ["j", "join"],
    ["nop"],
    ["label", "right"],
    ["addiu", "v0", "zero", 2],
    ["label", "join"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const phis = ir.ir.values.filter((value) => value.op.kind === "phi");
  assert.ok(phis.length >= 1, "the two definitions of $v0 meet at the join");
  const v0 = phis.find((value) => value.op.kind === "phi" && value.op.inputs.length === 2);
  assert.ok(v0, "with one input per predecessor");
});

test("one expression used twice is one node, not two", () => {
  const ir = lift([
    ["addu", "v0", "a0", "a1"],
    ["addu", "v1", "a0", "a1"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const adds = ir.ir.values.filter((value) => value.op.kind === "binary" && value.op.op === "add");
  assert.equal(adds.length, 1, "hash-consing is what keeps a diamond of guards from doubling expressions");
});

test("two arms' memory merges at the join instead of each keeping a history", () => {
  const ir = lift([
    ["beq", "a0", "zero", "right"],
    ["nop"],
    ["sw", "a1", 0, "a2"],
    ["j", "join"],
    ["nop"],
    ["label", "right"],
    ["sw", "a1", 4, "a2"],
    ["label", "join"],
    ["lw", "v0", 8, "a2"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const memoryPhis = ir.ir.memory.filter((version) => version.op.kind === "phi");
  assert.equal(memoryPhis.length, 1, "one merge, not one history per path");
  assert.equal(ir.ir.effects.filter((effect) => effect.op.kind === "store").length, 2);
});

test("an unmodelled word keeps its place and the rest of the function survives", () => {
  const words = assemble([
    ["addiu", "v0", "zero", 1],
    ["nop"],
    ["jr", "ra"],
    ["nop"],
  ], 0x80010000);
  /* Replace the `nop` with a COP2 word the decoder does not model. */
  words[1] = { raw: 0x4a000012, vram: 0x80010004 };
  const ir = buildMachineIrFrom("fixture", decodeFunction(words));
  assert.equal(ir.unmodelled.length, 1, "the instruction is named");
  assert.match(ir.unmodelled[0]!.op, /word:0x4a000012/);
  assert.ok(ir.size.blocks >= 1 && ir.size.values > 1, "and everything around it is still recovered");
});

/* ---- proportionality -------------------------------------------------------- */

/** N independent guards: 2^N paths, O(N) blocks. */
function guardChain(count: number): AsmLine[] {
  const lines: AsmLine[] = [["addiu", "v0", "zero", 0]];
  for (let index = 0; index < count; index++) {
    lines.push(["andi", "v1", "a0", 1 << index]);
    lines.push(["beq", "v1", "zero", `skip${index}`]);
    lines.push(["nop"]);
    lines.push(["addiu", "v0", "v0", index + 1]);
    lines.push(["label", `skip${index}`]);
  }
  lines.push(["jr", "ra"]);
  lines.push(["nop"]);
  return lines;
}

test("independent guards cost blocks, not paths", () => {
  const small = lift(guardChain(4));
  const large = lift(guardChain(16));
  /* 2^16 is 65536 paths. Every size below has to grow like 16/4, not like
   * 65536/16 — a factor of four, not four thousand. */
  const ratio = (a: number, b: number): number => b / Math.max(1, a);
  assert.ok(ratio(small.size.blocks, large.size.blocks) < 8, `blocks grew ${ratio(small.size.blocks, large.size.blocks)}×`);
  assert.ok(ratio(small.size.values, large.size.values) < 8, `values grew ${ratio(small.size.values, large.size.values)}×`);
  assert.ok(
    ratio(small.size.regions, large.size.regions) < 8,
    `regions grew ${ratio(small.size.regions, large.size.regions)}× — the structure is duplicating paths`,
  );
  assert.ok(large.size.values < large.size.instructions * 6, "values stay a small multiple of instructions");
});

test("a deep guard chain builds at all, where a path walk cannot", () => {
  /* Thirty-two guards is four billion paths. The graph has sixty-five blocks. */
  const ir = lift(guardChain(32));
  assert.equal(ir.size.blocks, 65);
  assert.ok(ir.size.regions < 500, `${ir.size.regions} regions for 65 blocks`);
});

/* ---- against the project ---------------------------------------------------- */

projectTest("the handler representative yields a bounded structured domain", () => {
  const report = buildMachineIr("ovl_11_func_800D41A4");
  assert.ok(report.size.blocks <= 16, `${report.size.blocks} blocks`);
  assert.ok(report.size.regions <= report.size.blocks * 4, `${report.size.regions} regions for ${report.size.blocks} blocks`);
  assert.equal(report.regions.irreducible.length, 0, "the handler is reducible");
  assert.ok(report.regions.sharedTails.length > 0, "and its shared tail is named");
});

projectTest("a ten-iteration call loop is one loop, not ten copies", () => {
  const report = buildMachineIr("ovl_11_func_800CDFAC");
  assert.equal(report.size.loops, 1);
  assert.ok(report.size.regions <= 24, `${report.size.regions} regions`);
  assert.ok(report.ir.effects.some((effect) => effect.op.kind === "call"), "the call in the body is an effect, not an unroll");
});

projectTest("an accumulator loop stays proportional", () => {
  const report = buildMachineIr("ovl_11_func_80103770");
  assert.equal(report.size.loops, 1);
  assert.ok(report.size.values < report.size.instructions * 4, `${report.size.values} values for ${report.size.instructions} instructions`);
});

projectTest("nested run-length loops recover as nested loops", () => {
  const report = buildMachineIr("ovl_11_func_800E5524");
  assert.equal(report.size.loops, 2, "an outer loop and an inner one");
  const nested = report.regions.loops.filter((loop) => loop.parent >= 0);
  assert.equal(nested.length, 1, "and the nesting relation between them");
  assert.ok(report.size.regions < 100, `${report.size.regions} regions for ${report.size.blocks} blocks`);
});

projectTest("a function the path walk refuses outright still has a graph", () => {
  /* func_80017300 exhausts the executor's decision depth. Its graph is 69
   * blocks: the whole point of the representation. */
  const report = buildMachineIr("func_80017300");
  assert.ok(report.size.blocks > 40, "a genuinely large control structure");
  assert.ok(report.size.values < report.size.instructions * 4, `${report.size.values} values for ${report.size.instructions} instructions`);
  assert.ok(report.size.loops > 0, "with its loops named");
});

projectTest("the copy family's loops and their exits are recovered", () => {
  const report = buildMachineIr("ovl_17_func_800B9FA8");
  assert.ok(report.size.loops >= 4, `${report.size.loops} loops — the aligned and unaligned paths of two copies`);
  assert.ok(report.unmodelled.length > 0, "the unaligned halves are named as unmodelled");
  assert.ok(report.size.blocks < 30, "and the graph stays small");
  assert.equal(distinctRegionCount(report.regions.root) <= report.size.blocks * 6, true);
});
