import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordedCommand, commandText } from "./recordedCommand.js";

const scratch = () => mkdtempSync(join(tmpdir(), "recorded-command-"));
test("full streams survive failure, without a capture ceiling", async (t) => {
  const root = scratch(); t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = await recordedCommand(process.execPath, ["-e", "process.stdout.write('x'.repeat(200000));process.stderr.write('warning\\n'+'y'.repeat(100000));process.exitCode=7"], root, root, "failure");
  assert.equal(result.status, 7);
  assert.equal(readFileSync(result.stdout).length, 200000);
  assert.equal(readFileSync(result.stderr).length, 100008);
  assert.ok(commandText(result).includes("warning"));
});
test("spawn failure still closes and preserves both streams", async (t) => {
  const root = scratch(); t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = await recordedCommand("/no-such-preparation-command", [], root, root, "missing");
  assert.ok(result.error?.includes("ENOENT")); assert.equal(result.status, -2);
  assert.equal(readFileSync(result.stdout, "utf8"), "");
});
test("cancellation and timeout are distinct bounded outcomes", async (t) => {
  const root = scratch(); t.after(() => rmSync(root, { recursive: true, force: true }));
  const controller = new AbortController(); controller.abort();
  const cancelled = await recordedCommand(process.execPath, ["-e", "throw new Error('must not execute')"], root, root, "cancelled", controller.signal);
  assert.equal(cancelled.cancelled, true); assert.equal(cancelled.timedOut, false); assert.equal(cancelled.status, null);
  const timeout = await recordedCommand(process.execPath, ["-e", "setInterval(()=>{},1000)"], root, root, "timeout", undefined, 50);
  assert.equal(timeout.timedOut, true); assert.equal(timeout.cancelled, false);
});

test("cancelling the npx preparation wrapper also stops its inherited compiler group", { skip: process.platform !== "linux" }, async (t) => {
  const root = scratch(); t.after(() => rmSync(root, { recursive: true, force: true }));
  const pidFile = join(root, "compiler.pid");
  const compiler = `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));setInterval(()=>{},1000)`;
  const runner = new URL("./recordedCommand.ts", import.meta.url).href;
  const script = join(root, "preparer.mts");
  writeFileSync(script, `import {recordedCommand} from ${JSON.stringify(runner)}; await recordedCommand(process.execPath,['-e',${JSON.stringify(compiler)}],process.cwd(),${JSON.stringify(root)},'compiler',undefined,10000,false);`);
  const abort = new AbortController();
  const wrapper = recordedCommand("npx", ["tsx", script], process.cwd(), root, "preparation", abort.signal, 10000);
  let pid: number | undefined;
  const running = () => {
    if (!pid) return false;
    try { const stat = readFileSync(`/proc/${pid}/stat`, "utf8"); return stat.slice(stat.lastIndexOf(")") + 2)[0] !== "Z"; }
    catch { return false; }
  };
  try {
    const deadline = Date.now() + 5000;
    while (!existsSync(pidFile) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    assert.ok(existsSync(pidFile), "the nested compiler actually started");
    pid = Number(readFileSync(pidFile, "utf8")); assert.ok(running());
    abort.abort(); const result = await wrapper;
    const stoppedBy = Date.now() + 1000;
    while (running() && Date.now() < stoppedBy) await new Promise((r) => setTimeout(r, 10));
    assert.equal(result.cancelled, true); assert.equal(running(), false, "no compiler continues after wrapper cancellation");
  } finally {
    abort.abort(); await wrapper;
    if (pid && running()) { try { process.kill(pid, "SIGKILL"); } catch {} }
  }
});
