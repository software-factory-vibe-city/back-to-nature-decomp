import assert from "node:assert/strict";
import test from "node:test";
import {
  containerFirstStrategy,
  dependencyReadySmallFirstStrategy,
  rankWorklist,
  type WorklistEntry,
  type WorklistRankingContext,
} from "./callGraphStrategies.js";

const context: WorklistRankingContext = {
  containerRank: new Map([["exe", 0], ["ovl_11", 1], ["ovl_15", 2]]),
  depthByName: new Map([
    ["exeLarge", 0], ["overlayTiny", 0], ["sdkTiny", 0],
    ["dep", 1], ["caller", 2],
    ["ovl15", 0], ["ovl11", 0], ["exeTie", 0], ["popularOverlay", 0],
  ]),
  maxDepth: 2,
};

function entry(name: string, overrides: Partial<WorklistEntry> = {}): WorklistEntry {
  return {
    name,
    container: "exe",
    tier: 1,
    instructionCount: 10,
    callerCount: 0,
    decompiled: false,
    handwritten: false,
    dead: false,
    ...overrides,
  };
}

function names(entries: WorklistEntry[]): string[] {
  return entries.map((item) => item.name);
}

test("container-first preserves container, tier, tier-3 depth, size, caller precedence", () => {
  const entries = [
    entry("overlayTiny", { container: "ovl_11", instructionCount: 1 }),
    entry("caller", { tier: 3, instructionCount: 1 }),
    entry("sdkTiny", { tier: 2, instructionCount: 1 }),
    entry("dep", { tier: 3, instructionCount: 20 }),
    entry("exeLarge", { instructionCount: 100 }),
    entry("tieHigh", { callerCount: 5 }),
    entry("tieLow"),
  ];
  assert.deepEqual(names(rankWorklist(entries, containerFirstStrategy, context)), [
    "tieHigh", "tieLow", "exeLarge", "sdkTiny", "dep", "caller", "overlayTiny",
  ]);
  assert.equal(entries[0]?.name, "overlayTiny", "ranking must not mutate the input");
});

test("dependency-ready small-first mixes depth-zero tiers and containers, but keeps callees before callers", () => {
  const entries = [
    entry("caller", { tier: 3, instructionCount: 1 }),
    entry("exeLarge", { instructionCount: 50 }),
    entry("dep", { tier: 3, instructionCount: 100 }),
    entry("sdkTiny", { tier: 2, instructionCount: 2 }),
    entry("overlayTiny", { container: "ovl_11", instructionCount: 1 }),
  ];
  assert.deepEqual(names(rankWorklist(entries, dependencyReadySmallFirstStrategy, context)), [
    "overlayTiny", "sdkTiny", "exeLarge", "dep", "caller",
  ]);
});

test("new ranking breaks equal-depth/size ties by callers then container, with unresolved cycles last", () => {
  const entries = [
    entry("ovl15", { container: "ovl_15" }),
    entry("ovl11", { container: "ovl_11" }),
    entry("exeTie"),
    entry("popularOverlay", { container: "ovl_15", callerCount: 2 }),
    entry("cyclic", { tier: 3, instructionCount: 1 }),
  ];
  assert.deepEqual(names(rankWorklist(entries, dependencyReadySmallFirstStrategy, context)), [
    "popularOverlay", "exeTie", "ovl11", "ovl15", "cyclic",
  ]);
});

test("both strategies keep existing exclusions ahead of rank (without changing GTE classification)", () => {
  const entries = [
    entry("matched", { decompiled: true, instructionCount: 0 }),
    entry("asm", { handwritten: "asm", instructionCount: 0 }),
    entry("dead", { dead: true, instructionCount: 0 }),
    entry("gte", { handwritten: "gte", instructionCount: 2 }),
    entry("live", { instructionCount: 4 }),
  ];
  for (const strategy of [containerFirstStrategy, dependencyReadySmallFirstStrategy]) {
    assert.deepEqual(names(rankWorklist(entries, strategy, context)).slice(0, 2), ["gte", "live"]);
  }
});
