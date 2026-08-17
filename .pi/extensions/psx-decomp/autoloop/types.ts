import type { PolicyFinding } from "../autonomous/types.ts";

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
  /** Non-matching yields a tier is allowed before the loop escalates. */
  returnsPerTier: number;
  /** Upper bound on functions attempted in one loop invocation. */
  maxFunctions: number;
  /** Clear the conversation before each escalation and each new function. */
  clearContextBetween: boolean;
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

export type ParkReason = "escalation-exhausted" | "asm-needs-human-approval" | "environment-guard";

export interface ParkRecord {
  functionName: string;
  reason: ParkReason;
  parkedAt: string;
  /** Ladder tier the loop reached before parking. */
  reachedTier: string;
  /** Last oracle report seen before parking. */
  lastReport: string;
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
}

export type FunctionOutcome =
  | { kind: "matched"; functionName: string; tier: string; changedFiles: string[]; commit?: string }
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
