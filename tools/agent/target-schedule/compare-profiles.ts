import type { TraceConfidence } from "../compiler-trace/types.js";
import { minimumConfidence } from "./profile.js";
import type {
  ScheduleMechanismDelta,
  ScheduleMechanismProfile,
} from "./profile-types.js";
import { SCHEDULE_PROFILE_SCHEMA_VERSION } from "./profile-types.js";

const REPLAY_SCORE: Record<ScheduleMechanismProfile["targetOrder"][number]["status"], number> = {
  "reproduced-with-current-state": 4,
  "reproducible-with-interventions": 3,
  "impossible-under-current-dag": 2,
  "baseline-not-exact": 0,
  "unsupported": 0,
};

const CONFIDENCE_SCORE: Record<TraceConfidence, number> = {
  inferred: 0,
  reconstructed: 1,
  exact: 2,
};

function key(stage: string, block: number, indexes: number[]): string {
  return `${stage}:${block}:${indexes.join(",")}`;
}

function rangeCovered(profile: ScheduleMechanismProfile, start: number, end: number): boolean {
  return profile.preservationRanges.some((range) => range.exact && range.start <= start && range.end >= end);
}

function allocationKey(role: ScheduleMechanismProfile["allocationRoles"][number]): string {
  return `${role.targetRegister}:${role.targetIndexes.join(",")}`;
}

