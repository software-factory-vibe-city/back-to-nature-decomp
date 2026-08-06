import type { TraceConfidence } from "../compiler-trace/types.js";
import type { NormalizedInstruction } from "../variant-lab/types.js";

export const RESIDUAL_SEARCH_SCHEMA_VERSION = 2 as const;

/**
 * Version of the finite rewrite grammar itself. Exhaustion claims are always
 * relative to this version plus the per-run suppression list. Schema 2 added
 * known-macro component forms to schema 1's web partitions, statement orders,
 * and declaration-birth forms; schema 3 adds materialization of literal
 * known-macro constant arguments whose values appear in mismatched target
 * instructions, with the materialized value entering the web universe so the
 * partition rule can merge it into compatible existing webs. Schema 4 adds
 * the administrative-form stratum: bounded coalescible typed copies of a
 * never-redefined parameter, activated only by a SAT scheduler-constraint
 * witness whose phantom requirements bind to that parameter, with all reads
 * after the copy region redirected to the fresh copy variable. Schema 5 adds
 * loop structure: a loop's header and body are modelled and reorderable under
 * loop-carried dependencies, the loop-update-placement stratum searches a
 * `for` header's updates against the same statements at the body tail, and the
 * switch-form stratum searches a jump table against a compare chain.
 */
export const RESIDUAL_GRAMMAR_SCHEMA_VERSION = 5 as const;

export interface SourceSpan {
  start: number;
  end: number;
  lineStart: number;
  lineEnd: number;
}

/* ------------------------------------------------------------------ */
/* Semantic graph                                                      */
/* ------------------------------------------------------------------ */

export type SemanticNodeKind =
  | "declaration"
  | "assign"
  | "store"
  | "known-macro"
  | "call"
  | "if"
  | "return"
  | "barrier"
  | "unknown";

export interface SemanticNode {
  id: string;
  kind: SemanticNodeKind;
  block: number;
  span: SourceSpan;
  text: string;
  /** Scalar variable names read by this node (parameters and locals). */
  reads: string[];
  /** Scalar variable names fully or partially written by this node. */
  writes: string[];
  /** True when the write kills the previous value ("=" on a scalar). */
  killingWrite: boolean;
  /** Conservative memory-region tokens; "*unknown*" poisons ordering. */
  memoryReads: string[];
  memoryWrites: string[];
  movable: boolean;
  evidence: string[];
  operator?: string;
  lhs?: string;
  rhs?: string;
  macro?: string;
  declName?: string;
  declType?: string;
  initializer?: string;
  condition?: string;
  condSpan?: SourceSpan;
  thenBlock?: number;
  elseBlock?: number;
  /* ---- loop and switch structure (schema 3) ---------------------- */
  /** `for`, `while`, or `do`/`while` as written. */
  loopForm?: "for" | "while" | "do-while";
  /** For `for` loops: the header's initialiser and update blocks. */
  initBlock?: number;
  updateBlock?: number;
  /** For loops: the body block. For switches: the block holding the cases. */
  bodyBlock?: number;
  /** For switches: the case block indexes in source order. */
  caseBlocks?: number[];
  /**
   * True when the body contains a `continue` that belongs to this loop. A
   * `continue` skips the body tail but not the header update, so it pins where
   * an update statement may legally sit.
   */
  hasContinue?: boolean;
}

export interface SemanticBlock {
  index: number;
  parent?: number;
  kind: "entry" | "then" | "else" | "loop-init" | "loop-update" | "loop-body" | "case";
  /** Node ids in program order, including nested if nodes. */
  nodeIds: string[];
  /** For then/else blocks: the controlling if node. */
  controllingIf?: string;
  /** For loop and case blocks: the loop or switch node that owns them. */
  controllingConstruct?: string;
  /** For case blocks: the label text, or absent for `default`. */
  caseLabel?: string;
}

/**
 * Blocks whose statements the reordering grammar reasons about. A loop's
 * header and body joined once loop-carried dependencies could constrain them.
 * A `case` block still cannot: fall-through and `break` are control flow this
 * schema does not model, so a switch remains a summary node.
 */
