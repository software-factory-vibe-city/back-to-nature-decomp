import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_LOOP_CONFIG } from "./config.ts";
import { type ContextReading } from "./context.ts";
import {
  checkpointContinuation, checkpointLimit, checkpointMessage,
  registerCheckpointMonitor, type CheckpointSink, type CheckpointWatch,
} from "./checkpoint.ts";
import { turn, type LoopDeps } from "./loop.ts";
import { createTurnGate } from "./turn-gate.ts";

type Hook = (event: { message: { role: string; stopReason: string }; willRetry?: boolean }, ctx: ExtensionContext) => unknown;

function monitor() {
  const hooks = new Map<string, Hook>();
  const sink: CheckpointSink = {};
  const messages: { content: string; options: unknown }[] = [];
  const notifications: string[] = [];
  let tokens: number | null | undefined = 0;
  let aborts = 0;
  const pi = {
    on: (event: string, hook: Hook) => hooks.set(event, hook),
    sendMessage: (message: { content: string }, options: unknown) => messages.push({ content: message.content, options }),
  } as unknown as ExtensionAPI;
  const ctx = {
    getContextUsage: (): ContextReading | undefined => tokens === undefined ? undefined
      : { tokens, contextWindow: 1_000_000, percent: null },
    abort: () => { aborts++; },
    ui: { notify: (text: string) => notifications.push(text) },
  } as unknown as ExtensionContext;
  registerCheckpointMonitor(pi, sink);
  const emit = (event = "turn_end", stopReason = "toolUse", willRetry = false) => hooks.get(event)!({ message: { role: "assistant", stopReason }, willRetry }, ctx);
  const arm = (thresholdTokens = 350_000, isAborted = () => false) => {
    const watch: CheckpointWatch = { thresholdTokens, tierLabel: "fixture", isAborted, warned: false };
    sink.current = watch;
    return watch;
  };
  return { pi, ctx, sink, messages, notifications, emit, arm,
    tokens: (value: number | null | undefined) => { tokens = value; }, aborts: () => aborts };
}

test("steering is queued at the per-agent threshold once, before any final return", () => {
  const m = monitor(), watch = m.arm();
  m.tokens(349_999); m.emit();
  assert.equal(m.messages.length, 0);
  m.tokens(350_000); m.emit();
  m.tokens(360_000); m.emit();
  assert.equal(m.messages.length, 1);
  assert.deepEqual(m.messages[0]!.options, { deliverAs: "steer" });
  assert.match(m.messages[0]!.content, /latest experiment/);
  assert.match(m.messages[0]!.content, /CLM\/live-context/);
  assert.match(m.messages[0]!.content, /normal assistant checkpoint summary/);
  assert.equal(watch.warned, true);
  assert.equal(m.aborts(), 0);
});

test("the 10% cutoff is exactly 385000 for a 350000 threshold", () => {
  assert.equal(checkpointLimit(350_000), 385_000);
  const m = monitor(), watch = m.arm();
  m.tokens(384_999); m.emit();
  assert.equal(m.aborts(), 0);
  m.tokens(385_000); m.emit();
  assert.equal(m.aborts(), 1);
  assert.equal(watch.forcedTokens, 385_000);
  m.tokens(900_000); m.emit();
  assert.equal(m.aborts(), 1, "only one abort before the controller handles the checkpoint");
});

test("a tool batch jumping over both thresholds forces a return without undeliverable steering", () => {
  const m = monitor(), watch = m.arm(120_000);
  m.tokens(200_000); m.emit();
  assert.equal(m.messages.length, 0);
  assert.equal(m.aborts(), 1);
  assert.equal(watch.forcedTokens, 200_000);
});

test("a known CLM/context reduction re-arms steering", () => {
  const m = monitor(); m.arm();
  m.tokens(351_000); m.emit();
  m.tokens(50_000); m.emit();
  m.tokens(351_000); m.emit();
  assert.equal(m.messages.length, 2);
  assert.equal(m.aborts(), 0);
});

test("a host compaction without retry keeps a cutoff pending for continuation", () => {
  const m = monitor(), watch = m.arm();
  m.tokens(390_000); m.emit();
  m.emit("session_compact");
  assert.equal(watch.forcedTokens, 390_000);
  assert.equal(watch.compactedAfterCutoff, true);
  m.tokens(null); m.emit();
  assert.equal(m.messages.length, 0);
});

