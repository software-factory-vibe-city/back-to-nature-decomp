import type {
  SchedulerSelectionExplanation,
  TraceConfidence,
} from "../compiler-trace/types.js";
import type { VariantMechanism } from "../variant-lab/types.js";

export const TARGET_SCHEDULE_SCHEMA_VERSION = 2 as const;

export interface MachineInstructionRef {
  index: number;
  canonical: string;
  mnemonic: string;
  operands: string[];
  relocation?: string;
  uid?: number;
  candidateUids?: number[];
  block?: number;
}

export interface EmissionAlignmentEntry {
  rtlUid?: number;
  rtlOrder?: number;
  machineIndex?: number;
  kind: "emitted" | "zero-width" | "rtl-only-unknown" | "machine-only";
  score?: number;
  confidence: TraceConfidence;
  evidence: string[];
}

export interface MachineUidLink {
  machineIndex: number;
  uid?: number;
  candidateUids: number[];
  confidence: TraceConfidence;
  evidence: string[];
}

export interface InstructionCorrespondence {
  targetIndex: number;
  candidateIndex?: number;
  candidateUid?: number;
  confidence: TraceConfidence;
  evidence: string[];
}

export interface RegisterRoleMap {
  targetRegister: string;
  candidateRegister: string;
  targetIndexes: number[];
  candidateIndexes: number[];
  pseudos: number[];
  confidence: TraceConfidence;
  evidence: string[];
}

export interface SchedulerReplayResult {
  stage: "sched" | "sched2";
  block: number;
  reproduced: boolean;
  counterfactualEligible: boolean;
  matchedCycles: number;
  totalCycles: number;
  firstMismatch?: string;
  caveats: string[];
}

export interface BaselineReplayResult {
  stage: "sched" | "sched2";
  block: number;
  status: "exact" | "partial" | "failed";
  matchedSelections: number;
  totalSelections: number;
  matchedReadySets: number;
  firstDivergence?: string;
  unsupportedFeatures: string[];
  confidence: TraceConfidence;
  evidence: string[];
}

export interface TargetOrderConstraint {
  beforeUid: number;
  afterUid: number;
  source: "target-machine-order" | "candidate-dependency";
  confidence: TraceConfidence;
  evidence: string[];
}

export interface CounterfactualStep {
  cycle: number;
  observedUid?: number;
  desiredUid?: number;
  desiredReady: boolean;
  outcome: "same" | "tie-lost" | "dependency-blocked" | "latency-blocked" | "resource-blocked" | "ambiguous";
  decidingCriterion?: string;
  blockers: number[];
  evidence: string[];
}

export interface TargetOrderReplay {
  stage: "sched" | "sched2";
  block: number;
  targetUids: number[];
  legality: "legal-under-candidate-dag" | "violates-candidate-dependency" | "ambiguous-correspondence" | "cross-block" | "wrong-stage" | "unsupported";
  status: "reproduced-with-current-state" | "reproducible-with-interventions" | "impossible-under-current-dag" | "baseline-not-exact" | "unsupported";
  steps: CounterfactualStep[];
  confidence: TraceConfidence;
  caveats: string[];
}

export interface SchedulerInterventionSet {
  interventions: AbstractIntervention[];
  block: number;
  stage: "sched" | "sched2";
  changedSteps: number[];
  preservesObservedConstraints: string[];
  minimalWithinBound: boolean;
  confidence: TraceConfidence;
  evidence: string[];
}

export type InterventionStage = "rtl" | "sched" | "greg" | "sched2" | "dbr";
export type InterventionKind =
  | "birth-eligibility"
  | "birth-order"
  | "lifetime-endpoint"
  | "dependency-add"
  | "dependency-remove"
  | "allocation-order"
  | "hard-register-assignment"
  | "delay-candidate-order"
  | "luid-order"
  | "ready-insertion-order"
  | "priority-relation"
  | "resource-relation";

export interface AbstractIntervention {
  id: string;
  stage: InterventionStage;
  kind: InterventionKind;
  uids: number[];
  pseudos: number[];
  expectedEffect: string;
  sourceMechanisms: VariantMechanism[];
  confidence: TraceConfidence;
  evidence: string[];
}

