/**
 * web-parity-gate.ts — precondition gate for allocation-swap requirements.
 *
 * An allocation-swap requirement asserts "these two pseudos must reverse
 * their hard-register assignments" — which presumes the candidate's pseudo
 * population already matches the target's. When the register-web sets differ
 * (missing/extra webs, entry-liveness on one side only), the source semantics
 * differ from the target and any allocation-order intervention is aimed at
 * the wrong problem (see the func_800241EC retrospective: a phantom
 * "allocation-priority swap" that was actually three semantic misreads).
 *
 * This gate downgrades allocation requirements to soft/inferred and records
 * an explicit caveat instead of letting a hard "allocation-swap-N-M"
 * constraint direct the matching loop toward allocator research.
 */

import {
  compareWebs,
  computeWebs,
  summarizeWeb,
  type InstructionLike,
} from "../webAnalysis.js";
import type { AllocationRequirement, TargetScheduleRequirement } from "./types.js";

export interface WebParityGateResult {
  parity: boolean;
  downgraded: number;
  caveat?: string;
}

export function applyWebParityGate(
  target: InstructionLike[],
  candidate: InstructionLike[],
  allocation: AllocationRequirement[],
  requirements: TargetScheduleRequirement[],
): WebParityGateResult {
  const parity = compareWebs(computeWebs(target), computeWebs(candidate));
  if (parity.parity) return { parity: true, downgraded: 0 };

  const describe = (label: string, webs: ReturnType<typeof computeWebs>): string =>
    webs.length > 0 ? `${label}: ${webs.slice(0, 4).map(summarizeWeb).join("; ")}` : "";
  const parts = [
    describe(`${parity.targetOnly.length} target-only web(s)`, parity.targetOnly),
    describe(`${parity.compiledOnly.length} candidate-only web(s)`, parity.compiledOnly),
    describe("entry-liveness only in target", parity.entryOnlyTarget),
    describe("entry-liveness only in candidate", parity.entryOnlyCompiled),
  ].filter(Boolean);
  const caveat = `WEB-PARITY FAILURE: ${parts.join(" — ")}. The pseudo web sets differ, so the ` +
    "source semantics do not yet match the target; allocation requirements below are downgraded " +
    "to soft/inferred. Restore web parity (missing/extra temporaries, value provenance — see " +
    "explainDiff) before acting on any allocation-order intervention.";
  const shortNote = "Downgraded by web-parity gate: pseudo web sets differ between target and candidate.";

  let downgraded = 0;
  for (const item of allocation) {
    item.confidence = "inferred";
    item.evidence.unshift(shortNote);
    downgraded++;
  }
  for (const requirement of requirements) {
    if (requirement.stage !== "greg") continue;
    requirement.hardConstraint = false;
    requirement.confidence = "inferred";
    requirement.evidence.unshift(shortNote);
  }
  return { parity: false, downgraded, caveat };
}
