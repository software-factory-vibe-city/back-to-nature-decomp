import assert from "node:assert/strict";
import test from "node:test";
import { createState } from "./state.ts";
import { eligible, matchedNeighborHash, normalizeVram, reconcileState } from "./call-graph.ts";
import type { CallGraph, CallGraphEntry } from "./types.ts";

function entry(overrides: Partial<CallGraphEntry>): CallGraphEntry {
  return {
    name: "func_80010000",
    vram: "0x80010000",
    size: 16,
    tier: 1,
    priority: 1,
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

test("normalizes VRAM and excludes dead and handwritten functions", () => {
  assert.equal(normalizeVram("0x8001abcd"), "0x8001ABCD");
  assert.equal(eligible(entry({})), true);
  assert.equal(eligible(entry({ dead: true })), false);
  assert.equal(eligible(entry({ handwritten: "gte" })), false);
});

test("reconciles names by stable VRAM", () => {
  const state = createState("/tmp/project");
  reconcileState(state, { functions: [entry({ name: "old_name" })] });
  reconcileState(state, { functions: [entry({ name: "new_name" })] });
  const fn = state.functions["0x80010000"];
  assert.equal(fn.currentName, "new_name");
  assert.deepEqual(fn.previousNames, ["old_name"]);
});

test("neighbor hash includes only supervisor-accepted matches", () => {
  const graph: CallGraph = {
    functions: [
      entry({ name: "a", vram: "0x80010000", calls: ["b", "c"] }),
      entry({ name: "b", vram: "0x80010010" }),
      entry({ name: "c", vram: "0x80010020" }),
    ],
  };
  const state = createState("/tmp/project");
  reconcileState(state, graph);
  state.functions["0x80010010"].status = "matched";
  const first = matchedNeighborHash("0x80010000", state, graph);
  assert.equal(first.count, 1);
  state.functions["0x80010020"].status = "matched";
  const second = matchedNeighborHash("0x80010000", state, graph);
  assert.equal(second.count, 2);
  assert.notEqual(first.hash, second.hash);
});
