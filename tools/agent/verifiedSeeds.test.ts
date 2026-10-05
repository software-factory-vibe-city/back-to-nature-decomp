import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { seedOracle } from "./type-propagation/seeds.js";
import { withSymbolMetadata } from "../lib/symbolIndex.js";
import { withPreprocessorMetadata } from "./preprocessedCache.js";

test("verified bundles reuse relocated verification and keep inference views isolated", () => withSymbolMetadata(() => withPreprocessorMetadata(() => {
  const name = "CopyVec3", first = seedOracle("unused");
  const prototype = first.get(name); assert.ok(prototype, first.records[0]?.reason);
  assert.equal(first.records[0]?.status, "verified"); const bundle = first.bundle(name)!;
  const second = seedOracle("another-request"); assert.deepEqual(second.get(name), prototype);
  assert.equal(second.records[0]?.cache, "hit"); assert.equal(second.bundle(name)!.preprocessed, bundle.preprocessed);
  second.get(name)!.paramTypes![0] = "corrupted view";
  const third = seedOracle("third"); assert.notEqual(third.get(name)!.paramTypes![0], "corrupted view");
  const withheld = seedOracle("held-out", [name]); assert.equal(withheld.get(name), undefined); assert.equal(withheld.records[0]?.status, "withheld");
  const restricted = seedOracle("restricted", [], []); assert.equal(restricted.get(name), undefined); assert.equal(restricted.bundle(name), undefined);
  assert.equal(restricted.records[0]?.status, "withheld");
  const permitted = seedOracle("permitted", [], [name]); assert.ok(permitted.get(name)); assert.equal(permitted.records[0]?.cache, "hit");
  const missing = seedOracle("absent"); assert.equal(missing.get("no_such_original_function"), undefined);
})));
test("a changed cached object is not a relocated-byte witness", () => withSymbolMetadata(() => withPreprocessorMetadata(() => {
  const first = seedOracle("first"); assert.ok(first.get("CopyVec3")); const path = first.bundle("CopyVec3")!.object;
  const original = readFileSync(path);
  try {
    writeFileSync(path, "interrupted object");
    const retry = seedOracle("retry"); assert.ok(retry.get("CopyVec3"), retry.records[0]?.reason); assert.equal(retry.records[0]?.cache, "miss");
    assert.deepEqual(readFileSync(path), original);
  } finally { writeFileSync(path, original); }
})));
