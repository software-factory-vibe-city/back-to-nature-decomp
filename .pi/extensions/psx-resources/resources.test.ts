import assert from "node:assert/strict";
import { test } from "node:test";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import extension from "./index.ts";
import { bindRequest, TOOL_SPECS, type RoleBinding } from "./tools/specs.ts";
import { boundedReport } from "./tools/index.ts";
import { git } from "../../../tools/agent/resource-extraction/git.ts";

test("resource CLI ownership is distinct and every registry entry is executable", () => {
  const root = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
  assert.equal(TOOL_SPECS.length, 9);
  assert.equal(new Set(TOOL_SPECS.map(s => s.name)).size, 9);
  assert.equal(new Set(TOOL_SPECS.map(s => s.script)).size, 9);
  for (const spec of TOOL_SPECS) {
    assert.match(spec.name, /^psx_resource_/);
    assert.match(readFileSync(join(root, "tools/agent", spec.script), "utf8"), /process\.argv/);
  }
});
test("role binding freezes scope, forbids alternate runs and limits documentation permissions", () => {
  const binding: RoleBinding = { phase: "extraction", request: { input: "extracted/title", maxSteps: 8 }, controller: new AbortController(), calls: 0 };
  assert.deepEqual(bindRequest(binding, "campaign", { input: "extracted/other" }), binding.request);
  assert.throws(() => bindRequest(binding, "extract", {}), /Start/);
  binding.run = "a".repeat(16) + "-" + "b".repeat(16);
  assert.throws(() => bindRequest(binding, "verify", { run: "c".repeat(16) + "-" + "d".repeat(16) }), /another run/);
  assert.throws(() => bindRequest(binding, "inventory", { input: "extracted/other" }), /frozen/);
  binding.phase = "documentation";
  assert.throws(() => bindRequest(binding, "campaign", {}), /Documentation/);
  assert.equal(bindRequest(binding, "document", { action: "bundle" }).run, binding.run);
});
test("repeating the unchanged request stalls and cancels the role rather than looping", () => {
  const binding: RoleBinding = { phase: "extraction", request: {}, run: "a".repeat(16) + "-" + "b".repeat(16), controller: new AbortController(), calls: 0 };
  bindRequest(binding, "analyze", { node: "same" }); bindRequest(binding, "analyze", { node: "same" });
  assert.throws(() => bindRequest(binding, "analyze", { node: "same" }), /stalled/);
  assert.equal(binding.controller.signal.aborted, true);
});
test("model-visible reports obey byte/line limits without losing their persisted pointer", () => {
  const text = boundedReport({ fullReport: "runs/example/logs/full.json", payload: "x".repeat(100000) });
  assert.ok(Buffer.byteLength(text) < 46000); assert.match(text, /Truncated/); assert.match(text, /full\.json/);
  assert.ok(boundedReport(Array.from({ length: 3000 }, () => "line")).split("\n").length < 1000);
});

