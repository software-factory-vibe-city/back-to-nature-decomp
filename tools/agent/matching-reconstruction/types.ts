/**
 * Automatic matching reconstruction — shared vocabulary.
 *
 * Implements the core records of plans/automatic-matching-reconstruction.md §3.
 * Three kinds of information stay separate throughout:
 *
 *   1. target facts — decoded operations and witnessed access relationships,
 *      derived from original bytes only;
 *   2. reconstruction hypotheses — origin, layout, and control-form
 *      alternatives that could have produced those facts;
 *   3. candidate observations — what one generated source actually compiled to.
 *
 * A candidate's failure never erases a hypothesis (that would repeat the
 * standalone-array mistake the plan documents); only the byte oracle promotes
 * or rejects a concrete combination.
 */

export const MATCHING_RECONSTRUCTION_SCHEMA_VERSION = 1 as const;

/** Terminal states, from the plan's Phase F table. */
export type TerminalState =
  | "exact-candidate"
  | "verified"
  | "unsupported-target"
  | "context-unresolved"
  | "oracle-undetermined"
  | "model-inconclusive"
  | "domain-exhausted"
  | "budget-exhausted"
  | "input-drift"
  | "tool-failure";

/* ---- symbolic values ----------------------------------------------------- */

/**
 * A value the target function computes, expressed over its inputs.
 *
 * Addresses are always concrete numbers in the supported class — a scan whose
 * address depends on a symbolic value is outside it. Loads at concrete
 * addresses are the atoms every predicate is built from.
 */
export type SymExpr =
  | { kind: "const"; value: number }
  | { kind: "entry"; register: string }
  | {
      kind: "load";
      /** Absolute address — or, when `base` is present, the offset from it. */
      address: number;
      width: 1 | 2 | 4;
      signed: boolean;
      /** Symbolic base (an argument pointer, or a loaded pointer value). */
      base?: SymExpr | undefined;
      /** Distinguishes re-reads after a potentially-aliasing store. */
      epoch?: number | undefined;
    }
  | { kind: "unary"; op: UnaryOp; operand: SymExpr }
  | { kind: "binary"; op: BinaryOp; left: SymExpr; right: SymExpr };

export type UnaryOp = "zext8" | "zext16" | "sext8" | "sext16";
export type BinaryOp =
  | "add" | "sub" | "and" | "or" | "xor" | "nor"
  | "sll" | "srl" | "sra"
  | "sltS" | "sltU";

/** A branch condition, normalized so loads sit on the left when present. */
export interface Predicate {
  op: "eq" | "ltS" | "ltU" | "lez" | "gtz" | "ltz" | "gez";
  left: SymExpr;
  /** Absent for the single-operand zero comparisons. */
  right?: SymExpr;
}

/* ---- decision DAG -------------------------------------------------------- */

/**
 * One store the path performed, in path order. `seq` is the position within
 * the path's store sequence; machine code preserves store order, so it doubles
 * as the assignment-order hint for construction.
 */
export interface StoreEffect {
  /** Absolute address — or, when `base` is present, the offset from it. */
  address: number;
  width: 1 | 2 | 4;
  value: SymExpr;
  seq: number;
  vram: number;
  /** Symbolic base for pointer-relative stores. */
  base?: SymExpr | undefined;
  /** The access went through `$gp` — small-data addressing, a TU-ownership fact. */
  viaGp?: boolean | undefined;
}

/**
 * The recovered machine relation: a decision DAG over load atoms and argument
 * values, whose leaves carry the path's memory effects. Hash-consed — two
 * nodes with equal predicate and equal children are the same id — so semantic
 * equivalence of two relations built in one arena is id equality at the root.
 */
export type DagRef = number;

export type DagNode =
  | { kind: "leaf"; value: SymExpr; effects: StoreEffect[] }
  | { kind: "test"; pred: Predicate; onTrue: DagRef; onFalse: DagRef };

/* ---- the recovered scan relation ---------------------------------------- */

export interface ArgUse {
  /** Argument register the value came from: a0..a3. */
  register: string;
  /** How the machine code narrowed it before use. */
  conversion: "raw" | "zext8" | "zext16" | "sext8" | "sext16";
}

export type RhsSpec =
  | { kind: "const"; value: number }
  | { kind: "arg"; use: ArgUse };

/** One guarded field test; all tests in a record must pass for a match. */
export interface FieldTest {
  /** Byte offset within the record. */
  offset: number;
  width: 1 | 2 | 4;
  signed: boolean;
  op: "eq" | "ne";
  rhs: RhsSpec;
}

/** Return value on success: a constant, or affine in the record index. */
export type ReturnSpec =
  | { kind: "const"; value: number }
  | { kind: "affine"; scale: number; offset: number };

