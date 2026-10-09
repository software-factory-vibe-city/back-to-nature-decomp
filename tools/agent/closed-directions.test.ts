import { strict as assert } from "node:assert";
import { test } from "node:test";
import { claimsEmptiness, readClosed, recordClosed, renderClosed, sourceSidePremise, searchedPremise, type ClosedDirection } from "./closedDirections.js";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "./provenance.js";

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

/* --- the premise a closure rests on ------------------------------------- */

test("a recorded premise renders under the verdict, where the next session reads it", () => {
  /* An impossibility is conditioned on its inputs, and the next session's job
     is to attack the premise rather than to re-run the proof — which it can
     only do if the premise is on the row. */
  const name = uniqueFunction();
  recordClosed({
    functionName: name,
    tool: "psx_loop_trace",
    question: "can any spelling make the payload pair decline at pass 1?",
    verdict: "closed",
    result: "no — the forced pair's product floors at 4 against a bar of 3",
    conditionalOn: "the pair originating at this loop, so that pass 1 evaluates it at all",
  });
  const text = renderClosed(name);
  assert.match(text, /conditional on: the pair originating at this loop/);
});

test("an impossibility with no premise is rendered as one, not as an unconditional fact", () => {
  const name = uniqueFunction();
  recordClosed({
    functionName: name,
    tool: "psx_search_source_shapes",
    question: "can any source shape place the address after the giv init?",
    verdict: "closed",
    result: "0 candidates",
  });
  assert.match(renderClosed(name), /conditional on: NOT RECORDED/);
  assert.match(renderClosed(name), /Do not read it as unconditional/);
});

test("a row that records a measurement rather than a proof earns no premise line", () => {
  /* The nudge is for claims that a region of the search space is empty. A row
     that says what a tool measured is a fact, and dressing it up with a caveat
     would train the reader to skip the caveat. */
  const name = uniqueFunction();
  recordClosed({
    functionName: name,
    tool: "psx_frame_map",
    question: "which slot holds the loop counter?",
    verdict: "closed",
    result: "0x10",
  });
  assert.equal(/conditional on/.test(renderClosed(name)), false);
});

test("the emptiness test reads the claim, not the tool", () => {
  assert.equal(claimsEmptiness("can any web assignment produce s0 for the address?"), true);
  assert.equal(claimsEmptiness("is the domain exhausted?"), true);
  assert.equal(claimsEmptiness("no source shape reaches this order"), true);
  assert.equal(claimsEmptiness("which slot holds the loop counter?"), false);
  assert.equal(claimsEmptiness("does the trace agree on the threshold?"), false);
});

test("an open verdict is never nudged: only a closure is read as final", () => {
  const name = uniqueFunction();
  recordClosed({
    functionName: name, tool: "t",
    question: "can the scheduler produce this order?", verdict: "open", result: "SAT",
  });
  assert.equal(/conditional on/.test(renderClosed(name)), false);
});

test("a premise can be added to a claim already in the record", () => {
  /* The record is append-only and repetition is not corroboration, so an
     identical claim is dropped. A claim that supplies the premise the record
     was missing is not identical — refusing it would leave the row a later
     session most needs permanently unconditional, which is the failure the
     field exists to prevent. */
  const name = uniqueFunction();
  const claim = {
    functionName: name, tool: "psx_loop_trace",
    question: "can any spelling make the pair decline at pass 1?",
    verdict: "closed" as const, result: "no — the product floors at 4 against a bar of 3",
  };
  recordClosed(claim);
  assert.match(renderClosed(name), /conditional on: NOT RECORDED/);

  assert.ok(recordClosed({ ...claim, conditionalOn: "the pair originating at this loop" }));
  assert.equal(readClosed(name).length, 1, "one claim stays one row to the reader");
  assert.match(renderClosed(name), /conditional on: the pair originating at this loop/);
  assert.equal(/NOT RECORDED/.test(renderClosed(name)), false);

  /* And the amended claim is then itself a repeat. */
  assert.equal(recordClosed({ ...claim, conditionalOn: "the pair originating at this loop" }), undefined);
});

test("historical loop-count closure replays as OPEN PREMISE, residual closures are unaffected", () => {
  const legacy = JSON.parse(readFileSync(new URL("./loop-emission/test-fixtures/hoist-guard/legacy-closure.json", import.meta.url), "utf8")) as ClosedDirection;
  assert.ok(sourceSidePremise(legacy));
  const text = renderClosed(legacy.function, [legacy]);
  assert.match(text, /OPEN PREMISE/);
  assert.match(text, /threshold<34/); assert.match(text, /currently 2/);
  assert.match(text, /Attack the\n\s+counts, not the inequality/);
  const ordinary = { ...legacy, tool: "psx_residual_objective", result: "bounded source search exhausted" };
  assert.equal(sourceSidePremise(ordinary), false);
  assert.doesNotMatch(renderClosed(legacy.function, [ordinary]), /OPEN PREMISE/);
  for (const result of ["insn_count 34", "threshold 52", "two moved groups", "savings 1", "lifetime 1"]) {
    assert.ok(sourceSidePremise({ tool: "other", result }));
  }
});

