import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { git } from "./git.ts";
import { iterationOperation } from "./iteration.ts";
import { parserOperation, parserSourcePolicy, PARSER_CONFIG, PARSER_ROOT } from "./parser-builder.ts";
import { executeResource } from "./pipeline.ts";
function project() {
  const root = mkdtempSync(join(tmpdir(), "resource-iterations-"));
  const put = (path: string, text: string | Buffer) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  put(".gitignore", "build/\nextracted/\n"); put("package.json", '{"type":"module"}\n');
  put(PARSER_CONFIG, 'import type { AssetParser } from "./registry.ts";\nexport const EXTRA_PARSERS: AssetParser[] = [];\n');
  put("tools/agent/resource-extraction/registry.ts", 'export interface AssetParser { id: string; format: string; version: number; probe: (b: Buffer, o: number) => boolean; parse: (b: Buffer, o: number) => {length: number; metadata: Record<string, unknown>}; variants: (b: Buffer) => Array<Record<string, unknown>>; decode: (b: Buffer, p: Record<string, unknown>, m: number) => Array<{kind: string; extension: string; stage: "export"; bytes: Buffer; metadata: Record<string, unknown>}> }\n');
  git(root, ["init", "-q"]); git(root, ["config", "user.name", "Resource Test"]); git(root, ["config", "user.email", "test@example.invalid"]); git(root, ["config", "commit.gpgsign", "false"]);
  git(root, ["add", "."]); git(root, ["commit", "-qm", "fixture"]);
  return { root, put, done: () => rmSync(root, { recursive: true, force: true }) };
}
function addParser(put: (path: string, text: string) => void, failing = false) {
  put(PARSER_ROOT + "fixture.ts", `import type { AssetParser } from "../registry.ts";
export const FIXTURE: AssetParser = {
 id: "fixture-v1", format: "Fixture", version: 1,
 probe: (b, o) => b[o] === 0xfa,
 parse: (b, o) => { if (o + 2 > b.length || b[o] !== 0xfa || b[o + 1] !== 2) throw new Error("invalid"); return {length: 2, metadata: {}}; },
 variants: () => [{}],
 decode: (b, _p, m) => { if (b.length > m) throw new Error("budget"); return [{kind: "raw", extension: "bin", stage: "export", bytes: b, metadata: {}}]; }
};\n`);
  put(PARSER_ROOT + "fixture.test.ts", `import test from "node:test"; import assert from "node:assert/strict"; import { FIXTURE } from "./fixture.ts";
test("positive fixture", () => assert.equal(FIXTURE.parse(Buffer.from([0xfa, 2]), 0).length, ${failing ? 9 : 2}));
test("malformed and truncated", () => { assert.throws(() => FIXTURE.parse(Buffer.from([0xfa]), 0)); assert.throws(() => FIXTURE.parse(Buffer.from([0xfa, 99]), 0)); });
test("budgets and magic", () => { assert.equal(FIXTURE.probe(Buffer.from([0]), 0), false); assert.throws(() => FIXTURE.decode(Buffer.alloc(2), {}, 1)); });\n`);
  put(PARSER_CONFIG, 'import type { AssetParser } from "./registry.ts";\nimport { FIXTURE } from "./parsers/fixture.ts";\nexport const EXTRA_PARSERS: AssetParser[] = [FIXTURE];\n');
}
test("parser source policy reads syntax, rejects I/O/dynamic imports and allows pure tests", () => {
  assert.throws(() => parserSourcePolicy(PARSER_ROOT + "bad.ts", 'import fs from "node:fs";'), /import/);
  assert.throws(() => parserSourcePolicy(PARSER_ROOT + "bad.ts", 'const io = import("node:fs");'), /Dynamic/);
  assert.throws(() => parserSourcePolicy(PARSER_ROOT + "bad.ts", 'globalThis.x = 1;'), /Forbidden/);
  assert.doesNotThrow(() => parserSourcePolicy(PARSER_ROOT + "ok.test.ts", 'import test from "node:test"; const text = "process"; test("pure", () => text);'));
  assert.throws(() => parserSourcePolicy(PARSER_CONFIG, 'export const EXTRA_PARSERS = (() => [])();'), /literal/);
});
test("tested parser iteration commits only its implementation/tests/registration, not uncharged dirt", async () => {
  const f = project();
  try {
    f.put("unrelated.txt", "preserve me");
    const prepared = await parserOperation(f.root, { action: "prepare" });
    addParser(f.put);
    const result = await parserOperation(f.root, { action: "accept", baseline: prepared.baseline as string, commit: true });
    assert.equal(result.outcome, "parser-committed", JSON.stringify(result));
    assert.match(git(f.root, ["log", "-1", "--format=%s"]), /Implement resource parser/);
    assert.deepEqual(git(f.root, ["show", "--format=", "--name-only", "HEAD"]).split("\n").sort(), [PARSER_CONFIG, PARSER_ROOT + "fixture.test.ts", PARSER_ROOT + "fixture.ts"].sort());
    assert.equal(readFileSync(join(f.root, "unrelated.txt"), "utf8"), "preserve me");
  } finally { f.done(); }
});
test("failed parser tests never commit, and discarded scope is restored without touching other work", async () => {
  const f = project();
  try {
    const head = git(f.root, ["rev-parse", "HEAD"]), original = readFileSync(join(f.root, PARSER_CONFIG), "utf8");
    const prepared = await parserOperation(f.root, { action: "prepare" }); addParser(f.put, true);
    const result = await parserOperation(f.root, { action: "accept", baseline: prepared.baseline as string, commit: true });
    assert.equal(result.outcome, "failed", JSON.stringify(result)); assert.ok(Number(result.testsExecuted) >= 24); assert.equal(git(f.root, ["rev-parse", "HEAD"]), head);
    f.put("outside.txt", "new unrelated work");
    await parserOperation(f.root, { action: "discard", baseline: prepared.baseline as string });
    assert.equal(readFileSync(join(f.root, PARSER_CONFIG), "utf8"), original);
    assert.equal(existsSync(join(f.root, PARSER_ROOT + "fixture.ts")), false);
    assert.match(readFileSync(join(f.root, "build/assets/loop/failed", prepared.baseline as string, (PARSER_ROOT + "fixture.ts").replaceAll("/", "_")), "utf8"), /fixture-v1/);
    assert.equal(readFileSync(join(f.root, "outside.txt"), "utf8"), "new unrelated work");
  } finally { f.done(); }
});
test("parser acceptance requires explicit commit permission, not merely passing tests", async () => {
  const f = project();
  try {
    const head = git(f.root, ["rev-parse", "HEAD"]), prepared = await parserOperation(f.root, { action: "prepare" }); addParser(f.put);
    await assert.rejects(parserOperation(f.root, { action: "accept", baseline: prepared.baseline as string }), /explicit commit permission/);
    assert.equal(git(f.root, ["rev-parse", "HEAD"]), head);
  } finally { f.done(); }
});
test("registration alone is not a new capability; it must reference the changed implementation", async () => {
  const f = project();
  try {
    addParser(f.put);
    f.put(PARSER_CONFIG, 'import type { AssetParser } from "./registry.ts";\nexport const EXTRA_PARSERS: AssetParser[] = [];\n');
    git(f.root, ["add", "tools"]); git(f.root, ["commit", "-qm", "unregistered plugin fixture"]);
    const prepared = await parserOperation(f.root, { action: "prepare" });
    f.put(PARSER_ROOT + "other.ts", "export const text = 1;\n");
    f.put(PARSER_ROOT + "other.test.ts", 'import test from "node:test"; test("other", () => {});\n');
    f.put(PARSER_CONFIG, 'import type { AssetParser } from "./registry.ts";\nimport { FIXTURE } from "./parsers/fixture.ts";\nexport const EXTRA_PARSERS: AssetParser[] = [FIXTURE];\n');
    await assert.rejects(parserOperation(f.root, { action: "accept", baseline: prepared.baseline as string, commit: true }), /changed parser implementation/);
  } finally { f.done(); }
});
test("parser head/scope drift is not silently committed or rolled back", async () => {
  const f = project();
  try {
    const prepared = await parserOperation(f.root, { action: "prepare" }); addParser(f.put);
    f.put("other.txt", "another change");
    await assert.rejects(parserOperation(f.root, { action: "accept", baseline: prepared.baseline as string, commit: true }), /Out-of-scope/);
    git(f.root, ["add", "other.txt"]); git(f.root, ["commit", "-qm", "other agent"]);
    await assert.rejects(parserOperation(f.root, { action: "discard", baseline: prepared.baseline as string }), /HEAD drift/);
    assert.match(readFileSync(join(f.root, PARSER_CONFIG), "utf8"), /FIXTURE/);
  } finally { f.done(); }
});
test("asset gate extracts, documents reproducible instructions, commits notes only and skips known assets", async () => {
  const f = project();
  try {
    const bytes = Buffer.alloc(22); bytes.writeUInt32LE(16); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(14, 8); bytes.writeUInt16LE(1, 16); bytes.writeUInt16LE(1, 18);
    f.put("extracted/resource", bytes);
    const next = await iterationOperation(f.root, { action: "next" });
    assert.equal(next.outcome, "asset-work");
    const accepted = await iterationOperation(f.root, { action: "asset", run: next.run as string, node: next.node as string, commit: true });
    assert.equal(accepted.outcome, "asset-committed");
    assert.equal(git(f.root, ["show", "--format=", "--name-only", "HEAD"]), "notes/asset-identification.md");
    assert.match(readFileSync(join(f.root, "notes/asset-identification.md"), "utf8"), /resourceCampaign\.ts --input 'extracted'/);
    assert.equal((await iterationOperation(f.root, { action: "next", run: next.run as string })).outcome, "parser-work");
    assert.equal((await iterationOperation(f.root, { action: "asset", run: next.run as string, node: next.node as string, commit: true })).outcome, "already-identified");
  } finally { f.done(); }
});
test("unrelated staged files prevent an asset commit and never enter it", async () => {
  const f = project();
  try {
    const bytes = Buffer.alloc(22); bytes.writeUInt32LE(16); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(14, 8); bytes.writeUInt16LE(1, 16); bytes.writeUInt16LE(1, 18);
    f.put("extracted/resource", bytes); f.put("other.txt", "staged"); git(f.root, ["add", "other.txt"]);
    const head = git(f.root, ["rev-parse", "HEAD"]);
    const run = await executeResource("campaign", f.root), next = await iterationOperation(f.root, { action: "next", run: run.run as string });
    await assert.rejects(iterationOperation(f.root, { action: "asset", run: next.run as string, node: next.node as string, commit: true }), /Unrelated staged/);
    assert.equal(git(f.root, ["rev-parse", "HEAD"]), head);
  } finally { f.done(); }
});
