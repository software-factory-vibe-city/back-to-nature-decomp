import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { extractAssets } from "./pipeline.ts";
import { migrateLegacy } from "./migration.ts";
import { canonical, hash, Store } from "./storage.ts";
import { fixture, tim } from "./test-fixtures.ts";

test("explicit migration removes verified legacy copies, preserves edits/unknowns and archives owned control files", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim()); f.put("notes/asset-identification.md", "historical human ledger");
    const store = new Store(f.root), blob = store.blob(tim()), directory = `images/node-${"a".repeat(24)}`;
    const files = ["original.tim", "edited.tim"].map(name => ({ path: `${directory}/${name}`, backing: blob, hash: blob.slice(6), size: tim().length, stage: "extraction" }));
    store.atomic(files[0]!.path, tim()); store.atomic(files[1]!.path, "edited by user"); store.atomic(`${directory}/unrelated.txt`, "keep");
    const run = `${"a".repeat(16)}-${"b".repeat(16)}`, resource = { id: `node-${"a".repeat(24)}`, format: "TIM" };
    const asset = { node: resource.id, category: "images", directory, files, manifest: `runs/${run}/manifest.json` };
    store.json(asset.manifest, { version: 1, nodes: [resource] });
    store.json(`${directory}/asset.json`, { ...asset, resource, note: "Browsable copies; backing blobs and the referenced run manifest remain authoritative. Historical semantic names are unknown." });
    store.json("index.json", { version: 1, assets: [asset] });
    store.json(`requests/${"b".repeat(24)}.json`, { input: "extracted" });
    store.json(`loop/asset-commits/node-${"c".repeat(24)}.json`, { node: `node-${"c".repeat(24)}`, commit: "historical-only" });
    const result = await extractAssets(f.root, { migrateLegacy: true });
    assert.equal(existsSync(store.path(files[0]!.path)), false);
    assert.equal(existsSync(store.path(`${directory}/asset.json`)), false);
    assert.equal(readFileSync(store.path(files[1]!.path), "utf8"), "edited by user");
    assert.equal(readFileSync(store.path(`${directory}/unrelated.txt`), "utf8"), "keep");
    assert.equal(existsSync(store.path("requests")), false); assert.equal(existsSync(store.path(`cache/legacy/requests/${"b".repeat(24)}.json`)), true);
    assert.equal(existsSync(store.path("loop")), false); assert.equal(existsSync(store.path(`cache/legacy/loop/asset-commits/node-${"c".repeat(24)}.json`)), true);
    assert.equal(readFileSync(new URL(`file://${f.root}/notes/asset-identification.md`), "utf8"), "historical human ledger");
    assert.ok(Number((result.migration as any).preservedUnknownOrEdited) > 0);
    await migrateLegacy(store); assert.equal(readFileSync(store.path(`${directory}/unrelated.txt`), "utf8"), "keep");
  } finally { f.cleanup(); }
});
test("legacy sidecar marker cannot authorize removing edited provenance", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim()); const store = new Store(f.root);
    const node = `node-${"c".repeat(24)}`, directory = `images/${node}`, run = `${"c".repeat(16)}-${"d".repeat(16)}`;
    const asset = { node, category: "images", directory, files: [], manifest: `runs/${run}/manifest.json` }, resource = { id: node, format: "TIM" };
    store.json(asset.manifest, { version: 1, nodes: [resource] });
    store.json("index.json", { version: 1, assets: [asset] });
    const edited = { ...asset, resource, note: "Browsable copies; backing blobs and the referenced run manifest remain authoritative. Historical semantic names are unknown.", annotation: "user-added context" };
    store.json(`${directory}/asset.json`, edited);
    const result = await extractAssets(f.root, { migrateLegacy: true });
    assert.deepEqual(store.read(`${directory}/asset.json`), edited);
    assert.ok(Number((result.migration as any).preservedUnknownOrEdited) > 0);
  } finally { f.cleanup(); }
});
test("verified legacy runs archive; unrecognized files and live owners block unsafe cleanup", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim()); await extractAssets(f.root); const store = new Store(f.root);
    const run = `${"a".repeat(16)}-${"b".repeat(16)}`, manifest = { version: 1, runId: run }, value = { manifest, state: { manifestHash: hash(canonical(manifest) + "\n") } }, digest = hash(canonical(value) + "\n");
    store.json(`runs/${run}/snapshots/${digest}.json`, value); store.json(`runs/${run}/current.json`, { snapshot: digest });
    store.atomic(`runs/${run}/unrelated.txt`, "not generated");
    await migrateLegacy(store); assert.equal(existsSync(store.path(`runs/${run}`)), true);
    const { rmSync } = await import("node:fs"); rmSync(store.path(`runs/${run}/unrelated.txt`));
    await migrateLegacy(store); assert.equal(existsSync(store.path(`runs/${run}`)), false); assert.equal(existsSync(store.path(`cache/legacy/runs/${run}`)), true);
    store.atomic("locks/legacy.lock", `${process.pid}\n`); await assert.rejects(migrateLegacy(store), /Live legacy/);
  } finally { f.cleanup(); }
});