test("a host compaction with automatic retry already supplies continuation and re-arms", () => {
  const m = monitor(), watch = m.arm();
  m.tokens(390_000); m.emit();
  m.emit("session_compact", "toolUse", true);
  assert.equal(watch.forcedTokens, undefined);
  m.tokens(null); m.emit();
  assert.equal(m.messages.length, 0);
  m.tokens(351_000); m.emit();
  assert.equal(m.messages.length, 1);
});

test("disabled checkpoints and unknown/nonfinite readings do not act", () => {
  const m = monitor(); m.arm(0);
  m.tokens(900_000); m.emit();
  m.arm();
  for (const tokens of [undefined, null, NaN, Infinity]) { m.tokens(tokens); m.emit(); }
  assert.equal(m.messages.length, 0);
  assert.equal(m.aborts(), 0);
});

test("ordinary sessions, stopped loops and failed/aborted responses are never steered", () => {
  const m = monitor(); m.tokens(900_000); m.emit();
  m.arm(350_000, () => true); m.emit();
  m.arm(); m.emit("turn_end", "error"); m.emit("turn_end", "aborted");
  const controller = new AbortController(); controller.abort();
  Object.assign(m.ctx, { signal: controller.signal });
  m.emit();
  assert.equal(m.messages.length, 0);
  assert.equal(m.aborts(), 0);
});

test("checkpoint prompts preserve pending roles/protocols instead of assuming matching", () => {
  const m = monitor(), watch = m.arm();
  assert.match(checkpointMessage(watch, 350_000), /pending handoff\/review protocol/);
  assert.match(checkpointContinuation("reviewer"), /same role, file scope, completion criteria/);
  assert.match(checkpointContinuation("reviewer"), /not a failed return.*does not advance the ladder/);
});

/** Script whole agent returns while using the real monitor and turn controller. */
function dispatch() {
  const m = monitor();
  const sent: string[] = [];
  const compactions: string[] = [];
  const gate = createTurnGate();
  const flag = { aborted: false };
  let run = () => { gate.settled++; };
  let compact = (handlers: { onComplete: () => void; onError: (error: Error) => void }) => {
    m.tokens(null); m.emit("session_compact"); handlers.onComplete();
  };
  const deps = {
    pi: { ...m.pi, sendUserMessage: (text: string) => { sent.push(text); run(); } },
    ctx: { ...m.ctx, isIdle: () => true, waitForIdle: async () => {},
      compact: (handlers: { customInstructions: string; onComplete: () => void; onError: (error: Error) => void }) => {
        compactions.push(handlers.customInstructions); compact(handlers);
      },
      ui: { notify: (text: string) => m.notifications.push(text), setStatus: () => {},
        theme: { fg: (_color: string, text: string) => text } },
    },
    config: { ...DEFAULT_LOOP_CONFIG, runtimeDir: "/unused", returnsPerTier: 1, maxReturnsPerTier: 1 },
    sink: { gate, checkpoint: m.sink, verdict: {}, handoff: { awaiting: "func_fixture" }, prep: {},
      tier: { provider: "fixture", model: "fixture", label: "fixture", thinking: "off", checkpointAtTokens: 350_000 } },
    flag, projectRoot: "/unused", baseline: new Set<string>(),
  } as unknown as LoopDeps;
  return { ...m, deps, gate, flag, sent, compactions,
    run: (script: () => void) => { run = script; },
    compact: (script: typeof compact) => { compact = script; } };
}

test("a forced checkpoint waits for compaction, then continues within the same logical return", async () => {
  const d = dispatch();
  let complete: (() => void) | undefined;
  d.compact((handlers) => { complete = () => { d.tokens(null); handlers.onComplete(); }; });
  d.run(() => {
    if (d.sent.length === 1) { d.tokens(350_000); d.emit(); d.tokens(385_000); d.emit(); }
    else { d.tokens(10_000); d.emit(); }
    d.gate.settled++;
  });
  const result = turn(d.deps, "Work on func_fixture; pending handoff protocol stays open.");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(d.sent.length, 1, "no continuation while summarization is pending");
  assert.equal(d.compactions.length, 1);
  assert.match(d.compactions[0]!, /latest measured experiment/);
  complete!();
  assert.equal(await result, true);
  assert.equal(d.sent.length, 2);
  assert.match(d.sent[1]!, /Continue the interrupted autoloop task on fixture/);
  assert.equal(d.aborts(), 1);
  assert.equal(d.flag.aborted, false, "checkpoint abort is not a user/loop abort");
  assert.equal(d.deps.sink.handoff.awaiting, "func_fixture");
  assert.equal(d.deps.sink.checkpoint?.current, undefined, "monitor disarmed at return");
});

