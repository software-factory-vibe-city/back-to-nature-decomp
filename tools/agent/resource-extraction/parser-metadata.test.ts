import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { executeResource, loadRun, verifyRun } from "./pipeline.ts";
import { PARSERS } from "./registry.ts";
import { Store } from "./storage.ts";
import type { Match } from "./types.ts";
import { xaEdc } from "./parsers/xa.ts";

// Synthetic form 1 sectors from the published CD-ROM XA layout, not game bytes.
function sector(stride: number, frame: number): Buffer {
  const bytes = Buffer.alloc(stride), subheader = stride === 2352 ? 16 : 0;
  if (stride === 2352) {
    bytes.fill(0xff, 1, 11);
    bytes.set([0, 2, frame, 2], 12); // BCD MSF and mode 2
  }
  bytes.set([1, 0, 0x08, 0, 1, 0, 0x08, 0], subheader); // duplicated DATA subheader
  bytes[subheader + 8] = 0x90 + frame;
  bytes.writeUInt32LE(xaEdc(bytes, subheader, 8 + 2048), subheader + 8 + 2048);
  return bytes;
}

for (const stride of [2352, 2336]) test(`embedded XA ${stride}: bounded metadata replays through extraction, cache and resume`, async () => {
  const root = mkdtempSync(join(tmpdir(), "resource-metadata-"));
  try {
    mkdirSync(join(root, "extracted"));
    const sectors = [sector(stride, 1), sector(stride, 2)], chain = Buffer.concat(sectors);
    const prefix = Buffer.from([0x31, 0x72, 0x93]), trailing = Buffer.alloc(100);
    const original = Buffer.concat([prefix, chain, trailing]);
    writeFileSync(join(root, "extracted/container"), original);
    assert.equal(PARSERS.parse("xa-v1", original, prefix.length).metadata.trailingBytes, trailing.length);

    const first = await executeResource("campaign", root), run = first.run as string, store = new Store(root);
    const full = loadRun(store, run), asset = full.manifest.nodes.find(node => node.kind === "resource")!;
    assert.equal(first.state, "supported-fixed-point");
    assert.equal(first.resourceNodes, 1);
    assert.deepEqual(asset.source, { node: full.manifest.inputs[0]!.id, offset: prefix.length, length: chain.length, coordinate: "file-byte" });
    assert.deepEqual(store.bytes(asset.blob), chain);
    assert.equal(asset.metadata.trailingBytes, 0, "resource metadata describes only its bounded blob");
    const probe = store.read<{ matches: Match[] }>(`runs/${run}/analysis/${asset.source!.node}-probe.json`);
    assert.equal(probe.matches.length, 1);
    assert.equal(probe.matches[0]!.metadata.trailingBytes, trailing.length, "probe retains the container context");
    const decoded = full.manifest.artifacts.find(artifact => artifact.parameters.kind === "xa-data")!;
    const payloadOffset = stride === 2352 ? 24 : 8;
    assert.deepEqual(readFileSync(store.path(decoded.path)), Buffer.concat(sectors.map(bytes => bytes.subarray(payloadOffset, payloadOffset + 2048))));
    assert.equal((await executeResource("verify", root, { run })).outcome, "validated");

    // Identical input reuses the probe cache; a step-limited run must verify
    // before decoding, then resume without changing the resource's identity.
    const partial = await executeResource("campaign", root, { maxSteps: 1 }), partialRun = partial.run as string;
    assert.equal(partial.state, "budget-exhausted");
    assert.equal(partial.artifacts, 0);
    const discovered = loadRun(store, partialRun).manifest.nodes.find(node => node.kind === "resource")!;
    assert.equal(discovered.id, asset.id);
    assert.deepEqual(discovered.metadata, asset.metadata);
    const resumed = await executeResource("campaign", root, { resume: partialRun });
    assert.equal(resumed.state, "supported-fixed-point");
    assert.equal(resumed.artifacts, first.artifacts);
    assert.deepEqual(loadRun(store, partialRun).manifest.nodes, full.manifest.nodes);
    assert.equal((await executeResource("verify", root, { run: partialRun })).outcome, "validated");
    assert.deepEqual(readFileSync(join(root, "extracted/container")), original);

    // Canonical replay remains strict; container metadata is not acceptable on
    // an isolated resource. Mutate only this in-memory test copy.
    asset.metadata.trailingBytes = trailing.length;
    assert.throws(() => verifyRun(store, full), /Parser node extent\/metadata failed replay/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
