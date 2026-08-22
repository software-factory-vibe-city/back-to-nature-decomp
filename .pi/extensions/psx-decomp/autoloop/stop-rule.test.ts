import { strict as assert } from "node:assert";
import { test } from "node:test";
import { blockedReading, shouldStop } from "./stop-rule.ts";
import type { ResidualReading } from "../autonomous/gates.ts";
import type { LoopConfig } from "./types.ts";

function config(overrides: Partial<LoopConfig> = {}): LoopConfig {
  return {
    ladder: [{ provider: "p", model: "m", thinking: "high", label: "m" }],
    singleTier: true,
    returnsPerTier: 3,
    maxReturnsPerTier: 8,
    tierMinutes: 25,
    parkAfterStalledMeasurements: 6,
    maxFunctions: 10,
    clearContextBetween: true,
    compactAtTokens: 0,
    handoffSummary: false,
    updateFileGroupings: false,
    commitOnMatch: false,
    commitOnPark: false,
    runtimeDir: "/tmp/does-not-matter",
    approvalsDir: "notes/human-needed-approvals",
    ...overrides,
  };
}

function reading(overrides: Partial<ResidualReading["objective"]> = {}): ResidualReading {
  return {
    objective: { exact: false, controlFlow: 0, population: 0, schedule: 1, allocation: 1, ...overrides },
    work: [],
  };
}

test("a residual with words no source edit can move is blocked, not hard", () => {
  const blocked = blockedReading(reading({ undetermined: 3, blindBlocks: [26, 27] }));
  assert.ok(blocked, "undetermined words in a named block are a blocked reading");
  assert.match(blocked!, /block 26, 27/);
  assert.match(blocked!, /the build's own configuration/);
  /* Undetermined words with no block attributed to them are not a blocked
     verdict: the reading cannot say where they are, so it cannot say the build
     is at fault. */
  assert.equal(blockedReading(reading({ undetermined: 3, blindBlocks: [] })), undefined);
  assert.equal(blockedReading(reading()), undefined);
  assert.equal(blockedReading(null), undefined);
});

test("a blocked reading parks immediately, whatever the counter says", () => {
  const verdict = shouldStop({
    config: config(),
    functionName: "func_stoptest_blocked",
    returns: 1,
    elapsedMs: 0,
    residual: reading({ undetermined: 2, blindBlocks: [26] }),
  });
  assert.equal(verdict.stop, true);
  assert.equal(verdict.parkNow, "blocked");
});

test("the minimum number of returns is a floor, not the decision", () => {
  const verdict = shouldStop({
    config: config(),
    functionName: "func_stoptest_floor",
    returns: 1,
    elapsedMs: 0,
    residual: reading(),
  });
  assert.equal(verdict.stop, false);
  assert.match(verdict.detail, /1 of at least 3/);
});

test("past the floor with no measured history the search keeps going", () => {
  /* No ledger for this name, so nothing is stalled and nothing is closed. The
     old rule parked here on the counter alone; that is the 68%-of-wall-clock
     failure this rule exists to remove. */
  const verdict = shouldStop({
    config: config(),
    functionName: "func_stoptest_nohistory",
    returns: 4,
    elapsedMs: 0,
    residual: reading(),
  });
  assert.equal(verdict.stop, false);
});

test("the wall clock escalates rather than parking", () => {
  const verdict = shouldStop({
    config: config({ tierMinutes: 1 }),
    functionName: "func_stoptest_clock",
    returns: 1,
    elapsedMs: 61_000,
    residual: reading(),
  });
  assert.equal(verdict.stop, true);
  assert.equal(verdict.parkNow, undefined);
  assert.match(verdict.detail, /ceiling is 1/);
});

test("the hard bound still exists, so a turn that stops measuring cannot run forever", () => {
  const verdict = shouldStop({
    config: config({ maxReturnsPerTier: 4 }),
    functionName: "func_stoptest_bound",
    returns: 4,
    elapsedMs: 0,
    residual: reading(),
  });
  assert.equal(verdict.stop, true);
  assert.match(verdict.detail, /hard bound is 4/);
});
