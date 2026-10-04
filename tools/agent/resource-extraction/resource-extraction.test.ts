import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { analyzeOriginal, evaluateByteTransform, recognizeByteTransform, transformAt } from "./analysis.ts";
import { parseArguments, splitArguments, validateRequest } from "./cli.ts";
import { decodeTim, parseExe, parseTim } from "./formats.ts";
import { parserFingerprints } from "./fingerprints.ts";
import { PARSERS, ParserRegistry, TIM_PARSER, scanFormats, type AssetParser } from "./registry.ts";
import { executeResource, extractAssets, verifyManifest } from "./pipeline.ts";
import { schemaExtents } from "./schema.ts";
import { canonical, hash, safePath, Store } from "./storage.ts";
import { DEFAULT_LIMITS, type ArchiveSchema } from "./types.ts";
import { decodeWord } from "../matching-reconstruction/decode.ts";
import { BASE, exe, fixture, I, R, readManifest, tim, xorWords } from "./test-fixtures.ts";
const field = (offset: number) => ({ offset, width: 2 as const, endian: "be" as const, scale: 1, signed: false });
const document = (root: string) => readFileSync(join(root, "notes/asset-provenance.md"), "utf8");

for (const mode of [0, 1, 2, 3]) test(`TIM ${mode}: validate/decode widths, STP and PPM conventions`, () => {
  const bytes = tim(mode, 2), parsed = parseTim(bytes), output = decodeTim(bytes, 0, 100000);
  assert.equal(parsed.length, bytes.length); assert.equal(parsed.width, [4, 2, 1, 1][mode]);
  assert.equal(output.rgba.length, parsed.width * 4); assert.equal(output.stp.length, parsed.width);
  if (mode === 2) { assert.deepEqual([...output.rgba], [255, 0, 0, 255]); assert.equal(output.stp[0], 1); }
  if (mode === 3) { assert.deepEqual([...output.rgba], [10, 20, 30, 255]); assert.equal(output.metadata.rowPaddingBytes, 1); }
  if (mode < 2) { assert.notDeepEqual(decodeTim(bytes, 1, 100000).rgba, output.rgba); assert.equal(parsed.palette!.banks, 2); }
  assert.match(output.ppm.toString("ascii", 0, 2), /P6/);
  assert.throws(() => decodeTim(bytes, 99, 10000), /palette/); assert.throws(() => decodeTim(bytes, 0, 1), /budget/);
});
test("TIM zero transparency/STP are independent; malformed magic/modes/rectangles rejected", async () => {
  const zero = tim(2); zero.writeUInt16LE(0, zero.length - 2); assert.equal(decodeTim(zero, 0, 10000).rgba[3], 0);
  zero.writeUInt16LE(0x8000, zero.length - 2); const black = decodeTim(zero, 0, 10000);
  assert.equal(black.rgba[3], 255); assert.equal(black.stp[0], 1);
  const bad = Buffer.from(zero); bad.writeUInt32LE(999999, 8); assert.throws(() => parseTim(bad), /length/);
  const result = await scanFormats(Buffer.concat([Buffer.from([1, 2, 3]), zero, bad]), 100);
  assert.equal(result.matches.length, 1); assert.equal(result.matches[0]!.offset, 3); assert.ok(result.rejected > 0);
  const flags = tim(2); flags.writeUInt32LE(4, 4); assert.throws(() => parseTim(flags), /flags/);
  flags.writeUInt32LE(0, 4); assert.throws(() => parseTim(flags), /palette/);
  flags.writeUInt32LE(2, 4); flags.writeUInt16LE(512, 14); assert.throws(() => parseTim(flags), /rectangle/);
});
test("schema: separate indexes, big-endian fields, padding, aliases, unsorted records", () => {
  const index = Buffer.from([99, 99, 0, 8, 0, 2, 99, 0, 0, 0, 2, 99, 0, 8, 0, 2, 99]);
  const schema: ArchiveSchema = { index: "extracted/index", data: "extracted/data", tableOffset: 2, count: 3, stride: 5, base: 1, position: field(0), length: field(2), basis: "supplied-hypothesis" };
  assert.deepEqual(schemaExtents(schema, index, 20), [{ index: 0, offset: 9, length: 2 }, { index: 1, offset: 1, length: 2 }, { index: 2, offset: 9, length: 2 }]);
  assert.throws(() => schemaExtents({ ...schema, count: 4 }, index, 20), /table/);
  assert.throws(() => schemaExtents(schema, index, 8), /outside/);
  assert.throws(() => schemaExtents({ ...schema, position: { ...field(0), width: 3 as never } }, index, 20), /field/);
});
test("original-word code map and checked byte-XOR do not depend on matched C", async () => {
  const image = exe(xorWords(0x1234)); assert.equal(parseExe(image)!.entry, BASE);
  const report = await analyzeOriginal(image, "alien-container", DEFAULT_LIMITS);
  assert.equal(report.container, "alien-container"); assert.equal(report.functions.length, 1);
  assert.equal((report.functions[0]!.transform as { key: number }).key, 0x34);
  assert.equal(transformAt(image, BASE)!.key, 0x34);
  assert.deepEqual([...evaluateByteTransform(Buffer.from([0, 0x80, 0xff]), 0x34, 100)], [0x34, 0xb4, 0xcb]);
  const broken = xorWords(0x1234); broken[3] = I(9, 4, 4, 2);
  assert.equal(recognizeByteTransform(broken.map((w, i) => decodeWord(w, BASE + 4 * i))), undefined);
  assert.equal(transformAt(image, BASE + 4), undefined); image.writeUInt32LE(0xffffffff, 0x1c); assert.throws(() => parseExe(image), /extent/);
});
test("CFG/SSA sees 12-byte table fields; unknown/indirect calls and budgets stay unresolved", async () => {
  const words = [I(9, 29, 29, -24), I(0x2b, 29, 31, 20), R(0, 4, 8, 1, 0), R(8, 4, 8, 0, 0x21), R(0, 8, 8, 2, 0), I(0xf, 0, 9, 0x8001), I(0xd, 9, 9, 0x80), R(9, 8, 9, 0, 0x21), I(0x23, 9, 5, 0), I(0x23, 9, 6, 4), ((3 << 26) | (((BASE + 0x60) >>> 2) & 0x3ffffff)) >>> 0, 0, I(0x23, 29, 31, 20), I(9, 29, 29, 24), R(31, 0, 0, 0, 8), 0];
  const image = exe(words, 0xa0); image.writeUInt32LE(R(31, 0, 0, 0, 8), 0x860);
  const report = await analyzeOriginal(image, "test-code", DEFAULT_LIMITS);
  const fields = report.functions[0]!.fields as Array<{ affineAddress: { base: number; terms: Record<string, number> } }>;
  assert.ok(fields.some(f => f.affineAddress?.base === BASE + 0x80 && f.affineAddress.terms.a0 === 12));
  assert.ok(fields.some(f => f.affineAddress?.base === BASE + 0x84 && f.affineAddress.terms.a0 === 12));
  assert.equal((report.functions[0]!.calls as Array<{ outcome: string }>)[0]!.outcome, "context-unresolved"); assert.equal(report.functions.length, 2);
  assert.equal((await analyzeOriginal(Buffer.from("not an exe"), "data", DEFAULT_LIMITS)).outcome, "context-unresolved");
  assert.match(JSON.stringify(await analyzeOriginal(exe([R(8, 0, 31, 0, 9), 0, R(31, 0, 0, 0, 8), 0]), "indirect", DEFAULT_LIMITS)), /Unresolved indirect call/);
  assert.match(JSON.stringify(await analyzeOriginal(exe(xorWords(1)), "bounded", { ...DEFAULT_LIMITS, maxInstructions: 2 })), /budget/);
});
test("cold/warm/forced/clean extraction is byte-identical, warm derivations do no parser work", async () => {
  const f = fixture();
  try {
    const original = Buffer.concat([Buffer.from([6, 7, 8]), tim(0, 2), Buffer.from([9])]);
    f.put("extracted/strange title/data.raw", original); f.put("src/do-not-edit.c", "untouched");
    const first = await extractAssets(f.root), m = readManifest(f.root), store = new Store(f.root);
    assert.equal(first.resourceNodes, 1); assert.equal(m.artifacts.length, 7);
    assert.equal(m.nodes.find(n => n.kind === "resource")!.source!.offset, 3);
    const before = ["manifest.json", "index.json", ...m.assets.flatMap(a => a.files.map(file => file.path))].map(path => [path, readFileSync(store.path(path)), statSync(store.path(path)).mtimeMs] as const);
    const notes = document(f.root), noteTime = statSync(join(f.root, "notes/asset-provenance.md")).mtimeMs;
    const warm = await extractAssets(f.root);
    assert.deepEqual((warm.statistics as object), { scans: 0, parses: 0, decodes: 0, replays: 0, cacheHits: PARSERS.parsers.length + 1 });
    for (const [path, bytes, time] of before) { assert.deepEqual(readFileSync(store.path(path)), bytes); assert.equal(statSync(store.path(path)).mtimeMs, time); }
    assert.equal(document(f.root), notes); assert.equal(statSync(join(f.root, "notes/asset-provenance.md")).mtimeMs, noteTime);
    await extractAssets(f.root, { force: true }); assert.equal(document(f.root), notes); assert.deepEqual(readManifest(f.root), m);
    rmSync(store.path("cache"), { recursive: true }); await extractAssets(f.root); assert.equal(document(f.root), notes);
    assert.equal((await executeResource("verify", f.root)).outcome, "validated");
    rmSync(join(f.root, "build/assets"), { recursive: true }); await extractAssets(f.root); assert.deepEqual(readManifest(f.root), m); assert.equal(document(f.root), notes);
    assert.equal(readFileSync(join(f.root, "src/do-not-edit.c"), "utf8"), "untouched"); assert.deepEqual(readFileSync(join(f.root, "extracted/strange title/data.raw")), original);
    for (const name of ["runs", "logs", "requests", "loop"]) assert.equal(existsSync(store.path(name)), false);
    assert.match(notes, /total game asset count/i); assert.match(notes, /PPM previews discard/);
  } finally { f.cleanup(); }
});
test("negative discovery caches and parser-local dependency invalidation", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim());
    const dummy: AssetParser = { id: "fixture-v1", format: "Fixture", version: 1, probe: () => false, parse: () => { throw new Error("not found"); }, variants: () => [], decode: () => [] };
    const registry = new ParserRegistry([TIM_PARSER, dummy]), timFingerprint = parserFingerprints().find(p => p.id === TIM_PARSER.id)!;
    const fingerprints = [timFingerprint, { id: dummy.id, format: dummy.format, version: 1, hash: hash("implementation-a"), files: [], specifications: [] }];
    await extractAssets(f.root, {}, undefined, undefined, { registry, fingerprints });
    const warm = await extractAssets(f.root, {}, undefined, undefined, { registry, fingerprints }); assert.equal((warm.statistics as any).scans, 0);
    const changed = [timFingerprint, { ...fingerprints[1]!, hash: hash("implementation-b") }];
    const next = await extractAssets(f.root, {}, undefined, undefined, { registry, fingerprints: changed });
    assert.deepEqual(next.statistics, { scans: 1, parses: 0, decodes: 0, replays: 0, cacheHits: 2 });
    const added = await extractAssets(f.root, {}, undefined, undefined, { registry: new ParserRegistry([TIM_PARSER]), fingerprints: [timFingerprint] });
    assert.equal((added.statistics as any).scans, 0);
  } finally { f.cleanup(); }
});
test("conditional schema members retain aliases and all assumptions in self-contained notes", async () => {
  const f = fixture();
  try {
    f.put("extracted/index", Buffer.from([0, 4, 0, 2, 0, 0, 0, 2, 0, 4, 0, 2])); f.put("extracted/data", Buffer.from([1, 2, 9, 9, 3, 4, 9]));
    const schema: ArchiveSchema = { index: "extracted/index", data: "extracted/data", tableOffset: 0, count: 3, stride: 4, base: 0, position: field(0), length: field(2), basis: "supplied-hypothesis" };
    await extractAssets(f.root, { schemas: [schema] }); const m = readManifest(f.root);
    assert.equal(m.nodes.filter(n => n.kind === "member").length, 3); assert.ok(m.edges.some(e => e.kind === "alias"));
    assert.ok(m.nodes.filter(n => n.kind === "member").every(n => n.stages.discovery === "candidate")); assert.equal(m.artifacts.length, 3);
    assert.equal((await executeResource("verify", f.root)).outcome, "validated");
    assert.match(document(f.root), /--schemas-json/); assert.match(document(f.root), /historical boundary\/field interpretation NOT established/);
  } finally { f.cleanup(); }
});
test("checked transform exposes an opaque TIM, with code hashes/addresses and qualified association", async () => {
  const f = fixture();
  try {
    const key = 0x5a, plain = tim(); f.put("extracted/engine", exe(xorWords(key))); f.put("extracted/opaque", evaluateByteTransform(plain, key, 10000));
    const initial = await extractAssets(f.root); assert.equal(initial.resourceNodes, 0);
    const request = { transforms: [{ input: "extracted/opaque", code: "extracted/engine", address: BASE, kind: "byte-xor" as const }] };
    await extractAssets(f.root, request); const m = readManifest(f.root), store = new Store(f.root);
    assert.equal(m.assets.length, 1); assert.ok(m.evidence.some(e => /NOT an inferred game call/.test(e.detail)));
    assert.deepEqual(store.bytes(m.artifacts.find(a => a.processor === "byte-xor-v1")!.path), plain);
    assert.equal((await executeResource("verify", f.root)).outcome, "validated"); assert.match(document(f.root), /--transforms-json/);
    await assert.rejects(extractAssets(f.root, { transforms: [{ ...request.transforms[0]!, address: BASE + 4 }] }), /no checked/);
  } finally { f.cleanup(); }
});
test("missing/corrupt cache outputs regenerate; read-only verification never repairs corruption", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim()); await extractAssets(f.root);
    const m = readManifest(f.root), store = new Store(f.root), raw = m.nodes.find(n => n.kind === "resource")!, art = m.artifacts.find(a => a.stage === "export")!;
    f.put(`build/assets/${art.path}`, "bad"); await assert.rejects(executeResource("verify", f.root), /Corrupt blob/);
    const repaired = await extractAssets(f.root); assert.equal((repaired.statistics as any).decodes, 1);
    rmSync(store.path(raw.blob)); await extractAssets(f.root); assert.deepEqual(store.bytes(raw.blob), tim());
    for (const name of readdirSync(store.path("cache/v2"))) f.put(`build/assets/cache/v2/${name}`, "{");
    const reset = await extractAssets(f.root); assert.ok((reset.statistics as any).scans > 0);
    assert.equal((await executeResource("verify", f.root)).outcome, "validated");
    const forged = readManifest(f.root); forged.nodes.find(n => n.kind === "resource")!.metadata.width = 999;
    assert.throws(() => verifyManifest(store, forged), /Parser node extent\/metadata/);
  } finally { f.cleanup(); }
});
test("budgets, cancellation and input mutation never replace a complete catalog with a prefix", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim()); await extractAssets(f.root); const before = document(f.root), old = readManifest(f.root);
    await assert.rejects(extractAssets(f.root, { limits: { maxFileBytes: 1 } }), /budget-exhausted/);
    await assert.rejects(extractAssets(f.root, { limits: { maxOutputBytes: 1 } }), /budget-exhausted/);
    f.put("extracted/resource", Buffer.concat([tim(), tim()])); await assert.rejects(extractAssets(f.root, { limits: { maxAssets: 1 } }), /budget-exhausted/);
    assert.equal(document(f.root), before); assert.deepEqual(readManifest(f.root), old);
    const controller = new AbortController(); controller.abort(); await assert.rejects(extractAssets(f.root, {}, controller.signal), /abort/i);
    f.put("extracted/resource", tim());
    await assert.rejects(extractAssets(f.root, {}, undefined, undefined, { beforePublish: () => f.put("extracted/resource", "changed") }), /input-drift/);
    assert.equal(document(f.root), before); assert.deepEqual(readManifest(f.root), old);
  } finally { f.cleanup(); }
});
test("containment, symlinks, concurrent publication locks and handwritten notes are protected", async () => {
  const f = fixture();
  try {
    f.put("extracted/resource", tim()); const store = new Store(f.root);
    await assert.rejects(extractAssets(f.root, { input: "../" }), /escapes/); await assert.rejects(extractAssets(f.root, { input: "src" }), /escapes/);
    symlinkSync(join(f.root, "extracted/resource"), join(f.root, "extracted/link")); await assert.rejects(extractAssets(f.root), /symlink/i); rmSync(join(f.root, "extracted/link"));
    await store.lock("extraction", async () => { await assert.rejects(extractAssets(f.root), /locked/); });
    f.put("notes/asset-provenance.md", "human prose"); await assert.rejects(extractAssets(f.root), /handwritten/);
    assert.equal(document(f.root), "human prose"); assert.equal(existsSync(store.path("manifest.json")), false);
    assert.throws(() => safePath(f.root, "/etc/passwd"), /escapes/);
  } finally { f.cleanup(); }
});
test("argument/request contracts have no shell expansion, universal schema, resume or commit API", () => {
  const f = fixture();
  try {
    assert.deepEqual(splitArguments('--input "extracted/a b" --force'), ["--input", "extracted/a b", "--force"]);
    assert.throws(() => splitArguments("'unfinished"), /Unterminated/);
    assert.throws(() => parseArguments(["--run", "old"], f.root), /retired/);
    assert.throws(() => parseArguments(["--schemas", "../../outside"], f.root), /escapes/);
    assert.equal(parseArguments(["--verify"], f.root).operation, "verify");
    assert.throws(() => validateRequest("extract", { commit: true } as never), /Unsupported/);
    assert.throws(() => validateRequest("verify", { force: true }), /Unsupported/);
    assert.equal(hash(canonical({ b: 2, a: 1 })), hash(canonical({ a: 1, b: 2 })));
  } finally { f.cleanup(); }
});
test("registry extensions validate domains/outputs; unsupported variants are never invented", async () => {
  const parser: AssetParser = { id: "fixture-v1", format: "Fixture", version: 1, probe: (b, o) => b[o] === 0xfa,
    parse: (b, o) => { if (b[o + 1] !== 2) throw new Error("invalid"); return { length: 2, metadata: {} }; }, variants: () => [{}], decode: bytes => [{ kind: "bytes", extension: "bin", stage: "export", bytes, metadata: {} }] };
  const registry = new ParserRegistry([TIM_PARSER, parser]), scanned = await registry.scan(Buffer.concat([Buffer.from([1, 0xfa, 2, 0xfa, 99]), tim()]), 100);
  assert.equal(scanned.matches.length, 2); assert.equal(scanned.rejected, 1);
  const bytes = Buffer.from([0xfa, 2]); assert.deepEqual(registry.replay(parser.id, bytes, {}, "bytes", 100).bytes, bytes);
  assert.throws(() => registry.decode(parser.id, bytes, { invented: true }, 100), /variant/);
  assert.throws(() => registry.decode(parser.id, bytes, {}, 1), /budget/); assert.throws(() => new ParserRegistry([parser, parser]), /duplicate/);
});
