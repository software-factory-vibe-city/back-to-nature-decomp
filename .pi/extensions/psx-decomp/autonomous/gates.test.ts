import assert from "node:assert/strict";
import test from "node:test";
import { parseFunctionDiffSummary } from "./gates.ts";

test("parses the oracle's word count and verdict", () => {
  const result = parseFunctionDiffSummary(
    "Match: 214/214 words (100.0%)\nVERDICT: MATCH — every word is byte-identical to the original after relocation.\n",
  );

  assert.deepEqual(result, {
    matchedInstructions: 214,
    totalInstructions: 214,
    matchPercent: 100,
    verdict: "match",
  });
});

test("a mismatch is reported as such even at a high word count", () => {
  const result = parseFunctionDiffSummary(
    "Match: 80/81 words (98.8%)\nVERDICT: MISMATCH — 1 word(s) differ.\n",
  );

  assert.deepEqual(result, {
    matchedInstructions: 80,
    totalInstructions: 81,
    matchPercent: 98.8,
    verdict: "mismatch",
  });
});

test("an undetermined verdict is kept distinct from a match, even at a full count", () => {
  const result = parseFunctionDiffSummary(
    "Match: 9/9 words (100.0%)\nVERDICT: UNDETERMINED — 1 word(s) could not be resolved; nothing else differs.\n",
  );

  assert.equal(result.verdict, "undetermined");
  assert.equal(result.matchedInstructions, result.totalInstructions);
});

test("uses the last summary and reports nothing rather than a pass when there is none", () => {
  assert.deepEqual(
    parseFunctionDiffSummary("Match: 1/2 words (50.0%)\nVERDICT: MISMATCH\nMatch: 2/2 words (100.0%)\nVERDICT: MATCH\n"),
    { matchedInstructions: 2, totalInstructions: 2, matchPercent: 100, verdict: "match" },
  );
  assert.deepEqual(
    parseFunctionDiffSummary("diff command failed before producing a summary\n"),
    { matchedInstructions: 0, totalInstructions: 0, matchPercent: 0, verdict: "unknown" },
  );
});
