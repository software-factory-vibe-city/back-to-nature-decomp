import type { Completion } from "../tools/prepared-attempt.ts";
import type { PolicyFinding } from "../../shared/types.ts";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

/** One rung of the escalation ladder: a concrete provider/model plus its thinking level. */
export interface LoopTier {
  provider: string;
  model: string;
  thinking: ThinkingLevel;
  /** Human-facing label used in status lines and notes. */
  label: string;
}

export interface LoopConfig {
  /** Ordered escalation ladder, cheapest/most-local first. */
  ladder: LoopTier[];
  /**
   * Non-matching yields a tier gets before the loop *may* escalate.
   *
   * A floor, not a ceiling. The loop stops working a function when the evidence
   * says the search is out of moves, not when a counter runs out: over one
   * overnight run, 68% of the wall clock went into the nine functions the loop
   * gave up on, and at least two of them needed a four-line edit it never
   * reached. See `maxReturnsPerTier` for the runaway bound and
   * `tierMinutes` for the wall-clock one.
   */
  returnsPerTier: number;
  /**
   * Hard bound on returns per tier, whatever the evidence says.
   *
   * The evidence gate can be satisfied late or not at all — a turn that stops
   * measuring stops producing evidence — so the counter still exists. It is
   * just no longer the thing that decides.
   */
  maxReturnsPerTier: number;
  /** Wall-clock ceiling per tier, in minutes; the tier escalates rather than parks. Zero disables. */
  tierMinutes: number;
  /**
   * Distinct measurements with no improvement before the loop may park.
   *
   * Counted from the experiment ledger, so it survives a context clear and a
   * model change, and so respellings of an already-measured program do not
   * count as failures to move.
   */
  parkAfterStalledMeasurements: number;
  /**
   * Acknowledge a one-rung ladder.
   *
   * A single tier silently disables escalation, the handoff, and policy
   * adjudication — which turns every forbidden construct into an immediate
   * human park. Three of nine parks in one overnight run were that. Requiring
   * the field makes it a decision instead of an accident.
   */
  singleTier: boolean;
  /** Upper bound on functions attempted in one loop invocation. */
  maxFunctions: number;
  /** Clear the conversation before each escalation and each new function. */
  clearContextBetween: boolean;
  /** Compact before any turn that would start above this many context tokens; 0 disables. */
  compactAtTokens: number;
  /** Have the outgoing tier summarize its findings for the incoming one. */
  handoffSummary: boolean;
  /** Give the agent one notes-only turn to record grouping evidence before committing. */
  updateFileGroupings: boolean;
  /** Commit each byte-exact, finalized function before moving to the next one. */
  commitOnMatch: boolean;
  /** Commit each parked function before moving to the next one. */
  commitOnPark: boolean;
  /** Where durable loop state is written (absolute). */
  runtimeDir: string;
  /** Directory for documents that need a human decision (project-relative). */
  approvalsDir: string;
}

/**
 * Why a function was parked.
 *
 * `blocked` is not a verdict on the function or on the model: the build cannot
 * express the function at all, so no source is reachable. It reads as
 * "escalation-exhausted" only if the two are conflated, and they need opposite
 * responses — one needs a build fix, the other needs a human's structural
 * judgement. `ovl_10_func_800BA394` should have been parked at minute one with
 * "the container has no rodata attribution for this function's jump table",
 * not at minute forty-six with "needs a new structural hypothesis".
 */
export type ParkReason =
  | "escalation-exhausted"
  | "asm-needs-human-approval"
  | "environment-guard"
  | "blocked";

export interface ParkRecord {
  functionName: string;
  /** Project-relative C file, so a note names the container's path, not `src/`. */
  sourcePath?: string;
  reason: ParkReason;
  parkedAt: string;
  /** Ladder tier the loop reached before parking. */
  reachedTier: string;
  /**
   * Oracle report for the source the park preserved, re-measured at park time.
   *
   * Re-measured rather than carried forward because the park may preserve a
   * different program from the one the last turn left on disk, and a note whose
   * report describes a program its own listing does not contain is worse than
   * no report.
   */
  lastReport: string;
  /** Which program was preserved and why — always stated, never inferred. */
  attemptNote?: string;
  findings: PolicyFinding[];
}

export interface ApprovalRecord {
  functionName: string;
  kinds: string[];
  approvedAt: string;
  /** Tier that granted the exemption. */
  approvedBy: string;
  rationale: string;
}

export interface LoopState {
  parked: Record<string, ParkRecord>;
  approvals: Record<string, ApprovalRecord>;
  completions?: Record<string, Completion>;
}

export type FunctionOutcome =
  | { kind: "matched"; functionName: string; tier: string; changedFiles: string[]; documentation?: "pending" | "passed"; commit?: string }
  | { kind: "parked"; functionName: string; record: ParkRecord; commit?: string }
  | { kind: "aborted"; functionName: string }
  | { kind: "environment-broken"; functionName: string; detail: string };

export interface HandoffSummary {
  functionName: string;
  whatWasTried: string;
  ruledOut: string;
  currentDivergence: string;
  leadingHypothesis: string;
  /** "tool" when the tier filled in the structured form; "prose" when it was scraped from the turn. */
  source: "tool" | "prose";
}

export type PolicyVerdict =
  | { decision: "approve"; rationale: string }
  | { decision: "reject"; rationale: string };
