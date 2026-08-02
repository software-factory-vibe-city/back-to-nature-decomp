import assert from "node:assert/strict";
import test from "node:test";
import { parseFunctionDiffSummary } from "./gates.ts";

test("parses the current LCS-aligned masked-match summary", () => {
  const result = parseFunctionDiffSummary(
    "Masked match: 214/214 instructions (100.0%, LCS-aligned)\nVERIFIED: byte-identical in linked binary (relocations included).\n",
  );

  assert.deepEqual(result, {
    matchedInstructions: 214,
    totalInstructions: 214,
    matchPercent: 100,
  });
});

test("continues to parse the legacy index-aligned match summary", () => {
  const result = parseFunctionDiffSummary("Match: 80/81 instructions (98.8%)\n");

  assert.deepEqual(result, {
    matchedInstructions: 80,
    totalInstructions: 81,
    matchPercent: 98.8,
  });
});

test("uses the last summary and returns zeroes when no summary exists", () => {
  assert.deepEqual(
    parseFunctionDiffSummary("Match: 1/2 instructions (50.0%)\nMasked match: 2/2 instructions (100.0%, LCS-aligned)\n"),
    { matchedInstructions: 2, totalInstructions: 2, matchPercent: 100 },
  );
  assert.deepEqual(
    parseFunctionDiffSummary("diff command failed before producing a summary\n"),
    { matchedInstructions: 0, totalInstructions: 0, matchPercent: 0 },
  );
});
