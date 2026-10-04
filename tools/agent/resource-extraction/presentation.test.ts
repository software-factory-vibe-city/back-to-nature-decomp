import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeResource } from "./pipeline.ts";
import { presentationPlan, presentAssets } from "./presentation.ts";
import { ParserRegistry, TIM_PARSER, type AssetParser } from "./registry.ts";
import { Store } from "./storage.ts";
import type { Manifest } from "./types.ts";

function tim(): Buffer {
  const bytes = Buffer.alloc(22);
  bytes.writeUInt32LE(16); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(14, 8);
  bytes.writeUInt16LE(1, 16); bytes.writeUInt16LE(1, 18); bytes.writeUInt16LE(31, 20);
  return bytes;
}
function manifest(root: string, run: string): Manifest { return JSON.parse(readFileSync(join(root, "build/assets/runs", run, "manifest.json"), "utf8")); }

test("campaign publishes real TIM/image files in images/ with provenance and stable names", async () => {
  // Inputs use normal project paths, never an output-boundary escape.
  const root = mkdtempSync(join(tmpdir(), "resource-presentation-"));
  const { mkdirSync } = await import("node:fs"); mkdirSync(join(root, "extracted"));
  writeFileSync(join(root, "extracted/resource"), tim());
  try {
    const first = await executeResource("campaign", root), run = first.run as string, m = manifest(root, run);
    const asset = m.nodes.find(n => n.kind === "resource")!, directory = join(root, "build/assets/images", asset.id);
    assert.deepEqual(readdirSync(directory).sort(), ["asset.json", "bank-0.ppm", "bank-0.rgba", "bank-0.stp", "original.tim"]);
    assert.deepEqual(readFileSync(join(directory, "original.tim")), tim());
    assert.match(readFileSync(join(directory, "bank-0.ppm"), "ascii"), /^P6\n1 1\n255\n/);
    const sidecar = JSON.parse(readFileSync(join(directory, "asset.json"), "utf8"));
    assert.equal(sidecar.resource.source.node, m.inputs[0]!.id);
    assert.equal(sidecar.manifestHash, (first.documentation as { manifestHash: string }).manifestHash);
    assert.equal((first.presented as { assets: number; files: number }).files, 4);
    assert.equal((await executeResource("verify", root, { run })).outcome, "validated");
    assert.equal(existsSync(join(root, "build/assets/sound")), false, "no empty folder pretending audio was found");
    await executeResource("campaign", root, { resume: run });
    const second = await executeResource("campaign", root);
    assert.equal((second.presented as { assets: number }).assets, 1);
    assert.equal(JSON.parse(readFileSync(join(root, "build/assets/index.json"), "utf8")).assets.length, 1);
    assert.equal(readdirSync(directory).length, 5, "repeated runs do not duplicate visible files");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("edits to browsable copies never alter backing blobs; verification detects and extraction repairs them", async () => {
  const root = mkdtempSync(join(tmpdir(), "resource-presentation-"));
  const { mkdirSync } = await import("node:fs"); mkdirSync(join(root, "extracted"));
  writeFileSync(join(root, "extracted/resource"), tim());
  try {
    const result = await executeResource("campaign", root), run = result.run as string, m = manifest(root, run);
    const asset = m.nodes.find(n => n.kind === "resource")!, visible = join(root, "build/assets/images", asset.id, "original.tim");
    writeFileSync(visible, "edited");
    assert.deepEqual(readFileSync(join(root, "build/assets", asset.blob)), tim());
    await assert.rejects(executeResource("verify", root, { run }), /Presented asset hash/);
    await executeResource("extract", root, { run, maxSteps: 0 });
    assert.deepEqual(readFileSync(visible), tim());
    assert.equal((await executeResource("verify", root, { run })).outcome, "validated");
    const metadata = join(root, "build/assets/images", asset.id, "asset.json");
    const forged = JSON.parse(readFileSync(metadata, "utf8")); forged.resource.metadata.width = 999;
    writeFileSync(metadata, JSON.stringify(forged));
    await assert.rejects(executeResource("verify", root, { run }), /metadata\/provenance/);
    await executeResource("extract", root, { run, maxSteps: 0 });
    assert.equal((await executeResource("verify", root, { run })).outcome, "validated");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("publication merges scopes, respects parser categories and refuses ambiguous resources and unsafe descriptors", async () => {
  const root = mkdtempSync(join(tmpdir(), "resource-presentation-"));
  const { mkdirSync } = await import("node:fs"); mkdirSync(join(root, "extracted"));
  writeFileSync(join(root, "extracted/resource"), tim());
  try {
    const result = await executeResource("campaign", root), m = manifest(root, result.run as string), store = new Store(root);
    const audio: AssetParser = {
      id: "sound-fixture-v1", format: "SyntheticSound", version: 1, category: "sound", rawExtension: "sample",
      probe: (b, o) => b[o] === 0xfa && b[o + 1] === 2,
      parse: (b, o) => { if (b[o] !== 0xfa || b[o + 1] !== 2) throw new Error("bad fixture"); return { length: 2, metadata: {} }; },
      variants: () => [{}], decode: () => [],
    };
    const registry = new ParserRegistry([TIM_PARSER, audio]), bytes = Buffer.from([0xfa, 2]);
    assert.equal(registry.parse(audio.id, bytes, 0).length, 2);
    const node = { id: "node-" + "a".repeat(24), kind: "resource" as const, blob: store.blob(bytes), size: 2, format: audio.format, metadata: { parserId: audio.id }, stages: { discovery: "validated" as const, extraction: "validated" as const }, evidence: [] };
    const other = { ...m, nodes: [node], artifacts: [] };
    await presentAssets(store, other, "independent-fixture", undefined, registry);
    assert.deepEqual(readFileSync(join(root, "build/assets/sound", node.id, "original.sample")), bytes);
    assert.equal(store.read<{ assets: unknown[] }>("index.json").assets.length, 2);
    assert.deepEqual(presentationPlan({ ...other, nodes: [{ ...node, stages: { discovery: "ambiguous", extraction: "validated" } }] }, "", registry), []);
    assert.throws(() => new ParserRegistry([{ ...audio, category: "../escape" as "sound" }]), /category/);
    assert.throws(() => new ParserRegistry([{ ...audio, rawExtension: "../escape" }]), /extension/);
    const generic = new ParserRegistry([{ ...audio, category: undefined, rawExtension: undefined }]);
    assert.match(presentationPlan(other, "", generic)[0]!.files[0]!.path, /^data\/.*\/original\.bin$/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("publication cannot follow a symlink out of its category directory", async () => {
  const root = mkdtempSync(join(tmpdir(), "resource-presentation-")), outside = mkdtempSync(join(tmpdir(), "resource-outside-"));
  const { mkdirSync } = await import("node:fs"); mkdirSync(join(root, "extracted"));
  writeFileSync(join(root, "extracted/resource"), tim());
  new Store(root); symlinkSync(outside, join(root, "build/assets/images"), "dir");
  try {
    await assert.rejects(executeResource("campaign", root), /Symlink/);
    assert.deepEqual(readdirSync(outside), []);
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});
