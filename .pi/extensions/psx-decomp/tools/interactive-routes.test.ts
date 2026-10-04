import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import extension from "../index.ts";
import { getSessionBaseline } from "./session-baseline.ts";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(check: () => boolean) {
  const end = Date.now() + 8000;
  while (!check() && Date.now() < end) await delay(10);
  assert.ok(check(), "fixture reached the tested boundary");
}
function fixture(t: { after: (f: () => Promise<void>) => void }) {
  const root = mkdtempSync(join(tmpdir(), "interactive-routes-"));
  const cwd = process.cwd();
  for (const path of ["src", "build", "tools/agent"]) mkdirSync(join(root, path), { recursive: true });
  symlinkSync(join(cwd, "node_modules"), join(root, "node_modules"));
  writeFileSync(join(root, "AGENTS.md"), "fixture\n");
  writeFileSync(join(root, "src/f.c"), 'INCLUDE_ASM("original/f", f);\n');
  writeFileSync(join(root, "build/callGraph.json"), JSON.stringify({ functions: [{ name: "f", vram: "0x80010000", container: "exe", decompiled: false, dead: false, handwritten: false, calls: [], calledBy: [] }] }));
  execFileSync("git", ["init", "-q"], { cwd: root });
  const commands = new Map<string, { handler: (args: string, ctx: ExtensionCommandContext) => Promise<void> }>();
  const handlers = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
  const messages: string[] = [], notices: string[] = [];
  const pi = { registerTool: () => {}, registerCommand: (name: string, command: any) => commands.set(name, command),
    on: (name: string, handler: any) => handlers.set(name, [...(handlers.get(name) ?? []), handler]),
    sendUserMessage: (text: string) => messages.push(text), getActiveTools: () => [], setActiveTools: () => {} } as unknown as ExtensionAPI;
  process.chdir(root); extension(pi); process.chdir(cwd);
  const ctx = { signal: undefined, model: undefined, waitForIdle: async () => {}, isIdle: () => true,
    ui: { notify: (text: string) => notices.push(text) } } as unknown as ExtensionCommandContext;
  const event = async (name: string, detail: any = {}) => { for (const handler of handlers.get(name) ?? []) await handler(detail, ctx); };
  t.after(async () => { await event("session_shutdown", { reason: "quit" }); await getSessionBaseline(root); rmSync(root, { recursive: true, force: true }); });
  return { root, ctx, messages, notices, event, command: (name: string, args: string) => commands.get(name)!.handler(args, ctx) };
}

test("actual /decompile and /fix-decomp routes cancel idle waiting, reject concurrency and never dispatch after cancel", async (t) => {
  const f = fixture(t);
  let waiting = false;
  f.ctx.waitForIdle = () => { waiting = true; return new Promise(() => {}); };
  const first = f.command("decompile", "f"); await until(() => waiting);
  await f.command("fix-decomp", "f");
  assert.ok(f.notices.some((n) => n.includes("already running")));
  await f.command("fix-decomp", "--cancel"); await first;
  assert.equal(f.messages.length, 0);
  assert.equal(existsSync(join(f.root, "build/preparation/commands")), false);
  assert.match(readFileSync(join(f.root, "src/f.c"), "utf8"), /INCLUDE_ASM/);
});

test("reload shutdown aborts and awaits the actual npx/tsx preparation and its live child compiler", { skip: process.platform !== "linux" }, async (t) => {
  const f = fixture(t); const pidFile = join(f.root, "compiler.pid");
  writeFileSync(join(f.root, "tools/agent/m2cFunc.ts"), `import {spawn} from 'node:child_process';\nspawn(process.execPath,['-e',${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000)`)}],{stdio:'inherit'});\n`);
  const command = f.command("fix-decomp", "f"); await until(() => existsSync(pidFile));
  const pid = Number(readFileSync(pidFile, "utf8"));
  const running = () => { try { const s = readFileSync(`/proc/${pid}/stat`, "utf8"); return s.slice(s.lastIndexOf(")") + 2)[0] !== "Z"; } catch { return false; } };
  try {
    assert.ok(running()); await f.event("session_shutdown", { reason: "reload" }); await command;
    await until(() => !running()); assert.equal(f.messages.length, 0);
    await f.command("decompile", "f"); assert.equal(f.messages.length, 0, "old extension cannot dispatch after shutdown");
  } finally { if (running()) process.kill(pid, "SIGKILL"); }
});

test("a cancelled preparation does not poison the next real command; a generation error still reaches the solver handoff", async (t) => {
  const f = fixture(t); let waiting = false;
  f.ctx.waitForIdle = () => { waiting = true; return new Promise(() => {}); };
  const first = f.command("fix-decomp", "f"); await until(() => waiting);
  await f.command("decompile", "--cancel"); await first;
  f.ctx.waitForIdle = async () => {};
  writeFileSync(join(f.root, "tools/agent/m2cFunc.ts"), "process.stderr.write('fixture generation failure\\n');process.exitCode=7;\n");
  await f.command("decompile", "f");
  assert.equal(f.messages.length, 1); assert.match(f.messages[0]!, /fixture generation failure/);
  assert.match(f.messages[0]!, /Preserve the current source/);
});
