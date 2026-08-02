import type { TraceConfidence } from "../compiler-trace/types.js";

export const ALLOCATOR_COUNTERFACTUAL_SCHEMA_VERSION = 1 as const;

export interface AllocnoPriority {
  pseudo: number;
  rank: number;
  references: number;
  liveLength: number;
  size: number;
  priority: number;
  assignedRegister?: string;
  formulaVerified: boolean;
}

export interface HardRegisterLifetime {
  register: number;
  registerName: string;
  block: number;
  birthIndex: number;
  deathIndex: number;
  liveIn: boolean;
  liveOut: boolean;
  birthUid?: number;
  deathUid?: number;
}

export interface PriorityIntervention {
  blockerPseudo: number;
  blockerRank: number;
  blockerPriority: number;
  requiredPriority: number;
  minimumReferences?: number;
  maximumLiveLength?: number;
  confidence: TraceConfidence;
  evidence: string[];
}

export interface ExplicitHardBlocker {
  kind: "explicit-hard-register";
  register: string;
  block: number;
  birthIndex: number;
  deathIndex: number;
  roleBirthIndex: number;
  roleDeathIndex: number;
  birthUid?: number;
  deathUid?: number;
  requiredRelation?: { beforeUid: number; afterUid: number };
  evidence: string[];
}

export interface AllocatedPseudoBlocker {
  kind: "allocated-pseudo";
  pseudo: number;
  assignedRegister: string;
  allocationStage?: string;
  block: number;
  birthIndex: number;
  deathIndex: number;
  evidence: string[];
}

export interface PseudoCounterfactual {
  pseudo: number;
  observedRegister?: string;
  desiredRegister: string;
  allocationStage?: string;
  sets?: number;
  references?: number;
  liveLength?: number;
  rank?: number;
  priority?: number;
  directHardConflict: boolean;
  explicitHardBlockers: ExplicitHardBlocker[];
  allocatedPseudoBlockers: AllocatedPseudoBlocker[];
  priorityInterventions: PriorityIntervention[];
  verdict:
    | "already-satisfied"
    | "requires-hard-lifetime-change"
    | "requires-local-allocation-change"
    | "requires-global-order-change"
    | "assignment-choice-unexplained";
  sourceMechanisms: string[];
  evidence: string[];
}

export interface RegisterRoleCounterfactual {
  targetRegister: string;
  candidateRegister: string;
  targetIndexes: number[];
  candidateIndexes: number[];
  candidateUids: number[];
  pseudos: number[];
  confidence: TraceConfidence;
  findings: PseudoCounterfactual[];
  evidence: string[];
}

export interface AllocatorCounterfactualAnalysis {
  schemaVersion: typeof ALLOCATOR_COUNTERFACTUAL_SCHEMA_VERSION;
  function: string;
  source: string;
  traceArtifact: string;
  targetScheduleArtifact: string;
  outputDirectory: string;
  allocnoPriorityFormula: string;
  allocnoOrderVerified: boolean;
  allocnos: AllocnoPriority[];
  hardRegisterLifetimes: HardRegisterLifetime[];
  roles: RegisterRoleCounterfactual[];
  requirements: string[];
  caveats: string[];
}
