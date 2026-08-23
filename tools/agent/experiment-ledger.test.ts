import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  annotateRespellings,
  measurements,
  priorMeasurement,
  recordExperiment,
  readLedger,
  renderLedger,
  valley,
  type LedgerEntry,
} from "./experimentLedger.js";
import type { ResidualObjective } from "./pipeline-reversal/objective.js";

/* The ledger writes under build/, so each test uses its own function name to
 * stay independent of run order and of whatever else is on disk. */
function row(overrides: Partial<LedgerEntry> & Pick<LedgerEntry, "at" | "sourceHash" | "outputHash" | "key">): LedgerEntry {
  return {
    schemaVersion: 1,
    function: "func_1",
    source: `src/${overrides.sourceHash}.c`,
    matchedWords: 0,
    totalWords: 1,
    verdict: "mismatch",
    ...overrides,
  };
}

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

test("a respelling is recorded but is not a measurement", () => {
  const at = (n: number) => `2026-08-17T00:0${n}:00.000Z`;
  const entries: LedgerEntry[] = [
    row({ at: at(1), sourceHash: "s1", outputHash: "o1", key: [0, 0, 6, 30] }),
    row({ at: at(2), sourceHash: "s2", outputHash: "o2", key: [0, 0, 6, 28] }),
    /* Different source, same compiled words: an idea already tried. */
    row({ at: at(3), sourceHash: "s3", outputHash: "o1", key: [0, 0, 6, 30] }),
  ];

  const annotated = annotateRespellings(entries);
  assert.equal(annotated[0]!.respellingOf, undefined);
  assert.equal(annotated[1]!.respellingOf, undefined);
  assert.equal(annotated[2]!.respellingOf, at(1));

  /* The count that drives progress sees two, not three. */
  assert.deepEqual(measurements(entries).map((item) => item.at), [at(1), at(2)]);
});

test("respellings are named in the rendered history", () => {
  const at = (n: number) => `2026-08-17T00:0${n}:00.000Z`;
  const entries: LedgerEntry[] = [
    row({ at: at(1), sourceHash: "s1", outputHash: "o1", key: [0, 0, 6, 30] }),
    row({ at: at(2), sourceHash: "s2", outputHash: "o1", key: [0, 0, 6, 30] }),
  ];
  const text = renderLedger("func_1", entries);
  assert.match(text, /1 measurement\(s\), 1 respelling\(s\)/);
  assert.match(text, /RESPELLING of 2026-08-17T00:01:00/);
});

test("the first entry to reach an output is the measurement, whatever its source", () => {
  const at = (n: number) => `2026-08-17T00:0${n}:00.000Z`;
  /* Three spellings of one program: one measurement and two respellings, and
     the first one stays the measurement no matter how many follow. */
  const entries: LedgerEntry[] = [
    row({ at: at(1), sourceHash: "s1", outputHash: "o1", key: [0, 1, 0, 0] }),
    row({ at: at(2), sourceHash: "s2", outputHash: "o1", key: [0, 1, 0, 0] }),
    row({ at: at(3), sourceHash: "s3", outputHash: "o1", key: [0, 1, 0, 0] }),
  ];
  assert.deepEqual(measurements(entries).map((item) => item.at), [at(1)]);
  assert.deepEqual(annotateRespellings(entries).map((item) => item.respellingOf), [undefined, at(1), at(1)]);
});

/* --- the valley ---------------------------------------------------------- */

/** n distinct programs on one key, so a floor can be built without repetition. */
function floor(key: number[], count: number, from = 10): LedgerEntry[] {
  return Array.from({ length: count }, (_, index) => row({
    at: `2026-08-20T00:${String(from + index).padStart(2, "0")}:00.000Z`,
    sourceHash: `f${key.join("")}${from + index}`,
    outputHash: `o${key.join("")}${from + index}`,
    key,
    exact: false,
  }));
}

test("an isolated best one term from exact is a valley, and says which evidence made it one", () => {
  const entries = [
    ...floor([0, 0, 1, 0], 1),
    ...floor([0, 4, 1, 3], 1, 20),
    ...floor([0, 6, 2, 1], 1, 30),
    ...floor([0, 5, 1, 5], 1, 40),
  ];
  const reading = valley(entries)!;
  assert.ok(reading, "the best stands alone and everything measured is far worse");
  assert.deepEqual(reading.bestKey, [0, 0, 1, 0]);
  assert.equal(reading.bestTotal, 1);
  assert.equal(reading.nearestOther, 8);
  assert.ok(reading.evidence.includes("isolated"));
});

test("a crowded floor no sweep improves on is a valley too — the case isolation misses", () => {
  /* The shape that actually cost six sessions: dozens of programs a term or two
     from exact, none better than the best. The crowd is the tell, not the
     counter-evidence — every neighbour is a single-coordinate move that traded
     one term for another, which is what a multi-coordinate distance looks like
     from the inside. */
  const entries = [
    ...floor([0, 0, 1, 1], 1),
    ...floor([0, 0, 2, 0], 3, 20),
    ...floor([0, 1, 0, 0], 3, 30),
    ...floor([0, 0, 2, 1], 3, 40),
  ];
  const reading = valley(entries)!;
  assert.deepEqual(reading.evidence, ["unimproved"], "not isolated — the neighbours are right there");
  assert.equal(reading.unimproved, 9);
});

test("a search that is still moving is not a valley", () => {
  const entries = [
    ...floor([0, 6, 2, 1], 1),
    ...floor([0, 4, 1, 3], 1, 20),
    ...floor([0, 0, 1, 0], 1, 30),
  ];
  assert.equal(valley(entries), undefined, "the last measurement improved the best");
});

test("a solved function is never in a valley", () => {
  const entries = [
    ...floor([0, 4, 1, 3], 1),
    ...floor([0, 6, 2, 1], 1, 20),
    ...floor([0, 5, 1, 5], 1, 30),
    row({ at: "2026-08-20T01:00:00.000Z", sourceHash: "win", outputHash: "owin", key: [0, 0, 0, 0], exact: true }),
  ];
  assert.equal(valley(entries), undefined);
});

test("a best still far from exact is a search with a gradient, not a floor", () => {
  /* The advisory says single-coordinate moves cannot cross the remaining gap.
     With nine terms outstanding that is simply false, and saying it would send
     a search away from the sweep that is about to work. */
  const entries = [
    ...floor([0, 5, 2, 2], 1),
    ...floor([0, 20, 8, 9], 10, 20),
  ];
  assert.equal(valley(entries), undefined);
});

test("the advisory names the requirement side, not another spelling", () => {
  const reading = valley([
    ...floor([0, 0, 1, 0], 1),
    ...floor([0, 4, 1, 3], 1, 20),
    ...floor([0, 6, 2, 1], 1, 30),
    ...floor([0, 5, 1, 5], 1, 40),
  ])!;
  const text = renderLedger("func_valley", [
    ...floor([0, 0, 1, 0], 1),
    ...floor([0, 4, 1, 3], 1, 20),
    ...floor([0, 6, 2, 1], 1, 30),
    ...floor([0, 5, 1, 5], 1, 40),
  ]);
  assert.ok(reading);
  assert.match(text, /VALLEY:/);
  assert.match(text, /psx_target_loop_emission/);
  assert.match(text, /cluster-donor/);
});
