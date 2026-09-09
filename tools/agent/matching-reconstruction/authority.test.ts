/**
 * Phase A3 of plans/automatic-matching-reconstruction.md: diagnostic authority
 * is scoped. A replay, a closed-direction record, or a ledger conclusion can
 * inform a human; none of them may veto an independently byte-exact candidate
 * or seed a hard search exclusion. The engine enforces this structurally — it
 * never consults those modules — and this test keeps it that way: the only
 * verdict-bearing dependency allowed is the byte oracle itself.
 */

import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";

const FORBIDDEN = [
  "closedDirections",
  "closed-directions",
  "experimentLedger",
  "experiment-ledger",
  "pipeline-reversal/replay",
  "reversePipeline",
  "residualObjective",
];

test("the engine imports no diagnostic authority that could veto a candidate", () => {
  const directory = join(ROOT, "tools/agent/matching-reconstruction");
  const files = readdirSync(directory)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(directory, name));
  files.push(join(ROOT, "tools/agent/reconstructFunction.ts"));

  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    for (const forbidden of FORBIDDEN) {
      assert.ok(
        !source.includes(`/${forbidden}.js"`) && !source.includes(`/${forbidden}/`),
        `${file} imports ${forbidden}; a diagnostic module must not gate reconstruction`,
      );
    }
  }
});

test("the only match verdict the engine trusts is the byte oracle's", () => {
  const engine = readFileSync(join(ROOT, "tools/agent/matching-reconstruction/engine.ts"), "utf-8");
  assert.ok(engine.includes("compareFunction"), "the engine must verify through functionOracle.compareFunction");
  assert.ok(
    !/verdict\s*=\s*"match"/.test(engine.replace(/oracle\.verdict/g, "")),
    "no code path may declare a match without the oracle",
  );
});
