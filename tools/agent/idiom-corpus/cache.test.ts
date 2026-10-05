import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { targetProgram } from "../idiomSearch.js";
import { requireFunctionLocation, withSymbolMetadata } from "../../lib/symbolIndex.js";
import { buildCorpus, corpusCandidates, excludedReason, loadCorpus } from "./corpus.js";

test("incremental regions equal a frozen full build and exclusions do not poison later queries", () => withSymbolMetadata(() => {
  const candidates = corpusCandidates();
  const eligible = candidates.filter((c) => !excludedReason(readFileSync(c.sourcePath, "utf8"))).slice(0, 2).map((c) => c.functionName);
  assert.equal(eligible.length, 2);
  const exclude = candidates.filter((c) => !eligible.includes(c.functionName)).map((c) => c.functionName);
  for (const name of eligible) {
    const { container } = requireFunctionLocation(name);
    rmSync(join(ROOT, "build/idiomCorpus/regions", container.id, "tier0", name + ".json"), { force: true });
  }
  const full = buildCorpus(targetProgram, { exclude });
  let calls = 0; const lift = (name: string) => { calls++; return targetProgram(name); };
  assert.deepEqual(loadCorpus(lift, { exclude }), full); assert.equal(calls, 2);
  calls = 0; assert.deepEqual(loadCorpus(lift, { exclude }), full); assert.equal(calls, 0);
  loadCorpus(lift, { exclude: [...exclude, eligible[0]!] }); assert.equal(calls, 0);
  assert.deepEqual(loadCorpus(lift, { exclude }), full); assert.equal(calls, 0);
}));
