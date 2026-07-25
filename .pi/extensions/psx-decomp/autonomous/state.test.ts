import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createState, StateStore } from "./state.ts";

test("persists state atomically and keeps a backup", () => {
  const runtime = mkdtempSync(join(tmpdir(), "autodecomp-state-"));
  const store = new StateStore(runtime, "/tmp/project");
  const state = createState("/tmp/project");
  state.status = "running";
  store.save(state);
  state.epoch = 2;
  store.save(state);
  assert.equal(store.load().epoch, 2);
  assert.equal(existsSync(store.backupPath), true);
});