export interface TargetScheduleRequirement {
  id: string;
  stage: InterventionStage;
  description: string;
  targetIndexes: number[];
  targetCanonical: string[];
  candidateIndexes: number[];
  candidateUids: number[];
  pseudos: number[];
  hardConstraint: boolean;
  interventions: AbstractIntervention[];
  confidence: TraceConfidence;
  evidence: string[];
}

export interface AllocationRequirement {
  id: string;
  roles: string[];
  pseudos: number[];
  observedOrder: number[];
  desiredOrder?: number[];
  observedAssignments: Record<string, string>;
  desiredAssignments: Record<string, string>;
  requiredChanges: AbstractIntervention[];
  confidence: TraceConfidence;
  evidence: string[];
}

export interface DelaySlotAnalysis {
  branchTargetIndex: number;
  branchCandidateIndex?: number;
  branchUid?: number;
  candidateDelayIndex?: number;
  candidateDelayUid?: number;
  desiredTargetIndex?: number;
  desiredCandidateIndex?: number;
  desiredCandidateUid?: number;
  ownBlockScanUids: number[];
  firstEligibleUid?: number;
  eligibleUids: number[];
  rejected: Array<{ uid: number; reason: string }>;
  requirement?: string;
  confidence: TraceConfidence;
  evidence: string[];
}

export interface TargetScheduleAnalysis {
  schemaVersion: typeof TARGET_SCHEDULE_SCHEMA_VERSION;
  function: string;
  source: string;
  outputDirectory: string;
  traceArtifact: string;
  target: MachineInstructionRef[];
  candidate: MachineInstructionRef[];
  correspondence: InstructionCorrespondence[];
  registerRoles: RegisterRoleMap[];
  emissionAlignment: EmissionAlignmentEntry[];
  machineUidLinks: MachineUidLink[];
  /**
   * Whether final RTL and machine instruction counts agreed after proven
   * zero-width skips. False means at least one RTL instruction emitted a
   * number of machine instructions other than one — a block move or a trap
   * packet — so every link below is inferred rather than established.
   */
  emissionCountExact: boolean;
  schedulerSelections: SchedulerSelectionExplanation[];
  schedulerReplay: SchedulerReplayResult[];
  baselineReplay: BaselineReplayResult[];
  targetOrderConstraints: TargetOrderConstraint[];
  targetOrderReplays: TargetOrderReplay[];
  interventionSets: SchedulerInterventionSet[];
  allocationRequirements: AllocationRequirement[];
  delaySlots: DelaySlotAnalysis[];
  requirements: TargetScheduleRequirement[];
  preservationRanges: Array<{ start: number; end: number; exact: boolean }>;
  firstDivergence?: { targetIndex: number; candidateIndex?: number; stage: InterventionStage; description: string };
  caveats: string[];
}

export function assertTargetScheduleAnalysis(value: unknown): TargetScheduleAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("target-schedule analysis must be an object");
  const raw = value as Record<string, unknown>;
  if (typeof raw.schemaVersion !== "number") throw new Error("target-schedule analysis is missing schemaVersion");
  if (raw.schemaVersion > TARGET_SCHEDULE_SCHEMA_VERSION) {
    throw new Error(`target-schedule schema ${raw.schemaVersion} is newer than supported schema ${TARGET_SCHEDULE_SCHEMA_VERSION}`);
  }
  if (raw.schemaVersion !== 1 && raw.schemaVersion !== TARGET_SCHEDULE_SCHEMA_VERSION) throw new Error(`unsupported target-schedule schema: ${raw.schemaVersion}`);
  if (typeof raw.function !== "string" || !raw.function) throw new Error("target-schedule analysis is missing function");
  if (!Array.isArray(raw.target) || !Array.isArray(raw.candidate) || !Array.isArray(raw.requirements)) {
    throw new Error("target-schedule analysis is missing instruction or requirement arrays");
  }
  if (raw.schemaVersion === 1) {
    return {
      ...(value as Omit<TargetScheduleAnalysis, "schemaVersion">),
      schemaVersion: TARGET_SCHEDULE_SCHEMA_VERSION,
      emissionAlignment: [],
      machineUidLinks: [],
      emissionCountExact: false,
      schedulerSelections: [],
      baselineReplay: [],
      targetOrderConstraints: [],
      targetOrderReplays: [],
      interventionSets: [],
    };
  }
  return value as TargetScheduleAnalysis;
}
