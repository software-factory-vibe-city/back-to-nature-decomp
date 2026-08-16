import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";
import type { BlockComparison, ProgramComparison } from "./compare.js";
import { blockKey, compareObjectives, rankBlocks, residualObjective } from "./objective.js";
import { reversePipeline } from "./reverse.js";
import type { MirBlock, MirProgram } from "./types.js";

function block(index: number, size = 4): MirBlock {
  return { index, insns: Array.from({ length: size }, (_, item) => index * 100 + item), successors: [], predecessors: [] };
}

function programOf(blockCount: number): MirProgram {
  const blocks = Array.from({ length: blockCount }, (_, index) => block(index));
  return {
    waypoint: "mach",
    functionName: "test",
    insns: blocks.flatMap((entry) => entry.insns.map((id, position) => ({
      index: entry.index * 100 + position,
      id,
      mnemonic: "addu",
      operands: [],
      text: "addu",
      shape: "addu <reg>",
      defs: [],
      uses: [],
      isCall: false,
      isBranch: false,
      isJump: false,
      isLoad: false,
      isStore: false,
      isNop: false,
      block: entry.index,
    }))),
    blocks,
    caveats: [],
  };
}

function comparisonOf(blocks: Array<Partial<BlockComparison> & { block: number }>): ProgramComparison {
  return {
    populationParity: true,
    targetOnlyShapes: new Map(),
    candidateOnlyShapes: new Map(),
    blocks: blocks.map((entry) => ({
      block: entry.block,
      matched: entry.matched ?? [],
      targetOnly: entry.targetOnly ?? [],
      candidateOnly: entry.candidateOnly ?? [],
      transposed: entry.transposed ?? [],
    })),
    webs: [],
    ambiguousWebs: [],
    orderDifferences: 0,
    fiberArtifacts: 0,
    allocationDifferences: 0,
    coalescedCopies: [],
  };
}

function move(from: number, to: number, withinFiber = false) {
  return {
    target: [from, from] as [number, number],
    candidate: [to, to] as [number, number],
    detail: "",
    withinFiber,
  };
}

test("the objective is zero when nothing differs", () => {
  const objective = residualObjective("f", comparisonOf([{ block: 0 }]), programOf(1), programOf(1), true);
  assert.deepEqual(objective.key, [0, 0, 0, 0]);
  assert.equal(objective.exact, true);
});

/* The whole reason for the objective: fewer transpositions beats a luckier
   register assignment, because allocation is downstream of the sched1 order. */
test("a better schedule outranks a better allocation", () => {
  const cleanSchedule = residualObjective("f",
    { ...comparisonOf([{ block: 0 }]), webs: Array.from({ length: 9 }, () => ({
      targetWeb: 0, candidateWeb: 0, targetRegister: "v0", candidateRegister: "v1",
      agrees: false, witnesses: 1, defShape: "x", uses: 1,
    })) },
    programOf(1), programOf(1), false);
  const luckyRegisters = residualObjective("f",
    comparisonOf([{ block: 0, transposed: [move(1, 2), move(3, 4)] }]),
    programOf(1), programOf(1), false);
  assert.equal(cleanSchedule.schedule, 0);
  assert.equal(luckyRegisters.schedule, 2);
  assert.ok(compareObjectives(cleanSchedule, luckyRegisters) < 0,
    "nine wrong registers with the right order beat two wrong positions");
});

test("an exact candidate outranks every derived number", () => {
  const exact = residualObjective("f", comparisonOf([{ block: 0 }]), programOf(1), programOf(1), true);
  const near = residualObjective("f", comparisonOf([{ block: 0, transposed: [move(1, 2)] }]),
    programOf(1), programOf(1), false);
  assert.ok(compareObjectives(exact, near) < 0);
  assert.ok(compareObjectives(near, exact) > 0);
});

/* A transposition the delay-slot inverse could have produced on its own is the
   instrument's noise, and a search that descends it chases itself. */
test("a transposition inside the delay-slot fiber does not count", () => {
  const objective = residualObjective("f",
    comparisonOf([{ block: 0, transposed: [move(1, 2, true), move(5, 9)] }]),
    programOf(1), programOf(1), false);
  assert.equal(objective.schedule, 1);
  assert.equal(objective.blocks[0].suppressed, 1);
});

test("ranking for one block prefers the variant that clears it", () => {
  const clearsBlockOne = residualObjective("f",
    comparisonOf([{ block: 0, transposed: [move(1, 2), move(3, 4)] }, { block: 1 }]),
    programOf(2), programOf(2), false);
  const clearsBlockZero = residualObjective("f",
    comparisonOf([{ block: 0 }, { block: 1, transposed: [move(1, 2), move(3, 4)] }]),
    programOf(2), programOf(2), false);
  assert.equal(compareObjectives(clearsBlockOne, clearsBlockZero), 0, "the whole-function keys are equal");
  assert.ok(compareObjectives(clearsBlockOne, clearsBlockZero, { block: 1 }) < 0);
  assert.ok(compareObjectives(clearsBlockZero, clearsBlockOne, { block: 0 }) < 0);
  assert.deepEqual(blockKey(clearsBlockOne, 1), [0, 0, 0]);
});

test("a different block count is reported as degraded and dominates the key", () => {
  const objective = residualObjective("f", comparisonOf([{ block: 0 }]), programOf(1), programOf(3), false);
  assert.equal(objective.degraded, true);
  assert.equal(objective.controlFlow, 2);
  assert.ok(objective.population > 0, "the unpaired blocks' instructions are counted");
});

/* Two blocks with the same residual shape are the same problem written twice.
   Saying so is the difference between four experiments and two. */
test("blocks with the same residual shape are ranked as one work item", () => {
  const objective = residualObjective("f",
    comparisonOf([
      { block: 0, transposed: [move(1, 2)] },
      { block: 1, transposed: [move(1, 2)] },
      { block: 2, transposed: [move(4, 9)] },
    ]),
    programOf(3), programOf(3), false);
  const work = rankBlocks(objective);
  assert.equal(work.length, 2, "the twinned blocks are one item");
  assert.deepEqual(work[0].duplicates, [1]);
  assert.match(work[0].reason, /same residual shape/);
});

/* The property the whole design rests on, measured rather than asserted. */
test("a function whose bytes match scores zero end to end", { skip: !existsSync(join(ROOT, "build/src/func_800136D4.c.o")) }, () => {
  const artifacts = reversePipeline({ functionName: "func_800136D4", replay: false });
  assert.deepEqual(artifacts.report.objective.key, [0, 0, 0, 0]);
  assert.equal(rankBlocks(artifacts.report.objective).length, 0);
});