export function compareScheduleMechanismProfiles(
  baseline: ScheduleMechanismProfile,
  variant: ScheduleMechanismProfile,
): ScheduleMechanismDelta {
  if (baseline.function !== variant.function) throw new Error("schedule profiles target different functions");
  if (baseline.traceBundleHash === variant.traceBundleHash && baseline.assemblyHash === variant.assemblyHash) {
    return {
      schemaVersion: SCHEDULE_PROFILE_SCHEMA_VERSION,
      baselineVariantId: baseline.variantId,
      variantId: variant.variantId,
      finalAssemblyEquivalent: true,
      verdict: "mechanistically-equivalent",
      replayChanges: [],
      allocationChanges: [],
      delaySlotChanges: [],
      preservationChanges: [],
      confidence: "exact",
      reasons: ["Normalized compiler trace and final assembly are equivalent."],
    };
  }
  const replayChanges: string[] = [];
  const allocationChanges: string[] = [];
  const delaySlotChanges: string[] = [];
  const preservationChanges: string[] = [];
  const reasons: string[] = [];
  const confidences: TraceConfidence[] = [];
  let improved = false;
  let regressed = false;
  let inconclusive = false;

  for (const range of baseline.preservationRanges.filter((item) => item.exact)) {
    if (!rangeCovered(variant, range.start, range.end)) {
      regressed = true;
      preservationChanges.push(`exact target range ${range.start}:${range.end} regressed`);
    }
  }

  const variantReplay = new Map(variant.targetOrder.map((item) => [key(item.stage, item.block, item.targetIndexes), item]));
  for (const before of baseline.targetOrder) {
    const replayKey = key(before.stage, before.block, before.targetIndexes);
    const after = variantReplay.get(replayKey);
    confidences.push(before.confidence);
    if (!after || before.targetIndexes.length === 0) {
      inconclusive = true;
      replayChanges.push(`${replayKey}: target-relative replay could not be aligned`);
      continue;
    }
    confidences.push(after.confidence);
    const baselineComparator = baseline.baselineReplay.find((item) => item.stage === before.stage && item.block === before.block);
    const variantComparator = variant.baselineReplay.find((item) => item.stage === after.stage && item.block === after.block);
    if (baselineComparator?.status !== "exact" || variantComparator?.status !== "exact") {
      inconclusive = true;
      replayChanges.push(`${replayKey}: comparator replay is not exact in both profiles`);
      continue;
    }
    const beforeScore = REPLAY_SCORE[before.status];
    const afterScore = REPLAY_SCORE[after.status];
    const confidenceDecreased = CONFIDENCE_SCORE[after.confidence] < CONFIDENCE_SCORE[before.confidence];
    if (afterScore > beforeScore) {
      if (confidenceDecreased) {
        inconclusive = true;
        replayChanges.push(`${replayKey}: apparent replay improvement has lower confidence ${before.confidence} -> ${after.confidence}`);
      } else {
        improved = true;
        replayChanges.push(`${replayKey}: replay improved ${before.status} -> ${after.status}`);
      }
    } else if (afterScore < beforeScore) {
      regressed = true;
      replayChanges.push(`${replayKey}: replay regressed ${before.status} -> ${after.status} (${after.confidence})`);
    } else if (confidenceDecreased) {
      inconclusive = true;
      replayChanges.push(`${replayKey}: confidence decreased ${before.confidence} -> ${after.confidence}`);
    } else if (before.status === "reproducible-with-interventions" && after.status === before.status &&
        before.bestSupportedInterventionCount !== undefined && after.bestSupportedInterventionCount !== undefined) {
      if (after.bestSupportedInterventionCount < before.bestSupportedInterventionCount) {
        improved = true;
        replayChanges.push(`${replayKey}: supported intervention count improved ${before.bestSupportedInterventionCount} -> ${after.bestSupportedInterventionCount}`);
      } else if (after.bestSupportedInterventionCount > before.bestSupportedInterventionCount) {
        regressed = true;
        replayChanges.push(`${replayKey}: supported intervention count regressed ${before.bestSupportedInterventionCount} -> ${after.bestSupportedInterventionCount}`);
      }
    }
  }

  const afterAllocations = new Map(variant.allocationRoles.map((role) => [allocationKey(role), role]));
  for (const before of baseline.allocationRoles) {
    const after = afterAllocations.get(allocationKey(before));
    confidences.push(before.confidence);
    if (!after) {
      inconclusive = true;
      allocationChanges.push(`${allocationKey(before)}: allocation role could not be aligned`);
      continue;
    }
    if (before.requirementSatisfied === "ambiguous" || after.requirementSatisfied === "ambiguous") {
      if (before.requirementSatisfied === after.requirementSatisfied &&
          before.candidateRegister === after.candidateRegister && before.confidence === after.confidence) continue;
      inconclusive = true;
      allocationChanges.push(`${allocationKey(before)}: allocation role is ambiguous`);
      continue;
    }
    confidences.push(after.confidence);
    if (before.requirementSatisfied && !after.requirementSatisfied) {
      regressed = true;
      allocationChanges.push(`${allocationKey(before)}: target register role regressed to ${after.candidateRegister || "unknown"}`);
    } else if (!before.requirementSatisfied && after.requirementSatisfied) {
      improved = true;
      allocationChanges.push(`${allocationKey(before)}: target register role became satisfied`);
    }
  }

  const afterDelays = new Map(variant.delaySlots.map((slot) => [slot.branchTargetIndex, slot]));
  for (const before of baseline.delaySlots) {
    const after = afterDelays.get(before.branchTargetIndex);
    confidences.push(before.confidence);
    if (!after || before.status === "ambiguous" || after.status === "ambiguous") {
      inconclusive = true;
      delaySlotChanges.push(`branch ${before.branchTargetIndex}: delay-slot comparison is ambiguous`);
      continue;
    }
    confidences.push(after.confidence);
    if (before.status === "satisfied" && after.status !== "satisfied") {
      regressed = true;
      delaySlotChanges.push(`branch ${before.branchTargetIndex}: solved delay slot regressed`);
    } else if (before.status !== "satisfied" && after.status === "satisfied") {
      improved = true;
      delaySlotChanges.push(`branch ${before.branchTargetIndex}: delay slot became satisfied`);
    }
  }

  let verdict: ScheduleMechanismDelta["verdict"];
  if (regressed) verdict = "regressed";
  else if (inconclusive) verdict = "changed-inconclusive";
  else if (improved) verdict = "improved";
  else verdict = "mechanistically-equivalent";

  const finalAssemblyEquivalent = baseline.assemblyHash === variant.assemblyHash;
  if (finalAssemblyEquivalent && baseline.traceBundleHash !== variant.traceBundleHash) {
    reasons.push("Final assembly is identical but normalized compiler trace bundles differ.");
  }
  if (verdict === "mechanistically-equivalent") {
    reasons.push(baseline.traceBundleHash === variant.traceBundleHash
      ? "Normalized compiler trace and target-relative profile are equivalent."
      : "Trace bundles differ, but no supported target-relative mechanism change was established.");
  } else if (verdict === "improved") reasons.push("Supported target-relative compiler mechanism progress was established without a higher-priority regression.");
  else if (verdict === "regressed") reasons.push("A solved range, supported replay, allocation role, or delay-slot requirement regressed.");
  else reasons.push("The profiles changed without sufficient exact/reconstructed evidence for a directional verdict.");

  return {
    schemaVersion: SCHEDULE_PROFILE_SCHEMA_VERSION,
    baselineVariantId: baseline.variantId,
    variantId: variant.variantId,
    finalAssemblyEquivalent,
    verdict,
    replayChanges,
    allocationChanges,
    delaySlotChanges,
    preservationChanges,
    confidence: minimumConfidence(confidences.length > 0 ? confidences : ["inferred"]),
    reasons,
  };
}

export function scheduleDeltaRank(delta: ScheduleMechanismDelta | undefined): number {
  if (!delta) return 0;
  if (delta.verdict === "improved") return 3;
  if (delta.verdict === "mechanistically-equivalent") return 2;
  if (delta.verdict === "changed-inconclusive") return 1;
  return -1;
}
