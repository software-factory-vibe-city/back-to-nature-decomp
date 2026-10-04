import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractAssets, executeResource, verifyManifest } from "./pipeline.ts";
import { PARSERS } from "./registry.ts";
import { Store } from "./storage.ts";
import { fixture, readManifest } from "./test-fixtures.ts";
import { xaEdc } from "./parsers/xa.ts";
// Synthetic form 1 sectors from the published CD-ROM XA layout, not game bytes.
function sector(stride: number, frame: number): Buffer {
  const bytes = Buffer.alloc(stride), subheader = stride === 2352 ? 16 : 0;
  if (stride === 2352) { bytes.fill(0xff, 1, 11); bytes.set([0, 2, frame, 2], 12); }
  bytes.set([1, 0, 0x08, 0, 1, 0, 0x08, 0], subheader); bytes[subheader + 8] = 0x90 + frame;
  bytes.writeUInt32LE(xaEdc(bytes, subheader, 8 + 2048), subheader + 8 + 2048); return bytes;
}
for (const stride of [2352, 2336]) test(`embedded XA ${stride}: bounded metadata replays through extraction/cache`, async () => {
  const f = fixture();
  try {
    const sectors = [sector(stride, 1), sector(stride, 2)], chain = Buffer.concat(sectors), prefix = Buffer.from([0x31, 0x72, 0x93]), trailing = Buffer.alloc(100);
    const original = Buffer.concat([prefix, chain, trailing]); f.put("extracted/container", original);
    assert.equal(PARSERS.parse("xa-v1", original, prefix.length).metadata.trailingBytes, trailing.length);
    const first = await extractAssets(f.root), m = readManifest(f.root), store = new Store(f.root), asset = m.nodes.find(n => n.kind === "resource")!;
    assert.equal(first.resourceNodes, 1); assert.equal(first.candidateNodes, 0);
    assert.deepEqual(asset.source, { node: m.inputs[0]!.id, offset: prefix.length, length: chain.length, coordinate: "file-byte" });
    assert.deepEqual(store.bytes(asset.blob), chain); assert.equal(asset.metadata.trailingBytes, 0);
    const decoded = m.artifacts.find(a => a.parameters.kind === "xa-data")!, payloadOffset = stride === 2352 ? 24 : 8;
    assert.deepEqual(store.bytes(decoded.path), Buffer.concat(sectors.map(b => b.subarray(payloadOffset, payloadOffset + 2048))));
    assert.equal((await executeResource("verify", f.root)).outcome, "validated");
    const warm = await extractAssets(f.root); assert.equal((warm.statistics as any).parses, 0); assert.deepEqual(readManifest(f.root), m);
    asset.metadata.trailingBytes = trailing.length; assert.throws(() => verifyManifest(store, m), /Parser node extent\/metadata/);
  } finally { f.cleanup(); }
});

test("weak stripped XA signature plus zero padding remains a candidate, never an export", async () => {
  const f = fixture();
  try {
    const weak = Buffer.concat([sector(2336, 1), Buffer.alloc(2336 * 2)]);
    f.put("extracted/archive", weak);
    assert.equal(PARSERS.parse("xa-v1", weak, 0).discovery, "candidate");
    const first = await extractAssets(f.root), m = readManifest(f.root), store = new Store(f.root);
    assert.equal(first.resourceNodes, 0); assert.equal(first.candidateNodes, 1);
    assert.deepEqual(m.assets, []); assert.equal(m.nodes.find(n => n.kind === "resource")!.stages.discovery, "candidate");
    assert.equal(m.artifacts.filter(a => a.processor === "xa-v1").length, 0);
    assert.ok(m.unresolved.some(u => u.outcome === "candidate" && u.reason.includes("Weak format signature")));
    assert.equal(existsSync(resolve(f.root, "build/assets/extracted/data")), false);
    assert.match(readFileSync(resolve(f.root, "notes/asset-provenance.md"), "utf8"), /0 validated source occurrences; 1 unpromoted candidate/);
    assert.equal((await executeResource("verify", f.root)).outcome, "validated");
    const warm = await extractAssets(f.root); assert.equal((warm.statistics as any).parses, 0); assert.deepEqual(readManifest(f.root), m);
    m.nodes.find(n => n.kind === "resource")!.stages.discovery = "validated";
    assert.throws(() => verifyManifest(store, m), /discovery failed replay/);
    // Sync/MSF-backed raw data, and two typed stripped sectors, still publish.
    f.put("extracted/archive", sector(2352, 1));
    assert.equal((await extractAssets(f.root)).resourceNodes, 1);
    f.put("extracted/archive", Buffer.concat([sector(2336, 1), sector(2336, 2)]));
    assert.equal((await extractAssets(f.root)).resourceNodes, 1);
    f.put("extracted/archive", weak); await extractAssets(f.root);
    assert.equal(existsSync(resolve(f.root, "build/assets/extracted/data")), false);
  } finally { f.cleanup(); }
});
