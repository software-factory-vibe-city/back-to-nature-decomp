import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG } from "../autonomous/config.ts";
import { emptyState, withLoopExemptions } from "./state.ts";
import { KEEP_GOING, escalationMessage, nudgeMessage, openingMessage } from "./prompts.ts";

test("a parked function is exempted from the include-asm rule, and nothing else is", () => {
  const state = emptyState();
  state.parked.func_80012345 = {
    functionName: "func_80012345",
    reason: "escalation-exhausted",
    parkedAt: "2026-08-09T00:00:00.000Z",
    reachedTier: "gpt-5.6-sol",
    lastReport: "",
    findings: [],
  };
  const config = withLoopExemptions(DEFAULT_CONFIG, state);
  assert.deepEqual(config.sourcePolicy.allowlist.func_80012345, ["include-asm"]);
  assert.equal(config.sourcePolicy.allowlist.func_80099999, undefined);
});

test("an agent-approved exemption is honoured by the loop and merged with existing entries", () => {
  const state = emptyState();
  state.approvals.func_80012345 = {
    functionName: "func_80012345",
    kinds: ["embedded-asm"],
    approvedAt: "2026-08-09T00:00:00.000Z",
    approvedBy: "gpt-5.6-sol",
    rationale: "documented exception class",
  };
  const base = {
    ...DEFAULT_CONFIG,
    sourcePolicy: { ...DEFAULT_CONFIG.sourcePolicy, allowlist: { func_80012345: ["register-asm"] } },
  };
  const config = withLoopExemptions(base, state);
  assert.deepEqual(config.sourcePolicy.allowlist.func_80012345.sort(), ["embedded-asm", "register-asm"]);
});

test("loop exemptions never mutate the config they were derived from", () => {
  const state = emptyState();
  state.parked.func_80012345 = {
    functionName: "func_80012345",
    reason: "escalation-exhausted",
    parkedAt: "2026-08-09T00:00:00.000Z",
    reachedTier: "kimi-k3",
    lastReport: "",
    findings: [],
  };
  withLoopExemptions(DEFAULT_CONFIG, state);
  assert.deepEqual(DEFAULT_CONFIG.sourcePolicy.allowlist, {});
});

test("the first tier opens a fresh decompilation and every later tier resumes the attempt", () => {
  assert.match(openingMessage("func_80012345"), /Mode: fresh decompilation/);
  assert.match(escalationMessage("func_80012345", "kimi-k3", "report"), /Mode: resume\/fix/);
  assert.match(escalationMessage("func_80012345", "kimi-k3", "report"), /you are now kimi-k3/);
});

test("every non-matching return carries the same nudge", () => {
  assert.ok(nudgeMessage("report").startsWith(KEEP_GOING));
  assert.ok(escalationMessage("func_80012345", "kimi-k3", "report").includes(KEEP_GOING));
  /* The nudge states the four-step protocol, not just encouragement: a turn told
   * only to keep going spends its context reasoning forward from the last
   * report instead of producing a measurement. */
  assert.match(KEEP_GOING, /there is clean C that matches this function 100%/);
  assert.match(KEEP_GOING, /One turn is one experiment/);
  for (const step of ["OBSERVE", "HYPOTHESISE", "ACT", "MEASURE"]) {
    assert.match(KEEP_GOING, new RegExp(step), `the nudge must name the ${step} step`);
  }
});