export const REORDERABLE_BLOCK_KINDS: ReadonlySet<SemanticBlock["kind"]> =
  new Set<SemanticBlock["kind"]>(["entry", "then", "else", "loop-init", "loop-update", "loop-body"]);

export interface GraphParameter {
  name: string;
  typeText: string;
  index: number;
  pointer: boolean;
  span: SourceSpan;
}

export interface GraphVariable {
  name: string;
  kind: "parameter" | "local";
  typeText: string;
  pointer: boolean;
  declarationId?: string;
  addressEscapes: boolean;
  /** Any access from an unsupported node freezes renaming and web analysis. */
  supported: boolean;
  evidence: string[];
}

export interface SemanticGraph {
  schemaVersion: typeof RESIDUAL_SEARCH_SCHEMA_VERSION;
  function: string;
  sourcePath: string;
  sourceHash: string;
  functionSpan: SourceSpan;
  bodySpan: SourceSpan;
  parameters: GraphParameter[];
  variables: GraphVariable[];
  blocks: SemanticBlock[];
  nodes: SemanticNode[];
  caveats: string[];
}

/* ------------------------------------------------------------------ */
/* Value webs                                                          */
/* ------------------------------------------------------------------ */

export interface ValueWeb {
  /** Deterministic id: `<variable>#<webIndex>`. */
  id: string;
  variable: string;
  webIndex: number;
  /** Node ids of killing definitions in this web ("param-entry" for web 0 of a parameter). */
  defNodes: string[];
  /** Node ids reading or partially updating this web (including conditions/returns). */
  useNodes: string[];
  typeText: string;
  pointer: boolean;
  /** True when the web is the incoming value of a parameter. */
  parameterEntry: boolean;
  /** Node ids at whose entry the web is live (statement-level liveness). */
  liveAtNodes: string[];
  /** Renaming and merging admissible only for supported, non-escaping webs. */
  renameable: boolean;
  /**
   * Set for synthetic webs created by constant materialization: the literal
   * value. Such webs merge into any integer web that can represent the value
   * and whose live range is disjoint from the conservative site range.
   */
  syntheticConstant?: number;
  /**
   * Set for synthetic webs created by an administrative copy (rule 4.7): the
   * id of the web the copy reads. The copy web never merges with that web.
   */
  syntheticCopyOf?: string;
  evidence: string[];
}

/* ------------------------------------------------------------------ */
/* Baseline bundle                                                     */
/* ------------------------------------------------------------------ */

export type MismatchCategory =
  | "exact"
  | "scheduling-permutation"
  | "allocation-or-operands"
  | "scheduling-and-operands"
  | "instruction-count"
  | "mixed";

export interface BaselineBundle {
  schemaVersion: typeof RESIDUAL_SEARCH_SCHEMA_VERSION;
  function: string;
  sourcePath: string;
  sourceHash: string;
  preprocessedSemanticHash: string;
  assemblyHash: string;
  toolchainHash: string;
  compilerFlags: string[];
  target: NormalizedInstruction[];
  candidate: NormalizedInstruction[];
  mismatchedTargetIndexes: number[];
  exactInstructions: number;
  totalInstructions: number;
  category: MismatchCategory;
  emptyMemoryBarriers: number;
  traceArtifact: string;
  analysisArtifact: string;
  caveats: string[];
}

export interface EligibilityRefusal {
  status: "unsupported-source" | "unsupported-correspondence" | "exact" | "failed";
  reason: string;
  evidence: string[];
}

/* ------------------------------------------------------------------ */
/* Diff-seeded causal closure                                          */
/* ------------------------------------------------------------------ */

export type ClosureReasonKind =
  | "mismatched-instruction"
  | "uid-correspondence"
  | "pseudo-def-use"
  | "pseudo-transition"
  | "constant-binding"
  | "source-line-binding"
  | "register-role"
  | "value-producer"
  | "value-consumer"
  | "scheduler-dependency"
  | "ready-list-competitor"
  | "allocation-conflict"
  | "allocation-order-neighbor"
  | "delay-slot-candidate"
  | "memory-order-anchor"
  | "compatible-web"
  | "controlling-branch";

