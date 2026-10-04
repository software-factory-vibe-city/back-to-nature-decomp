import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { prepareAttempt, attemptStaticFinalization, buildInputs, sameInputs, inputIdentity, documentCompletion, type Completion } from "./prepared-attempt.ts";
import { finalize } from "../autoloop/oracles.ts";
import { groupingsMessage } from "../autoloop/prompts.ts";
import { getSessionBaseline } from "./session-baseline.ts";
import { randomUUID } from "node:crypto";

const completionPath = (root: string, name: string) => join(root, "build/preparation/completions", `${name}.json`);
export function saveInteractiveCompletion(root: string, name: string, completion: Completion): void {
  mkdirSync(join(root, "build/preparation/completions"), { recursive: true });
  writeFileSync(completionPath(root, name), JSON.stringify(completion, null, 2) + "\n");
}
export function agentCompletion(root: string, changedFiles: string[]): Completion {
  const inputs = buildInputs(root);
  return { origin: "agent", inputs, verifiedIdentity: inputIdentity(inputs), verification: "passed", changedFiles, documentation: "pending" };
}
export async function prepareInteractive(root: string, name: string, ctx: ExtensionCommandContext, signal: AbortSignal): Promise<{
  handoff: string; completion?: Completion;
}> {
  signal.throwIfAborted();
  const path = completionPath(root, name);
  if (existsSync(path)) {
    const prior = JSON.parse(readFileSync(path, "utf8")) as Completion;
    if (sameInputs(prior.inputs, buildInputs(root))) return { handoff: "", completion: prior };
  }
  await waitForPreparationIdle(ctx, signal);
  const attempt = await prepareAttempt(root, name, signal);
  signal.throwIfAborted();
  const baseline = await getSessionBaseline(root);
  signal.throwIfAborted();
  const result = await attemptStaticFinalization({ root, attempt, aborted: () => signal.aborted,
    finalize: async () => {
      const result = await finalize({ projectRoot: root, baseline, state: { parked: {}, approvals: {} }, signal }, name);
      return { passed: result.passed, changedFiles: result.changedFiles, detail: result.gate.failures.join("; ") };
    } });
  signal.throwIfAborted();
  if (result.completed) saveInteractiveCompletion(root, name, result.completed);
  return { handoff: result.handoff, ...(result.completed ? { completion: result.completed } : {}) };
}

/** Idle commands have no ctx.signal. Own cancellation until the last dispatch;
 * shutdown awaits child cleanup, and a second command never starts another job. */
export function interactivePreparationLifecycle(pi: ExtensionAPI) {
  let active: { controller: AbortController; done: Promise<void> } | undefined;
  let closed = false;
  const cancel = async () => {
    const own = active;
    if (!own) return false;
    own.controller.abort();
    await own.done;
    return true;
  };
  pi.on("session_shutdown", async () => { closed = true; await cancel(); });
  pi.on("session_start", () => { closed = false; });
  return {
    cancel,
    async run(ctx: Pick<ExtensionContext, "signal" | "ui">, work: (signal: AbortSignal) => Promise<void>): Promise<void> {
      if (closed) return;
      if (active) { ctx.ui.notify("Preparation already running. Use /decompile --cancel or /fix-decomp --cancel first.", "warning"); return; }
      const controller = new AbortController();
      const abort = () => controller.abort();
      ctx.signal?.addEventListener("abort", abort, { once: true });
      if (ctx.signal?.aborted) abort();
      const own = { controller, done: Promise.resolve() };
      active = own;
      own.done = Promise.resolve().then(async () => {
        controller.signal.throwIfAborted();
        await work(controller.signal);
      }).catch((error) => {
        if (controller.signal.aborted) ctx.ui.notify("Preparation cancelled; no solver or documentation dispatched.", "info");
        else ctx.ui.notify(`Preparation command failed: ${String(error)}`, "error");
      }).finally(() => {
        ctx.signal?.removeEventListener("abort", abort);
        if (active === own) active = undefined;
      });
      await own.done;
    },
  };
}

export async function waitForPreparationIdle(ctx: Pick<ExtensionCommandContext, "waitForIdle">, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  let abort: () => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });
  try { await Promise.race([ctx.waitForIdle(), cancelled]); signal.throwIfAborted(); }
  finally { signal.removeEventListener("abort", abort); }
}

/** One explicit notes-only role, with durable pending state and input protection. */
export function interactiveDocumentation(pi: ExtensionAPI, root: string): {
  start: (name: string, completion: Completion, ctx: Pick<ExtensionContext, "model" | "ui" | "isIdle">) => void;
} {
  let pending: { name: string; completion: Completion; marker: string; started: boolean; succeeded: boolean } | undefined;
  pi.on("before_agent_start", (event) => {
    if (!pending) return;
    if (!event.prompt.includes(pending.marker)) {
      saveInteractiveCompletion(root, pending.name, { ...pending.completion, documentation: "pending", error: "documentation interrupted by another request" });
      pending = undefined; return;
    }
    pending.started = true;
    pending.succeeded = false;
  });
  pi.on("agent_end", (event) => {
    if (!pending?.started) return;
    const last = [...event.messages].reverse().find((m) => m.role === "assistant");
    pending.succeeded = last?.role === "assistant" && last.stopReason === "stop";
  });
  pi.on("agent_settled", async (_event, ctx) => {
    if (!pending?.started) return;
    const own = pending; pending = undefined;
    const result = await documentCompletion(root, own.completion, async () => own.succeeded);
    saveInteractiveCompletion(root, own.name, result);
    if (result.documentation !== "passed") ctx.ui.notify(`${own.name}: documentation pending — ${result.error}`, "warning");
  });
  return { start(name, completion, ctx) {
    saveInteractiveCompletion(root, name, completion);
    if (completion.documentation === "passed") { ctx.ui.notify(`${name} is already finalized and documented.`, "info"); return; }
    if (!ctx.model) { ctx.ui.notify(`${name} finalized; documentation pending (no model available).`, "warning"); return; }
    if (pending) { ctx.ui.notify(`${name}: documentation pending; another documentation turn is active.`, "warning"); return; }
    const marker = `Documentation attempt: ${randomUUID()}`;
    pending = { name, completion, marker, started: false, succeeded: false };
    pi.sendUserMessage(groupingsMessage(name) + `\n${marker}. Verified identity: ${completion.verifiedIdentity}. Changed files: ${completion.changedFiles.join(", ")}.`,
      ctx.isIdle() ? undefined : { deliverAs: "followUp" });
  } };
}
