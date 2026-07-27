export type TraceConfidence = "exact" | "reconstructed" | "inferred";
export type AllocationStage = "local" | "global/reload";
export type DependencyKind =
  | "true"
  | "anti"
  | "output"
  | "memory/alias"
  | "control"
  | "scheduling-group"
  | "unknown";

export interface StageSummary {
  suffix: string;
  file: string;
  bytes: number;
  instructionCount: number;
  pseudoCount: number;
  pseudoOccurrences: number;
}

export interface RegisterReference {
  register: number;
  mode: string;
  flags: string[];
  name?: string;
}

export interface RawDependencyReference {
  predecessorUid: number;
  note?: "REG_DEP_ANTI" | "REG_DEP_OUTPUT";
}

export interface RtlInstruction {
  uid: number;
  kind: "insn" | "jump_insn" | "call_insn";
  stage: string;
  order: number;
  block?: number;
  text: string;
  expression?: string;
  operation?: string;
  sets: RegisterReference[];
  uses: RegisterReference[];
  deaths: RegisterReference[];
  memoryRead: boolean;
  memoryWrite: boolean;
  control: boolean;
  dependencies: RawDependencyReference[];
}

export interface PseudoStagePresence {
  stage: string;
  setUids: number[];
  useUids: number[];
  deathUids: number[];
  blocks: number[];
  expressions: string[];
}

export interface PseudoTransition {
  fromStage: string;
  toStage: string;
  kind: "appeared" | "deleted" | "set-count-changed" | "substituted" | "merged" | "hard-register-renumbered" | "ambiguous";
  relatedPseudos: number[];
  confidence: TraceConfidence;
  evidence: string;
}

export interface LifetimeRange {
  block: number;
  birthUid?: number;
  deathUid?: number;
  birthIndex: number;
  deathIndex: number;
  fakeBirthIndex: number;
  fakeDeathIndex: number;
  liveIn: boolean;
  liveOut: boolean;
  confidence: TraceConfidence;
}

export interface QuantitySummary {
  id: string;
  members: number[];
  birthIndex?: number;
  deathIndex?: number;
  confidence: TraceConfidence;
  evidence: string;
}

export interface ConflictSummary {
  register: number;
  registerName?: string;
  kind: "pseudo" | "hard-register" | "fake-lifetime-only";
  confidence: TraceConfidence;
}

export interface PseudoProvenance {
  pseudo: number;
  modes: string[];
  userVariable: boolean;
  pointer: boolean;
  attributes: string[];
  sourceExpression?: string;
  sourceExpressionConfidence?: TraceConfidence;
  firstStage: string;
  lastStage: string;
  stages: PseudoStagePresence[];
  transitions: PseudoTransition[];
  lifetimes: LifetimeRange[];
  quantity?: QuantitySummary;
  uses?: number;
  span?: number;
  block?: number;
  sets?: number;
  assignedHardReg?: number;
  assignedRegister?: string;
  allocationStage?: AllocationStage;
  preferences: number[];
  conflicts: ConflictSummary[];
}

export interface DependencyEdge {
  fromUid: number;
  toUid: number;
  kind: DependencyKind;
  cost?: number;
  targetAdjustedCost?: number;
  confidence: TraceConfidence;
  evidence: string;
}

export interface ReadyEntry {
  uid: number;
  displayedPriority: number;
  rawPriority: string;
  rank: number;
}

export interface SchedulerDecision {
  block: number;
  cycle: number;
  ready: ReadyEntry[];
  ranked: number[];
  selectedUid?: number;
  selectedRank?: number;
  basePriority?: number;
  birthPriorityAdjusted: boolean;
  reason: "sole" | "priority" | "birth-priority" | "functional-unit-hazard" | "luid-or-list-order" | "launch" | "blocked" | "unknown";
  reasonConfidence: TraceConfidence;
  events: string[];
}

export interface LifetimeChange {
  register: number;
  direction: "shortened" | "extended";
  from: number;
  to: number;
}

export interface SchedulerStage {
  stage: "sched" | "sched2";
  instructionPriorities: Record<string, { priority: number; refCount: number }>;
  decisions: SchedulerDecision[];
  dependencies: DependencyEdge[];
  sourceOrder: number[];
  forwardOrder: number[];
  backwardSelectionOrder: number[];
  lifetimeChanges: LifetimeChange[];
  caveats: string[];
}

export interface FeedbackFinding {
  category:
    | "sched1-reordered"
    | "sched2-fixed"
    | "allocation-blocked"
    | "memory-or-control"
    | "allocation-observation";
  confidence: TraceConfidence;
  message: string;
  evidence: string[];
  uids: number[];
  registers: string[];
  pseudos: number[];
}

export interface RegisterRecurrenceHint {
  targetRegister: string;
  firstTargetIndex: number;
  secondTargetIndex: number;
  firstCandidateRegister: string;
  secondCandidateRegister: string;
  firstPseudo: number;
  secondPseudo: number;
  confidence: TraceConfidence;
  message: string;
  evidence: string[];
}

export interface CompilerTraceReport {
  schemaVersion: 1;
  function: string;
  source: string;
  outputDirectory: string;
  assembly: string;
  reportArtifact: string;
  flags: string[];
  stages: StageSummary[];
  pseudos: PseudoProvenance[];
  schedulers: SchedulerStage[];
  feedback: FeedbackFinding[];
  recurrenceHints: RegisterRecurrenceHint[];
  caveats: string[];
}

export interface RenderOptions {
  pseudo?: number;
  schedulerWindow?: { start: number; end: number };
}