export interface ClosureReason {
  kind: ClosureReasonKind;
  /** The already-included item this inclusion was derived from. */
  from: string;
  detail: string;
  confidence: TraceConfidence;
}

export interface ClosureItem {
  /** "target:<i>", "uid:<n>", "pseudo:<n>", "node:<id>", "web:<id>" */
  id: string;
  reasons: ClosureReason[];
  confidence: TraceConfidence;
}

export interface CausalClosure {
  schemaVersion: typeof RESIDUAL_SEARCH_SCHEMA_VERSION;
  function: string;
  seeds: string[];
  items: ClosureItem[];
  nodeIds: string[];
  webIds: string[];
  uids: number[];
  pseudos: number[];
  wholeFunction: boolean;
  caveats: string[];
}

/* ------------------------------------------------------------------ */
/* Rewrite grammar and finite domain                                   */
/* ------------------------------------------------------------------ */

export type RewriteRuleId =
  | "web-partition"
  | "statement-order"
  | "declaration-birth"
  | "expression-materialization"
  | "type-cast-representation"
  | "known-macro-form"
  | "administrative-form"
  | "compound-assignment-form"
  | "loop-form"
  | "loop-update-placement"
  | "switch-form";

export interface SuppressedRule {
  rule: RewriteRuleId;
  reason: string;
  evidence: string[];
}

export interface WebGroup {
  /** Canonical rendered variable name for the group. */
  name: string;
  webIds: string[];
  typeText: string;
  /** Parameter-named groups reuse the parameter and have no declaration. */
  parameterName?: string;
}

export interface WebPartition {
  /** Restricted-growth-string over the canonical web order. */
  rgs: number[];
  groups: WebGroup[];
  baseline: boolean;
}

export interface MaterializationSite {
  /** `${hostNodeId}#a${argIndex}` — host may be a synthetic split component. */
  siteId: string;
  hostNodeId: string;
  argIndex: number;
  value: number;
  /** Literal token as written (e.g. "0x64"), preserved in renders. */
  token: string;
  regionId: string;
  /** Canonical fresh-temp type when the web stays unmerged. */
  freshType: string;
}

/**
 * One admissible administrative copy (rule 4.7): `T fresh = <parameter>;`
 * floated in one order region, with every read of the parameter after the
 * region redirected to the fresh variable. Activated only by a SAT
 * scheduler-constraint witness whose phantom binds to the parameter.
 */
export interface AdministrativeCopySite {
  /** `${templateId}@${regionId}`. */
  siteId: string;
  /** Directory name of the witness run under build/schedulerConstraint/<fn>/. */
  witnessRunId: string;
  /** The witness phantom template this site realizes. */
  templateId: string;
  /** Parameter whose entry web the copy reads; never redefined in the function. */
  readVariable: string;
  readWebId: string;
  /** Canonical collision-free name of the copy variable. */
  freshVariable: string;
  freshType: string;
  pointer: boolean;
  regionId: string;
  /** Node ids after the region whose reads of the parameter become reads of the copy. */
  redirectedReadNodes: string[];
  evidence: string[];
}

/**
 * One switch this grammar may also spell as an if/else-if chain. The two reach
 * the machine by different paths — a balanced `slti` tree against a compare
 * chain — which is the only reason both are in the grammar.
 */
export interface SwitchFormSite {
  /** The switch node this site replaces. */
  nodeId: string;
  /** Full replacement text for the switch's span. */
  chainText: string;
  /** Case labels in source order; the default is recorded as null. */
  labels: Array<string | null>;
  evidence: string[];
}

export interface OrderRegion {
  id: string;
  block: number;
  /** Node ids in original program order. */
  nodeIds: string[];
  /** Node ids in this region eligible for declaration-birth removal. */
  birthEligible: string[];
  /** Composite known-macro nodes whose registered components may be split out. */
  splittable: string[];
  /**
   * Loop updates this region may carry at its tail instead of the `for`
   * header. Present only on a loop-body region whose loop has no `continue`.
   */
  movableUpdates: string[];
  /** Constant-argument materialization sites hosted in this region. */
  materializable: MaterializationSite[];
}

