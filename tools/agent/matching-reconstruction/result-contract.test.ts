/**
 * The result contract: what a consumer may read, and on whose authority.
 *
 * The defects under test are the ones the plan names. A previous run's
 * `winner.c` must not be readable through this run's result. A best-effort
 * draft must survive a budget stop, not only domain exhaustion. Ranking must
 * use the complete difference count rather than the truncated sample, because
 * a truncated count makes every candidate past sixteen differences look
 * equally good and the winner becomes whichever ran first.
 */

import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";
import { sha256 } from "../provenance.js";
import { ArtifactRecorder, isRefusal, readResultArtifact, type LoadedResult } from "./result-contract.js";
import { MATCHING_RECONSTRUCTION_SCHEMA_VERSION, type ResultBundle } from "./types.js";
import { ALL_FAILURE_CATEGORIES, classifyUnknownWord, failureLayer, targetFeatures } from "./failure-category.js";
import { decodeBytes } from "./exec.js";

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "result-contract-"));
}

function bundleWith(directory: string, files: Record<string, string>): LoadedResult {
  const recorder = new ArtifactRecorder(directory);
  for (const [name, content] of Object.entries(files)) recorder.write(name, content);
  const bundle: ResultBundle = {
    schemaVersion: MATCHING_RECONSTRUCTION_SCHEMA_VERSION,
    functionName: "fixture",
    containerId: "exe",
    vram: 0x80010000,
    sizeBytes: 16,
    state: "domain-exhausted",
    candidates: [],
    artifacts: recorder.manifest(),
    inputsRead: [],
    compiles: 0,
    wallMs: 0,
  };
  return { bundle, stale: null, directory };
}

test("an artifact the manifest names, with matching bytes, is readable", () => {
  const directory = scratch();
  try {
    const loaded = bundleWith(directory, { "best-effort.c": "int main(void) { return 0; }\n" });
    const read = readResultArtifact(loaded, "best-effort.c");
    assert.ok(!isRefusal(read), "a manifested, unmodified artifact must be readable");
    assert.equal((read as { content: string }).content, "int main(void) { return 0; }\n");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a file left behind by an earlier run is refused, not consumed", () => {
  const directory = scratch();
  try {
    /* This run produced only a best-effort draft; `winner.c` on disk belongs
     * to some previous run and must not be readable through this result. */
    const loaded = bundleWith(directory, { "best-effort.c": "/* this run */\n" });
    writeFileSync(join(directory, "winner.c"), "/* last week's exact match */\n");
    const read = readResultArtifact(loaded, "winner.c");
    assert.ok(isRefusal(read), "an unmanifested file must be refused");
    assert.equal((read as { refused: string }).refused, "not-in-manifest");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("an artifact edited after the run is refused with the hash reason", () => {
  const directory = scratch();
  try {
    const loaded = bundleWith(directory, { "best-effort.c": "original\n" });
    writeFileSync(join(directory, "best-effort.c"), "edited by hand\n");
    const read = readResultArtifact(loaded, "best-effort.c");
    assert.ok(isRefusal(read));
    assert.equal((read as { refused: string }).refused, "hash-mismatch");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the recorder's manifest hashes exactly what it wrote", () => {
  const directory = scratch();
  try {
    const recorder = new ArtifactRecorder(directory);
    recorder.write("candidates/001.c", "candidate one\n");
    const manifest = recorder.manifest();
    assert.equal(manifest.files["candidates/001.c"], sha256("candidate one\n"));
    assert.equal(readFileSync(join(directory, "candidates/001.c"), "utf-8"), "candidate one\n");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

/* ---- the ranking defect --------------------------------------------------- */

test("the engine ranks best-effort by the complete difference count", () => {
  const source = readFileSync(join(ROOT, "tools/agent/matching-reconstruction/engine.ts"), "utf-8");
  assert.ok(
    source.includes("outcome.differingCount = oracle.differing.length"),
    "the complete count must be recorded, not only the truncated sample",
  );
  assert.ok(
    !/differingVram\?\.length\s*\?\?\s*9999/.test(source),
    "ranking must not read the truncated sample's length",
  );
  assert.ok(
    source.includes("bestEffortCandidate?.outcome.differingCount"),
    "the incumbent's complete count is what a challenger is compared against",
  );
});

test("a budget stop keeps its best-effort draft", () => {
  const source = readFileSync(join(ROOT, "tools/agent/matching-reconstruction/engine.ts"), "utf-8");
  /* The best-effort block must sit after the state decision and outside any
   * branch that only domain exhaustion reaches. */
  const stateBlock = source.indexOf('"budget-exhausted",');
  const bestEffortBlock = source.indexOf("if (bestEffortCandidate) {");
  assert.ok(stateBlock > 0 && bestEffortBlock > stateBlock, "best effort must be attached after every terminal state is settled");
});

test("candidates compile under the effective flag set, overrides included", () => {
  const source = readFileSync(join(ROOT, "tools/agent/matching-reconstruction/engine.ts"), "utf-8");
  assert.ok(
    !source.includes("useOverrides: false"),
    "reconstruction must not silently compile a different experiment from the production build",
  );
  assert.ok(source.includes("useOverrides: !options.ignoreFlagOverrides"));
});

/* ---- typed categories ----------------------------------------------------- */

test("every failure category belongs to exactly one layer", () => {
  for (const category of ALL_FAILURE_CATEGORIES) {
    assert.ok(failureLayer(category), `${category} has no layer`);
  }
  assert.equal(new Set(ALL_FAILURE_CATEGORIES).size, ALL_FAILURE_CATEGORIES.length);
});

test("undecoded words are classified by mechanism, not lumped together", () => {
  /* lwl $v0, 0($a0) — opcode 0x22. */
  assert.equal(classifyUnknownWord(0x88820000), "lwl-lwr");
  /* swr $v0, 0($a0) — opcode 0x2e. */
  assert.equal(classifyUnknownWord(0xb8820000), "swl-swr");
  /* break 0 — SPECIAL function 0x0d. */
  assert.equal(classifyUnknownWord(0x0000000d), "break");
  /* COP2 operation — opcode 0x12. */
  assert.equal(classifyUnknownWord(0x4a000012), "cop2");
});

test("population facts come from the words, not from a refusal message", () => {
  /* jal 0x80010000; nop; sw $v0, 0($a0); jr $ra; nop */
  const words = Buffer.alloc(20);
  words.writeUInt32LE(0x0c004000, 0);  /* jal */
  words.writeUInt32LE(0x00000000, 4);  /* nop */
  words.writeUInt32LE(0xac820000, 8);  /* sw v0, 0(a0) */
  words.writeUInt32LE(0x03e00008, 12); /* jr ra */
  words.writeUInt32LE(0x00000000, 16); /* nop */
  const features = targetFeatures(decodeBytes(words, 0x80020000));
  assert.equal(features.hasCalls, true, "a jal in the words is a call whatever the engine says");
  assert.equal(features.hasStores, true);
  assert.equal(features.hasBackEdge, false);
  assert.equal(features.words, 5);
});
