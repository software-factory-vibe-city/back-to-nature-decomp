/**
 * loop-emission — what the ORIGINAL's loop optimizer must have done.
 *
 * `psx_loop_trace` observes the candidate's loop pass. This derives the
 * requirement it should be compared against, from the target's bytes alone, so
 * it is available before any source exists — the same standing as
 * `psx_frame_map` or `psx_analyze_target_schedule`, and the reason those passes
 * are searchable while `loop` was not.
 *
 * The derivation rests on one fact about `loop.c`: within a loop, everything it
 * emits into the preheader goes through `emit_insn_before (..., loop_start)`,
 * so emissions land in the order they were made, and the order of the phases is
 * fixed. A preheader therefore reads, front to back, as a non-decreasing
 * sequence of emission classes.
 */

/**
 * The phases that write a preheader, in the order they write it.
 *
 * `Source` covers everything the compiler did not hoist there, including a
 * *basic* induction variable's initialisation: `loop.c` emits reduced givs'
 * inits but never a biv's, which is what lets those two be told apart at all.
 */
export enum EmissionClass {
  Source = 0,
  Pass1Movable = 1,
  Pass1GivInit = 2,
  Pass2Movable = 3,
  Pass2GivInit = 4,
}

export const CLASS_NAMES: Record<EmissionClass, string> = {
  [EmissionClass.Source]: "source",
  [EmissionClass.Pass1Movable]: "pass-1 movable",
  [EmissionClass.Pass1GivInit]: "pass-1 giv init",
  [EmissionClass.Pass2Movable]: "pass-2 movable",
  [EmissionClass.Pass2GivInit]: "pass-2 giv init",
};

/** Why a group can only be some of the classes. */
export type GroupRole =
  /** Destination is never read in the loop, so no loop phase emitted it. */
  | "not-live-in-loop"
  /** Destination is stepped by a constant in the loop: a biv init or a reduced giv init. */
  | "induction-init"
  /** Destination is read but never written in the loop: a loop-invariant value. */
  | "invariant"
  /** Written in the loop by something other than a constant step. */
  | "varying"
  /** Has a side effect, so it was never a candidate for hoisting. */
  | "effectful";

/** One emitted unit in a preheader — an address pair counts once. */
export interface PreheaderGroup {
  index: number;
  /** Instruction ids from the program this was derived from. */
  insns: number[];
  vram?: number;
  text: string;
  /** Register the group produces, when it produces one. */
  destination?: string;
  /** Symbol the group materialises, when it materialises one. */
  symbol?: string;
  /**
   * Exact address that symbol resolves to.
   *
   * This, not the name, is the identity used to match a goal against a
   * candidate. The target lift renders an unnamed datum as an offset from the
   * nearest known symbol (`D_800B889C+0x3120`) while the compiler's own RTL
   * names it outright (`D_800BB9BC`); comparing the two strings silently fails,
   * and a silent failure here reports a goal as met.
   */
  symbolAddress?: number;
  role: GroupRole;
  /**
   * The group is a standalone `%hi`/`%lo` pair.
   *
   * Which matters twice. `move_movables` ties the two halves together with
   * `force_movables`, so their savings and lifetimes are summed and the
   * desirability product floors at 2x2 — the fact that closes the ordinary
   * pass-1-decline route. And a pair exists at all only because the `%lo` could
   * not fold into a load, which on MIPS is decided by the index: one register
   * folds, a two-register sum does not.
   */
  addressPair: boolean;
  /** Constant step inside the loop, for an `induction-init`. */
  step?: number;
  /** Classes admissible from the group's own shape, before ordering. */
  admissible: EmissionClass[];
  /** Classes that survive the non-decreasing solve over the whole preheader. */
  consistent: EmissionClass[];
}

export interface PreheaderRequirement {
  /** Block index of the preheader in the program it was derived from. */
  block: number;
  vram?: number;
  /** Loop header block this preheader feeds. */
  header: number;
  /**
   * Headers of loops nested inside this one.
   *
   * The target-side evidence for the cascade route: an insn a loop pass hoisted
   * out of a nested loop is invisible to the enclosing loop's pass-1 scan and a
   * fresh movable for its pass-2 scan. Without a nested loop that route is
   * closed, and with one it is open with no pass-1 decline to explain.
   */
  innerLoops: number[];
  groups: PreheaderGroup[];
  /**
   * True when no assignment of classes makes the sequence non-decreasing. That
   * is a defect in this model, not a fact about the compiler, and is reported
   * as such rather than being smoothed over.
   */
  unsatisfiable: boolean;
}

export interface LoopEmissionRequirement {
  functionName: string;
  preheaders: PreheaderRequirement[];
  caveats: string[];
}
