import assert from "node:assert/strict";
import test from "node:test";
import { deriveAllocationRequirements } from "./allocation-requirements.js";
import { analyzeDelaySlots } from "./delay-slot.js";
import { alignMachineInstructions, machineRefs } from "./machine-alignment.js";
import { replayScheduler } from "./scheduler-replay.js";
import type { SchedulerStage } from "../compiler-trace/types.js";

const instruction = (mnemonic: string, operands: string[]) => ({ mnemonic, operands, canonical: `${mnemonic} ${operands.join(",")}` });

test("aligns a scheduling window and a consistent hard-register role swap", () => {
  const target = machineRefs([
    instruction("andi", ["t6", "a2", "15"]),
    instruction("srl", ["a2", "a2", "4"]),
    instruction("lw", ["t7", "36(sp)"]),
  ]);
  const candidate = machineRefs([
    instruction("srl", ["a2", "a2", "4"]),
    instruction("andi", ["t7", "a2", "15"]),
    instruction("lw", ["t6", "36(sp)"]),
  ]);
  const aligned = alignMachineInstructions(target, candidate);
  assert.equal(aligned.correspondence[1]?.candidateIndex, 0);
  assert.equal(aligned.registerRoles.some((role) => role.targetRegister === "t6" && role.candidateRegister === "t7"), true);
  assert.equal(aligned.registerRoles.some((role) => role.targetRegister === "t7" && role.candidateRegister === "t6"), true);
});

test("does not hide duplicate-instruction ambiguity", () => {
  const target = machineRefs([instruction("move", ["t0", "a0"])]);
  const candidate = machineRefs([
    instruction("nop", []),
    instruction("move", ["t0", "a0"]),
    instruction("nop", []),
    instruction("move", ["t0", "a0"]),
  ]);
  const aligned = alignMachineInstructions(target, candidate);
  assert.ok(aligned.correspondence[0]?.candidateIndex !== undefined);
  assert.equal(aligned.correspondence[0]?.confidence, "inferred");
  assert.match(aligned.correspondence[0]?.evidence.join(" ") || "", /duplicated/);
});

test("marks an unresolved scheduler tie observational-only", () => {
  const scheduler: SchedulerStage = {
    stage: "sched",
    instructionPriorities: {},
    decisions: [{
      block: 0,
      cycle: 1,
      ready: [
        { uid: 10, displayedPriority: 1, rawPriority: "1", rank: 0 },
        { uid: 12, displayedPriority: 1, rawPriority: "1", rank: 1 },
      ],
      ranked: [10, 12],
      selectedUid: 10,
      selectedRank: 0,
      birthPriorityAdjusted: false,
      reason: "luid-or-list-order",
      reasonConfidence: "inferred",
      events: [],
    }],
    dependencies: [],
    sourceOrder: [10, 12],
    forwardOrder: [10, 12],
    backwardSelectionOrder: [10],
    lifetimeChanges: [],
    caveats: [],
  };
  const replay = replayScheduler(scheduler)[0]!;
  assert.equal(replay.reproduced, true);
  assert.equal(replay.counterfactualEligible, false);
});

test("derives a pairwise allocno reversal only for conflicting swapped roles", () => {
  const roles = [
    { targetRegister: "t6", candidateRegister: "t7", targetIndexes: [1], candidateIndexes: [1], pseudos: [105], confidence: "reconstructed" as const, evidence: [] },
    { targetRegister: "t7", candidateRegister: "t6", targetIndexes: [2], candidateIndexes: [2], pseudos: [102], confidence: "reconstructed" as const, evidence: [] },
  ];
  const pseudos = [
    { pseudo: 105, conflicts: [{ register: 102, kind: "pseudo", confidence: "exact" }], preferences: [], stages: [], transitions: [], lifetimes: [], modes: [], userVariable: false, pointer: false, attributes: [], firstStage: "rtl", lastStage: "greg" },
    { pseudo: 102, conflicts: [{ register: 105, kind: "pseudo", confidence: "exact" }], preferences: [], stages: [], transitions: [], lifetimes: [], modes: [], userVariable: false, pointer: false, attributes: [], firstStage: "rtl", lastStage: "greg" },
  ] as any;
  const derived = deriveAllocationRequirements(roles, pseudos, [
    { pseudo: 102, rank: 0, assignedRegister: "t6" },
    { pseudo: 105, rank: 1, assignedRegister: "t7" },
  ]);
  assert.equal(derived.allocation.length, 1);
  assert.deepEqual(derived.allocation[0]?.desiredOrder, [105, 102]);
});

test("reports the wrong own-block branch delay candidate and desired UID", () => {
  const target = machineRefs([
    instruction("srl", ["a2", "a2", "4"]),
    instruction("bnez", ["v0", "<branch-target>"]),
    instruction("srl", ["a2", "a2", "4"]),
  ]);
  const candidate = machineRefs([
    instruction("srl", ["a2", "a2", "4"]),
    instruction("bnez", ["v0", "<branch-target>"]),
    instruction("move", ["t3", "a0"]),
  ]);
  candidate.forEach((item, index) => { item.uid = 10 + index; });
  const correspondence = [
    { targetIndex: 0, candidateIndex: 0, candidateUid: 10, confidence: "exact" as const, evidence: [] },
    { targetIndex: 1, candidateIndex: 1, candidateUid: 11, confidence: "exact" as const, evidence: [] },
    { targetIndex: 2, candidateIndex: 0, candidateUid: 10, confidence: "reconstructed" as const, evidence: [] },
  ];
  const delay = analyzeDelaySlots(target, candidate, correspondence);
  assert.equal(delay.analyses[0]?.candidateDelayUid, 12);
  assert.equal(delay.analyses[0]?.desiredCandidateUid, 10);
  assert.equal(delay.requirements.length, 1);
});
