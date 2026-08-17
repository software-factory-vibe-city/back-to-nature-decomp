/**
 * The loop's context ceiling.
 *
 * Clearing between tiers and between functions bounds the conversation at those
 * boundaries only. Inside one tier's work on one function the context grows
 * without a bound of its own: a long ladder rung reads sources, runs oracles and
 * reads their reports, and the turn that finally has the answer is the one
 * carrying the most history. Compaction is what keeps that turn possible — it
 * summarizes rather than drops, so the tier keeps its own reasoning where a
 * clear would take it away mid-function.
 */

/** The reading `ExtensionContext.getContextUsage()` returns. */
export interface ContextReading {
  /** Estimated context tokens, or null when there is no reading yet. */
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

/**
 * Whether the next turn should start with a compaction.
 *
 * A missing or null reading is not a small context — it is no context reading
 * at all, which is what `getContextUsage()` returns right after a compaction
 * and before the next response. Compacting on it would compact what was just
 * compacted, so an unknown reading never triggers.
 */
export function needsCompaction(usage: ContextReading | undefined, thresholdTokens: number): boolean {
  if (!Number.isFinite(thresholdTokens) || thresholdTokens <= 0) return false;
  if (!usage || usage.tokens === null) return false;
  return usage.tokens >= thresholdTokens;
}

export type CompactionOutcome = "compacted" | "failed" | "timed-out";

export interface CompactionHandlers {
  onComplete: () => void;
  onError: (error: Error) => void;
}

/**
 * Turn the fire-and-forget compaction call into something the loop can await.
 *
 * `ctx.compact()` returns immediately and reports through callbacks, so the
 * loop would otherwise send its next message into a session that is busy
 * summarizing. The timeout is the other half: a compaction that reports neither
 * completion nor error must not stop the loop forever, and the caller can still
 * wait for idle before it sends.
 */
export async function requestCompaction(options: {
  compact: (handlers: CompactionHandlers) => void;
  timeoutMs: number;
  sleep: (ms: number) => Promise<void>;
}): Promise<{ outcome: CompactionOutcome; detail: string }> {
  let settle: ((result: { outcome: CompactionOutcome; detail: string }) => void) | undefined;
  const reported = new Promise<{ outcome: CompactionOutcome; detail: string }>((resolve) => {
    settle = (result) => {
      if (settle) settle = undefined;
      resolve(result);
    };
  });

  const finish = (result: { outcome: CompactionOutcome; detail: string }) => settle?.(result);

  try {
    options.compact({
      onComplete: () => finish({ outcome: "compacted", detail: "" }),
      onError: (error) => finish({ outcome: "failed", detail: error instanceof Error ? error.message : String(error) }),
    });
  } catch (error) {
    return { outcome: "failed", detail: error instanceof Error ? error.message : String(error) };
  }

  const timedOut = options
    .sleep(options.timeoutMs)
    .then(() => ({ outcome: "timed-out" as const, detail: `no result within ${options.timeoutMs}ms` }));

  return Promise.race([reported, timedOut]);
}
