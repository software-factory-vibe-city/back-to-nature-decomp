import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { interactiveDocumentation, interactivePreparationLifecycle, agentCompletion } from "./interactive-preparation.ts";

function fixture(t: { after: (f: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "interactive-documentation-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src")); writeFileSync(join(root, "src/f.c"), "void f(void) {}\n");
  const handlers = new Map<string, (event: any, ctx: any) => Promise<void> | void>();
  const messages: string[] = [];
  const pi = { on: (name: string, handler: any) => handlers.set(name, handler), sendUserMessage: (text: string) => messages.push(text) } as unknown as ExtensionAPI;
  const ctx = { model: {} as any, isIdle: () => true, ui: { notify: () => {} } };
  const documentation = interactiveDocumentation(pi, root);
  const completion = agentCompletion(root, ["src/f.c"]);
  const saved = () => JSON.parse(readFileSync(join(root, "build/preparation/completions/f.json"), "utf8"));
  return { root, handlers, messages, ctx, documentation, completion, saved };
}
test("only the explicit documentation role's successful settlement records completion", async (t) => {
  const f = fixture(t); f.documentation.start("f", f.completion, f.ctx);
  assert.equal(f.saved().documentation, "pending"); assert.match(f.messages[0]!, /psx-post-decompile-documentation/);
  await f.handlers.get("agent_settled")!({}, f.ctx); assert.equal(f.saved().documentation, "pending");
  await f.handlers.get("before_agent_start")!({ prompt: f.messages[0] }, f.ctx);
  await f.handlers.get("agent_end")!({ messages: [{ role: "assistant", stopReason: "stop" }] }, f.ctx);
  await f.handlers.get("agent_settled")!({}, f.ctx); assert.equal(f.saved().documentation, "passed");
});
test("an unrelated run or a model error cannot certify documentation", async (t) => {
  const f = fixture(t); f.documentation.start("f", f.completion, f.ctx);
  await f.handlers.get("before_agent_start")!({ prompt: "unrelated request" }, f.ctx);
  await f.handlers.get("agent_end")!({ messages: [{ role: "assistant", stopReason: "stop" }] }, f.ctx);
  await f.handlers.get("agent_settled")!({}, f.ctx); assert.equal(f.saved().documentation, "pending");
  f.documentation.start("f", f.completion, f.ctx);
  await f.handlers.get("before_agent_start")!({ prompt: f.messages.at(-1) }, f.ctx);
  await f.handlers.get("agent_end")!({ messages: [{ role: "assistant", stopReason: "error" }] }, f.ctx);
  await f.handlers.get("agent_settled")!({}, f.ctx); assert.equal(f.saved().documentation, "pending");
});
test("source drift during a failed documentation turn still invalidates verification", async (t) => {
  const f = fixture(t); f.documentation.start("f", f.completion, f.ctx);
  await f.handlers.get("before_agent_start")!({ prompt: f.messages[0] }, f.ctx);
  writeFileSync(join(f.root, "src/f.c"), "void f(void) { unexpected(); }\n");
  await f.handlers.get("agent_end")!({ messages: [{ role: "assistant", stopReason: "aborted" }] }, f.ctx);
  await f.handlers.get("agent_settled")!({}, f.ctx);
  assert.equal(f.saved().verification, "invalidated"); assert.equal(f.saved().documentation, "pending");
});
test("native lifecycle bridges a supplied agent signal and awaits cleanup before returning cancellation", async (t) => {
  const f = fixture(t), parent = new AbortController();
  const lifecycle = interactivePreparationLifecycle({ on: () => {} } as unknown as ExtensionAPI);
  let started!: () => void, cleaned = false;
  const ready = new Promise<void>((r) => { started = r; });
  const task = lifecycle.run({ ...f.ctx, signal: parent.signal }, async (signal) => {
    await new Promise<void>((resolve) => { signal.addEventListener("abort", () => resolve(), { once: true }); started(); });
    await new Promise((r) => setTimeout(r, 10)); cleaned = true;
    signal.throwIfAborted();
    assert.fail("no dispatch after abort");
  });
  await ready; parent.abort(); await lifecycle.cancel(); await task;
  assert.equal(cleaned, true);
});

test("unavailable documentation models keep a durable pending identity", (t) => {
  const f = fixture(t); f.documentation.start("f", f.completion, { ...f.ctx, model: undefined });
  assert.equal(f.messages.length, 0); assert.equal(f.saved().verifiedIdentity, f.completion.verifiedIdentity);
  assert.equal(f.saved().documentation, "pending");
});