export interface RegionVariantDomain {
  splitMask: number;
  /** Bit k moves `movableUpdates[k]` from the `for` header into this region. */
  updateMask: number;
  birthMask: number;
  /** Birth definitions materialized as declaration initializers. */
  removedNodes: string[];
  /** Synthetic component statements replacing split macros. */
  addedNodes: string[];
  orderCount: string;
}

export interface RegionDomain {
  regionId: string;
  /**
   * One entry per admissible (splitMask, birthMask) pair in canonical order.
   * Counts are decimal strings of exact linear-extension counts.
   */
  variants: RegionVariantDomain[];
  size: string;
}

export interface PartitionDomain {
  partitionIndex: number;
  /** Site ids materialized in this section of the domain. */
  materializedSites: string[];
  /** Switch node ids spelled as an if/else-if chain in this section. */
  switchForms?: string[];
  /** Administrative copy site ids active in this section (rule 4.7). */
  administrativeCopies?: string[];
  partition: WebPartition;
  regions: RegionDomain[];
  size: string;
}

export interface ResidualGrammar {
  schemaVersion: typeof RESIDUAL_SEARCH_SCHEMA_VERSION;
  grammarSchemaVersion: typeof RESIDUAL_GRAMMAR_SCHEMA_VERSION;
  function: string;
  activeRules: RewriteRuleId[];
  suppressedRules: SuppressedRule[];
  /** Recorded semantic assumptions the equivalence proofs rely on. */
  assumptions: string[];
  webs: ValueWeb[];
  partitionWebIds: string[];
  regions: OrderRegion[];
  frozenNodeIds: string[];
  /** Rule 4.7 sites; present only when a witness activated the stratum. */
  administrativeSites?: AdministrativeCopySite[];
  /** Switches this grammar may also spell as an if/else-if chain. */
  switchFormSites?: SwitchFormSite[];
  /** Citation of the scheduler-constraint witness that activated rule 4.7. */
  witness?: {
    runId: string;
    directory: string;
    boundPhantoms: number;
    unboundPhantoms: number;
    sourceRequirements: number;
  };
  caveats: string[];
}

export interface ResidualDomain {
  schemaVersion: typeof RESIDUAL_SEARCH_SCHEMA_VERSION;
  function: string;
  partitionCount: number;
  partitionEnumerationComplete: boolean;
  partitions: PartitionDomain[];
  totalCandidates: string;
  coordinateSchema: string;
  caveats: string[];
}