test("multiple checkpoints re-arm and resume without consuming the single return budget", async () => {
  const d = dispatch();
  d.run(() => {
    d.tokens(d.sent.length <= 2 ? 390_000 : 10_000); d.emit(); d.gate.settled++;
  });
  assert.equal(await turn(d.deps, "Initial task"), true);
  assert.equal(d.sent.length, 3);
  assert.equal(d.compactions.length, 2);
  assert.equal(d.aborts(), 2);
  assert.equal(d.flag.aborted, false);
});

test("host compaction after a cutoff is not repeated, but still gets a continuation", async () => {
  const d = dispatch();
  d.run(() => {
    if (d.sent.length === 1) {
      d.tokens(390_000); d.emit();
      d.tokens(null); d.emit("session_compact");
    } else { d.tokens(1000); d.emit(); }
    d.gate.settled++;
  });
  assert.equal(await turn(d.deps, "Initial task"), true);
  assert.equal(d.compactions.length, 0, "the host already compacted");
  assert.equal(d.sent.length, 2, "an aborted run still needs continuation");
});

test("a normal early return still compacts before the next dispatch using its own rung threshold", async () => {
  const d = dispatch();
  d.deps.sink.tier!.checkpointAtTokens = 120_000;
  d.tokens(125_000);
  d.run(() => { d.tokens(1000); d.emit(); d.gate.settled++; });
  assert.equal(await turn(d.deps, "Next normal task"), true);
  assert.equal(d.compactions.length, 1);
  assert.equal(d.sent.length, 1);
  assert.equal(d.aborts(), 0);
});

test("a disabled rung is not compacted at dispatch or cut off while running", async () => {
  const d = dispatch(); d.deps.sink.tier!.checkpointAtTokens = 0;
  d.tokens(900_000);
  d.run(() => { d.emit(); d.gate.settled++; });
  assert.equal(await turn(d.deps, "Task with checkpointing off"), true);
  assert.equal(d.compactions.length, 0);
  assert.equal(d.aborts(), 0);
  assert.equal(d.messages.length, 0);
});

test("stopping before dispatch sends nothing", async () => {
  const d = dispatch(); d.flag.aborted = true;
  assert.equal(await turn(d.deps, "Do not send"), false);
  assert.equal(d.sent.length, 0);
  assert.equal(d.compactions.length, 0);
});

test("a user stop at the forced-return boundary prevents compaction and continuation", async () => {
  const d = dispatch();
  d.run(() => { d.tokens(390_000); d.emit(); d.flag.aborted = true; d.gate.settled++; });
  assert.equal(await turn(d.deps, "Initial task"), false);
  assert.equal(d.sent.length, 1);
  assert.equal(d.compactions.length, 0);
  assert.equal(d.deps.sink.checkpoint?.current, undefined);
});

test("a user stop during compaction prevents continuation", async () => {
  const d = dispatch();
  d.run(() => { d.tokens(390_000); d.emit(); d.gate.settled++; });
  d.compact((handlers) => { d.flag.aborted = true; handlers.onComplete(); });
  assert.equal(await turn(d.deps, "Initial task"), false);
  assert.equal(d.sent.length, 1);
  assert.equal(d.compactions.length, 1);
});

test("failed checkpoint compaction stops safely instead of looping aborts or resuming un-compacted", async () => {
  const d = dispatch();
  d.run(() => { d.tokens(390_000); d.emit(); d.gate.settled++; });
  d.compact((handlers) => handlers.onError(new Error("summarizer unavailable")));
  assert.equal(await turn(d.deps, "Initial task"), false);
  assert.equal(d.flag.aborted, true);
  assert.equal(d.sent.length, 1);
  assert.equal(d.compactions.length, 1);
  assert.match(d.notifications.join("\n"), /loop stopped, work preserved.*summarizer unavailable/);
  assert.equal(d.deps.sink.checkpoint?.current, undefined);
});
