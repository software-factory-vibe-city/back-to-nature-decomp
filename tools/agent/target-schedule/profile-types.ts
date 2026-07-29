import type { TraceConfidence } from "../compiler-trace/types.js";
import type {
  CounterfactualStep,
  InterventionKind,
  InterventionStage,
  TargetOrderReplay,
} from "./types.js";

export const SCHEDULE_PROFILE_SCHEMA_VERSION = 1 as const;

export interface ScheduleMechanismProfile {
  schemaVersion: typeof SCHEDULE_PROFILE_SCHEMA_VERSION;
  function: string;
  variantId: string;
  sourceHash: string;
  assemblyHash: string;
  traceBundleHash: string;
  baselineReplay: Array<{
    stage: "sched" | "sched2";
    block: number;
    status: "exact" | "partial" | "failed";
    confidence: TraceConfidence;
  }>;
  targetOrder: Array<{
    targetIndexes: number[];
    stage: "sched" | "sched2";
    block: number;
    legality: TargetOrderReplay["legality"];
    status: TargetOrderReplay["status"];
    unsupportedOutcomes: CounterfactualStep["outcome"][];
    bestSupportedInterventionCount?: number;
    interventionKinds: InterventionKind[];
    confidence: TraceConfidence;
  }>;
  allocationRoles: Array<{
    targetRegister: string;
    targetIndexes: number[];
    candidateRegister?: string;
    requirementSatisfied: boolean | "ambiguous";
    confidence: TraceConfidence;
  }>;
  delaySlots: Array<{
    branchTargetIndex: number;
    desiredTargetIndex?: number;
    selectedTargetIndex?: number;
    status: "satisfied" | "unsatisfied" | "ambiguous";
    confidence: TraceConfidence;
  }>;
  preservationRanges: Array<{ start: number; end: number; exact: boolean }>;
  firstDivergence?: {
    targetIndex: number;
    candidateIndex?: number;
    stage: InterventionStage;
    description: string;
  };
  caveats: string[];
}

export type ScheduleDeltaVerdict =
  | "improved"
  | "regressed"
  | "mechanistically-equivalent"
  | "changed-inconclusive";

export interface ScheduleMechanismDelta {
  schemaVersion: typeof SCHEDULE_PROFILE_SCHEMA_VERSION;
  baselineVariantId: string;
  variantId: string;
  finalAssemblyEquivalent: boolean;
  verdict: ScheduleDeltaVerdict;
  replayChanges: string[];
  allocationChanges: string[];
  delaySlotChanges: string[];
  preservationChanges: string[];
  confidence: TraceConfidence;
  reasons: string[];
}