test("new source-side records store the measured source hash without vetoing a closure", () => {
  const dir = mkdtempSync(join(tmpdir(), "closed-hoist-"));
  try {
    const source = join(dir, "source.c"); const text = "void f(void) {}\n";
    writeFileSync(source, text);
    const name = uniqueFunction();
    const row = recordClosed({ functionName: name, tool: "psx_loop_trace", question: "cannot decline?", verdict: "closed", result: "insn_count 34, two moved groups", source })!;
    assert.equal(row.sourceHash, sha256(text)); assert.equal(row.premiseClass, "source-side");
    assert.match(renderClosed(name), /OPEN PREMISE/); assert.ok(renderClosed(name).includes(sha256(text)));
    assert.equal(readClosed(name)[0]!.verdict, "closed", "label, not a verdict rewrite or veto");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

function sweepCertificate(sourceHash: string) {
  const windows = [{ before: 95 }], sites = [{ line: 34 }], contextHash = "measured-context";
  const coverage = { exhaustive: true, evaluated: 2, total: "2" };
  const representations = [{ id: "raw", sourceHash, windows, sites, coverage }];
  return { schemaVersion: 1, sourceHash, contextHash, inputStable: true, preparationErrors: [],
    goals: [{ name: "17" }], windows, sites, representations, coverage, goalMeeting: 0,
    variants: [0, 1].map(mask => ({ representation: "raw", mask: String(mask), premiseMet: true,
      decisions: [{ outcome: "not-met" }], objective: { key: [0, 0, 1, 0] } })),
    closure: { sourceHash, contextHash, windows, sites, representations, result: "exhausted-no-goal-meeting-variant" } };
}

test("only an exhaustive measured window/site-set certificate can retire its source premise", () => {
  const certificate = sweepCertificate("abc");
  assert.ok(searchedPremise(certificate, "abc"));
  assert.equal(searchedPremise(certificate, "different"), false);
  assert.equal(searchedPremise({ ...certificate, coverage: { ...certificate.coverage, exhaustive: false } }, "abc"), false);
  assert.equal(searchedPremise({ ...certificate, variants: [] }, "abc"), false);
  assert.equal(searchedPremise({ ...certificate, variants: [{ error: "compile failed" }, certificate.variants[1]] }, "abc"), false);
  assert.equal(searchedPremise({ ...certificate, variants: [{ ...certificate.variants[0], decisions: [{ outcome: "undetermined" }] }, certificate.variants[1]] }, "abc"), false);
  for (const changed of [
    { ...certificate, inputStable: false }, { ...certificate, preparationErrors: ["compile failed"] },
    { ...certificate, contextHash: "different-headers" },
    { ...certificate, closure: { ...certificate.closure, sites: [{ line: 35 }] } },
    { ...certificate, closure: { ...certificate.closure, representations: [] } },
    { ...certificate, representations: [{ ...certificate.representations[0], coverage: { exhaustive: false } }] },
    { ...certificate, variants: [certificate.variants[0], certificate.variants[0]] },
    { ...certificate, variants: [certificate.variants[0], { ...certificate.variants[1], mask: "00" }] },
    { ...certificate, variants: [{ ...certificate.variants[0], representation: "unsearched" }, certificate.variants[1]] },
    { ...certificate, variants: [{ ...certificate.variants[0], mask: "not-a-mask" }, certificate.variants[1]] },
    { ...certificate, variants: [{ ...certificate.variants[0], decisions: [{ outcome: "met" }] }, certificate.variants[1]] },
  ]) assert.equal(searchedPremise(changed, "abc"), false);
  const dir = mkdtempSync(join(tmpdir(), "closed-hoist-certificate-"));
  try {
    const name = uniqueFunction(); const path = join(dir, "report.json");
    writeFileSync(path, JSON.stringify({ ...certificate, functionName: name }));
    const claim = { functionName: name, tool: "psx_loop_trace", question: "can 17 decline?", verdict: "closed" as const, result: "threshold counts", sourceHash: "abc" };
    recordClosed(claim);
    recordClosed({ ...claim, sweepReport: path });
    assert.doesNotMatch(renderClosed(name), /OPEN PREMISE/);
    assert.match(renderClosed(name), /window and site set/);
    assert.match(renderClosed(name), /context measured-context/);
    assert.match(renderClosed(name), /and representations/);
    const legacyScope = readClosed(name)[0]!;
    const { contextHash: _context, ...oldScope } = legacyScope.searchedPremise!;
    assert.match(renderClosed(name, [{ ...legacyScope, searchedPremise: oldScope as NonNullable<ClosedDirection["searchedPremise"]> }]), /OPEN PREMISE/,
      "pre-context certificates cannot silently close newly prepared representations");
    recordClosed({ ...claim, sourceHash: "new-source" });
    assert.match(renderClosed(name), /OPEN PREMISE/, "old exhaustive scope cannot retire a new source");
    const other = uniqueFunction();
    recordClosed({ ...claim, functionName: other, sweepReport: path });
    assert.match(renderClosed(other), /OPEN PREMISE/, "a wrong certificate leaves a recorded closure's premise open");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