export interface Coordinate {
  partitionIndex: number;
  /** Site ids materialized under this coordinate. */
  materializedSites: string[];
  /** Switch node ids spelled as an if/else-if chain under this coordinate. */
  switchForms?: string[];
  /** Administrative copy site ids active under this coordinate (rule 4.7). */
  administrativeCopies?: string[];
  /** Per region (in grammar order): chosen split mask, birth mask, and order rank. */
  regionChoices: Array<{
    splitMask: number;
    updateMask: number;
    birthMask: number;
    orderRank: string;
  }>;
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

export interface EvaluatedCandidate {
  globalRank: string;
  coordinate: Coordinate;
  canonicalHash: string;
  sourceHash?: string;
  /** Set when this coordinate was deduplicated to an earlier candidate. */
  equivalentTo?: string;
  stage: "canonical-duplicate" | "policy-failed" | "preprocess-failed" | "compile-failed" | "compared" | "confirmed-exact";
  policyError?: string;
  compileError?: string;
  preprocessedHash?: string;
  assemblyHash?: string;
  exactInstructions?: number;
  totalInstructions?: number;
  cc1Exact?: boolean;
  fullObjectExact?: boolean;
}

export interface CandidateClass {
  classId: string;
  stage: "assembly";
  hash: string;
  representativeRank: string;
  members: number;
  exactInstructions: number;
  totalInstructions: number;
  cc1Exact: boolean;
  fullObjectExact?: boolean;
  requirementResults?: Array<{ requirementId: string; status: string }>;
  firstDivergenceStage?: string;
  artifacts?: string;
}

export type TerminalStatus =
  | "exact-candidate-found"
  | "exhausted-no-exact"
  | "incomplete-budget"
  | "incomplete-shards"
  | "unsupported-source"
  | "unsupported-correspondence"
  | "domain-too-large"
  | "baseline-drift"
  | "derived"
  | "exact"
  | "failed";

export interface CoverageReport {
  totalCandidates: string;
  evaluatedCandidates: string;
  shard?: { index: number; count: number };
  shardCandidates?: string;
  evaluatedRanges: Array<[string, string]>;
  complete: boolean;
}

/* ------------------------------------------------------------------ */
/* Cost report                                                         */
/* ------------------------------------------------------------------ */

/**
 * One independent choice axis of the mixed-radix domain. Region axes carry the
 * largest radix they reach across sections; the section axis carries the
 * grammar selections and web partitions that precede them.
 */
export interface DomainAxisReport {
  id: string;
  kind: "section" | "region";
  /** Largest number of choices this axis offers, as a decimal string. */
  radix: string;
  detail: string;
}

/**
 * The projection `--derive-only` publishes before a run starts. `c` is the
 * median of five baseline compiles through cc1, maspsx, and the assembler;
 * `d` is the canonical-duplicate rate observed by the deterministic pilot.
 */
export interface CostEstimate {
  totalCandidates: string;
  /** Largest axis first. */
  axes: DomainAxisReport[];
  /** `c`: median per-candidate compile cost in milliseconds. */
  perCandidateMs: number;
  calibrationSamplesMs: number[];
  /** `d`: canonical duplicates divided by sampled coordinates, 0..1. */
  duplicateRate: number;
  pilot: {
    size: number;
    /** The stratified sample, recorded so the estimate is reproducible. */
    ranks: string[];
    wallMs: number;
    duplicates: number;
    compiled: number;
    /** Real wall cost per non-duplicate coordinate, for drift against `c`. */
    observedPerCandidateMs: number;
  };
  jobs: number;
  /** `T = N x (1 - d) x c / jobs`, milliseconds; null when N overflows. */
  projectedMs: number | null;
}

/** A finished run's real wall time next to the projection for the same domain. */
export interface RunTiming {
  /** Whole run, including baseline, trace, closure, and derivation. */
  actualMs: number;
  /** Coordinate evaluation only — the part `T` projects. */
  evaluationMs: number;
  projectedMs?: number;
  /** evaluationMs / projectedMs; a repeatedly wrong projection is a defect. */
  ratio?: number;
  /** Run id of the `--derive-only` estimate the projection came from. */
  projectionFrom?: string;
}

export interface ResidualSearchSummary {
  schemaVersion: typeof RESIDUAL_SEARCH_SCHEMA_VERSION;
  function: string;
  runId: string;
  status: TerminalStatus;
  statusDetail: string;
  artifacts: string;
  baseline?: {
    exactInstructions: number;
    totalInstructions: number;
    category: MismatchCategory;
  };
  closure?: {
    nodes: number;
    webs: number;
    uids: number;
    pseudos: number;
    wholeFunction: boolean;
  };
  domain?: {
    partitions: number;
    regions: number;
    totalCandidates: string;
  };
  coverage?: CoverageReport;
  /** Present on `--derive-only` runs and on any run that projected its cost. */
  estimate?: CostEstimate;
  /** Present on runs that evaluated the domain. */
  timing?: RunTiming;
  classes: CandidateClass[];
  exactCandidates: Array<{ globalRank: string; canonicalHash: string; artifacts: string }>;
  caveats: string[];
}

export interface SearchCheckpoint {
  schemaVersion: typeof RESIDUAL_SEARCH_SCHEMA_VERSION;
  function: string;
  runId: string;
  identityHash: string;
  shard?: { index: number; count: number };
  /** Inclusive global-rank ranges already evaluated, as decimal strings. */
  evaluatedRanges: Array<[string, string]>;
  evaluatedCount: string;
  classes: CandidateClass[];
  exactCandidates: Array<{ globalRank: string; canonicalHash: string; artifacts: string }>;
}
