import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateSchedulerConstraintInput } from "./derive.js";
import { solveFiniteDomain } from "./finite-solver.js";
import { simulateScheduler } from "./model.js";
import { solveSchedulerConstraints } from "./solver.js";
import { SCHEDULER_CONSTRAINT_SCHEMA_VERSION, type SchedulerBlockModel, type SchedulerConstraintInput, type SchedulerConstraintNode } from "./types.js";

function node(uid: number, luid: number, options: Partial<SchedulerConstraintNode> = {}): SchedulerConstraintNode {
  return {
    uid,
    label: `uid ${uid}`,
    basePriority: 1,
    baselineBoost: false,
    boostVariable: false,
    baselineLuid: luid,
    luidVariable: true,
    machineClass: "ordinary",
    sourceMechanisms: ["statement-birth-order"],
    evidence: [],
    ...options,
  };
}

function model(nodes: SchedulerConstraintNode[], baselineBackwardOrder: number[], dependencies: SchedulerBlockModel["dependencies"] = []): SchedulerBlockModel {
  return {
    schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
    function: "func_test",
    stage: "sched",
    block: 0,
    launchPriority: 0x7f000001,
    nodes,
    dependencies,
    baselineBackwardOrder,
    baselineForwardOrder: [...baselineBackwardOrder].reverse(),
    baselineReadySets: baselineBackwardOrder.map((uid, index) => ({ cycle: index + 1, uids: [uid] })),
    hazardPolicy: { kind: "none", evidence: [] },
    caveats: [],
  };
}

function input(blockModel: SchedulerBlockModel, target: number[]): SchedulerConstraintInput {
  return {
    schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
    model: blockModel,
    domain: {
      schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
      function: blockModel.function,
      stage: blockModel.stage,
      block: blockModel.block,
      variableBoostUids: [],
      luidOrderConstraints: [],
      phantomTemplates: [],
      maxPhantoms: 0,
      optionalEdges: [],
      maxAssignments: 1000,
      sourceMechanisms: [],
      caveats: [],
    },
    assertion: {
      schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
      function: blockModel.function,
      stage: blockModel.stage,
      block: blockModel.block,
      projectedBackwardOrder: target,
      participantUids: target,
      fixedUids: [],
      derivation: "explicit",
      confidence: "exact",
      evidence: [],
    },
  };
}

test("generic finite solver visits assignments in minimum intervention cost", () => {
  const result = solveFiniteDomain<boolean>({
    variables: [
      { id: "a", values: [{ value: false, cost: 0, label: "base" }, { value: true, cost: 1, label: "toggle" }] },
      { id: "b", values: [{ value: false, cost: 0, label: "base" }, { value: true, cost: 1, label: "toggle" }] },
    ],
    maxAssignments: 4,
    evaluateComplete: (assignment) => assignment.get("a") === true && assignment.get("b") === false,
  });
  assert.equal(result.status, "sat");
  assert.equal(result.assignment?.get("a"), true);
  assert.equal(result.assignment?.get("b"), false);
  assert.equal(result.exploredAssignments, 3);
});

test("parameterized scheduler reproduces a launch-priority boosted-load hazard winner", () => {
  const nodes = [
    node(1, 2, { baselineBoost: true, machineClass: "ordinary" }),
    node(2, 1, { baselineBoost: true, machineClass: "load" }),
  ];
  const block = model(nodes, [2, 1]);
  block.hazardPolicy = { kind: "launch-priority-load-first", evidence: [] };
  const replay = simulateScheduler(block, {
    nodes,
    dependencies: [],
    boosts: { "1": true, "2": true },
    luids: { "1": 2, "2": 1 },
  }, [2, 1]);
  assert.equal(replay.exact, true);
});

test("serialized domains reject unjustified optional dependency edges", () => {
  const value = input(model([node(1, 0)], [1]), [1]);
  value.domain.optionalEdges.push({
    id: "bad-edge",
    fromUid: 1,
    toUid: 1,
    kind: "true",
    cost: 1,
    confidence: "inferred",
    optional: true,
    justification: "",
    evidence: [],
  });
  assert.throws(() => validateSchedulerConstraintInput(value), /source mechanism|unknown real UID|lacks optional/);
});

test("finds a SAT LUID permutation without function-specific UIDs", () => {
  const block = model([node(10, 0), node(20, 1)], [20, 10]);
  const result = solveSchedulerConstraints(input(block, [10, 20]), "build/test");
  assert.equal(result.status, "sat");
  assert.ok(result.witness!.luids["10"] > result.witness!.luids["20"]);
});

test("emits bounded exhaustive UNSAT when fixed LUID relations contradict the target", () => {
  const block = model([
    node(10, 0, { luidVariable: false }),
    node(20, 1, { luidVariable: false }),
  ], [20, 10]);
  const value = input(block, [10, 20]);
  value.domain.luidOrderConstraints.push({
    id: "fixed-10-before-20",
    beforeUid: 10,
    afterUid: 20,
    source: "fixed-chain",
    confidence: "exact",
    evidence: [],
  });
  const result = solveSchedulerConstraints(value, "build/test");
  assert.equal(result.status, "unsat");
  assert.equal(result.unsatCertificate?.exhaustive, true);
  assert.equal(result.unsatCertificate?.core.some((conflict) => conflict.kind === "luid-cycle"), true);
});

