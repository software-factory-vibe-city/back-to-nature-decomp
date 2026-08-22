import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readClosed, recordClosed, renderClosed } from "./closedDirections.js";

let counter = 0;
function uniqueFunction(): string {
  counter += 1;
  return `func_closedtest${process.pid}${counter}`;
}

test("an answered question is recorded once, however many sessions answer it", () => {
  const name = uniqueFunction();
  const first = recordClosed({
    functionName: name,
    tool: "psx_solve_local_allocation",
    question: "can any web assignment produce s0 for the address?",
    verdict: "closed",
    result: "UNSAT_WITHIN_BOUNDS",
    evidence: "bounded at 4 webs, 12s",
    at: "2026-08-22T00:00:00.000Z",
  });
  assert.ok(first, "the first answer is recorded");

  /* Two sessions discovering the same UNSAT is one fact. Recording it twice
     would make repetition look like corroboration. */
  const second = recordClosed({
    functionName: name,
    tool: "psx_solve_local_allocation",
    question: "can any web assignment produce s0 for the address?",
    verdict: "closed",
    result: "UNSAT_WITHIN_BOUNDS (rediscovered)",
    at: "2026-08-23T00:00:00.000Z",
  });
  assert.equal(second, undefined);
  assert.equal(readClosed(name).length, 1);
});

test("a different verdict on the same question is a new fact", () => {
  const name = uniqueFunction();
  recordClosed({ functionName: name, tool: "t", question: "q", verdict: "inconclusive", result: "hit the bound" });
  recordClosed({ functionName: name, tool: "t", question: "q", verdict: "closed", result: "UNSAT" });
  assert.equal(readClosed(name).length, 2);
});

test("the record renders as a block a turn message can carry, and is empty when there is none", () => {
  const name = uniqueFunction();
  assert.equal(renderClosed(name), "");
  recordClosed({ functionName: name, tool: "psx_search_source_shapes", question: "is the domain empty?", verdict: "closed", result: "0 candidates" });
  const text = renderClosed(name);
  assert.match(text, /do not re-run/);
  assert.match(text, /psx_search_source_shapes/);
  assert.match(text, /0 candidates/);
});