function tim(): Buffer {
  const bytes = Buffer.alloc(22); bytes.writeUInt32LE(0x10); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(14, 8); bytes.writeUInt16LE(1, 16); bytes.writeUInt16LE(1, 18); bytes.writeUInt16LE(0x1f, 20); return bytes;
}
function parserFixture(root: string): Record<string, string> {
  const base = "tools/agent/resource-extraction/";
  const plugins = readFileSync(join(root, base, "parser-plugins.ts"), "utf8");
  return {
    // Add the fixture without removing plugins already copied into the project.
    [base + "parser-plugins.ts"]: 'import { FIXTURE } from "./parsers/fixture.ts";\n' + plugins.replace("export const EXTRA_PARSERS: AssetParser[] = [", "export const EXTRA_PARSERS: AssetParser[] = [FIXTURE, "),
    [base + "parsers/fixture.ts"]: `import type { AssetParser } from "../registry.ts";
/* Independent synthetic format: four-byte FTR1 magic, one length byte, payload. */
export const FIXTURE: AssetParser = {
 id: "fixture-v1", format: "Fixture", version: 1,
 probe: (b, o) => o + 5 <= b.length && b.toString("ascii", o, o + 4) === "FTR1",
 parse: (b, o) => { if (o + 5 > b.length || b.toString("ascii", o, o + 4) !== "FTR1" || o + 5 + b[o + 4]! > b.length) throw new Error("invalid"); return {length: 5 + b[o + 4]!, metadata: {payloadBytes: b[o + 4]!}}; },
 variants: () => [{}],
 decode: (b, _p, m) => { if (b.length > m) throw new Error("budget"); return [{kind: "raw", extension: "bin", stage: "export", bytes: b, metadata: {}}]; }
};\n`,
    [base + "parsers/fixture.test.ts"]: `import test from "node:test"; import assert from "node:assert/strict"; import { FIXTURE } from "./fixture.ts";
test("positive synthetic layout", () => assert.equal(FIXTURE.parse(Buffer.from([70,84,82,49,2,0,0]), 0).length, 7));
test("truncated extent", () => assert.throws(() => FIXTURE.parse(Buffer.from([70,84,82,49,2]), 0)));
test("bad magic and decode budget", () => { assert.equal(FIXTURE.probe(Buffer.alloc(7), 0), false); assert.throws(() => FIXTURE.decode(Buffer.alloc(7), {}, 6)); });\n`,
  };
}
/** The fake only supplies Pi's host loop: tool computation and verification are
 * real. A delayed queue proves we do not confuse sendUserMessage with a turn. */