test("finds a projected target order through a bounded self-deleting phantom reader", () => {
  const nodes = [
    node(1, 0, { baselineBoost: true, boostVariable: true, luidVariable: false, pseudo: 101, assignedRegister: "t3" }),
    node(2, 2),
    node(3, 1, { luidVariable: false }),
    node(4, 3, { machineClass: "zero-width", luidVariable: false }),
  ];
  const dependencies = [
    { id: "1-to-4", fromUid: 1, toUid: 4, kind: "unknown" as const, cost: 1, confidence: "exact" as const, optional: false, justification: "fixture", evidence: [] },
    { id: "2-to-4", fromUid: 2, toUid: 4, kind: "unknown" as const, cost: 1, confidence: "exact" as const, optional: false, justification: "fixture", evidence: [] },
    { id: "3-to-4", fromUid: 3, toUid: 4, kind: "unknown" as const, cost: 1, confidence: "exact" as const, optional: false, justification: "fixture", evidence: [] },
  ];
  const block = model(nodes, [4, 1, 2, 3], dependencies);
  const value = input(block, [4, 2, 1, 3]);
  value.domain.variableBoostUids = [1];
  value.domain.maxPhantoms = 1;
  value.domain.phantomTemplates = [{
    id: "read-web-101",
    producerUid: 1,
    producerPseudo: 101,
    releaseUid: 4,
    readRegister: "t3",
    sourceMechanism: "fresh-vs-reused-web",
    coalescible: true,
    justification: "typed coalescible copy fixture",
    evidence: [],
  }];
  value.domain.luidOrderConstraints.push({
    id: "fixed-1-before-3",
    beforeUid: 1,
    afterUid: 3,
    source: "fixed-chain",
    confidence: "exact",
    evidence: [],
  });
  const result = solveSchedulerConstraints(value, "build/test");
  assert.equal(result.status, "sat");
  assert.equal(result.witness?.phantoms.length, 1);
  assert.deepEqual(result.witness?.projectedBackwardOrder, [4, 2, 1, 3]);
  assert.equal(result.witness?.boosts["1"], true);
});

test("func_80019070 reduced fixture replays 21/21 and finds the generic phantom/web witness", () => {
  const fixture = JSON.parse(readFileSync(new URL("fixtures/func_80019070-block0.json", import.meta.url), "utf8")) as any;
  const nodes: SchedulerConstraintNode[] = fixture.nodes.map((value: any[]) => node(value[0], value[3], {
    basePriority: value[1],
    baselineBoost: value[2],
    boostVariable: value[4],
    luidVariable: value[5],
    machineClass: value[6],
    ...(value[7] === null ? {} : { pseudo: value[7] }),
    ...(value[8] === null ? {} : { assignedRegister: value[8] }),
  }));
  const block = model(nodes, fixture.baseline, fixture.edges.map((value: any[], index: number) => ({
    id: `fixture-edge-${index}`,
    fromUid: value[0],
    toUid: value[1],
    kind: value[2],
    cost: value[3],
    confidence: "exact" as const,
    optional: false,
    justification: "reduced trace fixture",
    evidence: [],
  })));
  block.function = fixture.function;
  block.launchPriority = fixture.launchPriority;
  block.hazardPolicy = { kind: "launch-priority-load-first", evidence: [] };
  const value = input(block, fixture.target);
  value.assertion.function = fixture.function;
  value.domain.function = fixture.function;
  value.domain.variableBoostUids = fixture.variableBoostUids;
  value.domain.luidOrderConstraints = fixture.luidRelations.map((relation: any[], index: number) => ({
    id: `fixture-luid-${index}`,
    beforeUid: relation[0],
    afterUid: relation[1],
    source: relation[2],
    confidence: "reconstructed" as const,
    evidence: [],
  }));
  value.domain.maxPhantoms = 1;
  value.domain.maxAssignments = 10_000;
  value.domain.phantomTemplates = [{
    id: fixture.phantom[0],
    producerUid: fixture.phantom[1],
    producerPseudo: fixture.phantom[2],
    releaseUid: fixture.phantom[3],
    readRegister: fixture.phantom[4],
    sourceMechanism: "fresh-vs-reused-web",
    coalescible: true,
    justification: "reduced traced coalescible pointer-reader hypothesis",
    evidence: [],
  }];
  const result = solveSchedulerConstraints(value, "build/test");
  assert.equal(result.modelReplay.matchedSelections, 21);
  assert.equal(result.status, "sat");
  assert.equal(result.exploredAssignments, 4_222);
  assert.deepEqual(result.witness?.phantoms.map((phantom) => phantom.producerUid), [4]);
  assert.equal(result.witness?.boosts["70"], false);
  assert.equal(result.witness?.boosts["63"], false);
  assert.equal(result.witness?.boosts["59"], false);
});
