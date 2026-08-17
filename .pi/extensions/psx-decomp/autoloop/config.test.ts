import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DEFAULT_LOOP_CONFIG, DEFAULT_LADDER, loadLoopConfig, parseLadder } from "./config.ts";
import { parseArgs } from "./commands.ts";

test("the default ladder escalates local -> openrouter -> codex with the configured thinking levels", () => {
  assert.deepEqual(
    DEFAULT_LADDER.map((tier) => `${tier.provider}/${tier.model}:${tier.thinking}`),
    [
      "qwen36-llama/qwen3.6-27b:medium",
      "openrouter/deepseek/deepseek-v4-flash-0731:xhigh",
      // "openrouter/moonshotai/kimi-k3:high",
      "openai-codex/gpt-5.6-sol:xhigh",
    ],
  );
});

test("a ladder entry must name a provider, a model, and a known thinking level", () => {
  assert.throws(() => parseLadder([]), /non-empty/);
  assert.throws(() => parseLadder([{ model: "m" }]), /provider/);
  assert.throws(() => parseLadder([{ provider: "p" }]), /model/);
  assert.throws(() => parseLadder([{ provider: "p", model: "m", thinking: "turbo" }]), /thinking/);
  assert.throws(() => parseLadder([{ provider: "p", model: "m", speed: 1 }]), /unknown field/);
});

test("a ladder entry defaults its label to the model id and its thinking to high", () => {
  assert.deepEqual(parseLadder([{ provider: "p", model: "m" }]), [
    { provider: "p", model: "m", thinking: "high", label: "m" },
  ]);
});

function projectWith(config: Record<string, unknown>): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "autoloop-config-"));
  mkdirSync(join(dir, ".pi"), { recursive: true });
  writeFileSync(join(dir, ".pi", "autoloop.json"), JSON.stringify(config));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("the context ceiling defaults to 350k tokens and is settable", () => {
  assert.equal(DEFAULT_LOOP_CONFIG.compactAtTokens, 350_000);

  const { dir, cleanup } = projectWith({ compactAtTokens: 120_000 });
  try {
    assert.equal(loadLoopConfig(dir).compactAtTokens, 120_000);
  } finally {
    cleanup();
  }
});

test("a zero ceiling turns compaction off, and a bad one is refused", () => {
  const off = projectWith({ compactAtTokens: 0 });
  try {
    assert.equal(loadLoopConfig(off.dir).compactAtTokens, 0);
  } finally {
    off.cleanup();
  }

  for (const bad of [-1, 1.5, "350k"]) {
    const { dir, cleanup } = projectWith({ compactAtTokens: bad });
    try {
      assert.throws(() => loadLoopConfig(dir), /compactAtTokens must be a non-negative integer/);
    } finally {
      cleanup();
    }
  }
});

test("an unknown autoloop config field is refused rather than ignored", () => {
  const { dir, cleanup } = projectWith({ compactAt: 350_000 });
  try {
    assert.throws(() => loadLoopConfig(dir), /unknown field/);
  } finally {
    cleanup();
  }
});

test("command arguments select a target, a limit, or a subcommand", () => {
  assert.deepEqual(parseArgs(""), { action: "run" });
  assert.deepEqual(parseArgs("  "), { action: "run" });
  assert.deepEqual(parseArgs("status"), { action: "status" });
  assert.deepEqual(parseArgs("stop"), { action: "stop" });
  assert.deepEqual(parseArgs("func_80012345"), { action: "run", target: "func_80012345" });
  assert.deepEqual(parseArgs("func_80012345 --max=3"), { action: "run", target: "func_80012345", maxFunctions: 3 });
  assert.deepEqual(parseArgs("--max-functions=7"), { action: "run", maxFunctions: 7 });
  assert.equal(parseArgs("func_1 func_2").action, "usage");
  assert.equal(parseArgs("--max=0").action, "usage");
  assert.equal(parseArgs("--nonsense").action, "usage");
});
