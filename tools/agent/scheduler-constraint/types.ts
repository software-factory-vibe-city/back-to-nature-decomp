import type { DependencyKind, TraceConfidence } from "../compiler-trace/types.js";
import type { VariantMechanism } from "../variant-lab/types.js";

export const SCHEDULER_CONSTRAINT_SCHEMA_VERSION = 1 as const;
export const DEFAULT_LAUNCH_PRIORITY = 0x7f000001;

export type ConstraintStatus = "sat" | "unsat" | "inconclusive" | "model-replay-failed";
export type SchedulerMachineClass = "load" | "store" | "control" | "zero-width" | "ordinary" | "phantom-copy";

export interface SchedulerConstraintNode {
  uid: number;
  label: string;
  basePriority: number;
  baselineBoost: boolean;
  boostVariable: boolean;
  baselineLuid: number;
  luidVariable: boolean;
  machineClass: SchedulerMachineClass;
  pseudo?: number;
  assignedRegister?: string;
  sourceMechanisms: VariantMechanism[];
  evidence: string[];
}

export interface SchedulerConstraintEdge {
  id: string;
  fromUid: number;
  toUid: number;
  kind: DependencyKind;
  cost: number;
  confidence: TraceConfidence;
  optional: boolean;
  sourceMechanism?: VariantMechanism;
  justification: string;
  evidence: string[];
}

export interface LuidOrderConstraint {
  id: string;
  beforeUid: number;
  afterUid: number;
  source: "fixed-chain" | "semantic-dependency" | "target-selection" | "phantom-position";
  confidence: TraceConfidence;
  evidence: string[];
}

export interface SchedulerHazardPolicy {
  kind: "launch-priority-load-first" | "none";
  evidence: string[];
}

export interface SchedulerBlockModel {
  schemaVersion: typeof SCHEDULER_CONSTRAINT_SCHEMA_VERSION;
  function: string;
  stage: "sched" | "sched2";
  block: number;
  launchPriority: number;
  nodes: SchedulerConstraintNode[];
  dependencies: SchedulerConstraintEdge[];
  baselineBackwardOrder: number[];
  baselineForwardOrder: number[];
  baselineReadySets: Array<{ cycle: number; uids: number[] }>;
  hazardPolicy: SchedulerHazardPolicy;
  caveats: string[];
}

export interface PhantomTemplate {
  id: string;
  producerUid: number;
  producerPseudo?: number;
  releaseUid: number;
  readRegister?: string;
  sourceMechanism: VariantMechanism;
  coalescible: boolean;
  justification: string;
  evidence: string[];
}

export interface SchedulerConstraintDomain {
  schemaVersion: typeof SCHEDULER_CONSTRAINT_SCHEMA_VERSION;
  function: string;
  stage: "sched" | "sched2";
  block: number;
  variableBoostUids: number[];
  luidOrderConstraints: LuidOrderConstraint[];
  phantomTemplates: PhantomTemplate[];
  maxPhantoms: number;
  optionalEdges: SchedulerConstraintEdge[];
  maxAssignments: number;
  sourceMechanisms: Array<{
    variable: string;
    mechanism: VariantMechanism;
    description: string;
  }>;
  caveats: string[];
}

export interface SchedulerTargetAssertion {
  schemaVersion: typeof SCHEDULER_CONSTRAINT_SCHEMA_VERSION;
  function: string;
  stage: "sched" | "sched2";
  block: number;
  projectedBackwardOrder: number[];
  participantUids: number[];
  fixedUids: number[];
  derivation: "target-machine-prefix" | "target-replay-window" | "explicit";
  confidence: TraceConfidence;
  evidence: string[];
}

export interface SchedulerConstraintInput {
  schemaVersion: typeof SCHEDULER_CONSTRAINT_SCHEMA_VERSION;
  model: SchedulerBlockModel;
  domain: SchedulerConstraintDomain;
  assertion: SchedulerTargetAssertion;
}

export interface SchedulerReplayStep {
  cycle: number;
  selectedUid?: number;
  expectedUid?: number;
  readyUids: number[];
  rankedUids: number[];
  status: "matched" | "wrong-selection" | "not-ready" | "queue-stalled";
  evidence: string[];
}

export interface SchedulerModelReplay {
  exact: boolean;
  matchedSelections: number;
  totalSelections: number;
  steps: SchedulerReplayStep[];
  firstDivergence?: string;
  evidence: string[];
}

export interface PhantomWitness {
  uid: number;
  templateId: string;
  producerUid: number;
  releaseUid: number;
  selectedAt: number;
  boost: boolean;
  luid: number;
  readRegister?: string;
  producerPseudo?: number;
  sourceMechanism: VariantMechanism;
  evidence: string[];
}

export interface SchedulerConstraintWitness {
  boosts: Record<string, boolean>;
  luids: Record<string, number>;
  enabledExtraEdges: string[];
  phantoms: PhantomWitness[];
  fullBackwardOrder: number[];
  projectedBackwardOrder: number[];
  sourceRequirements: Array<{
    id: string;
    mechanism: VariantMechanism;
    description: string;
    uids: number[];
    pseudos: number[];
    evidence: string[];
  }>;
  hardRegisterConflicts: string[];
  evidence: string[];
}

export interface SchedulerConflictReason {
  id: string;
  kind: "priority" | "readiness" | "hazard" | "dependency-class" | "luid-cycle" | "fixed-luid" | "domain";
  cycle?: number;
  desiredUid?: number;
  competingUids: number[];
  requirementIds: string[];
  message: string;
  evidence: string[];
}

export interface SchedulerUnsatCertificate {
  bounded: true;
  exhaustive: boolean;
  exploredAssignments: number;
  structuralAlternatives: number;
  domainSummary: string[];
  core: SchedulerConflictReason[];
  caveats: string[];
}

export interface SchedulerConstraintResult {
  schemaVersion: typeof SCHEDULER_CONSTRAINT_SCHEMA_VERSION;
  function: string;
  stage: "sched" | "sched2";
  block: number;
  status: ConstraintStatus;
  modelReplay: SchedulerModelReplay;
  exploredAssignments: number;
  structuralAlternatives: number;
  witness?: SchedulerConstraintWitness;
  unsatCertificate?: SchedulerUnsatCertificate;
  sourceSearchSpec?: string;
  artifacts: string;
  caveats: string[];
}
