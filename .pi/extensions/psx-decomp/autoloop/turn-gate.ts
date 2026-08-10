import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * The loop's proof that a message it sent has actually been answered.
 *
 * `sendUserMessage` only queues: the session is not marked busy until several
 * ticks later, inside the prompt it eventually starts. So `waitForIdle()` called
 * straight after a send observes a still-idle session and returns immediately,
 * and the loop races ahead of the agent — scoring oracles against a file nobody
 * has touched yet, and applying the next tier's model to the previous tier's
 * message. A turn is therefore waited for in two steps: watch the session become
 * busy, and only then wait for it to go idle again.
 */
export interface TurnGate {
  /** Agent runs seen to settle, when the host emits that event. */
  settled: number;
}

export function createTurnGate(): TurnGate {
  return { settled: 0 };
}

/**
 * Count settled agent runs.
 *
 * `agent_settled` fires once per fully finished run — after any retry,
 * compaction, or queued continuation — so it closes the one hole in watching the
 * busy flag: a run that begins and ends between two polls. It is a second
 * witness rather than the only one, so a host that never emits it degrades to
 * the busy flag instead of hanging.
 */
export function registerTurnGate(pi: ExtensionAPI, gate: TurnGate): void {
  pi.on("agent_settled", async () => {
    gate.settled += 1;
  });
}

export type TurnWaitResult = "settled" | "aborted" | "never-started";

export interface TurnWaitOptions {
  gate: TurnGate;
  /** The gate reading taken immediately before the message was sent. */
  before: number;
  isIdle: () => boolean;
  isAborted: () => boolean;
  waitForIdle: () => Promise<void>;
  /** How long a queued message may take to become a running agent turn. */
  startTimeoutMs: number;
  pollMs: number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

/**
 * Wait for the run triggered by one sent message.
 *
 * The start timeout covers the case where the message never becomes a run at
 * all — a rejected send, a session that went away — and it applies only until
 * the run is first seen busy, so a turn that takes an hour is never mistaken for
 * one that never began. Reporting `never-started` rather than waiting forever
 * matters more than the reverse: the loop can stop and say so, where a silent
 * timeout would have it score an unanswered turn.
 */
export async function waitForTurn(options: TurnWaitOptions): Promise<TurnWaitResult> {
  const deadline = options.now() + options.startTimeoutMs;

  while (options.isIdle() && options.gate.settled <= options.before) {
    if (options.isAborted()) return "aborted";
    if (options.now() >= deadline) return "never-started";
    await options.sleep(options.pollMs);
  }

  if (options.gate.settled <= options.before) await options.waitForIdle();
  return options.isAborted() ? "aborted" : "settled";
}
