import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LADDER, parseLadder } from "./config.ts";
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
