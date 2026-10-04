import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { executeResource, extractAssets } from "./pipeline.ts";
import { readManifest } from "./test-fixtures.ts";
import { ParserRegistry, PARSERS } from "./registry.ts";
import { Store } from "./storage.ts";
import { XA_PARSER, xaEdc } from "./parsers/xa.ts";

function sector(stride: number, audio: boolean): Buffer {
  const bytes = Buffer.alloc(stride), sub = stride === 2352 ? 16 : 0, payload = sub + 8;
  if (stride === 2352) { bytes.fill(255, 1, 11); bytes.set([0, 2, 1, 2], 12); }
  const mode = audio ? 0x64 : 0x48, coding = audio ? 1 : 0;
  bytes.set([1, 3, mode, coding, 1, 3, mode, coding], sub);
  if (audio) for (let group = 0; group < 18; group++) {
    bytes.fill(12, payload + group * 128, payload + group * 128 + 16);
    bytes.fill(0xf1, payload + group * 128 + 16, payload + group * 128 + 128);
  }
  if (!audio) bytes.writeUInt32LE(xaEdc(bytes, sub, 8 + 2048), payload + 2048);
  return bytes;
}

for (const stride of [2352, 2336]) test(`XA ${stride}: real browsable WAV and ADPCM, raw preservation, resume and verification`, async () => {
  const root = mkdtempSync(join(tmpdir(), "xa-export-"));
  try {
    mkdirSync(join(root, "extracted"));
    const chain = Buffer.concat([sector(stride, true), sector(stride, true)]);
    writeFileSync(join(root, "extracted/audio"), Buffer.concat([Buffer.from([7, 9, 3]), chain, Buffer.alloc(64)]));
    await extractAssets(root);
    const store = new Store(root), asset = readManifest(root).nodes.find(node => node.kind === "resource")!;
    const directory = "extracted/sounds", files = readdirSync(store.path(directory));
    const wavName = files.find(file => file.endsWith(".wav"))!;
    assert.ok(wavName, "the user can open an actual WAV, not a renamed XA");
    assert.ok(readManifest(root).artifacts.some(a => a.extension === "adpcm"));
    assert.deepEqual(store.bytes(asset.blob), chain);
    const wav = readFileSync(store.path(`${directory}/${wavName}`));
    assert.equal(wav.readUInt16LE(22), 2); assert.equal(wav.readUInt32LE(24), 37800);
    assert.equal(wav.length, 44 + 2 * 18 * 8 * 28 * 2);
    for (let at = 44; at < wav.length; at += 4) { assert.equal(wav.readInt16LE(at), 1); assert.equal(wav.readInt16LE(at + 2), -1); }
    assert.equal((await executeResource("verify", root)).outcome, "validated");
    writeFileSync(store.path(`${directory}/${wavName}`), "corrupt");
    await assert.rejects(executeResource("verify", root), /Presented asset hash/);
    const cached = await extractAssets(root);
    assert.deepEqual(readFileSync(store.path(`${directory}/${wavName}`)), wav);
    assert.equal((cached.statistics as any).decodes, 0);
    assert.equal((await executeResource("verify", root)).outcome, "validated");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("eight real-disc-shaped channels survive unused sectors, individual EOFs and cached publication", async () => {
  const root = mkdtempSync(join(tmpdir(), "xa-interleave-"));
  try {
    mkdirSync(join(root, "extracted"));
    const sectors: Buffer[] = [];
    const counts = [3, 3, 3, 2, 3, 3, 3, 1];
    for (let round = 0; round < 3; round++) for (let channel = 0; channel < 8; channel++) {
      const bytes = sector(2352, true);
      const mode = round < counts[channel]! ? (round === counts[channel]! - 1 ? 0xe4 : 0x64) : 0;
      bytes.set([1, channel, mode, mode ? 1 : 0, 1, channel, mode, mode ? 1 : 0], 16);
      if (!mode) {
        bytes.fill(0xf7, 24, 24 + 2048);
        bytes.writeUInt32LE(xaEdc(bytes, 16, 8 + 2048), 24 + 2048);
      }
      sectors.push(bytes);
    }
    const end = sector(2352, false);
    end.set([1, 0, 0x80, 0, 1, 0, 0x80, 0], 16);
    end.writeUInt32LE(xaEdc(end, 16, 8 + 2048), 24 + 2048);
    sectors.push(end);
    const chain = Buffer.concat(sectors);
    writeFileSync(join(root, "extracted/interleaved.xa"), chain);
    const result = await extractAssets(root), store = new Store(root);
    const manifest = readManifest(root);
    const asset = manifest.nodes.find(n => n.kind === "resource")!;
    assert.equal(result.resourceNodes, 1); assert.equal(result.outcome, "validated");
    assert.equal(asset.size, chain.length); assert.equal(asset.metadata.paddingSectors, 4);
    const files = readdirSync(store.path("extracted/sounds"));
    assert.equal(files.filter(f => f.endsWith(".wav")).length, 8);
    assert.equal(manifest.artifacts.filter(a => a.extension === "adpcm").length, 8);
    assert.deepEqual(store.bytes(asset.blob), chain);
    for (const artifact of manifest.artifacts.filter(a => a.extension === "wav")) {
      const channel = artifact.parameters.channel as number;
      const wav = readFileSync(store.path(artifact.path));
      assert.equal(artifact.parameters.sectors, counts[channel]);
      assert.equal(wav.length, 44 + counts[channel]! * 18 * 8 * 28 * 2);
      for (let at = 44; at < wav.length; at += 4) {
        assert.equal(wav.readInt16LE(at), 1); assert.equal(wav.readInt16LE(at + 2), -1);
      }
    }
    assert.equal((await executeResource("verify", root)).outcome, "validated");
    await extractAssets(root);
    assert.deepEqual(readManifest(root).nodes, manifest.nodes);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("non-audio XA goes to data, never a video folder; dynamic category output is validated", async () => {
  const root = mkdtempSync(join(tmpdir(), "xa-export-"));
  try {
    mkdirSync(join(root, "extracted")); writeFileSync(join(root, "extracted/data"), sector(2352, false));
    await extractAssets(root); const store = new Store(root);
    assert.ok(readdirSync(store.path("extracted/data")).some(f => f.endsWith(".xa")));
    assert.equal(store.read<{ assets: Array<{ category: string }> }>("index.json").assets[0]!.category, "data");
    assert.equal((await executeResource("verify", root)).outcome, "validated");
    const registry = new ParserRegistry([{ ...XA_PARSER, category: () => "../escape" as "sound" }]);
    assert.throws(() => registry.category(XA_PARSER.id, {}), /category/);
    assert.equal(PARSERS.category("tim-v1", {}), "images");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
