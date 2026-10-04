import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { extractAssets, executeResource } from "./pipeline.ts";
import { fixture, readManifest, tim } from "./test-fixtures.ts";
import { Store } from "./storage.ts";

test("archive and extracted-member occurrences share one flat image, all origins retained", async () => {
  const f = fixture();
  try {
    const bytes = tim(); f.put("extracted/archive", Buffer.concat([Buffer.from([1, 2, 3]), bytes])); f.put("extracted/member", bytes);
    const result = await extractAssets(f.root), m = readManifest(f.root), store = new Store(f.root);
    assert.equal(result.resourceNodes, 2); assert.equal(result.assets, 1); assert.equal(result.exports, 1);
    assert.equal((result.statistics as any).decodes, 1);
    const forced = await extractAssets(f.root, { force: true });
    assert.equal((forced.statistics as any).decodes, 1); assert.equal((forced.statistics as any).replays, 1);
    assert.deepEqual(readManifest(f.root), m);
    assert.equal(m.assets[0]!.occurrences.length, 2);
    const files = readdirSync(store.path("extracted/images")); assert.equal(files.length, 1); assert.match(files[0]!, /asset-.*-bank-0-.*\.ppm$/);
    assert.match(readFileSync(store.path(`extracted/images/${files[0]}`), "ascii"), /^P6\n1 1\n255\n/);
    assert.ok(m.artifacts.some(a => a.extension === "rgba")); assert.ok(m.artifacts.some(a => a.extension === "stp"));
    assert.deepEqual(store.bytes(m.assets[0]!.raw), bytes);
    for (const category of ["images", "sound", "models", "video", "data"]) assert.equal(existsSync(store.path(category)), false);
    assert.equal((await executeResource("verify", f.root)).outcome, "validated");
  } finally { f.cleanup(); }
});
test("equal previews do not erase distinct native TIM metadata/content", async () => {
  const f = fixture();
  try {
    const a = tim(), b = tim(); b.writeUInt16LE(1, 12); // VRAM x differs; rendered pixels do not.
    f.put("extracted/a", a); f.put("extracted/b", b); await extractAssets(f.root);
    const m = readManifest(f.root); assert.equal(m.assets.length, 2);
    assert.equal(new Set(m.assets.flatMap(a => a.files.map(f => f.hash))).size, 1);
    assert.equal(new Set(m.assets.flatMap(a => a.files.map(f => f.path))).size, 2);
  } finally { f.cleanup(); }
});
test("edited/missing public exports regenerate without changing backing data or decoding again", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim()); await extractAssets(f.root); const m = readManifest(f.root), store = new Store(f.root), file = m.assets[0]!.files[0]!;
    const bytes = store.bytes(file.backing); f.put(`build/assets/${file.path}`, "edited");
    assert.deepEqual(store.bytes(file.backing), bytes); await assert.rejects(executeResource("verify", f.root), /Presented asset hash/);
    const repaired = await extractAssets(f.root); assert.equal((repaired.statistics as any).decodes, 0); assert.deepEqual(readFileSync(store.path(file.path)), bytes);
    rmSync(store.path(file.path)); await extractAssets(f.root); assert.deepEqual(readFileSync(store.path(file.path)), bytes);
  } finally { f.cleanup(); }
});
test("narrow selection replaces the active catalog and removes only owned stale exports", async () => {
  const f = fixture();
  try {
    f.put("extracted/a", tim(2)); f.put("extracted/b", tim(3)); await extractAssets(f.root); const store = new Store(f.root);
    assert.equal(readdirSync(store.path("extracted/images")).length, 2);
    f.put("build/assets/extracted/images/unrelated.txt", "keep");
    await extractAssets(f.root, { input: "extracted/a" }); const m = readManifest(f.root);
    assert.equal(m.inputs.length, 1); assert.equal(m.assets.length, 1); assert.equal(readdirSync(store.path("extracted/images")).length, 2);
    assert.equal(readFileSync(store.path("extracted/images/unrelated.txt"), "utf8"), "keep");
    assert.equal(store.read<any>("index.json").assets.length, 1);
  } finally { f.cleanup(); }
});
test("publication crash after manifest is detected; rerun repairs notes/index and prunes interrupted copies", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim(2)); await extractAssets(f.root); const store = new Store(f.root), old = readManifest(f.root).assets[0]!.files[0]!.path;
    f.put("extracted/resource", tim(3));
    await assert.rejects(extractAssets(f.root, {}, undefined, undefined, { publicationStep: stage => { if (stage === "manifest") throw new Error("crash"); } }), /crash/);
    await assert.rejects(executeResource("verify", f.root), /index\/provenance mismatch/);
    assert.equal(existsSync(store.path(old)), true, "previous public result retained during incomplete publication");
    await extractAssets(f.root); assert.equal((await executeResource("verify", f.root)).outcome, "validated");
    assert.equal(existsSync(store.path(old)), false); assert.equal(existsSync(store.path("cache/publication.json")), false);
  } finally { f.cleanup(); }
});
test("publication crash before manifest keeps the old authoritative result and recovers owned orphan copies", async () => {
  const f = fixture();
  try {
    f.put("extracted/a", tim()); await extractAssets(f.root); const old = readManifest(f.root), store = new Store(f.root);
    f.put("extracted/b", tim(3));
    await assert.rejects(extractAssets(f.root, {}, undefined, undefined, { publicationStep: stage => { if (stage === "exports") throw new Error("crash"); } }), /crash/);
    assert.deepEqual(readManifest(f.root), old);
    await extractAssets(f.root, { input: "extracted/a" });
    assert.equal(readdirSync(store.path("extracted/images")).length, 1); assert.equal((await executeResource("verify", f.root)).outcome, "validated");
  } finally { f.cleanup(); }
});
test("publication does not follow a symlink out of the flat category directory", async () => {
  const f = fixture(), outside = fixture();
  try {
    f.put("extracted/resource", tim()); const store = new Store(f.root);
    symlinkSync(outside.root, store.path("extracted"), "dir");
    await assert.rejects(extractAssets(f.root), /Symlink/); assert.deepEqual(readdirSync(outside.root), ["extracted"]);
  } finally { f.cleanup(); outside.cleanup(); }
});
