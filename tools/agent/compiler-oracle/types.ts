export const COMPILER_ORACLE_SCHEMA_VERSION = 1 as const;

export interface ScheduleEdge {
  beforeUid: number;
  afterUid: number;
}

export interface ForcedLocalAssignment {
  pseudo: number;
  hardRegister: number;
  registerName?: string;
}

export interface ForbiddenLocalCandidate {
  pseudo: number;
  hardRegister: number;
  registerName?: string;
}

export interface CompilerOracleInterventions {
  scheduleEdges: ScheduleEdge[];
  forcedLocalAssignments: ForcedLocalAssignment[];
  forbiddenLocalCandidates: ForbiddenLocalCandidate[];
}

export interface CompilerOracleEvent {
  stage: "sched" | "local";
  event: string;
  reload?: number;
  block?: number;
  clock?: number;
  uid?: number;
  xUid?: number;
  yUid?: number;
  preferredUid?: number;
  beforeUid?: number;
  afterUid?: number;
  qty?: number;
  pseudo?: number;
  hardRegister?: number;
  born?: number;
  dead?: number;
  legal?: number;
  suggested?: number;
  forced?: number;
  references?: number;
  size?: number;
  minClass?: number;
  alternateClass?: number;
  callsCrossed?: number;
  available?: number[];
  members?: number[];
}

export interface CompilerOracleVariantResult {
  id: string;
  interventions: CompilerOracleInterventions;
  compiled: boolean;
  instructionCount?: number;
  exactInstructionCount?: number;
  maskedMatchPercent?: number;
  exactObject: boolean;
  productionEquivalent?: boolean;
  eventCount: number;
  scheduleOverrideCount: number;
  scheduleEdgeInjectionCount: number;
  forcedLocalAccepted: ForcedLocalAssignment[];
  forcedLocalRejected: ForcedLocalAssignment[];
  artifactDirectory: string;
  error?: string;
}

export interface CompilerOracleReport {
  schemaVersion: typeof COMPILER_ORACLE_SCHEMA_VERSION;
  function: string;
  source: string;
  diagnosticCompiler: string;
  diagnosticCompilerSha256: string;
  productionCompilerSha256: string;
  baselineProductionEquivalent: boolean;
  derivedInterventions: CompilerOracleInterventions;
  variants: CompilerOracleVariantResult[];
  caveats: string[];
}
