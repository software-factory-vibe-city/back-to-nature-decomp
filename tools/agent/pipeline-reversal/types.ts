/**
 * Deterministic pipeline reversal — shared vocabulary.
 *
 * The forward compiler is a composition F = f_n ∘ … ∘ f_1 of deterministic
 * passes. Each f_k has a preimage *set*, not a point, so this module models a
 * backward chain of canonical preimage functions g_k with f_k(g_k(y)) = y for
 * y ∈ image(f_k), plus an explicit representation of the places where g_k
 * cannot be a function: a `FiberSite` names the stage, the location, and the
 * enumerated alternatives.
 *
 * Every waypoint below is expressed in one IR so that the same g_k chain can
 * run over the original bytes and over a candidate object, and the two can be
 * compared stage by stage. That comparison is what localizes a residual to a
 * pass instead of to a 40-word diff.
 */

/**
 * Waypoints, newest first — the order the backward chain visits them.
 *
 * These are the real GCC 2.95.2 stage boundaries, taken from the vendored
 * `toplev.c` `rest_of_compilation`. Note that `jump2` runs *after* `sched2`,
 * not before it: the tail order is greg → flow2 → sched2 → jump2 → mach → dbr.
 */
export const WAYPOINT_ORDER = [
  "machine",
  "dbr",
  "mach",
  "jump2",
  "sched2",
  "greg",
  "lreg",
  "sched",
  "regmove",
  "combine",
] as const;

export type WaypointName = (typeof WAYPOINT_ORDER)[number];

/** How much of a derived fact is measured rather than assumed. */
export type Confidence = "exact" | "reconstructed" | "inferred";

export type RegisterKind = "hard" | "web";

export interface RegisterOperand {
  /** Architectural register name as it appears in the machine stream. */
  register: string;
  /** Web identity once `inverse-alloc` has run; undefined at machine level. */
  web?: number;
  kind: RegisterKind;
}

/** One instruction in the common IR. */
export interface MirInsn {
  /** Position in this waypoint's stream. */
  index: number;
  /** Stable identity across waypoints — assigned at lift time, preserved by
   *  every g_k so a reordering pass can be described as a permutation. */
  id: number;
  vram?: number;
  word?: number;
  mnemonic: string;
  operands: string[];
  /** Rendered text with symbols resolved. */
  text: string;
  /** Register-masked structural key; two instructions differing only by
   *  allocation share a shape. */
  shape: string;
  /** Symbol this instruction references, when it references one. */
  symbol?: string;
  /** Address that symbol resolves to — the exact identity, where the name is
   *  only a rendering of the nearest table entry. */
  symbolAddress?: number;
  defs: string[];
  uses: string[];
  isCall: boolean;
  isBranch: boolean;
  isJump: boolean;
  isLoad: boolean;
  isStore: boolean;
  isNop: boolean;
  /** Block index in the containing program. */
  block: number;
  /** Set when this instruction sat in the delay slot of another one. */
  delaySlotOf?: number;
  /** Instruction index of a local branch target, when local and resolvable. */
  branchTargetIndex?: number;
  /** Web identities after `inverse-alloc`. */
  defWebs?: number[];
  useWebs?: number[];
  /** Argument registers a call consumes, derived from reaching definitions —
   *  the encoding does not name them. */
  callArguments?: string[];
  /** Number of pre-dbr positions the delay-slot inverse admitted for this
   *  instruction. Greater than one means its position at this waypoint is a
   *  choice the chain made, not something the bytes record. */
  slotFiber?: number;
}

export interface MirBlock {
  index: number;
  /** Instruction ids, in this waypoint's order. */
  insns: number[];
  successors: number[];
  predecessors: number[];
  /** VRAM of the first instruction, when the block came from machine code. */
  vram?: number;
  /** True when the block is reached only through the jump table. */
  dispatchTarget?: boolean;
}

export interface MirProgram {
  waypoint: WaypointName;
  functionName: string;
  insns: MirInsn[];
  blocks: MirBlock[];
  /** Notes about anything the construction could not establish exactly. */
  caveats: string[];
}

/**
 * One located ambiguity: a place where the backward chain could not produce a
 * single preimage. `members` is the whole fiber, not a ranked guess list — a
 * site with one member is a resolved choice kept for the audit trail.
 */
export interface FiberSite {
  id: string;
  stage: WaypointName;
  /** Human-readable location: block, instruction, register role. */
  location: string;
  /** What kind of pass decision this site represents. */
  kind:
    | "delay-slot-origin"
    | "macro-grouping"
    | "cross-jump"
    | "branch-tension"
    | "schedule-order"
    | "web-merge"
    | "allocation-order"
    | "insn-population";
  description: string;
  members: FiberMember[];
  /** Machine word addresses this site is responsible for, when known. */
  affectedVram: number[];
  confidence: Confidence;
  evidence: string[];
}

export interface FiberMember {
  id: string;
  summary: string;
  /** What the source would have to do to select this member, when a lever is
   *  known. Empty means the member is reachable but no source lever is known. */
  sourceLever: string[];
  evidence: string[];
}

/** Result of replaying one backward step forward through the real compiler. */
export interface ReplayCheck {
  stage: WaypointName;
  /** What was compared. */
  subject: string;
  status: "verified" | "diverged" | "unavailable";
  detail: string;
}

export interface WaypointComparison {
  stage: WaypointName;
  /** True when target and candidate waypoints are identical under the
   *  comparison appropriate to that stage. */
  agrees: boolean;
  /** Comparison used, so a reader knows what "agrees" claims. */
  relation: string;
  targetCount: number;
  candidateCount: number;
  differences: string[];
}

import type { ResidualObjective } from "./objective.js";

export interface Decision {
  id: string;
  /** The pass that owns the choice. */
  stage: WaypointName;
  location: string;
  summary: string;
  /** What in the source could move this decision. */
  levers: string[];
  evidence: string[];
  affectedVram: number[];
  /** Differences this decision is expected to explain. */
  consequences: string[];
}

export const PIPELINE_REVERSAL_SCHEMA_VERSION = 1 as const;

export interface ReversalReport {
  schemaVersion: typeof PIPELINE_REVERSAL_SCHEMA_VERSION;
  functionName: string;
  /** Whether the candidate object already reproduces the target bytes. */
  exact: boolean;
  matchedWords: number;
  totalWords: number;
  /** Waypoint ladder, newest first, with target/candidate agreement. */
  comparisons: WaypointComparison[];
  /** The oldest waypoint at which target and candidate still agree; the
   *  residual was introduced by the pass immediately after it. */
  firstDivergence?: { stage: WaypointName; detail: string };
  /** The pass that owns the residual, named in compiler terms. */
  residualOwner: string;
  /** Round-trip validation of each backward step against the real dumps. */
  replay: ReplayCheck[];
  /** The enumerated search space that remains — sites that explain the
   *  residual, and only those. */
  sites: FiberSite[];
  /** Ambiguities internal to the backward chain. They are the same on both
   *  sides, so they cancel in the comparison and are not search space; they are
   *  kept so a reader can audit the reconstruction. */
  ambiguities: FiberSite[];
  /** Independent choices that, taken together, account for the residual. The
   *  headline number: how many things actually have to change, as opposed to
   *  how many words differ. */
  decisions: Decision[];
  /** The staged, per-block residual a search should descend instead of the
   *  byte score. Zero exactly when the two programs agree everywhere. */
  objective: ResidualObjective;
  /** Product of the fiber sizes of the sites that remain genuinely open. */
  searchSpaceSize: number;
  caveats: string[];
}
