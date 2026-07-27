import type { TraceConfidence } from "../compiler-trace/types.js";
import type { VariantMechanism } from "../variant-lab/types.js";

export const TARGET_SCHEDULE_SCHEMA_VERSION = 1 as const;

export interface MachineInstructionRef {
  index: number;
  canonical: string;
  mnemonic: string;
  operands: string[];
  relocation?: string;
  uid?: number;
  block?: number;
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

export type InterventionStage = "rtl" | "sched" | "greg" | "sched2" | "dbr";
export type InterventionKind =
  | "birth-eligibility"
  | "birth-order"
  | "lifetime-endpoint"
  | "dependency-add"
  | "dependency-remove"
  | "allocation-order"
  | "hard-register-assignment"
  | "delay-candidate-order";

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
  schedulerReplay: SchedulerReplayResult[];
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
  if (raw.schemaVersion !== TARGET_SCHEDULE_SCHEMA_VERSION) throw new Error(`unsupported target-schedule schema: ${raw.schemaVersion}`);
  if (typeof raw.function !== "string" || !raw.function) throw new Error("target-schedule analysis is missing function");
  if (!Array.isArray(raw.target) || !Array.isArray(raw.candidate) || !Array.isArray(raw.requirements)) {
    throw new Error("target-schedule analysis is missing instruction or requirement arrays");
  }
  return value as TargetScheduleAnalysis;
}
