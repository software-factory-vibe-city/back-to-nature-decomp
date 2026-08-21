import assert from "node:assert/strict";
import test from "node:test";
import { AutodecompController, parseContainerArgs, statusText } from "./controller.ts";
import { DEFAULT_CONFIG } from "./config.ts";
import { createState } from "./state.ts";
import { reconcileState } from "./call-graph.ts";
import type { CallGraphEntry } from "./types.ts";

const PROJECT_ROOT = new URL("../../../..", import.meta.url).pathname;

function entry(name: string, container: string, vram: string): CallGraphEntry {
  return {
    name,
    container,
    source: container === "exe" ? `src/${name}.c` : `src/overlays/${container}/${name}.c`,
    vram,
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
  };
}

test("--container accepts repetition and comma lists, and refuses a bare flag", () => {
  assert.equal(parseContainerArgs(["--once"]), undefined);
  assert.deepEqual(parseContainerArgs(["--container", "ovl_11"]), ["ovl_11"]);
  assert.deepEqual(parseContainerArgs(["--container", "ovl_11", "--container", "ovl_30"]), ["ovl_11", "ovl_30"]);
  assert.deepEqual(parseContainerArgs(["--container", "ovl_11,ovl_30,ovl_11"]), ["ovl_11", "ovl_30"]);
  assert.throws(() => parseContainerArgs(["--container"]), /requires a container id/);
  assert.throws(() => parseContainerArgs(["--container", "--once"]), /requires a container id/);
});

test("a --container run overrides the configured scope without editing it", () => {
  /* The controller only reads configuration in its constructor, so this is the
     whole of the override: one run pinned, the project config untouched. */
  const unpinned = new AutodecompController(PROJECT_ROOT);
  assert.equal(unpinned.config.containers, DEFAULT_CONFIG.containers);

  const pinned = new AutodecompController(PROJECT_ROOT, { containers: ["ovl_31"] });
  assert.deepEqual(pinned.config.containers, ["ovl_31"]);
  assert.equal(unpinned.config.containers, DEFAULT_CONFIG.containers);
});

test("the status line names the scope and the active target's container", () => {
  const state = createState(PROJECT_ROOT);
  reconcileState(state, {
    functions: [
      entry("func_80010000", "exe", "0x80010000"),
      entry("ovl_31_func_800B82E8", "ovl_31", "0x800B82E8"),
    ],
  });
  state.activeFunctionKey = "ovl_31:0x800B82E8";

  assert.match(statusText(state), /all containers/);
  assert.match(statusText(state), /Active: ovl_31_func_800B82E8 \(ovl_31:0x800B82E8\)/);

  const scoped = { ...DEFAULT_CONFIG, containers: ["ovl_31"] };
  assert.match(statusText(state, scoped), /containers ovl_31/);
  /* Pending counts this run's own work, not the project's. */
  assert.match(statusText(state, scoped), /pending 1/);
  assert.match(statusText(state), /pending 2/);
});
