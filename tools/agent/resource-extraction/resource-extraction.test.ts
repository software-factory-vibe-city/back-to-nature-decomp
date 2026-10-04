import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeOriginal, evaluateByteTransform, recognizeByteTransform, transformAt } from "./analysis.ts";
import { parseArguments, splitArguments } from "./cli.ts";
import { decodeTim, parseExe, parseTim } from "./formats.ts";
import { ParserRegistry, TIM_PARSER, scanFormats, type AssetParser } from "./registry.ts";
import { executeResource } from "./pipeline.ts";
import { schemaExtents } from "./schema.ts";
import { canonical, hash, safePath, Store } from "./storage.ts";
import { DEFAULT_LIMITS, type ArchiveSchema, type Manifest } from "./types.ts";
import { decodeWord } from "../matching-reconstruction/decode.ts";

function fixture(): { root: string; put: (path: string, bytes: string | Uint8Array) => void; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "psx-resources-"));
  mkdirSync(join(root, "extracted"));
  const put = (path: string, bytes: string | Uint8Array): void => { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), bytes); };
  return { root, put, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
function tim(mode = 2, banks = 1): Buffer {
  const colors = mode === 0 ? 16 : 256;
  const indexed = mode < 2;
  const paletteBytes = indexed ? 12 + colors * banks * 2 : 0;
  const rowBytes = mode === 3 ? 4 : 2;
  const bytes = Buffer.alloc(8 + paletteBytes + 12 + rowBytes);
  bytes.writeUInt32LE(0x10, 0); bytes.writeUInt32LE(mode | (indexed ? 8 : 0), 4);
  if (indexed) {
    bytes.writeUInt32LE(paletteBytes, 8); bytes.writeUInt16LE(colors, 16); bytes.writeUInt16LE(banks, 18);
    for (let bank = 0; bank < banks; bank++) bytes.writeUInt16LE(bank % 2 ? 0x83e0 : 0x001f, 20 + bank * colors * 2);
  }
  const at = 8 + paletteBytes;
  bytes.writeUInt32LE(12 + rowBytes, at); bytes.writeUInt16LE(rowBytes / 2, at + 8); bytes.writeUInt16LE(1, at + 10);
  if (mode === 2) bytes.writeUInt16LE(0x801f, at + 12);
  if (mode === 3) bytes.set([10, 20, 30, 0x99], at + 12);
  return bytes;
}
const I = (op: number, rs: number, rt: number, imm: number): number => ((op << 26) | (rs << 21) | (rt << 16) | (imm & 65535)) >>> 0;
const R = (rs: number, rt: number, rd: number, sh: number, fn: number): number => ((rs << 21) | (rt << 16) | (rd << 11) | (sh << 6) | fn) >>> 0;
const BASE = 0x80010000;
function exe(words: number[], size = words.length * 4): Buffer {
  const bytes = Buffer.alloc(0x800 + size);
  bytes.write("PS-X EXE"); bytes.writeUInt32LE(BASE, 0x10); bytes.writeUInt32LE(BASE, 0x18); bytes.writeUInt32LE(size, 0x1c);
  words.forEach((word, index) => bytes.writeUInt32LE(word, 0x800 + index * 4));
  return bytes;
}
function xorWords(key: number): number[] {
  return [I(4, 6, 0, 8), 0, I(0x24, 4, 8, 0), I(9, 4, 4, 1), I(0xe, 8, 8, key), I(0x28, 5, 8, 0), I(9, 6, 6, -1), I(5, 6, 0, -6), I(9, 5, 5, 1), R(31, 0, 0, 0, 8), 0];
}
function manifest(root: string, run: string): Manifest { return JSON.parse(readFileSync(join(root, "build/assets/runs", run, "manifest.json"), "utf8")); }
const field = (offset: number) => ({ offset, width: 2 as const, endian: "be" as const, scale: 1, signed: false });

for (const mode of [0, 1, 2, 3]) test(`TIM ${mode}: validate/decode widths, STP and PPM conventions`, () => {
  const bytes = tim(mode, 2), parsed = parseTim(bytes);
  assert.equal(parsed.length, bytes.length);
  assert.equal(parsed.width, [4, 2, 1, 1][mode]);
  const output = decodeTim(bytes, 0, 100000);
  assert.equal(output.rgba.length, parsed.width * 4);
  assert.equal(output.stp.length, parsed.width);
  if (mode === 2) { assert.deepEqual([...output.rgba], [255, 0, 0, 255]); assert.equal(output.stp[0], 1); }
  if (mode === 3) { assert.deepEqual([...output.rgba], [10, 20, 30, 255]); assert.equal(output.metadata.rowPaddingBytes, 1); }
  if (mode < 2) { assert.notDeepEqual(decodeTim(bytes, 1, 100000).rgba, output.rgba); assert.equal(parsed.palette!.banks, 2); }
  assert.match(output.ppm.toString("ascii", 0, 2), /P6/);
  assert.throws(() => decodeTim(bytes, 99, 10000), /palette/);
  assert.throws(() => decodeTim(bytes, 0, 1), /budget/);
});
test("TIM zero transparency and STP are independent, malformed magic is rejected", async () => {
  const zero = tim(2); zero.writeUInt16LE(0, zero.length - 2);
  assert.equal(decodeTim(zero, 0, 10000).rgba[3], 0);
  zero.writeUInt16LE(0x8000, zero.length - 2);
  const black = decodeTim(zero, 0, 10000);
  assert.equal(black.rgba[3], 255); assert.equal(black.stp[0], 1);
  const bad = Buffer.from(zero); bad.writeUInt32LE(999999, 8);
  assert.throws(() => parseTim(bad), /length/);
  const result = await scanFormats(Buffer.concat([Buffer.from([1, 2, 3]), zero, bad]), 100);
  assert.equal(result.matches.length, 1); assert.equal(result.matches[0]!.offset, 3); assert.ok(result.rejected > 0);
});
test("TIM mixed mode, invalid rectangles and missing palettes are not accepted", () => {
  const bytes = tim(2); bytes.writeUInt32LE(4, 4); assert.throws(() => parseTim(bytes), /flags/);
  bytes.writeUInt32LE(0, 4); assert.throws(() => parseTim(bytes), /palette/);
  bytes.writeUInt32LE(2, 4); bytes.writeUInt16LE(512, 14); assert.throws(() => parseTim(bytes), /rectangle/);
});
test("schema covers embedded/separate indexes, big-endian fields, padding, aliases and unsorted records", () => {
  const index = Buffer.from([99, 99, 0, 8, 0, 2, 99, 0, 0, 0, 2, 99, 0, 8, 0, 2, 99]);
  const schema: ArchiveSchema = { index: "extracted/index", data: "extracted/data", tableOffset: 2, count: 3, stride: 5, base: 1, position: field(0), length: field(2), basis: "supplied-hypothesis" };
  assert.deepEqual(schemaExtents(schema, index, 20), [{ index: 0, offset: 9, length: 2 }, { index: 1, offset: 1, length: 2 }, { index: 2, offset: 9, length: 2 }]);
  assert.throws(() => schemaExtents({ ...schema, count: 4 }, index, 20), /table/);
  assert.throws(() => schemaExtents(schema, index, 8), /outside/);
  assert.throws(() => schemaExtents({ ...schema, position: { ...field(0), width: 3 as never } }, index, 20), /field/);
});
test("code map comes from original PS-X header, not filenames or matched C", async () => {
  const image = exe(xorWords(0x1234));
  assert.equal(parseExe(image)!.entry, BASE);
  const report = await analyzeOriginal(image, "alien-container", DEFAULT_LIMITS);
  assert.equal(report.container, "alien-container"); assert.equal(report.functions.length, 1);
  const recovered = report.functions[0]!.transform as { key: number; outcome: string };
  assert.equal(recovered.key, 0x34); assert.equal(recovered.outcome, "validated");
  assert.equal(transformAt(image, BASE)!.key, 0x34);
  assert.deepEqual([...evaluateByteTransform(Buffer.from([0, 0x80, 0xff]), 0x34, 100)], [0x34, 0xb4, 0xcb]);
  const broken = xorWords(0x1234); broken[3] = I(9, 4, 4, 2);
  assert.equal(recognizeByteTransform(broken.map((w, i) => decodeWord(w, BASE + 4 * i))), undefined);
  assert.equal(transformAt(image, BASE + 4), undefined);
  image.writeUInt32LE(0xffffffff, 0x1c); assert.throws(() => parseExe(image), /extent/);
});
test("CFG/SSA observes parallel table fields with 12-byte indexing, unknown callees stay unresolved", async () => {
  const words = [I(9, 29, 29, -24), I(0x2b, 29, 31, 20), R(0, 4, 8, 1, 0), R(8, 4, 8, 0, 0x21), R(0, 8, 8, 2, 0), I(0xf, 0, 9, 0x8001), I(0xd, 9, 9, 0x80), R(9, 8, 9, 0, 0x21), I(0x23, 9, 5, 0), I(0x23, 9, 6, 4), ((3 << 26) | (((BASE + 0x60) >>> 2) & 0x3ffffff)) >>> 0, 0, I(0x23, 29, 31, 20), I(9, 29, 29, 24), R(31, 0, 0, 0, 8), 0];
  const image = exe(words, 0xa0); image.writeUInt32LE(R(31, 0, 0, 0, 8), 0x860);
  const report = await analyzeOriginal(image, "test-code", DEFAULT_LIMITS);
  const fields = report.functions[0]!.fields as Array<{ affineAddress: { base: number; terms: Record<string, number> } }>;
  assert.ok(fields.some(f => f.affineAddress?.base === BASE + 0x80 && f.affineAddress.terms.a0 === 12));
  assert.ok(fields.some(f => f.affineAddress?.base === BASE + 0x84 && f.affineAddress.terms.a0 === 12));
  const calls = report.functions[0]!.calls as Array<{ outcome: string }>;
  assert.equal(calls[0]!.outcome, "context-unresolved"); assert.equal(report.functions.length, 2);
});
test("unsupported code/indirect calls and analysis budgets are explicit", async () => {
  assert.equal((await analyzeOriginal(Buffer.from("not an exe"), "data", DEFAULT_LIMITS)).outcome, "context-unresolved");
  const indirect = await analyzeOriginal(exe([R(8, 0, 31, 0, 9), 0, R(31, 0, 0, 0, 8), 0]), "indirect", DEFAULT_LIMITS);
  assert.match(JSON.stringify(indirect), /Unresolved indirect call/);
  const limited = await analyzeOriginal(exe(xorWords(1)), "bounded", { ...DEFAULT_LIMITS, maxInstructions: 2 });
  assert.match(JSON.stringify(limited), /budget/);
});
test("complete cold-input campaign extracts embedded TIMs, verifies replay, catalogs unknown coverage", async () => {
  const f = fixture();
  try {
    const original = Buffer.concat([Buffer.from([6, 7, 8]), tim(0, 2), Buffer.from([9])]);
    f.put("extracted/strange title/data.raw", original); f.put("src/do-not-edit.c", "untouched");
    const result = await executeResource("campaign", f.root);
    const run = result.run as string, m = manifest(f.root, run);
    assert.equal(result.state, "supported-fixed-point"); assert.equal(result.resourceNodes, 1);
    assert.equal(m.artifacts.length, 7); assert.equal(m.nodes[1]!.source!.offset, 3);
    assert.equal(readFileSync(join(f.root, "src/do-not-edit.c"), "utf8"), "untouched");
    assert.deepEqual(readFileSync(join(f.root, "extracted/strange title/data.raw")), original);
    assert.equal((await executeResource("verify", f.root, { run })).outcome, "validated");
    const catalog = readFileSync(join(f.root, "build/assets/runs", run, "docs/catalog.md"), "utf8");
    assert.match(catalog, /total game assets unknown/); assert.match(catalog, /PPM discards/);
    assert.ok(m.unresolved.some(u => u.subject === "scope"));
    for (const a of m.artifacts) assert.ok(a.path.startsWith("blobs/") || a.path.startsWith(`runs/${run}/exports/`));
  } finally { f.cleanup(); }
});
test("checkpoints resume without duplicate jobs or artifacts; identities stable across runs", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim());
    const first = await executeResource("campaign", f.root, { maxSteps: 1 });
    assert.equal(first.state, "budget-exhausted");
    const resumed = await executeResource("campaign", f.root, { resume: first.run as string });
    assert.equal(resumed.state, "supported-fixed-point");
    const again = await executeResource("campaign", f.root, { resume: first.run as string });
    assert.equal(again.steps, 0); assert.equal(again.artifacts, resumed.artifacts);
    const next = await executeResource("campaign", f.root);
    const a = manifest(f.root, first.run as string), b = manifest(f.root, next.run as string);
    assert.equal(a.identity, b.identity); assert.deepEqual(a.nodes, b.nodes);
    assert.deepEqual(a.artifacts.map(x => x.hash), b.artifacts.map(x => x.hash));
    assert.throws(() => new Store(f.root).read("../../src/do-not-edit.c"), /escapes/);
  } finally { f.cleanup(); }
});
test("conditional archive members preserve alias relationships without requiring tiling", async () => {
  const f = fixture();
  try {
    f.put("extracted/index", Buffer.from([0, 4, 0, 2, 0, 0, 0, 2, 0, 4, 0, 2]));
    f.put("extracted/data", Buffer.from([1, 2, 9, 9, 3, 4, 9]));
    const schema: ArchiveSchema = { index: "extracted/index", data: "extracted/data", tableOffset: 0, count: 3, stride: 4, base: 0, position: field(0), length: field(2), basis: "supplied-hypothesis" };
    const result = await executeResource("campaign", f.root, { schemas: [schema] });
    const m = manifest(f.root, result.run as string);
    assert.equal(m.nodes.filter(n => n.kind === "member").length, 3);
    assert.ok(m.edges.some(e => e.kind === "alias"));
    assert.ok(m.nodes.filter(n => n.kind === "member").every(n => n.stages.discovery === "candidate"));
    assert.equal(m.artifacts.length, 3);
    assert.equal((await executeResource("verify", f.root, { run: result.run as string })).outcome, "validated");
  } finally { f.cleanup(); }
});
test("checked decoder output requeues only its new view and exposes a formerly opaque TIM", async () => {
  const f = fixture();
  try {
    const key = 0x5a, plain = tim();
    f.put("extracted/engine", exe(xorWords(key))); f.put("extracted/opaque", evaluateByteTransform(plain, key, 10000));
    const initial = await executeResource("campaign", f.root);
    const run = initial.run as string, before = manifest(f.root, run);
    assert.equal(initial.resourceNodes, 0);
    const code = before.inputs.find(i => i.path.endsWith("engine"))!, input = before.inputs.find(i => i.path.endsWith("opaque"))!;
    const transformed = await executeResource("extract", f.root, { run, node: input.id, transformNode: code.id, transformAddress: BASE });
    assert.equal(transformed.pending, 1);
    const resumed = await executeResource("campaign", f.root, { resume: run });
    assert.equal(resumed.steps, 2); assert.equal(resumed.resourceNodes, 2);
    assert.equal((await executeResource("verify", f.root, { run })).outcome, "validated");
    const after = manifest(f.root, run);
    assert.ok(after.evidence.some(e => /NOT an inferred game call/.test(e.detail)));
    const art = after.artifacts.find(a => a.processor === "byte-xor-v1")!;
    assert.deepEqual(readFileSync(join(f.root, "build/assets", art.path)), plain);
  } finally { f.cleanup(); }
});
test("artifact corruption, input drift and checkpoint corruption fail verification", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim());
    const result = await executeResource("campaign", f.root), run = result.run as string;
    const m = manifest(f.root, run), art = m.artifacts.find(a => a.stage === "export")!;
    f.put(`build/assets/${art.path}`, "bad"); await assert.rejects(executeResource("verify", f.root, { run }), /hash/);
    f.put("extracted/resource", "changed"); await assert.rejects(executeResource("campaign", f.root, { resume: run }), /input-drift/);
    const pointer = JSON.parse(readFileSync(join(f.root, "build/assets/runs", run, "current.json"), "utf8"));
    f.put(`build/assets/runs/${run}/snapshots/${pointer.snapshot}.json`, "{}");
    await assert.rejects(executeResource("verify", f.root, { run }), /checkpoint/);
  } finally { f.cleanup(); }
});
test("byte/output/node budgets stop honestly and retain validated prefix", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", Buffer.concat([tim(), tim()]));
    const result = await executeResource("campaign", f.root, { limits: { maxAssets: 1 } });
    assert.equal(result.state, "budget-exhausted"); assert.equal(result.resourceNodes, 1);
    assert.equal((await executeResource("verify", f.root, { run: result.run as string })).outcome, "validated");
    await assert.rejects(executeResource("inventory", f.root, { limits: { maxFileBytes: 1 } }), /budget-exhausted/);
    const tiny = await executeResource("campaign", f.root, { limits: { maxOutputBytes: 1 } });
    assert.equal(tiny.state, "budget-exhausted"); assert.equal(tiny.resourceNodes, 0);
  } finally { f.cleanup(); }
});
test("path traversal, symlinks, incompatible resume options and forged run IDs are refused", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim());
    await assert.rejects(executeResource("campaign", f.root, { input: "../" }), /escapes/);
    await assert.rejects(executeResource("campaign", f.root, { input: "src" }), /escapes/);
    symlinkSync(join(f.root, "extracted/resource"), join(f.root, "extracted/link"));
    await assert.rejects(executeResource("campaign", f.root), /symlink/i);
    rmSync(join(f.root, "extracted/link"));
    const initial = await executeResource("inventory", f.root);
    await assert.rejects(executeResource("campaign", f.root, { resume: initial.run as string, limits: { maxAssets: 30 } }), /recorded|frozen/);
    await assert.rejects(executeResource("verify", f.root, { run: "../../src" }), /run ID/);
    assert.throws(() => safePath(f.root, "/etc/passwd"), /escapes/);
  } finally { f.cleanup(); }
});
test("run locks refuse concurrent mutation, cancellation leaves original bytes untouched", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim());
    const result = await executeResource("inventory", f.root), run = result.run as string;
    const store = new Store(f.root);
    await store.lock(run, async () => { await assert.rejects(executeResource("campaign", f.root, { resume: run }), /locked/); });
    const controller = new AbortController(); controller.abort();
    await assert.rejects(executeResource("campaign", f.root, { resume: run }, controller.signal), /abort/i);
    assert.deepEqual(readFileSync(join(f.root, "extracted/resource")), tim());
    assert.ok(readdirSync(join(f.root, "build/assets/locks")).length === 0);
  } finally { f.cleanup(); }
});
test("documentation is a reference-checked candidate, not a semantic acceptance gate", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim());
    const result = await executeResource("campaign", f.root), run = result.run as string, m = manifest(f.root, run);
    await assert.rejects(executeResource("document", f.root, { run, action: "propose", claims: [{ text: "An invented meaning", evidence: ["unknown-id"] }] }), /evidence/);
    const proposal = await executeResource("document", f.root, { run, action: "propose", claims: [{ text: "This input is structurally compatible with TIM; historical names are unknown.", evidence: [m.evidence[0]!.id] }] });
    const payload = JSON.parse(readFileSync(join(f.root, "build/assets", proposal.proposal as string), "utf8"));
    assert.equal(payload.outcome, "candidate"); assert.match(payload.semanticReview, /required/);
    assert.equal(manifest(f.root, run).artifacts.length, m.artifacts.length);
  } finally { f.cleanup(); }
});
test("a new parser registers probe/validation/variants/exports/replay without pipeline edits", async () => {
  const parser: AssetParser = {
    id: "fixture-v1", format: "Fixture", version: 1,
    probe: (bytes, at) => bytes[at] === 0xfa,
    parse: (bytes, at) => { if (bytes[at + 1] !== 2) throw new Error("invalid fixture length"); return { length: 2, metadata: { size: 2 } }; },
    variants: () => [{ convention: "raw" }],
    decode: bytes => [{ kind: "bytes", extension: "bin", stage: "export", bytes, metadata: { interpretation: "unknown" } }],
  };
  const registry = new ParserRegistry([TIM_PARSER, parser]);
  const scanned = await registry.scan(Buffer.concat([Buffer.from([1, 0xfa, 2, 0xfa, 99]), tim()]), 100);
  assert.equal(scanned.matches.length, 2); assert.equal(scanned.rejected, 1);
  assert.equal(scanned.matches[0]!.parser, parser.id);
  const bytes = Buffer.from([0xfa, 2]);
  assert.deepEqual(registry.replay(parser.id, bytes, { convention: "raw" }, "bytes", 100).bytes, bytes);
  assert.throws(() => registry.replay(parser.id, bytes, { convention: "invented" }, "bytes", 100), /variant/);
  assert.throws(() => registry.decode(parser.id, bytes, { convention: "raw" }, 1), /budget/);
  assert.throws(() => new ParserRegistry([parser, parser]), /duplicate/);
  assert.throws(() => registry.get("invented-v1"), /Unsupported/);
});

test("argument parser has no shell expansion and declarative files stay in output root", () => {
  const f = fixture();
  try {
    assert.deepEqual(splitArguments('--input "extracted/a b" --max-steps 3'), ["--input", "extracted/a b", "--max-steps", "3"]);
    assert.throws(() => splitArguments("'unfinished"), /Unterminated/);
    assert.throws(() => parseArguments(["--unknown", "x"], f.root), /Unknown/);
    assert.throws(() => parseArguments(["--run", "x", "--resume", "y"], f.root), /OR/);
    assert.throws(() => parseArguments(["--schemas", "../../src/anything"], f.root), /escapes/);
    assert.equal(parseArguments(["--status"], f.root).request.action, "check");
    assert.equal(parseArguments(["--no-agents"], f.root).agents, false);
    assert.equal(hash(canonical({ b: 2, a: 1 })), hash(canonical({ a: 1, b: 2 })));
  } finally { f.cleanup(); }
});
