import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG } from "./config.ts";
import { reconcileState } from "./call-graph.ts";
import { createState } from "./state.ts";
import { completionReady, modelTierForAttempt, nextMatchingWork } from "./scheduler.ts";
import type { AutodecompConfig, CallGraphEntry } from "./types.ts";

function entry(name: string, vram: string, priority: number, overrides: Partial<CallGraphEntry> = {}): CallGraphEntry {
  return {
    name,
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

test("maps attempts to configured model tiers", () => {
  const fn = createState("/tmp/project").functions;
  const fake = { attemptsThisEpoch: 0 } as any;
  assert.equal(modelTierForAttempt(fake, config()), 0);
  fake.attemptsThisEpoch = 2;
  assert.equal(modelTierForAttempt(fake, config()), 1);
  fake.attemptsThisEpoch = 3;
  assert.equal(modelTierForAttempt(fake, config()), undefined);
  void fn;
});

test("completion requires all eligible functions to be matched", () => {
  const state = createState("/tmp/project");
  const graph = { functions: [entry("a", "0x80010000", 1)] };
  reconcileState(state, graph);
  const cfg = config();
  cfg.refinement.projectAtFinalization = false;
  assert.equal(completionReady(state, graph, cfg), false);
  state.functions["0x80010000"].status = "matched";
  assert.equal(completionReady(state, graph, cfg), true);
});
