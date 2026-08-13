import type { DiffCategory } from "../explainDiff.js";

export const VARIANT_MECHANISMS = [
  "fresh-vs-reused-web",
  "single-vs-multi-set",
  "constant-birth-site",
  "result-vs-input-reuse",
  "address-expression-family",
  "alias-dependency",
  "statement-birth-order",
  "custom",
] as const;

export type VariantMechanism = typeof VARIANT_MECHANISMS[number];
export type HypothesisVerdict = "confirmed" | "partially-confirmed" | "rejected" | "inconclusive";
export type VariantStatus = "exact" | "mismatch" | "compile-error";
/** How a byte-exact result was established, independent of the verdict. */
export type ExactCandidateBasis = "full-object" | "cc1-only" | null;
export type PassStage = "rtl" | "jump" | "cse" | "combine" | "regmove" | "sched" | "lreg" | "greg" | "sched2" | "dbr";

export const PASS_STAGES: PassStage[] = [
  "rtl", "jump", "cse", "combine", "regmove", "sched", "lreg", "greg", "sched2", "dbr",
];

export interface VariantHypothesis {
  id: string;
  sourcePath: string;
  mechanism: VariantMechanism;
  expectedPass: string;
  expectedEffect: string;
  invariants: string[];
  baseline?: boolean;
}

export interface VariantManifest {
  schemaVersion?: 1;
  function?: string;
  variants: VariantHypothesis[];
}

export interface ResolvedVariantHypothesis extends VariantHypothesis {
  absoluteSourcePath: string;
  sourceHash: string;
}

export interface SourceFinding {
  line: number;
  kind: "forbidden-construct" | "c99" | "generated-global";
  message: string;
}

export interface NormalizedPassInstruction {
  uid: number;
  kind: string;
  operation?: string;
  expression?: string;
  semanticSignature: string;
  sets: string[];
  uses: string[];
  deaths: string[];
  dependencies: string[];
  memoryRead: boolean;
  memoryWrite: boolean;
  control: boolean;
  loopDepth: number;
  block?: number;
}

export interface NormalizedPassNote {
  kind: "loop-begin" | "loop-end" | "loop-continue" | "basic-block" | "deleted";
  block?: number;
  previousInstruction?: string;
  nextInstruction?: string;
}

export interface NormalizedLoopRegion {
  depth: number;
  confidence: "exact" | "reconstructed" | "inferred";
  semanticInstructionSignatures: string[];
  executableControlCount: number;
}

export interface PassSnapshot {
  stage: PassStage;
  hash: string;
  instructionCount: number;
  noteCount: number;
  maximumLoopDepth: number;
  instructions: NormalizedPassInstruction[];
  notes: NormalizedPassNote[];
  loopRegions: NormalizedLoopRegion[];
  metadataCaveats: string[];
  assignments: Array<{ pseudo: number; hardRegister: number }>;
  schedulerOrder: number[];
  schedulerDecisions: Array<{ cycle: number; selectedUid?: number; ranked: number[] }>;
}

export interface MetadataDifference {
  kind: "loop-depth" | "loop-region" | "basic-block" | "deleted-note" | "note";
  instruction?: string;
  baselineDepth?: number;
  variantDepth?: number;
  noExecutableLoopControlAdded?: boolean;
  summary: string;
}

export interface StageDifference {
  stage: PassStage;
  baselineHash: string;
  variantHash: string;
  firstInstructionIndex?: number;
  baselineUid?: number;
  variantUid?: number;
  affectedUids: number[];
  affectedPseudos: number[];
  metadataChanges: MetadataDifference[];
  summary: string;
}

export interface PassComparison {
  equivalent: boolean;
  firstDivergence?: StageDifference;
  divergentStages: StageDifference[];
  commonThrough?: PassStage;
}

export interface HypothesisClassification {
  verdict: HypothesisVerdict;
  reason: string;
  promotionEligible: boolean;
}

