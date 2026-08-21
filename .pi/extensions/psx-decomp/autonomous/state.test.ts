import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createState, migrateState, StateStore } from "./state.ts";

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

/**
 * A schema-1 state file, as the controller wrote them before containers: the
 * `functions` map keyed by bare VRAM, no container on any entry, and the active
 * target named by address.
 */
function legacyState(projectRoot: string): Record<string, unknown> {
  return {
    schemaVersion: 1,
    projectRoot,
    status: "paused",
    updatedAt: "2026-08-01T00:00:00.000Z",
    startedAt: "2026-07-31T00:00:00.000Z",
    epoch: 3,
    baselineHead: "abc123",
    baselineTree: "def456",
    graphHash: "hash",
    matchesSinceTargeted: 4,
    matchesSinceProject: 9,
    functions: {
      "0x8001FE6C": {
        vram: "0x8001FE6C",
        currentName: "func_8001FE6C",
        previousNames: ["old_name"],
        status: "matched",
        priority: 1,
        tier: 1,
        graphDecompiled: true,
        dead: false,
        handwritten: false,
        attempts: ["attempt-1"],
        attemptsThisEpoch: 2,
        matchedAt: "2026-07-31T12:00:00.000Z",
        lastNeighborHash: "n1",
      },
      "0x80022794": {
        vram: "0x80022794",
        currentName: "func_80022794",
        previousNames: [],
        status: "parked",
        priority: 40,
        tier: 2,
        graphDecompiled: false,
        dead: false,
        handwritten: false,
        attempts: [],
        attemptsThisEpoch: 4,
        parkedReason: "Attempt budget exhausted for this epoch",
      },
    },
    attempts: {
      "attempt-1": {
        id: "attempt-1",
        mode: "match",
        functionVram: "0x8001FE6C",
        functionName: "func_8001FE6C",
        thinking: "high",
        modelTier: 0,
        startedAt: "2026-07-31T11:00:00.000Z",
        sessionDir: "/run/sessions/1",
        patchPath: "/run/patches/1.patch",
        status: "passed",
      },
    },
    activeFunctionVram: "0x80022794",
    totalUsage: { turns: 12, inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4, costUsd: 5 },
  };
}

test("migrates a schema-1 state file without losing anything", () => {
  const runtime = mkdtempSync(join(tmpdir(), "autodecomp-migrate-"));
  const root = "/tmp/project";
  const legacy = legacyState(root);
  writeFileSync(join(runtime, "state.json"), `${JSON.stringify(legacy, null, 2)}\n`);

  const migrated = new StateStore(runtime, root).load();

  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(Object.keys(migrated.functions).sort(), ["exe:0x8001FE6C", "exe:0x80022794"]);

  /* Every field of every entry survives; only the key and the container move. */
  for (const [oldKey, before] of Object.entries(legacy.functions as Record<string, Record<string, unknown>>)) {
    const after = migrated.functions[`exe:${oldKey}`]!;
    assert.equal(after.container, "exe");
    for (const [field, value] of Object.entries(before)) {
      assert.deepEqual((after as unknown as Record<string, unknown>)[field], value, `${oldKey}.${field}`);
    }
  }

  /* Attempts keep their identifiers and their recorded paths, so a run's whole
     history stays reachable across the migration. */
  const attempt = migrated.attempts["attempt-1"]!;
  assert.equal(attempt.functionContainer, "exe");
  assert.equal(attempt.sessionDir, "/run/sessions/1");
  assert.equal(attempt.patchPath, "/run/patches/1.patch");
  assert.deepEqual(migrated.functions["exe:0x8001FE6C"]!.attempts, ["attempt-1"]);

  assert.equal(migrated.activeFunctionKey, "exe:0x80022794");
  assert.equal((migrated as unknown as Record<string, unknown>).activeFunctionVram, undefined);

  /* Counters, budget and baselines are carried, not reset. */
  assert.equal(migrated.epoch, 3);
  assert.equal(migrated.matchesSinceTargeted, 4);
  assert.equal(migrated.matchesSinceProject, 9);
  assert.equal(migrated.baselineHead, "abc123");
  assert.equal(migrated.baselineTree, "def456");
  assert.equal(migrated.totalUsage.turns, 12);
  assert.equal(migrated.totalUsage.costUsd, 5);
});

test("migration is idempotent and refuses a schema it does not know", () => {
  const root = "/tmp/project";
  const once = migrateState(legacyState(root) as never);
  assert.deepEqual(migrateState(once), once);
  assert.throws(() => migrateState({ ...legacyState(root), schemaVersion: 99 } as never), /Unsupported state schema 99/);
});
