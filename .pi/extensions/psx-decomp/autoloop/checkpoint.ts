import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { needsCompaction, type ContextReading } from "./context.ts";

/** One logical loop dispatch, which may contain several checkpoint resumptions. */
export interface CheckpointWatch {
  thresholdTokens: number;
  tierLabel: string;
  isAborted: () => boolean;
  warned: boolean;
  forcedTokens?: number;
  /** The host compacted this cutoff already, but still owes a continuation. */
  compactedAfterCutoff?: boolean;
}

export interface CheckpointSink {
  /** Armed only while the controller is waiting for its own agent message. */
  current?: CheckpointWatch;
}

/** Integer arithmetic avoids rounding 350000 * 1.1 up to 385001. */
export function checkpointLimit(thresholdTokens: number): number {
  return thresholdTokens + Math.ceil(thresholdTokens / 10);
}

export function checkpointMessage(watch: CheckpointWatch, tokens: number): string {
  return [
    `Autoloop checkpoint: ${watch.tierLabel} has reached ${tokens} context tokens ` +
      `(checkpointAtTokens ${watch.thresholdTokens}; forced return at ${checkpointLimit(watch.thresholdTokens)}).`,
    "Pause broad investigation and focus on the latest experiment. Finish or clearly mark its measurement as incomplete, then summarize the work so far:",
    "- Latest candidate/artifact paths, last measured residual, what the latest experiment changed and what its result establishes.",
    "- Earlier measured experiments grouped by mechanism; distinguish identical compiler outputs from genuinely different programs.",
    "- Open assumptions, blockers and ruled-out domains with their premises/bounds. Do not promote a failed search into an impossibility proof.",
    "- The next concrete experiment and the current role, file scope, completion criteria and any pending handoff/review protocol.",
    "Use CLM/live-context facilities if present: edit LIVE_CONTEXT.md to retain this concise working summary and remove stale reasoning and bulky completed tool output. " +
      "Use live_context_annotate for exact evidence that must survive, and live_context_recall when needed. Follow the live-context metadata/nonce rules; do not alter system instructions.",
    "Also emit a brief normal assistant checkpoint summary: forced native compaction reads the raw transcript, not just CLM's edited projection.",
    "Then continue the SAME task from the latest experiment. This is a context checkpoint, not a match, failed attempt, tier escalation or permission to commit. " +
      "If context reaches the forced-return limit, the harness will interrupt, compact and ask you to continue.",
  ].join("\n");
}

export const CHECKPOINT_COMPACTION_INSTRUCTIONS = [
  "This is an autoloop checkpoint within the SAME task and model tier, not a new task or an escalation.",
  "Prioritize the latest checkpoint summary and latest measured experiment over older speculative reasoning.",
  "Preserve the active role, function, file-scope constraints, completion criteria and pending handoff/review tool protocol.",
  "Record current source/artifact paths, last measured residual, whether the interrupted experiment completed, and the next concrete action.",
  "Summarize older experiments by mechanism and compiled-output identity. Preserve the premises and bounds of negative results; do not turn them into unconditional impossibility claims.",
].join("\n");

export function checkpointContinuation(tierLabel: string): string {
  return [
    `Continue the interrupted autoloop task on ${tierLabel} after checkpoint compaction.`,
    "Resume from the latest experiment and current on-disk candidate, using the checkpoint summary and preserved artifacts. " +
      "Confirm any interrupted measurement before relying on it; do not restart from an old draft or repeat already-closed experiments.",
    "Keep the same role, file scope, completion criteria and any pending handoff/review protocol. " +
      "The checkpoint is not a failed return and does not advance the ladder. Continue working rather than merely reporting status; " +
      "if the task is already complete or genuinely blocked, finish its normal completion/reporting protocol. " +
      "Do not repeat a completion/handoff tool that already succeeded before the interruption; return normally so the harness can verify it.",
  ].join("\n");
}

/**
 * Observe every completed assistant/tool turn, not just the agent's final return.
 * CLM edits and tool mutations can finish at this boundary before we abort.
 * Never await idle/compaction here: event handlers would deadlock the agent.
 */
export function registerCheckpointMonitor(pi: ExtensionAPI, sink: CheckpointSink): void {
  pi.on("turn_end", (event, ctx) => {
    const watch = sink.current;
    if (!watch || watch.isAborted() || watch.forcedTokens !== undefined || ctx.signal?.aborted) return;
    if (event.message.role !== "assistant" || event.message.stopReason === "aborted" || event.message.stopReason === "error") return;
    const usage: ContextReading | undefined = ctx.getContextUsage();
    if (!usage || usage.tokens === null || !Number.isFinite(usage.tokens)) return;
    if (!needsCompaction(usage, watch.thresholdTokens)) {
      if (usage.tokens < watch.thresholdTokens) watch.warned = false;
      return;
    }

    if (usage.tokens >= checkpointLimit(watch.thresholdTokens)) {
      /* A whole tool batch can jump over both thresholds. Do not enqueue a
         steering message that abort would immediately discard/restore to the editor. */
      watch.forcedTokens = usage.tokens;
      ctx.ui.notify(`Autoloop forced checkpoint: ${usage.tokens} context tokens on ${watch.tierLabel}; returning to compact and continue.`, "warning");
      ctx.abort();
    } else if (!watch.warned) {
      watch.warned = true;
      pi.sendMessage({
        customType: "autoloop-checkpoint",
        content: checkpointMessage(watch, usage.tokens),
        display: true,
        details: { tier: watch.tierLabel, tokens: usage.tokens, checkpointAtTokens: watch.thresholdTokens },
      }, { deliverAs: "steer" });
    }
  });

  pi.on("session_compact", (event) => {
    const watch = sink.current;
    if (!watch) return;
    watch.warned = false;
    if (watch.forcedTokens !== undefined) {
      /* Native overflow recovery may compact before our idle wait finishes.
         A host retry already supplies continuation; otherwise keep the cutoff
         pending so the controller resumes, without compacting twice. */
      if (event.willRetry) delete watch.forcedTokens;
      else watch.compactedAfterCutoff = true;
    }
  });
}
