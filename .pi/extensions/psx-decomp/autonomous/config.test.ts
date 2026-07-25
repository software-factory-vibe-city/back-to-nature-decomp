import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig } from "./config.ts";

test("loads defaults and resolves the runtime directory", () => {
  const root = mkdtempSync(join(tmpdir(), "autodecomp-config-"));
  const config = loadConfig(root);
  assert.equal(config.parallelism, 1);
  assert.equal(config.runtimeDir, join(root, "run_output", "autodecomp"));
});

test("rejects unknown configuration fields", () => {
  const root = mkdtempSync(join(tmpdir(), "autodecomp-config-"));
  mkdirSync(join(root, ".pi"));
  writeFileSync(join(root, ".pi", "autodecomp.json"), JSON.stringify({ unexpected: true }));
  assert.throws(() => loadConfig(root), /unknown field/);
});