function host(root: string, mode: "normal" | "early" | "no-document" | "builder" | "cancel" = "normal") {
  const events = new Map<string, Array<(event: any, ctx: any) => any>>();
  const commands = new Map<string, any>(), tools = new Map<string, any>();
  const messages: any[] = [], prompts: string[] = [], updates: any[] = [], errors: unknown[] = [];
  let activeTools = ["read", "bash", "sentinel"], busy = false;
  const idle: Array<() => void> = [];
  const emit = async (name: string, event: any): Promise<void> => { for (const handler of events.get(name) ?? []) await handler(event, ctx); };
  const ctx = {
    cwd: root, hasUI: false, isIdle: () => !busy,
    waitForIdle: () => busy ? new Promise<void>(r => idle.push(r)) : Promise.resolve(),
    abort: async () => { busy = false; idle.splice(0).forEach(r => r()); },
    ui: { setStatus: () => {}, notify: () => {} },
  } as unknown as ExtensionCommandContext;
  async function permitted(name: string, args: any) {
    for (const handler of events.get("tool_call") ?? []) { const result = await handler({ toolName: name, input: args }, ctx); if (result?.block) throw new Error(result.reason); }
  }
  async function invoke(name: string, args: any) {
    await permitted(name, args);
    const result = await tools.get(name).execute("test", args, new AbortController().signal, (value: any) => updates.push(value), ctx);
    return JSON.parse(result.content[0].text);
  }
  const pi = {
    on: (name: string, handler: any) => events.set(name, [...events.get(name) ?? [], handler]),
    registerCommand: (name: string, command: any) => commands.set(name, command),
    registerTool: (tool: any) => tools.set(tool.name, tool),
    getActiveTools: () => [...activeTools], setActiveTools: (names: string[]) => { activeTools = [...names]; },
    sendMessage: (message: any) => messages.push(message),
    sendUserMessage: (prompt: string, options: any) => {
      prompts.push(prompt); assert.equal(options, undefined);
      setTimeout(async () => {
        busy = true;
        try {
          await emit("turn_start", {});
          if (mode === "cancel") await emit("input", { source: "interactive", text: "stop" });
          if (mode === "builder" && prompt.includes("Prepared baseline:")) {
            assert.deepEqual(activeTools, ["read", "write", "edit", "psx_resource_parser", "psx_resource_inventory", "psx_resource_analyze"]);
            await assert.rejects(permitted("bash", { command: "anything" }), /no shell/);
            await assert.rejects(permitted("write", { path: "src/anything.c" }), /writes only/);
            await assert.rejects(permitted("edit", { path: "../escape.ts" }), /escapes root/);
            for (const [path, text] of Object.entries(parserFixture(root))) {
              await permitted("write", { path });
              mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text);
            }
            const tested = await invoke("psx_resource_parser", { action: "test" });
            assert.equal(tested.outcome, "tested", JSON.stringify(tested)); assert.ok(tested.testsExecuted >= 24);
            const accepted = await invoke("psx_resource_parser", { action: "accept" });
            assert.equal(accepted.outcome, "parser-committed", JSON.stringify(accepted));
          } else {
            const bundle = await invoke("psx_resource_document", { action: "bundle" });
            if (mode === "normal" || mode === "builder") await invoke("psx_resource_iteration", { action: "asset", claims: [{ text: "Input bytes are fingerprinted; resource meanings remain qualified.", evidence: [bundle.facts.evidence[0].id] }] });
          }
          await emit("message_end", { message: { role: "assistant", content: [{ type: "text", text: "bounded role result" }] } });
        } catch (error) { errors.push(error); }
        finally { busy = false; idle.splice(0).forEach(r => r()); await emit("agent_settled", {}); }
      }, 5);
    },
  } as unknown as ExtensionAPI;
  extension(pi);
  return { commands, tools, ctx, messages, prompts, updates, errors, active: () => activeTools, emit };
}
function project(): string {
  const root = mkdtempSync(join(tmpdir(), "resource-tui-"));
  mkdirSync(join(root, "extracted")); mkdirSync(join(root, "tools/agent"), { recursive: true });
  writeFileSync(join(root, "AGENTS.md"), "test project"); writeFileSync(join(root, "extracted/resource"), tim());
  writeFileSync(join(root, ".gitignore"), "build/\nextracted/\n");
  git(root, ["init", "--quiet"]); git(root, ["config", "user.name", "Resource Test"]); git(root, ["config", "user.email", "test@example.invalid"]); git(root, ["config", "commit.gpgsign", "false"]);
  git(root, ["add", "AGENTS.md", ".gitignore"]); git(root, ["commit", "-qm", "fixture"]);
  return root;
}
test("extension import does not launch agents or change host tools", () => {
  const root = project();
  try { const h = host(root); assert.equal(h.prompts.length, 0); assert.deepEqual(h.active(), ["read", "bash", "sentinel"]); assert.ok(h.commands.has("extract-resources")); }
  finally { rmSync(root, { recursive: true, force: true }); }
});
test("same TUI extraction streams tool updates, gates its stop, then documents and restores tools", async () => {
  const root = project();
  try {
    const h = host(root);
    await h.commands.get("extract-resources").handler("--max-iterations 1", h.ctx);
    assert.equal(h.errors.length, 0, String(h.errors)); assert.equal(h.prompts.length, 1);
    assert.match(h.prompts[0]!, /psx-document-resources/);
    assert.ok(h.updates.length); assert.deepEqual(h.active(), ["read", "bash", "sentinel"]);
    assert.ok(h.messages.some(m => /asset-committed/.test(m.content)), JSON.stringify(h.messages));
    assert.match(readFileSync(join(root, "notes/asset-identification.md"), "utf8"), /Source and extraction/);
    assert.match(git(root, ["log", "-1", "--format=%s"]), /Identify TIM asset/);
    const run = readdirSync(join(root, "build/assets/runs"))[0]!;
    assert.ok(readdirSync(join(root, "build/assets/runs", run, "docs")).some(f => f.startsWith("handoff-")));
    assert.ok(readdirSync(join(root, "build/assets/runs", run, "logs")).some(f => f.startsWith("tui-documentation-")));
    assert.deepEqual(readFileSync(join(root, "extracted/resource")), tim());
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("a settled agent without a deterministic stop is not accepted or handed to documentation", async () => {
  const root = project();
  try {
    const h = host(root, "early"); await h.commands.get("extract-resources").handler("--max-iterations 1", h.ctx);
    assert.equal(h.prompts.length, 1); assert.ok(h.messages.some(m => /no verified documentation commit/.test(m.content)));
    assert.deepEqual(h.active(), ["read", "bash", "sentinel"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("documentation failure retains verified extraction and does not fake a proposal", async () => {
  const root = project();
  try {
    const h = host(root, "no-document"); await h.commands.get("extract-resources").handler("--max-iterations 1", h.ctx);
    assert.ok(h.messages.some(m => /no verified documentation commit/.test(m.content)));
    assert.ok(readdirSync(join(root, "build/assets/blobs")).length > 0);
    assert.deepEqual(h.active(), ["read", "bash", "sentinel"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("parser closure dispatches builder; tested commit hot-reloads and discovers the next asset in the same TUI", async () => {
  const root = project(), repository = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
  try {
    const files = ["resource-extraction", "machine-ir", ...TOOL_SPECS.map(s => s.script)];
    for (const file of files) cpSync(join(repository, "tools/agent", file), join(root, "tools/agent", file), { recursive: true });
    mkdirSync(join(root, "tools/agent/matching-reconstruction"));
    for (const file of ["decode.ts", "types.ts", "failure-category.ts"]) cpSync(join(repository, "tools/agent/matching-reconstruction", file), join(root, "tools/agent/matching-reconstruction", file));
    symlinkSync(join(repository, "node_modules"), join(root, "node_modules"), "dir");
    writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
    writeFileSync(join(root, ".gitignore"), "build/\nextracted/\nnode_modules\n");
    writeFileSync(join(root, "extracted/resource"), Buffer.from([70,84,82,49,2,0,0]));
    git(root, ["add", "tools", "package.json", ".gitignore"]); git(root, ["commit", "-qm", "parser plumbing fixture"]);
    const h = host(root, "builder");
    await h.commands.get("extract-resources").handler("--max-iterations 2", h.ctx);
    assert.equal(h.errors.length, 0, String(h.errors)); assert.equal(h.prompts.length, 2, JSON.stringify(h.messages));
    assert.match(h.prompts[0]!, /psx-build-resource-parser/); assert.match(h.prompts[1]!, /psx-document-resources/);
    assert.match(h.prompts[0]!, /PCM WAV/); assert.match(h.prompts[0]!, /preservation, not completed audio\/video decoding/);
    assert.match(h.prompts[0]!, /ISO payload may have lost sector headers/);
    assert.match(h.prompts[0]!, /Verify complete exports from available real inputs/);
    assert.match(h.prompts[0]!, /synthetic fixtures alone are not completion/);
    assert.equal(h.messages.filter(m => /Iteration \d+:.*committed/.test(m.content)).length, 2, JSON.stringify(h.messages));
    assert.match(git(root, ["log", "-2", "--format=%s"]), /Identify Fixture asset.*\nImplement resource parser FIXTURE/s);
    assert.equal(readdirSync(join(root, "build/assets/runs")).length, 2, "parser change creates a new fingerprinted run");
    assert.match(readFileSync(join(root, "notes/asset-identification.md"), "utf8"), /fixture-v1/);
    assert.deepEqual(h.active(), ["read", "bash", "sentinel"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("interactive cancellation earns no iteration commit and restores previous tools", async () => {
  const root = project();
  try {
    const before = git(root, ["rev-parse", "HEAD"]), h = host(root, "cancel");
    await h.commands.get("extract-resources").handler("--max-iterations 1", h.ctx);
    assert.equal(git(root, ["rev-parse", "HEAD"]), before);
    assert.deepEqual(h.active(), ["read", "bash", "sentinel"]);
    assert.ok(h.messages.some(m => /0 accepted iteration/.test(m.content)), JSON.stringify(h.messages));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("noninteractive deterministic mode uses no agent session, model or fork", async () => {
  const root = project();
  try {
    const h = host(root); await h.commands.get("extract-resources").handler("--no-agents", h.ctx);
    assert.equal(h.prompts.length, 0); assert.ok(h.messages.some(m => /supported-fixed-point/.test(m.content)));
    assert.deepEqual(h.active(), ["read", "bash", "sentinel"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
