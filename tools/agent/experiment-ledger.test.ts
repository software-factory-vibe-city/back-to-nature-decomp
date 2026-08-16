import { strict as assert } from "node:assert";
import { test } from "node:test";
import { priorMeasurement, recordExperiment, readLedger, renderLedger } from "./experimentLedger.js";
import type { ResidualObjective } from "./pipeline-reversal/objective.js";

/* The ledger writes under build/, so each test uses its own function name to
 * stay independent of run order and of whatever else is on disk. */
let counter = 0;
function uniqueFunction(): string {
  counter += 1;
  return `func_ledgertest${process.pid}${counter}`;
}

function objective(key: number[]): ResidualObjective {
  return { key } as ResidualObjective;
}

function entry(functionName: string, source: string, outputHash: string, key: number[], sourceText: string) {
  return {
    functionName,
    source,
    sourceText,
    outputHash,
    objective: objective(key),
    matchedWords: key[3] ?? 0,
    totalWords: 100,
    verdict: "scored",
    at: "2026-08-16T00:00:00.000Z",
  };
}

test("a measurement is recorded and read back", () => {
  const name = uniqueFunction();
  recordExperiment(entry(name, "src/a.c", "out1", [0, 0, 6, 30], "int a;"));
  const entries = readLedger(name);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.outputHash, "out1");
  assert.deepEqual(entries[0]!.key, [0, 0, 6, 30]);
});

test("re-measuring an unchanged source does not grow the ledger", () => {
  const name = uniqueFunction();
  recordExperiment(entry(name, "src/a.c", "out1", [0, 0, 6, 30], "int a;"));
  const second = recordExperiment(entry(name, "src/a.c", "out1", [0, 0, 6, 30], "int a;"));
  assert.equal(second, undefined, "an identical re-measure is a no-op");
  assert.equal(readLedger(name).length, 1);
});

test("a different spelling with the same output is recorded and reported as a repeat", () => {
  const name = uniqueFunction();
  recordExperiment(entry(name, "src/a.c", "out1", [0, 0, 6, 30], "int a;"));
  recordExperiment(entry(name, "build/variants/b.c", "out1", [0, 0, 6, 30], "int a; /* respelled */"));

  const entries = readLedger(name);
  assert.equal(entries.length, 2, "a new source text is a new row even when the output repeats");

  /* This is the expensive repeat: it looks like a new idea from the source
   * side and is the same experiment from the compiler's side. */
  const prior = priorMeasurement(name, "int a; /* a third spelling */", "out1");
  assert.ok(prior.sameOutput, "an output seen before must be found");
  assert.equal(prior.sameSource, undefined, "the source text is genuinely new");

  assert.match(renderLedger(name, entries), /REPEATED EXPERIMENTS/);
});

test("the best key is the lexicographically smallest, not the highest word count", () => {
  const name = uniqueFunction();
  /* The whole point of the staged residual: more matching words can accompany
   * a worse schedule, and the ledger must not crown that row. */
  recordExperiment({ ...entry(name, "src/worse.c", "out1", [0, 0, 10, 20], "a"), matchedWords: 240 });
  recordExperiment({ ...entry(name, "src/better.c", "out2", [0, 0, 6, 30], "b"), matchedWords: 228 });

  assert.match(renderLedger(name, readLedger(name)), /best key so far: \[0, 0, 6, 30\] from src\/better\.c/);
});

test("an empty ledger says so rather than failing", () => {
  const name = uniqueFunction();
  assert.deepEqual(readLedger(name), []);
  assert.match(renderLedger(name, []), /no measurements recorded yet/);
});
