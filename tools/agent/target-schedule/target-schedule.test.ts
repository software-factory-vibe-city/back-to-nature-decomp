import assert from "node:assert/strict";
import test from "node:test";
import { deriveAllocationRequirements } from "./allocation-requirements.js";
import { analyzeDelaySlots } from "./delay-slot.js";
import { alignFinalRtlToMachine } from "./emission-alignment.js";
import { analyzeTargetOrderReplay } from "./counterfactual-replay.js";
import { alignMachineInstructions, machineRefs } from "./machine-alignment.js";
import { replayScheduler } from "./scheduler-replay.js";
import { parseRtlInstructions } from "../compiler-trace/rtl-parser.js";
import type { SchedulerStage } from "../compiler-trace/types.js";
import { assertTargetScheduleAnalysis, TARGET_SCHEDULE_SCHEMA_VERSION } from "./types.js";

const instruction = (mnemonic: string, operands: string[]) => ({ mnemonic, operands, canonical: `${mnemonic} ${operands.join(",")}` });

test("migrates schema-v1 analyses with explicit empty replay fields", () => {
  const analysis = assertTargetScheduleAnalysis({
    schemaVersion: 1,
    function: "func_test",
    target: [],
    candidate: [],
    requirements: [],
  });
  assert.equal(analysis.schemaVersion, TARGET_SCHEDULE_SCHEMA_VERSION);
  assert.deepEqual(analysis.emissionAlignment, []);
  assert.deepEqual(analysis.targetOrderReplays, []);
});

test("maps emitted UIDs through a proven zero-width memory barrier", () => {
  const machine = machineRefs([
    instruction("move", ["t0", "a1"]),
    instruction("li", ["v0", "4"]),
  ]);
  const rtl = parseRtlInstructions(`
(insn 10 0 11 (set (reg:SI 8 t0) (reg:SI 5 a1)) 1 (nil) (nil))
(insn 11 10 12 (parallel[ (asm_operands/v ("") ("") 0[ ] [ ] ("fixture.c") 1) (clobber (mem:BLK (scratch) 0)) ]) -1 (nil) (nil))
(insn 12 11 0 (set (reg:SI 2 v0) (const_int 4)) 1 (nil) (nil))
`, "mach");
  const aligned = alignFinalRtlToMachine(machine, rtl);
  assert.equal(aligned.alignment.filter((item) => item.kind === "zero-width").length, 1);
  assert.deepEqual(aligned.links.map((link) => link.uid), [10, 12]);
  assert.deepEqual(machine.map((item) => item.uid), [10, 12]);
});

test("recomputes readiness for a bounded target-order counterfactual", () => {
  const target = machineRefs([
    instruction("li", ["v1", "2"]),
    instruction("li", ["v0", "1"]),
    instruction("move", ["t0", "a0"]),
  ]);
  const candidate = machineRefs([
    instruction("li", ["v0", "1"]),
    instruction("li", ["v1", "2"]),
    instruction("move", ["t0", "a0"]),
  ]);
  candidate.forEach((item, index) => { item.uid = 10 + index * 2; item.block = 0; });
  const correspondence = [
    { targetIndex: 0, candidateIndex: 1, candidateUid: 12, confidence: "exact" as const, evidence: [] },
    { targetIndex: 1, candidateIndex: 0, candidateUid: 10, confidence: "exact" as const, evidence: [] },
    { targetIndex: 2, candidateIndex: 2, candidateUid: 14, confidence: "exact" as const, evidence: [] },
  ];
  const ready = (uids: number[]) => uids.map((uid, rank) => ({ uid, displayedPriority: 1, rawPriority: "1", rank }));
  const decisions = [
    { block: 0, cycle: 1, ready: ready([10, 12, 14]), comparatorRanked: [14, 12, 10], ranked: [14, 12, 10], selectedUid: 14, selectedRank: 0, birthPriorityAdjusted: false, reason: "luid-or-list-order" as const, reasonConfidence: "reconstructed" as const, events: [] },
    { block: 0, cycle: 2, ready: ready([10, 12]), comparatorRanked: [12, 10], ranked: [12, 10], selectedUid: 12, selectedRank: 0, birthPriorityAdjusted: false, reason: "luid-or-list-order" as const, reasonConfidence: "reconstructed" as const, events: [] },
    { block: 0, cycle: 3, ready: ready([10]), comparatorRanked: [10], ranked: [10], selectedUid: 10, selectedRank: 0, birthPriorityAdjusted: false, reason: "sole" as const, reasonConfidence: "exact" as const, events: [] },
  ];
  const scheduler: SchedulerStage = {
    stage: "sched", instructionPriorities: { "10": { priority: 1, refCount: 0 }, "12": { priority: 1, refCount: 0 }, "14": { priority: 1, refCount: 0 } },
    decisions, selectionExplanations: [], luidByUid: { "10": 0, "12": 1, "14": 2 }, dependencies: [],
    sourceOrder: [10, 12, 14], forwardOrder: [10, 12, 14], backwardSelectionOrder: [14, 12, 10], lifetimeChanges: [], caveats: [],
  };
  const result = analyzeTargetOrderReplay({
    target, candidate, correspondence, scheduler,
    baseline: [{ stage: "sched", block: 0, status: "exact", matchedSelections: 3, totalSelections: 3, matchedReadySets: 3, unsupportedFeatures: [], confidence: "exact", evidence: [] }],
    maxInterventions: 3,
  });
  assert.equal(result.replays[0]?.legality, "legal-under-candidate-dag");
  assert.equal(result.replays[0]?.status, "reproducible-with-interventions");
  assert.equal(result.interventionSets[0]?.interventions[0]?.kind, "luid-order");
  assert.deepEqual(result.interventionSets[0]?.interventions[0]?.uids, [10, 12]);
});

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
      comparatorRanked: [10, 12],
      ranked: [10, 12],
      selectedUid: 10,
      selectedRank: 0,
      birthPriorityAdjusted: false,
      reason: "luid-or-list-order",
      reasonConfidence: "inferred",
      events: [],
    }],
    selectionExplanations: [{
      stage: "sched", block: 0, cycle: 1, selectedUid: 10,
      orderKeys: [], comparisons: [{ winnerUid: 10, loserUid: 12, criterion: "unresolved", confidence: "inferred", evidence: [] }],
      confidence: "inferred", caveats: [],
    }],
    luidByUid: { "10": 0, "12": 0 },
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
