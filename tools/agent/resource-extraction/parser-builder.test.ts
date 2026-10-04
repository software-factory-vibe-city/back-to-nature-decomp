import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parserOperation, parserSourcePolicy, PARSER_CONFIG, PARSER_ROOT } from "./parser-builder.ts";
import { fixture } from "./test-fixtures.ts";
function git(root: string, args: string[]) { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); }
function project() {
  const f = fixture();
  f.put(".gitignore", "build/\nextracted/\n"); f.put("package.json", '{"type":"module"}\n');
  f.put(PARSER_CONFIG, 'import type { AssetParser } from "./registry.ts";\nexport const EXTRA_PARSERS: AssetParser[] = [];\n');
  f.put("tools/agent/resource-extraction/registry.ts", 'export interface AssetParser { id: string; format: string; version: number; probe: (b: Buffer, o: number) => boolean; parse: (b: Buffer, o: number) => {length: number; metadata: Record<string, unknown>}; variants: (b: Buffer) => Array<Record<string, unknown>>; decode: (b: Buffer, p: Record<string, unknown>, m: number) => Array<{kind: string; extension: string; stage: "export"; bytes: Buffer; metadata: Record<string, unknown>}> }\n');
  git(f.root, ["init", "-q"]); git(f.root, ["config", "user.name", "Resource Test"]); git(f.root, ["config", "user.email", "test@example.invalid"]); git(f.root, ["config", "commit.gpgsign", "false"]);
  git(f.root, ["add", "."]); git(f.root, ["commit", "-qm", "fixture"]); return f;
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
test("parser syntax policy rejects I/O/dynamic imports and accepts pure tests", () => {
  assert.throws(() => parserSourcePolicy(PARSER_ROOT + "bad.ts", 'import fs from "node:fs";'), /import/);
  assert.throws(() => parserSourcePolicy(PARSER_ROOT + "bad.ts", 'const io = import("node:fs");'), /Dynamic/);
  assert.throws(() => parserSourcePolicy(PARSER_ROOT + "bad.ts", 'globalThis.x = 1;'), /Forbidden/);
  assert.doesNotThrow(() => parserSourcePolicy(PARSER_ROOT + "ok.test.ts", 'import test from "node:test"; const text = "process"; test("pure", () => text);'));
  assert.throws(() => parserSourcePolicy(PARSER_CONFIG, 'export const EXTRA_PARSERS = (() => [])();'), /literal/);
});
test("successful parser test/accept performs no Git mutation and tolerates concurrent unrelated work", async () => {
  const f = project();
  try {
    f.put("unrelated.txt", "staged"); git(f.root, ["add", "unrelated.txt"]);
    const head = git(f.root, ["rev-parse", "HEAD"]), index = git(f.root, ["diff", "--cached"]), prepared = await parserOperation(f.root, { action: "prepare" });
    addParser(f.put); f.put("src/concurrent.c", "another agent's change");
    const result = await parserOperation(f.root, { action: "accept", baseline: prepared.baseline as string });
    assert.equal(result.outcome, "parser-tested", JSON.stringify(result)); assert.ok(Number(result.testsExecuted) > 3);
    assert.equal(git(f.root, ["rev-parse", "HEAD"]), head); assert.equal(git(f.root, ["diff", "--cached"]), index);
    assert.equal(readFileSync(join(f.root, "src/concurrent.c"), "utf8"), "another agent's change");
  } finally { f.cleanup(); }
});
test("failed tests keep drafts; no implicit discard/reset API", async () => {
  const f = project();
  try {
    const prepared = await parserOperation(f.root, { action: "prepare" }); addParser(f.put, true);
    const result = await parserOperation(f.root, { action: "accept", baseline: prepared.baseline as string });
    assert.equal(result.outcome, "failed", JSON.stringify(result)); assert.match(readFileSync(join(f.root, PARSER_CONFIG), "utf8"), /FIXTURE/);
    await assert.rejects(parserOperation(f.root, { action: "discard", baseline: prepared.baseline } as never), /never automatically restored/);
  } finally { f.cleanup(); }
});
test("HEAD changes do not invalidate a tested parser capability", async () => {
  const f = project();
  try {
    const prepared = await parserOperation(f.root, { action: "prepare" }); addParser(f.put);
    f.put("other.txt", "another agent"); git(f.root, ["add", "other.txt"]); git(f.root, ["commit", "-qm", "concurrent fixture work"]);
    const head = git(f.root, ["rev-parse", "HEAD"]);
    assert.equal((await parserOperation(f.root, { action: "accept", baseline: prepared.baseline as string })).outcome, "parser-tested");
    assert.equal(git(f.root, ["rev-parse", "HEAD"]), head);
  } finally { f.cleanup(); }
});
test("registration alone and empty/skipped parser suites cannot qualify", async () => {
  const f = project();
  try {
    addParser(f.put); f.put(PARSER_CONFIG, 'import type { AssetParser } from "./registry.ts";\nexport const EXTRA_PARSERS: AssetParser[] = [];\n');
    const prepared = await parserOperation(f.root, { action: "prepare" });
    f.put(PARSER_CONFIG, 'import type { AssetParser } from "./registry.ts";\nimport { FIXTURE } from "./parsers/fixture.ts";\nexport const EXTRA_PARSERS: AssetParser[] = [FIXTURE];\n');
    await assert.rejects(parserOperation(f.root, { action: "test", baseline: prepared.baseline as string }), /corresponding test/);
    const fresh = await parserOperation(f.root, { action: "prepare" });
    f.put(PARSER_ROOT + "fixture.ts", readFileSync(join(f.root, PARSER_ROOT + "fixture.ts"), "utf8") + "/* changed implementation */\n");
    f.put(PARSER_ROOT + "fixture.test.ts", 'import test from "node:test"; test.skip("not executed", () => {});\n');
    assert.equal((await parserOperation(f.root, { action: "accept", baseline: fresh.baseline as string })).outcome, "failed");
  } finally { f.cleanup(); }
});
test("capability gate reruns existing parser suites, not only changed files", async () => {
  const f = project();
  try {
    f.put(PARSER_ROOT + "existing.test.ts", 'import test from "node:test"; import assert from "node:assert/strict"; test("existing regression", () => assert.fail("existing failure"));\n');
    const prepared = await parserOperation(f.root, { action: "prepare" }); addParser(f.put);
    const result = await parserOperation(f.root, { action: "accept", baseline: prepared.baseline as string });
    assert.equal(result.outcome, "failed");
    assert.ok((result.tests as Array<{file: string; passed: boolean}>).some(r => r.file.endsWith("existing.test.ts") && !r.passed));
  } finally { f.cleanup(); }
});
test("parser source drift during fixed-argv checks cannot earn acceptance", async () => {
  const f = project();
  try {
    const prepared = await parserOperation(f.root, { action: "prepare" }); addParser(f.put);
    const checking = parserOperation(f.root, { action: "accept", baseline: prepared.baseline as string });
    setImmediate(() => f.put(PARSER_ROOT + "fixture.ts", readFileSync(join(f.root, PARSER_ROOT + "fixture.ts"), "utf8") + "/* concurrent parser edit */\n"));
    await assert.rejects(checking, /Parser source drift/);
    assert.match(readFileSync(join(f.root, PARSER_ROOT + "fixture.ts"), "utf8"), /concurrent parser edit/);
  } finally { f.cleanup(); }
});
