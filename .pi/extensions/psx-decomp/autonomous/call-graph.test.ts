import assert from "node:assert/strict";
import test from "node:test";
import { createState } from "./state.ts";
import {
  eligible,
  functionKey,
  matchedNeighborHash,
  normalizeVram,
  parseFunctionKey,
  reconcileState,
} from "./call-graph.ts";
import type { CallGraph, CallGraphEntry } from "./types.ts";

function entry(overrides: Partial<CallGraphEntry>): CallGraphEntry {
  return {
    name: "func_80010000",
    container: "exe",
    source: "src/func_80010000.c",
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

test("function keys carry the container and round-trip", () => {
  assert.equal(functionKey("ovl_11", "0x800b7e24"), "ovl_11:0x800B7E24");
  assert.deepEqual(parseFunctionKey("ovl_11:0x800B7E24"), { container: "ovl_11", vram: "0x800B7E24" });
  /* A bare address is not a key. Accepting one would let a caller that never
     learned about containers address an entry that another container also has. */
  assert.throws(() => parseFunctionKey("0x800B7E24"));
});

test("reconciles names by stable key", () => {
  const state = createState("/tmp/project");
  reconcileState(state, { functions: [entry({ name: "old_name" })] });
  reconcileState(state, { functions: [entry({ name: "new_name" })] });
  const fn = state.functions["exe:0x80010000"]!;
  assert.equal(fn.currentName, "new_name");
  assert.equal(fn.container, "exe");
  assert.deepEqual(fn.previousNames, ["old_name"]);
});

test("two overlays sharing a RAM slot are two entries, not one", () => {
  const state = createState("/tmp/project");
  const shared = "0x800B7E24";
  reconcileState(state, {
    functions: [
      entry({ name: "ovl_11_func_800B7E24", container: "ovl_11", vram: shared, source: "src/overlays/ovl_11/ovl_11_func_800B7E24.c" }),
      entry({ name: "ovl_30_func_800B7E24", container: "ovl_30", vram: shared, source: "src/overlays/ovl_30/ovl_30_func_800B7E24.c" }),
    ],
  });
  assert.deepEqual(Object.keys(state.functions).sort(), ["ovl_11:0x800B7E24", "ovl_30:0x800B7E24"]);
  assert.equal(state.functions["ovl_11:0x800B7E24"]!.currentName, "ovl_11_func_800B7E24");
  assert.equal(state.functions["ovl_30:0x800B7E24"]!.currentName, "ovl_30_func_800B7E24");
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
  state.functions["exe:0x80010010"]!.status = "matched";
  const first = matchedNeighborHash("exe:0x80010000", state, graph);
  assert.equal(first.count, 1);
  state.functions["exe:0x80010020"]!.status = "matched";
  const second = matchedNeighborHash("exe:0x80010000", state, graph);
  assert.equal(second.count, 2);
  assert.notEqual(first.hash, second.hash);
});

test("neighbor hash follows a cross-container edge", () => {
  const graph: CallGraph = {
    functions: [
      entry({ name: "ovl_30_func_8012F028", container: "ovl_30", vram: "0x8012F028", calls: ["ovl_11_func_800BCF20"] }),
      entry({ name: "ovl_11_func_800BCF20", container: "ovl_11", vram: "0x800BCF20" }),
    ],
  };
  const state = createState("/tmp/project");
  reconcileState(state, graph);
  assert.equal(matchedNeighborHash("ovl_30:0x8012F028", state, graph).count, 0);
  state.functions["ovl_11:0x800BCF20"]!.status = "matched";
  assert.equal(matchedNeighborHash("ovl_30:0x8012F028", state, graph).count, 1);
});
