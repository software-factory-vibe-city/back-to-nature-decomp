/**
 * loop-trace — the vocabulary of GCC 2.95's loop optimizer log.
 *
 * Every field here is something `loop.c` (or `unroll.c`, reached through it)
 * printed about a decision it made. Nothing is inferred: a value that the pass
 * did not print is absent, and the reader can tell the difference.
 *
 * The one deliberately unprinted quantity is `threshold`, which is the
 * denominator of every desirability test. `threshold.ts` solves for it from
 * the decisions rather than assuming it, which is why the decision records
 * below carry their inputs (`savings`, `life`, the loop's `insnCount`) and not
 * just their outcome.
 */

/** What `move_movables` did with one loop-invariant candidate. */
export type MovableDecision =
  /** Hoisted; `movedTo` names the new insn's UID. */
  | "moved"
  /** Safe to move, but `threshold * savings * lifetime` lost to `insn_count`. */
  | "not desirable"
  /** The safety gate itself failed — conditional, or a dependency is not invariant. */
  | "not safe"
  /**
   * No decision was printed. The movable was already `done` (it matched
   * another movable that moved), so `move_movables` skipped the whole test.
   */
  | "skipped";

export interface Movable {
  /** UID of the insn that sets the invariant. */
  insn: number;
  regno: number;
  /** `m->lifetime` — the register's live length inside the loop. */
  life: number;
  /** `consec %d` — additional insns that must move with this one. */
  consec?: number;
  cond: boolean;
  force: boolean;
  global: boolean;
  done: boolean;
  moveInsn: boolean;
  /** `matches %d` — another movable computing the same value. */
  matches?: number;
  /** `forces %d` — this movable can only move if that one does. */
  forces?: number;
  /** `savings %d`, printed only once the safety gate passed. */
  savings?: number;
  /** `halved since already moved` — the denominator doubles for this decision. */
  halved: boolean;
  decision: MovableDecision;
  /** UID of the emitted preheader insn, when it moved. */
  movedTo?: number;
  /** The log line, verbatim, so a reader can check any reading against it. */
  raw: string;
  /** Symbol this movable materialises, resolved from the pre-loop RTL dump. */
  symbol?: string;
}

export interface BasicInductionVariable {
  regno: number;
  /** UIDs that proposed this register as a biv. */
  candidates: number[];
  /** The `const =` text as printed: a literal, or an rtx for a non-constant step. */
  increment?: string;
  verified: boolean;
  eliminated: boolean;
  /** `Reg %d: biv discarded, <reason>`. */
  discarded?: string;
  /** `Cannot eliminate biv %d[: biv used in insn %d]`. */
  cannotEliminate?: { usedIn?: number };
  /** `biv %d can be|cannot be eliminated.` from the elimination pass. */
  eliminable?: boolean;
  /** `Biv %d initialized at insn %d` — the preheader insn this biv's init sits at. */
  initInsn?: number;
  initialValue?: string;
}

export interface GeneralInductionVariable {
  insn: number;
  /** True for `dest address` givs, which have no destination pseudo. */
  destAddress: boolean;
  reg?: number;
  srcReg: number;
  benefit: number;
  lifetime: number;
  replaceable: boolean;
  ncav: boolean;
  mult?: string;
  add?: string;
  combinedWith?: number;
  recombinedWith?: { insn: number; as: string };
  derivedFrom?: { insn: number; as: string };
  /** The pseudo the giv became, e.g. `(reg:SI 600)`. */
  reducedTo?: string;
  /**
   * `giv of insn %d not worth while, %d vs %d.` — the product
   * `lifetime * threshold * benefit` and the `insn_count` it lost to. The
   * product is the only place `threshold` reaches the log as a number.
   */
  rejected?: { product: number; insnCount: number };
  needsMultiply?: boolean;
  finalValueReplaceable?: boolean;
  /** Symbol this giv's address involves, resolved from the pre-loop RTL dump. */
  symbol?: string;
}

