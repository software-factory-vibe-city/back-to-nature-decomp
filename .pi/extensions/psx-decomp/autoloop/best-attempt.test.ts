import { strict as assert } from "node:assert";
import { test } from "node:test";
import { chooseParkAttempt } from "./best-attempt.ts";
import { recordExperiment } from "../../../../tools/agent/experimentLedger.ts";
import type { ResidualObjective } from "../../../../tools/agent/pipeline-reversal/objective.ts";

let counter = 0;
function uniqueFunction(): string {
  counter += 1;
  return `func_parkattempt${process.pid}${counter}`;
}

function measure(functionName: string, text: string, key: number[], words: number, exact = false) {
  recordExperiment({
    functionName,
    source: `build/variants/${key.join("")}.c`,
    sourceText: text,
    outputHash: `out-${text.length}-${key.join("")}`,
    objective: { key, exact } as ResidualObjective,
    matchedWords: words,
    totalWords: 100,
    verdict: "scored",
    at: "2026-08-22T00:00:00.000Z",
  });
}

test("with no measured history the source on disk is what gets preserved", () => {
  const name = uniqueFunction();
  const choice = chooseParkAttempt(process.cwd(), name, "int on_disk;");
  assert.equal(choice.origin, "on-disk");
  assert.equal(choice.text, "int on_disk;");
  assert.match(choice.note, /no measured history/);
});

test("the best measured program is preserved, not the last one left on disk", () => {
  const name = uniqueFunction();
  measure(name, "int better;", [0, 0, 1, 1], 98);
  measure(name, "int worse;", [0, 4, 1, 1], 90);

  const choice = chooseParkAttempt(process.cwd(), name, "int worse;");
  assert.equal(choice.origin, "ledger");
  assert.equal(choice.text, "int better;");
  assert.equal(choice.supersededText, "int worse;");
  /* The note has to say what happened, because a park that silently swaps the
     program is worse than one that keeps the wrong one. */
  assert.match(choice.note, /rather than the source left on disk/);
  assert.match(choice.note, /\[0, 0, 1, 1\]/);
});

test("when the source on disk already is the best, nothing is swapped", () => {
  const name = uniqueFunction();
  measure(name, "int best;", [0, 0, 1, 0], 99);
  measure(name, "int other;", [0, 2, 0, 0], 95);

  const choice = chooseParkAttempt(process.cwd(), name, "int best;");
  assert.equal(choice.origin, "on-disk");
  assert.equal(choice.supersededText, undefined);
  assert.match(choice.note, /is the best measured program/);
});

test("an exact row outranks every key", () => {
  const name = uniqueFunction();
  measure(name, "int zerokey;", [0, 0, 0, 0], 99, false);
  measure(name, "int exact;", [0, 0, 3, 2], 100, true);

  const choice = chooseParkAttempt(process.cwd(), name, "int zerokey;");
  assert.equal(choice.text, "int exact;");
  assert.match(choice.note, /EXACT/);
});
