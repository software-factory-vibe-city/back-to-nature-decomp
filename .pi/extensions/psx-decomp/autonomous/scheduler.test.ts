import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG } from "./config.ts";
import { reconcileState } from "./call-graph.ts";
import { createState } from "./state.ts";
import { completionReady, inScope, modelTierForAttempt, nextMatchingWork, pendingEligible } from "./scheduler.ts";
import type { AutodecompConfig, CallGraphEntry } from "./types.ts";

function entry(name: string, vram: string, priority: number, overrides: Partial<CallGraphEntry> = {}): CallGraphEntry {
  const container = overrides.container ?? "exe";
  return {
    name,
    container,
    source: container === "exe" ? `src/${name}.c` : `src/overlays/${container}/${name}.c`,
    vram,
    size: 16,
    tier: 1,
    priority,
    callerCount: 0,
    calls: [],
    calledBy: [],
    instructionCount: 4,
    decompiled: false,
    handwritten: false,
    dead: false,
    ...overrides,
  };
}

function config(): AutodecompConfig {
  const result = structuredClone(DEFAULT_CONFIG);
  result.matching.models = [
    { model: "normal", thinking: "high", maxAttempts: 2 },
    { model: "strong", thinking: "high", maxAttempts: 1 },
  ];
  return result;
}

test("selects the highest-priority eligible live C function", () => {
  const state = createState("/tmp/project");
  const graph = {
    functions: [
      entry("dead", "0x80010000", 1, { dead: true }),
      entry("gte", "0x80010010", 2, { handwritten: "gte" }),
      entry("later", "0x80010020", 4),
      entry("first", "0x80010030", 3),
    ],
  };
  reconcileState(state, graph);
  assert.equal(nextMatchingWork(state, config())?.functionName, "first");
});

test("work items carry the container, not just the address", () => {
  const state = createState("/tmp/project");
  reconcileState(state, {
    functions: [entry("ovl_31_func_800B82E8", "0x800B82E8", 1, { container: "ovl_31" })],
  });
  const work = nextMatchingWork(state, config());
  assert.equal(work?.functionKey, "ovl_31:0x800B82E8");
  assert.equal(work?.functionContainer, "ovl_31");
  assert.equal(work?.functionVram, "0x800B82E8");
});

test("two overlays at one address select the target the container names", () => {
  const shared = "0x800B7E24";
  const graph = {
    functions: [
      /* Deliberately reversed priority: the wrong entry sorts first, so a
         scheduler that resolved by address alone would return it. */
      entry("ovl_30_func_800B7E24", shared, 1, { container: "ovl_30" }),
      entry("ovl_11_func_800B7E24", shared, 2, { container: "ovl_11" }),
    ],
  };

  const unpinned = createState("/tmp/project");
  reconcileState(unpinned, graph);
  assert.equal(Object.keys(unpinned.functions).length, 2);
  assert.equal(nextMatchingWork(unpinned, config())?.functionName, "ovl_30_func_800B7E24");

  const pinned = createState("/tmp/project");
  reconcileState(pinned, graph);
  const scoped = { ...config(), containers: ["ovl_11"] };
  const work = nextMatchingWork(pinned, scoped);
  assert.equal(work?.functionName, "ovl_11_func_800B7E24");
  assert.equal(work?.functionKey, "ovl_11:0x800B7E24");
});

test("a pinned run neither takes nor waits on another container's work", () => {
  const state = createState("/tmp/project");
  reconcileState(state, {
    functions: [
      entry("func_80010000", "0x80010000", 1),
      entry("ovl_31_func_800B82E8", "0x800B82E8", 2, { container: "ovl_31" }),
    ],
  });
  const scoped = { ...config(), containers: ["ovl_31"] };
  scoped.refinement.projectAtFinalization = false;

  assert.equal(nextMatchingWork(state, scoped)?.functionName, "ovl_31_func_800B82E8");
  assert.deepEqual(pendingEligible(state, scoped).map((fn) => fn.currentName), ["ovl_31_func_800B82E8"]);
  assert.equal(pendingEligible(state).length, 2);

  state.functions["ovl_31:0x800B82E8"]!.status = "matched";
  /* The executable's function is still pending, and the pinned run is still
     done: completion is a statement about this run's scope, not the project. */
  assert.equal(completionReady(state, { functions: [] }, scoped), true);
  assert.equal(nextMatchingWork(state, scoped), undefined);
});

test("container scope membership", () => {
  const fn = { container: "ovl_11" } as any;
  assert.equal(inScope(fn, config()), true);
  assert.equal(inScope(fn, { ...config(), containers: ["ovl_11", "exe"] }), true);
  assert.equal(inScope(fn, { ...config(), containers: ["ovl_30"] }), false);
});

test("maps attempts to configured model tiers", () => {
  const fake = { attemptsThisEpoch: 0 } as any;
  assert.equal(modelTierForAttempt(fake, config()), 0);
  fake.attemptsThisEpoch = 2;
  assert.equal(modelTierForAttempt(fake, config()), 1);
  fake.attemptsThisEpoch = 3;
  assert.equal(modelTierForAttempt(fake, config()), undefined);
});

test("completion requires all eligible functions to be matched", () => {
  const state = createState("/tmp/project");
  const graph = { functions: [entry("a", "0x80010000", 1)] };
  reconcileState(state, graph);
  const cfg = config();
  cfg.refinement.projectAtFinalization = false;
  assert.equal(completionReady(state, graph, cfg), false);
  state.functions["exe:0x80010000"]!.status = "matched";
  assert.equal(completionReady(state, graph, cfg), true);
});
