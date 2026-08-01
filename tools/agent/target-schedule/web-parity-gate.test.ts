import assert from "node:assert/strict";
import test from "node:test";
import { applyWebParityGate } from "./web-parity-gate.js";
import type { AllocationRequirement, TargetScheduleRequirement } from "./types.js";

function instruction(mnemonic: string, operands: string[]) {
  return { mnemonic, operands };
}

function allocationRequirement(): AllocationRequirement {
  return {
    id: "allocation-swap-83-126",
    roles: ["target-$a2-role", "target-$t0-role"],
    pseudos: [83, 126],
    observedOrder: [126, 83],
    desiredOrder: [83, 126],
    observedAssignments: {},
    desiredAssignments: {},
    requiredChanges: [],
    confidence: "reconstructed",
    evidence: ["existing evidence"],
  };
}

function scheduleRequirement(stage: "greg" | "sched"): TargetScheduleRequirement {
  return {
    id: `requirement-${stage}`,
    stage,
    description: "test",
    targetIndexes: [0],
    targetCanonical: [],
    candidateIndexes: [0],
    candidateUids: [],
    pseudos: [83, 126],
    hardConstraint: true,
    interventions: [],
    confidence: "reconstructed",
    evidence: [],
  };
}

test("web-parity gate passes and leaves requirements untouched on a pure allocation rotation", () => {
  const target = [
    instruction("andi", ["a1", "v1", "0xffff"]),
    instruction("addu", ["v0", "a2", "a1"]),
    instruction("jr", ["ra"]),
  ];
  const candidate = [
    instruction("andi", ["t0", "v1", "0xffff"]),
    instruction("addu", ["v0", "a2", "t0"]),
    instruction("jr", ["ra"]),
  ];
  const allocation = [allocationRequirement()];
  const requirements = [scheduleRequirement("greg")];
  const result = applyWebParityGate(target, candidate, allocation, requirements);
  assert.equal(result.parity, true);
  assert.equal(result.downgraded, 0);
  assert.equal(allocation[0]!.confidence, "reconstructed");
  assert.equal(requirements[0]!.hardConstraint, true);
});

test("web-parity gate downgrades allocation requirements when webs are missing", () => {
  /* Target has a masking web the candidate lacks — the func_800241EC shape. */
  const target = [
    instruction("subu", ["v0", "a0", "v1"]),
    instruction("andi", ["a1", "v0", "0xffff"]),
    instruction("sw", ["a1", "16(sp)"]),
    instruction("jr", ["ra"]),
  ];
  const candidate = [
    instruction("subu", ["v0", "a0", "v1"]),
    instruction("sw", ["v0", "16(sp)"]),
    instruction("jr", ["ra"]),
  ];
  const allocation = [allocationRequirement()];
  const requirements = [scheduleRequirement("greg"), scheduleRequirement("sched")];
  const result = applyWebParityGate(target, candidate, allocation, requirements);
  assert.equal(result.parity, false);
  assert.equal(result.downgraded, 1);
  assert.ok(result.caveat && /WEB-PARITY FAILURE/.test(result.caveat));
  assert.ok(result.caveat && /andi/.test(result.caveat));
  assert.equal(allocation[0]!.confidence, "inferred");
  assert.match(allocation[0]!.evidence[0]!, /web-parity gate/);
  assert.equal(requirements[0]!.hardConstraint, false);
  assert.equal(requirements[0]!.confidence, "inferred");
  /* Non-allocation stages are left alone. */
  assert.equal(requirements[1]!.hardConstraint, true);
  assert.equal(requirements[1]!.confidence, "reconstructed");
});

test("web-parity gate flags one-sided entry liveness", () => {
  const target = [
    instruction("sw", ["v0", "0(sp)"]), /* $v0 read before any def: entry web */
    instruction("jr", ["ra"]),
  ];
  const candidate = [
    instruction("move", ["v0", "zero"]),
    instruction("sw", ["v0", "0(sp)"]),
    instruction("jr", ["ra"]),
  ];
  const result = applyWebParityGate(target, candidate, [], []);
  assert.equal(result.parity, false);
  assert.ok(result.caveat && /entry-liveness only in target/.test(result.caveat));
});
