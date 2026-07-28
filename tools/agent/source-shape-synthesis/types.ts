import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import type { ExactSourceEdit, VariantMechanism } from "../variant-lab/types.js";

export const SOURCE_SHAPE_SYNTHESIS_SCHEMA_VERSION = 1 as const;

export interface SourceSpan {
  start: number;
  end: number;
  lineStart: number;
  lineEnd: number;
}

export interface SourceParameter {
  id: string;
  name: string;
  typeText: string;
  index: number;
  pointer: boolean;
  span: SourceSpan;
}

export interface SourceDeclaration {
  id: string;
  name: string;
  typeText: string;
  initializer?: string;
  span: SourceSpan;
  text: string;
}

export interface SourceStatement {
  id: string;
  kind: "assignment" | "known-macro" | "barrier" | "expression" | "unknown";
  span: SourceSpan;
  text: string;
  reads: string[];
  writes: string[];
  memoryReads: string[];
  memoryWrites: string[];
  operator?: string;
  lhs?: string;
  rhs?: string;
  macro?: string;
  movable: boolean;
  evidence: string[];
}

export interface SourceModel {
  schemaVersion: 1;
  function: string;
  sourcePath: string;
  sourceHash: string;
  functionSpan: SourceSpan;
  bodySpan: SourceSpan;
  parameters: SourceParameter[];
  declarations: SourceDeclaration[];
  prologueStatements: SourceStatement[];
  declarationRegion?: SourceSpan;
  prologueRegion?: SourceSpan;
  caveats: string[];
}

export interface SourceRoleBinding {
  id: string;
  role: string;
  targetIndexes: number[];
  candidateIndexes: number[];
  statementIds: string[];
  sourceNames: string[];
  confidence: "exact" | "reconstructed" | "inferred";
  evidence: string[];
}

export interface SynthesisRecipe {
  id: string;
  mechanisms: VariantMechanism[];
  expectedPass: string;
  expectedEffect: string;
  requirementIds: string[];
  statementIds: string[];
  edits: ExactSourceEdit[];
  safety: "proven-local" | "proven-known-macro";
  evidence: string[];
}

export interface SynthesizedAlternative {
  id: string;
  expectedEffect: string;
  invariants: string[];
  naturalPriority: number;
  edits: ExactSourceEdit[];
  recipeIds: string[];
  statementOrder: string[];
}

export interface SynthesisPlan {
  schemaVersion: typeof SOURCE_SHAPE_SYNTHESIS_SCHEMA_VERSION;
  function: string;
  sourcePath: string;
  sourceHash: string;
  analysisPath: string;
  analysisHash: string;
  maxVariants: number;
  maxDepth: number;
  preserveTargetRanges: Array<[number, number]>;
  roles: SourceRoleBinding[];
  recipes: SynthesisRecipe[];
  alternatives: SynthesizedAlternative[];
  suppressed: Array<{ kind: string; reason: string; evidence: string[] }>;
  caveats: string[];
}

export interface SynthesisSummary {
  schemaVersion: 1;
  function: string;
  runId: string;
  status:
    | "derived"
    | "search-complete"
    | "exact-candidate-found"
    | "no-safe-recipe-for-requirement"
    | "search-failed";
  artifacts: string;
  sourceModel: string;
  plan: string;
  searchSpec?: string;
  searchSummary?: string;
  generatedAlternatives: number;
  requirementsCovered: number;
  requirementsTotal: number;
  exactCandidates: string[];
  promotableCandidates: string[];
  caveats: string[];
}

export interface DeriveOptions {
  functionName: string;
  sourcePath: string;
  source: string;
  analysisPath: string;
  analysis: TargetScheduleAnalysis;
  maxVariants: number;
  maxDepth: number;
}
