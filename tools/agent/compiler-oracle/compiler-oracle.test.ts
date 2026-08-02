import assert from "node:assert/strict";
import test from "node:test";
import { instrumentLocalAllocation, instrumentScheduler } from "./instrumentation.js";
import { deriveOracleInterventions, parseOracleEvents } from "./run.js";
import { replayLocalAllocation } from "./local-allocation.js";
import { localQuantityPriority, solveLocalAllocationState } from "./local-allocation-solver.js";
import type { AllocatorCounterfactualAnalysis } from "../allocator-counterfactual/types.js";
import type { CompilerOracleEvent } from "./types.js";

test("instrumentation preserves stock sources while adding generic hooks", () => {
  const local = instrumentLocalAllocation();
  const scheduler = instrumentScheduler();
  assert.match(local, /PSX_ORACLE_FORCE_LOCAL/);
  assert.match(local, /PSX_ORACLE_FORBID_LOCAL/);
  assert.match(local, /"force_accept"/);
  assert.match(local, /\\"find\\"/);
  assert.match(scheduler, /PSX_ORACLE_SCHEDULE_EDGES/);
  assert.match(scheduler, /add_dependence \(oracle_after_insn, oracle_before_insn/);
});

test("allocator requirements derive unique scheduler and local interventions", () => {
  const analysis = {
    roles: [{
      findings: [{
        pseudo: 105,
        desiredRegister: "a0",
        observedRegister: "a3",
        allocationStage: "local",
        explicitHardBlockers: [{ requiredRelation: { beforeUid: 4, afterUid: 55 } }, { requiredRelation: { beforeUid: 4, afterUid: 55 } }],
      }],
    }],
  } as unknown as AllocatorCounterfactualAnalysis;
  assert.deepEqual(deriveOracleInterventions(analysis), {
    scheduleEdges: [{ beforeUid: 4, afterUid: 55 }],
    forcedLocalAssignments: [{ pseudo: 105, hardRegister: 4, registerName: "a0" }],
    forbiddenLocalCandidates: [],
  });
});

test("JSONL parser rejects malformed compiler events", () => {
  assert.deepEqual(parseOracleEvents('{"stage":"sched","event":"select","uid":4}\n'), [
    { stage: "sched", event: "select", uid: 4 },
  ]);
  assert.throws(() => parseOracleEvents("not-json\n"), /Invalid compiler-oracle JSONL/);
});

test("local allocation priority reproduces GCC's quantity formula", () => {
  assert.equal(localQuantityPriority(8, 16, 28), 20000);
  assert.equal(localQuantityPriority(4, 12, 30), 4444);
});

test("local allocation replay follows exact emitted candidate order", () => {
  const events: CompilerOracleEvent[] = [
    { stage: "local", event: "alloc_qty", block: 1, qty: 0, members: [126], born: 10 },
    { stage: "local", event: "find", block: 1, qty: 0, members: [126], born: 10, dead: 18, suggested: 0, available: [4, 5, 6] },
    { stage: "local", event: "choose", block: 1, qty: 0, members: [126], born: 10, dead: 18, hardRegister: 4 },
    { stage: "local", event: "final", block: 1, qty: 0, members: [126], born: 10, dead: 18, hardRegister: 4 },
  ];
  const replay = replayLocalAllocation(events, [{ pseudo: 126, hardRegister: 6, registerName: "a2" }]);
  assert.equal(replay.replayVerified, true);
  assert.equal(replay.replayedChoices, 1);
  assert.equal(replay.requests[0]?.baselineAvailable, true);
  assert.equal(replay.quantities[0]?.block, 1);
});

test("local allocation state solver finds the two phantom occupancy mechanism", () => {
  const decisions = [
    { block: 1, qty: 3, members: [131], born: 16, dead: 28, references: 8, size: 1, suggested: false, available: [2, 3, 4, 5, 6], chosen: 2, forced: false, replayed: true },
    { block: 1, qty: 0, members: [104], born: 0, dead: 12, references: 4, size: 1, suggested: false, available: [2, 3, 4, 5, 6], chosen: 2, forced: false, replayed: true },
    { block: 1, qty: 2, members: [127], born: 12, dead: 30, references: 4, size: 1, suggested: false, available: [3, 4, 5, 6], chosen: 3, forced: false, replayed: true },
    { block: 1, qty: 1, members: [126], born: 10, dead: 18, references: 2, size: 1, suggested: false, available: [4, 5, 6], chosen: 4, forced: false, replayed: true },
  ];
  const replay = {
    decisions,
    quantities: decisions.map((decision) => ({
      block: decision.block, qty: decision.qty, members: decision.members, born: decision.born,
      dead: decision.dead, references: decision.references, size: decision.size,
      assignedHardRegister: decision.chosen,
    })),
    ordinaryChoices: 4, replayedChoices: 4, replayVerified: true, requests: [], caveats: [],
  } as ReturnType<typeof replayLocalAllocation>;
  const solutions = solveLocalAllocationState(replay, [
    { pseudo: 127, hardRegister: 4, registerName: "a0" },
    { pseudo: 126, hardRegister: 6, registerName: "a2" },
  ], { maxPhantoms: 2, maxSolutions: 1 });
  assert.equal(solutions[0]?.phantoms.length, 2);
  assert.deepEqual(solutions[0]?.assignments.map((item) => item.hardRegister), [4, 6]);
  assert.deepEqual(solutions[0]?.phantoms.map((item) => item.assignedHardRegister), [3, 5]);
});
