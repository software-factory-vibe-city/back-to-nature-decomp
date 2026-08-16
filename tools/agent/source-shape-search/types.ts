import type { HypothesisClassification, VariantMechanism } from "../variant-lab/types.js";
import type { ExactSourceEdit } from "../variant-lab/types.js";
import type { ScheduleMechanismDelta } from "../target-schedule/profile-types.js";

export const SOURCE_SHAPE_SEARCH_SCHEMA_VERSION = 2 as const;

export interface SourceShapeAlternative {
  id: string;
  edits?: ExactSourceEdit[];
  useBase?: boolean;
  expectedEffect: string;
  invariants: string[];
  naturalPriority?: number;
}

export interface SourceShapeDimension {
  id: string;
  mechanism: VariantMechanism;
  expectedPass: string;
  invariants: string[];
  alternatives: SourceShapeAlternative[];
}

export interface ChoiceConstraint {
  choices: string[];
}

export interface SourceShapeConstraints {
  preserveTargetRanges: Array<[number, number]>;
  preserveOpcodeStream: boolean;
  forbidInstructionCountGrowth: boolean;
  preserveExistingEmptyMemoryBarriers: boolean;
  incompatibleAlternatives: ChoiceConstraint[];
  requiredAlternatives: string[];
}

export interface ScheduleComparisonConfig {
  enabled: boolean;
  analyze: "traced-classes";
  maxInterventions: number;
}

export interface SourceShapeSearchSpec {
  schemaVersion: typeof SOURCE_SHAPE_SEARCH_SCHEMA_VERSION;
  function: string;
  baseSourcePath: string;
  analysisPath?: string;
  maxVariants: number;
  dimensions: SourceShapeDimension[];
  constraints: SourceShapeConstraints;
  traceAllPreprocessed: boolean;
  assembleUniqueDbr: boolean;
  scheduleComparison: ScheduleComparisonConfig;
}

export interface VariantLineage {
  variantId: string;
  productIndex: number;
  baseSourceHash: string;
  sourceHash: string;
  choices: Array<{
    dimension: string;
    alternative: string;
    mechanism: VariantMechanism;
    expectedPass: string;
    expectedEffect: string;
  }>;
  invariants: string[];
  changedDimensions: number;
  editRegions: number;
  changedSpan: number;
  naturalPriority: number;
}

export interface RequirementResult {
  requirementId: string;
  status: "satisfied" | "regressed" | "unchanged" | "ambiguous";
  evidence: string[];
}

export interface SearchVariantResult {
  variantId: string;
  productIndex: number;
  sourceHash: string;
  preprocessedHash?: string;
  assemblyHash?: string;
  sourceEquivalentTo?: string;
  preprocessedEquivalentTo?: string;
  assemblyEquivalentTo?: string;
  policyPassed: boolean;
  compiled: boolean;
  compileError?: string;
  requirementResults: RequirementResult[];
  mechanismVerdicts: HypothesisClassification[];
  preservedRanges: Array<{ start: number; end: number; exact: boolean }>;
  hardConstraintsPassed: boolean;
  opcodeStreamExact: boolean;
  instructionCountExact: boolean;
  cc1Exact: boolean;
  /**
   * The staged residual from the pipeline reversal, when a full object exists.
   * It ranks above the instruction count because it is a distance: an edit that
   * fixes the cause of a difference rotates the register assignment downstream
   * and comes out worse by count while moving closer.
   */
  residual?: { key: [number, number, number, number]; summary: string };
  exactInstructions: number;
  totalInstructions: number;
  fullObjectExact: boolean;
  promotionEligible: boolean;
  traceArtifact?: string;
  traceBundleHash?: string;
  traceEquivalentTo?: string;
  scheduleProfileArtifact?: string;
  scheduleDeltaArtifact?: string;
  scheduleDelta?: ScheduleMechanismDelta;
  scheduleAnalysisError?: string;
  artifacts: string;
}

export interface EquivalenceClass {
  stage: "source" | "preprocessed" | "assembly" | "dbr" | "trace";
  hash: string;
  representative: string;
  members: string[];
}

export interface SearchCheckpoint {
  schemaVersion: 1;
  function: string;
  runId: string;
  specHash: string;
  toolchainHash: string;
  nextProductIndex: number;
  totalProducts: number;
  completedVariantIds: string[];
  results: SearchVariantResult[];
  equivalenceClasses: EquivalenceClass[];
}

export interface SourceShapeSearchSummary {
  schemaVersion: 1;
  function: string;
  runId: string;
  artifacts: string;
  productStart: number;
  productEnd: number;
  totalProducts: number;
  unvisitedProducts: number;
  resumed: boolean;
  exactCc1Candidates: string[];
  promotableCandidates: string[];
  results: SearchVariantResult[];
  equivalenceClasses: EquivalenceClass[];
  caveats: string[];
}