export interface NormalizedInstruction {
  mnemonic: string;
  operands: string[];
  relocation?: string;
  canonical: string;
}

export interface VariantResult {
  id: string;
  source: string;
  sourceHash: string;
  mechanism: VariantMechanism;
  expectedPass: string;
  expectedEffect: string;
  invariants: string[];
  baseline: boolean;
  status: VariantStatus;
  verdict: HypothesisVerdict;
  verdictReason: string;
  promotionEligible: boolean;
  /**
   * Byte-exactness, orthogonal to `verdict` and `promotionEligible`: an exact
   * candidate can still be `inconclusive` (no mechanism evidence) and still be
   * promotion-ineligible (cc1-only). The oracle result must never be readable
   * only through the verdict.
   */
  exactCandidate: boolean;
  exactCandidateBasis: ExactCandidateBasis;
  exactCandidateReason?: string;
  category?: DiffCategory | string;
  exact?: number;
  total?: number;
  firstDivergence?: string;
  passComparison?: PassComparison;
  /** Label shared by every variant that compiled to identical code. */
  outcomeGroup?: string;
  /** Earliest traced pass whose dump this variant shares with its group. */
  convergedAt?: PassStage;
  error?: string;
  artifacts: string;
  artifactHashes: Record<string, string>;
  flags: string[];
}

export interface ToolIdentity {
  node: string;
  variantLab: { schemaVersion: 1; sha256: string };
  compiler: { path: string; sha256: string; version: string };
  assemblerShim: { path: string; sha256: string };
  cpp: string;
  assembler: string;
  objdump: string;
}

export interface PreservedVariantManifest {
  id: string;
  sourcePath: string;
  sourceHash: string;
  mechanism: VariantMechanism;
  expectedPass: string;
  expectedEffect: string;
  invariants: string[];
  baseline: boolean;
  artifacts: string;
}

export interface VariantRunManifest {
  schemaVersion: 1;
  function: string;
  runId: string;
  mode: "cc1-only" | "full";
  tracePasses: boolean;
  baselineId: string;
  compilerFlags: string[];
  variants: PreservedVariantManifest[];
  toolchain: ToolIdentity;
}

export interface VariantRunSummary {
  schemaVersion: 1;
  function: string;
  runId: string;
  mode: "cc1-only" | "full";
  tracePasses: boolean;
  baselineId: string;
  targetInstructions: number;
  artifacts: string;
  results: VariantResult[];
  caveats: string[];
}

export const TRANSFORMATION_TEMPLATES = [
  "fresh-local-vs-reuse",
  "target-register-reuse",
  "direct-vs-named-temporary",
  "fresh-result-vs-input-reuse",
  "constant-around-join",
  "array-vs-struct-address",
  "assignment-chain",
  "alias-access",
  "sdk-call-order",
] as const;

export type TransformationTemplate = typeof TRANSFORMATION_TEMPLATES[number];

export interface ExactSourceEdit {
  find: string;
  replace: string;
  occurrences?: number;
}

export interface TransformationOutput {
  id: string;
  expectedEffect: string;
  invariants: string[];
  edits: ExactSourceEdit[];
  baseline?: boolean;
}

/**
 * The adjacent SDK macro calls whose birth order the `sdk-call-order` template
 * permutes. Statements are exact source text in current program order; the
 * generator derives the admissible orders itself, so the spec names the region
 * and never a permutation list.
 */
export interface SdkCallOrderRegionSpec {
  statements: string[];
}

export interface TransformationSpec {
  schemaVersion?: 1;
  function: string;
  template: TransformationTemplate;
  baseSourcePath: string;
  outputDirectory?: string;
  expectedPass: string;
  /** Required for every template except `sdk-call-order`, which derives them. */
  outputs: TransformationOutput[];
  /** `sdk-call-order` only: the adjacent macro-call run to permute. */
  region?: SdkCallOrderRegionSpec;
}
