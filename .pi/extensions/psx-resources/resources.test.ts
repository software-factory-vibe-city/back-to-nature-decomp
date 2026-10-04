import assert from "node:assert/strict";
import { test } from "node:test";
import { cpSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import extension from "./index.ts";
import { bindRequest, TOOL_SPECS, type RoleBinding } from "./tools/specs.ts";
import { boundedReport } from "./tools/index.ts";
import { fixture, readManifest, tim } from "../../../tools/agent/resource-extraction/test-fixtures.ts";
const REPOSITORY = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

test("four focused resource tools have distinct executable ownership and purpose-specific schemas", () => {
  assert.equal(TOOL_SPECS.length, 4); assert.equal(new Set(TOOL_SPECS.map(s => s.script)).size, 4);
  for (const spec of TOOL_SPECS) assert.match(readFileSync(join(REPOSITORY, "tools/agent", spec.script), "utf8"), /process\.argv/);
  const schemas = TOOL_SPECS.map(s => JSON.stringify(s.parameters));
  assert.equal(new Set(schemas).size, 4);
  for (const schema of schemas) { assert.doesNotMatch(schema, /"run"|"resume"|"claims"|"commit"/); }
});
test("parser binding fixes its baseline, owns preparation and has no documentation/commit action", () => {
  const binding: RoleBinding = { baseline: "a".repeat(24), controller: new AbortController(), calls: 0 };
  assert.equal(bindRequest(binding, "parser", { action: "test" }).baseline, binding.baseline);
  assert.throws(() => bindRequest(binding, "parser", { action: "prepare" }), /Controller owns/);
  assert.throws(() => bindRequest(binding, "parser", { action: "test", baseline: "b".repeat(24) }), /Wrong/);
  assert.throws(() => bindRequest(binding, "verify", {}), /Parser work item/);
});
test("model reports are bounded and retain their full-report pointer", () => {
  const report = boundedReport({ fullReport: "build/assets/cache/analysis/full.json", payload: "x".repeat(100000) });
  assert.ok(Buffer.byteLength(report) < 46000); assert.match(report, /Truncated/); assert.match(report, /full\.json/);
  assert.ok(boundedReport(Array.from({ length: 3000 }, () => "line")).split("\n").length < 1000);
});
function project(full = false) {
  const f = fixture(); f.put("AGENTS.md", "fixture project"); f.put("tools/agent/marker", "root"); f.put("extracted/resource", tim()); f.put("package.json", '{"type":"module"}\n');
  if (full) {
    for (const file of ["resource-extraction", "machine-ir", ...TOOL_SPECS.map(s => s.script)]) cpSync(join(REPOSITORY, "tools/agent", file), join(f.root, "tools/agent", file), { recursive: true });
    for (const file of ["decode.ts", "types.ts", "failure-category.ts"]) f.put(`tools/agent/matching-reconstruction/${file}`, readFileSync(join(REPOSITORY, "tools/agent/matching-reconstruction", file)));
    f.put("tools/lib/resourceLocks.ts", readFileSync(join(REPOSITORY, "tools/lib/resourceLocks.ts")));
    symlinkSync(join(REPOSITORY, "node_modules"), join(f.root, "node_modules"), "dir");
  }
  return f;
}
function host(root: string, role?: (h: any) => Promise<void>) {
  const events = new Map<string, Array<(event: any, ctx: any) => any>>(), commands = new Map<string, any>(), tools = new Map<string, any>();
  const messages: any[] = [], prompts: string[] = [], errors: unknown[] = [];
  let active = ["read", "bash", "sentinel"], busy = false;
  const idle: Array<() => void> = [];
  const ctx = { cwd: root, hasUI: false, isIdle: () => !busy, waitForIdle: () => busy ? new Promise<void>(r => idle.push(r)) : Promise.resolve(), abort: async () => { busy = false; idle.splice(0).forEach(r => r()); } } as unknown as ExtensionCommandContext;
  const emit = async (name: string, event: any = {}) => { for (const handler of events.get(name) ?? []) await handler(event, ctx); };
  async function permitted(name: string, args: any) { for (const handler of events.get("tool_call") ?? []) { const result = await handler({ toolName: name, input: args }, ctx); if (result?.block) throw new Error(result.reason); } }
  async function invoke(name: string, args: any) { await permitted(name, args); const result = await tools.get(name).execute("test", args, new AbortController().signal, () => {}, ctx); return JSON.parse(result.content[0].text); }
  const pi = { on: (name: string, handler: any) => events.set(name, [...events.get(name) ?? [], handler]), registerCommand: (name: string, command: any) => commands.set(name, command), registerTool: (tool: any) => tools.set(tool.name, tool), getActiveTools: () => [...active], setActiveTools: (names: string[]) => { active = [...names]; }, sendMessage: (message: any) => messages.push(message), sendUserMessage: (prompt: string) => {
    prompts.push(prompt);
    setTimeout(async () => {
      busy = true;
      try { await emit("turn_start"); await role?.(h); }
      catch (error) { errors.push(error); }
      finally { busy = false; idle.splice(0).forEach(r => r()); await emit("agent_settled"); }
    }, 5);
  } } as unknown as ExtensionAPI;
  extension(pi);
  const h = { commands, tools, ctx, messages, prompts, errors, invoke, permitted, emit, active: () => active };
  return h;
}
test("known-format command runs zero model turns, preserves host tools, creates no request/run logs", async () => {
  const f = project();
  try {
    const h = host(f.root); assert.equal(h.prompts.length, 0); assert.deepEqual(h.active(), ["read", "bash", "sentinel"]);
    await h.commands.get("extract-resources").handler("", h.ctx);
    assert.equal(h.prompts.length, 0); assert.equal(h.errors.length, 0); assert.ok(h.messages.some(m => /"outcome": "validated"/.test(m.content)), JSON.stringify(h.messages));
    assert.equal(readManifest(f.root).assets.length, 1); assert.deepEqual(h.active(), ["read", "bash", "sentinel"]);
    for (const forbidden of ["requests", "runs", "logs", "loop"]) assert.ok(!readdirSync(join(f.root, "build/assets")).includes(forbidden));
    await h.commands.get("extract-resources").handler("--force", h.ctx); assert.equal(h.prompts.length, 0);
    assert.ok(h.commands.has("build-resource-parser"));
  } finally { f.cleanup(); }
});
test("unsupported parser closure never automatically dispatches a builder", async () => {
  const f = project();
  try { f.put("extracted/resource", "unknown"); const h = host(f.root); await h.commands.get("extract-resources").handler("", h.ctx); assert.equal(h.prompts.length, 0); assert.equal(readManifest(f.root).assets.length, 0); }
  finally { f.cleanup(); }
});
test("one explicit parser work item loads one skill; tested plugin hot-loads through normal extraction", async () => {
  const f = project(true);
  try {
    const h = host(f.root, async h => {
      await assert.rejects(h.permitted("bash", {}), /no shell/);
      await assert.rejects(h.permitted("write", { path: "src/anything.c" }), /writes only/);
      await assert.rejects(h.permitted("edit", { path: "../escape.ts" }), /escapes root/);
      const base = "tools/agent/resource-extraction/", plugins = readFileSync(join(f.root, base, "parser-plugins.ts"), "utf8");
      f.put(base + "parser-plugins.ts", 'import { FIXTURE } from "./parsers/fixture.ts";\n' + plugins.replace("export const EXTRA_PARSERS: AssetParser[] = [", "export const EXTRA_PARSERS: AssetParser[] = [FIXTURE, "));
      f.put(base + "parsers/fixture.ts", `import type { AssetParser } from "../registry.ts";
export const FIXTURE: AssetParser = { id: "fixture-v1", format: "Fixture", version: 1,
 probe: (b,o) => o+5<=b.length && b.toString("ascii",o,o+4)==="FTR1",
 parse: (b,o) => { if (o+5>b.length || b.toString("ascii",o,o+4)!=="FTR1" || o+5+b[o+4]!>b.length) throw new Error("invalid"); return {length:5+b[o+4]!,metadata:{}}; },
 variants: () => [{}], decode: (b,_v,m) => { if(b.length>m)throw new Error("budget"); return [{kind:"raw",extension:"bin",stage:"export",bytes:b,metadata:{}}]; } };\n`);
      f.put(base + "parsers/fixture.test.ts", `import test from "node:test"; import assert from "node:assert/strict"; import { FIXTURE } from "./fixture.ts";
test("layout",()=>assert.equal(FIXTURE.parse(Buffer.from([70,84,82,49,2,0,0]),0).length,7));
test("truncated",()=>assert.throws(()=>FIXTURE.parse(Buffer.from([70,84,82,49,2]),0)));
test("budget",()=>assert.throws(()=>FIXTURE.decode(Buffer.alloc(7),{},1)));\n`);
      const tested = await h.invoke("psx_resource_parser", { action: "test" }); assert.equal(tested.outcome, "tested", JSON.stringify(tested));
      const integrated = await h.invoke("psx_resource_extract", {}); assert.equal(integrated.assets, 1, JSON.stringify(integrated));
      const accepted = await h.invoke("psx_resource_parser", { action: "accept" }); assert.equal(accepted.outcome, "parser-tested", JSON.stringify(accepted));
    });
    f.put("extracted/resource", Buffer.from([70,84,82,49,2,0,0]));
    await h.commands.get("build-resource-parser").handler("Implement the independently specified FTR1 fixture", h.ctx);
    assert.equal(h.prompts.length, 1); assert.equal(h.errors.length, 0, String(h.errors));
    assert.equal(h.prompts[0]!.split("# Build a resource parser").length, 2);
    assert.ok(h.messages.some(m => /capability tested/.test(m.content)), JSON.stringify(h.messages));
    assert.equal(readManifest(f.root).assets[0]!.format, "Fixture"); assert.deepEqual(h.active(), ["read", "bash", "sentinel"]);
  } finally { f.cleanup(); }
});
test("cancelled or unfinished parser work retains drafts and restores tools without auto-retry", async () => {
  const f = project(true);
  try {
    const h = host(f.root, async h => { f.put("tools/agent/resource-extraction/parsers/draft.ts", "export const unfinished = 1;\n"); await h.emit("input", { source: "interactive", text: "stop" }); });
    await h.commands.get("build-resource-parser").handler("Investigate an unknown format", h.ctx);
    assert.equal(h.prompts.length, 1); assert.match(readFileSync(join(f.root, "tools/agent/resource-extraction/parsers/draft.ts"), "utf8"), /unfinished/);
    assert.deepEqual(h.active(), ["read", "bash", "sentinel"]);
  } finally { f.cleanup(); }
});
