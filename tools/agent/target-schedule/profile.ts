import type { CompilerTraceReport, TraceConfidence } from "../compiler-trace/types.js";
import { sha256, stableJson } from "../variant-lab/artifacts.js";
import type { TargetScheduleAnalysis } from "./types.js";
import {
  SCHEDULE_PROFILE_SCHEMA_VERSION,
  type ScheduleMechanismProfile,
} from "./profile-types.js";

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function targetIndexesForUids(analysis: TargetScheduleAnalysis, uids: number[]): number[] {
  const wanted = new Set(uids);
  return uniqueSorted(analysis.correspondence.flatMap((item) =>
    item.candidateUid !== undefined && wanted.has(item.candidateUid) ? [item.targetIndex] : []
  ));
}

/** Hash normalized compiler causality, not artifact paths or final assembly alone. */
export function traceBundleHash(trace: CompilerTraceReport, assemblyHash: string): string {
  const normalizedMetadata = trace.stageMetadata.map((stage) => ({
    ...stage,
    notes: stage.notes.map(({ sourceFile: _sourceFile, ...note }) => note),
  }));
  return sha256(stableJson({
    schemaVersion: trace.schemaVersion,
    flags: trace.flags,
    stages: trace.stages.map(({ file: _file, bytes: _bytes, ...stage }) => stage),
    stageMetadata: normalizedMetadata,
    pseudos: trace.pseudos,
    allocationOrder: trace.allocationOrder,
    schedulers: trace.schedulers,
    feedback: trace.feedback,
    recurrenceHints: trace.recurrenceHints,
    assemblyHash,
  }));
}

function selectedTargetIndex(analysis: TargetScheduleAnalysis, candidateIndex: number | undefined): number | undefined {
  if (candidateIndex === undefined) return undefined;
  const matches = analysis.correspondence.filter((item) => item.candidateIndex === candidateIndex);
  return matches.length === 1 ? matches[0]!.targetIndex : undefined;
}

function delayStatus(
  desiredTargetIndex: number | undefined,
  selected: number | undefined,
): "satisfied" | "unsatisfied" | "ambiguous" {
  if (desiredTargetIndex === undefined || selected === undefined) return "ambiguous";
  return desiredTargetIndex === selected ? "satisfied" : "unsatisfied";
}

export function deriveScheduleMechanismProfile(options: {
  analysis: TargetScheduleAnalysis;
  trace: CompilerTraceReport;
  variantId: string;
  sourceHash: string;
  assemblyHash: string;
}): ScheduleMechanismProfile {
  const { analysis } = options;
  const targetOrder = analysis.targetOrderReplays.map((replay) => {
    const interventionSets = analysis.interventionSets.filter((set) =>
      set.stage === replay.stage && set.block === replay.block && set.minimalWithinBound
    );
    const best = interventionSets
      .map((set) => set.interventions.length)
      .sort((left, right) => left - right)[0];
    const interventionKinds = [...new Set(interventionSets.flatMap((set) =>
      set.interventions.map((intervention) => intervention.kind)
    ))].sort();
    const unsupportedOutcomes = [...new Set(replay.steps
      .map((step) => step.outcome)
      .filter((outcome) => outcome !== "same" && outcome !== "tie-lost"))].sort();
    const result: ScheduleMechanismProfile["targetOrder"][number] = {
      targetIndexes: targetIndexesForUids(analysis, replay.targetUids),
      stage: replay.stage,
      block: replay.block,
      legality: replay.legality,
      status: replay.status,
      unsupportedOutcomes,
      interventionKinds,
      confidence: replay.confidence,
    };
    if (best !== undefined && replay.status === "reproducible-with-interventions") {
      result.bestSupportedInterventionCount = best;
    }
    return result;
  });

  const profile: ScheduleMechanismProfile = {
    schemaVersion: SCHEDULE_PROFILE_SCHEMA_VERSION,
    function: analysis.function,
    variantId: options.variantId,
    sourceHash: options.sourceHash,
    assemblyHash: options.assemblyHash,
    traceBundleHash: traceBundleHash(options.trace, options.assemblyHash),
    baselineReplay: analysis.baselineReplay.map((item) => ({
      stage: item.stage,
      block: item.block,
      status: item.status,
      confidence: item.confidence,
    })),
    targetOrder,
    allocationRoles: analysis.registerRoles.filter((role) => role.confidence !== "inferred").map((role) => ({
      targetRegister: role.targetRegister,
      targetIndexes: uniqueSorted(role.targetIndexes),
      candidateRegister: role.candidateRegister,
      requirementSatisfied: role.confidence === "inferred"
        ? "ambiguous"
        : role.targetRegister === role.candidateRegister,
      confidence: role.confidence,
    })),
    delaySlots: analysis.delaySlots.map((slot) => {
      const selected = selectedTargetIndex(analysis, slot.candidateDelayIndex);
      const result: ScheduleMechanismProfile["delaySlots"][number] = {
        branchTargetIndex: slot.branchTargetIndex,
        status: delayStatus(slot.desiredTargetIndex, selected),
        confidence: slot.confidence,
      };
      if (slot.desiredTargetIndex !== undefined) result.desiredTargetIndex = slot.desiredTargetIndex;
      if (selected !== undefined) result.selectedTargetIndex = selected;
      return result;
    }),
    preservationRanges: analysis.preservationRanges,
    caveats: [...analysis.caveats],
  };
  if (analysis.firstDivergence) profile.firstDivergence = analysis.firstDivergence;
  return profile;
}

export function minimumConfidence(values: TraceConfidence[]): TraceConfidence {
  if (values.includes("inferred")) return "inferred";
  if (values.includes("reconstructed")) return "reconstructed";
  return "exact";
}