/** One `Sorted combine statistics:` table. */
export type CombineStatistics = Array<{ insn: number; totalBenefit: number }>;

/**
 * Why `scan_loop` refused a loop.
 *
 * `loop.c:740` discards a loop whose `scan_start` is not a `CODE_LABEL`, or
 * whose `scan_start` is an insn a loop pass created (whose luid
 * `loop_reg_used_before_p` cannot read). The log prints only that it happened.
 * The cause decides the antidote, and it is readable from the RTL the same dump
 * carries, so it is resolved rather than left to the reader.
 */
export type PhonyCauseKind =
  /** Real insns sit between `NOTE_INSN_LOOP_BEG` and the loop's entry — gcse's
   *  PRE insertions are the case this project has measured. */
  | "insns-before-entry"
  /** The loop is entered by a jump `scan_loop` could not follow to a label
   *  inside the loop, so `scan_start` stayed the jump. */
  | "entry-jump"
  /** `scan_start` is a label, so only the `INSN_UID >= max_uid_for_loop` test
   *  can have fired: an earlier pass created it. */
  | "loop-created-scan-start"
  /** The dump's RTL does not settle it. Reported, never guessed. */
  | "undetermined";

export interface PhonyCause {
  kind: PhonyCauseKind;
  /** What `scan_start` resolved to in the RTL, when the walk found it. */
  scanStart?: { uid: number; kind: string };
  /** The insns between the loop note and the loop's entry, for the first kind. */
  intruders?: number[];
  /** Symbols those insns materialise, when the RTL names any. */
  symbols?: string[];
  detail: string;
}

export interface LoopRecord {
  from: number;
  to: number;
  /** `%d real insns.` — the desirability denominator for this loop. */
  insnCount: number;
  /** `Loop from %d to %d is phony.` — discarded before any decision. */
  phony: boolean;
  /** Why, when the dump's own RTL settles it. Only ever set on a phony loop. */
  phonyCause?: PhonyCause;
  /** `Loop at %d ignored due to <reason>` — never optimised at all. */
  ignored?: string;
  continueAt?: number;
  movables: Movable[];
  bivs: BasicInductionVariable[];
  givs: GeneralInductionVariable[];
  combineStatistics: CombineStatistics[];
  /**
   * Lines the parser recognised but does not model as structure — loop
   * reversal, BCT instrumentation, unroll.c's iteration analysis. Kept
   * verbatim and attributed to the loop so nothing the pass said is lost.
   */
  notes: string[];
}

export interface PassRecord {
  /** 1-based. `-O2` sets `flag_rerun_loop_opt`, so there are normally two. */
  index: number;
  loops: LoopRecord[];
}

export interface UnrecognisedLine {
  line: number;
  text: string;
}

export interface LoopTrace {
  functionName: string;
  passes: PassRecord[];
  /**
   * Anything the grammar did not cover. A silently dropped line is a decision
   * the reader believes they saw, so these are carried into the report.
   */
  unrecognised: UnrecognisedLine[];
  /** Line number where the post-pass RTL began, or the file length. */
  rtlStartsAt: number;
}

/**
 * One preheader slot, in emission order.
 *
 * `move_movables` and `strength_reduce` both emit with
 * `emit_insn_before (..., loop_start)`, so successive emissions land in
 * successive stream positions: the movables this loop moved, in the order it
 * moved them, then the giv initialisations `strength_reduce` created. That
 * layout is what a preheader-order residual is about, and it is assembled from
 * the log rather than read off the assembly.
 */
export interface PreheaderSlot {
  kind: "movable" | "giv-init";
  /** UID of the emitted insn, where the pass named it. */
  uid?: number;
  /** UID of the in-loop insn this came from, for a movable. */
  from?: number;
  regno?: number;
  /** Symbol the slot materialises, when the RTL names one. */
  symbol?: string;
  detail: string;
}

export interface PreheaderLayout {
  pass: number;
  from: number;
  to: number;
  slots: PreheaderSlot[];
}
