import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runPiWorker } from "./worker.ts";

test("captures Pi JSON events, usage, and final assistant text", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "autodecomp-worker-"));
  const bin = join(workspace, "node_modules", ".bin");
  mkdirSync(bin, { recursive: true });
  const fakePi = join(bin, "pi");
  writeFileSync(fakePi, `#!/usr/bin/env node\nconsole.log(JSON.stringify({type:\"turn_start\"}));\nconsole.log(JSON.stringify({type:\"message_end\",message:{id:\"m1\",role:\"assistant\",content:[{type:\"text\",text:\"done\"}],usage:{input:10,output:5,cost:{total:0.01}}}}));\n`);
  chmodSync(fakePi, 0o755);
  const result = await runPiWorker({
    workspace,
    sessionDir: join(workspace, "sessions"),
    mode: "match",
    functionName: "target",
    model: { thinking: "high", maxAttempts: 1 },
    continueSession: false,
    timeoutMs: 5_000,
    idleTimeoutMs: 5_000,
    turnLimit: 10,
  });
  assert.equal(result.code, 0);
  assert.equal(result.usage.turns, 1);
  assert.equal(result.usage.inputTokens, 10);
  assert.equal(result.usage.outputTokens, 5);
  assert.equal(result.usage.costUsd, 0.01);
  assert.equal(result.finalText, "done");
  assert.equal(result.parseErrors, 0);
});