/**
 * The machine-level scan relation (plan §6 C1): a fixed-bound, read-only,
 * call-free walk of affine fixed-stride records with short-circuit field
 * tests. Every number here is evidence from the bytes, never a name.
 */
export interface ScanRelation {
  /** Resolved address of record zero's byte zero. */
  base: number;
  stride: number;
  count: number;
  /** In test order — the machine's short-circuit order. */
  tests: FieldTest[];
  successReturn: ReturnSpec;
  failReturn: number;
  /** Bytes the relation witnessed: [base, base + extent). */
  witnessedExtent: number;
  evidence: string[];
}

/**
 * A straight-line effect relation (no symbolic branches): the function
 * performs these stores in this order and returns this value. The class the
 * census sized as the largest tractable expansion — field setters and small
 * initializers.
 */
export interface EffectRelation {
  kind: "straight-line-effects";
  effects: StoreEffect[];
  /** The returned value; `entry v0` means the caller receives nothing. */
  returnValue: SymExpr;
  evidence: string[];
}

/* ---- access index -------------------------------------------------------- */

/**
 * One witnessed access relationship in some function's original code: an
 * anchored base address (materialized by a hi/lo pair or reached through $gp)
 * plus an explicit offset chain. `kind: "add"` records address arithmetic that
 * never dereferenced — the strongest containment witness, since it names the
 * base and the offset in one instruction.
 */
export interface AccessWitness {
  functionName: string;
  containerId: string;
  vram: number;
  kind: "load" | "store" | "add";
  /** The resolved concrete address the event names. */
  address: number;
  /** The materialized anchor the address was computed from. */
  anchor: number;
  /** Symbol at the anchor, when the symbol tables know one. */
  anchorSymbol?: string | undefined;
  width?: 1 | 2 | 4 | undefined;
  signed?: boolean | undefined;
}

export interface AccessIndex {
  schemaVersion: number;
  containerId: string;
  witnesses: AccessWitness[];
}

/* ---- reconstruction hypotheses ------------------------------------------- */

/**
 * Where the scanned storage came from, as source structure. Object extent and
 * translation-unit ownership are deliberately not claimed here (plan §3).
 */
export type OriginAlternative =
  | {
      kind: "standalone";
      /** Label at the table base, from the symbol tables. */
      symbol: string;
      /** Records before the scanned window: the scan visits [startIndex,
       *  startIndex + count) of a table whose base has independent evidence. */
      startIndex: number;
      evidence: string[];
    }
  | {
      kind: "embedded";
      /** Independently witnessed parent base. */
      parentSymbol: string;
      parentAddress: number;
      /** Table base minus parent base. */
      offset: number;
      startIndex: number;
      evidence: string[];
    };

export type LayoutAlternative =
  | { kind: "rows"; elementWidth: 1 | 2 | 4; signed: boolean; columns: number }
  | { kind: "scalar-record"; }
  | { kind: "flat"; elementWidth: 1 | 2 | 4; signed: boolean };

export type LoopForm = "index" | "cursor";
export type ResultForm = "break-flag" | "direct-return";
export type ConditionForm = "nested" | "conjunction";
export type ContextMode = "standalone" | "umbrella";

/** One point in the joint choice space. */
export interface ConstructionChoice {
  origin: OriginAlternative;
  layout: LayoutAlternative;
  loop: LoopForm;
  result: ResultForm;
  condition: ConditionForm;
  context: ContextMode;
}

/* ---- candidate observations and results ---------------------------------- */

export interface CandidateOutcome {
  id: string;
  choice: ConstructionChoice;
  sourcePath: string;
  /** `error` when the production compiler rejected the source. */
  verdict: "match" | "mismatch" | "undetermined" | "error";
  matchedWords?: number;
  totalWords?: number;
  differingVram?: number[];
  compileError?: string;
}

export interface UnresolvedReason {
  state: Exclude<TerminalState, "exact-candidate" | "verified">;
  detail: string;
  /** VRAM addresses implicated, when the reason is located. */
  vram?: number[];
}

export interface ResultBundle {
  schemaVersion: typeof MATCHING_RECONSTRUCTION_SCHEMA_VERSION;
  functionName: string;
  containerId: string;
  vram: number;
  sizeBytes: number;
  state: TerminalState;
  relation?: ScanRelation;
  effectRelation?: EffectRelation;
  origins?: OriginAlternative[];
  candidates: CandidateOutcome[];
  /** The winning candidate, present exactly when state is exact-candidate. */
  winner?: CandidateOutcome & {
    source: string;
    /** Context changes an authorized integration would make; never applied here. */
    integrationPlan: string[];
  };
  unresolved?: UnresolvedReason;
  /** Input categories the engine read, for the source-hidden evaluation contract. */
  inputsRead: string[];
  compiles: number;
  wallMs: number;
}
