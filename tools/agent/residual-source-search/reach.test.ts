import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { projectedCost, loadEstimate } from "./cost-report.js";
import { reachFromLines, staleBaseline } from "./reach.js";
import { detectSearchDomain } from "../triage.js";
import { sha256 } from "../provenance.js";
import type { CostEstimate, SemanticGraph, ResidualGrammar } from "./types.js";
import type { LedgerEntry } from "../experimentLedger.js";

const fixture = join(import.meta.dirname, "../../../test-fixtures/branch-orientation");
const json = (path: string) => JSON.parse(readFileSync(join(fixture, path), "utf8"));
const graph = json("historical-semantic-graph.json") as SemanticGraph;
const grammar = json("historical-grammar.json") as ResidualGrammar;

test("historical 60,672-candidate pilot projection is within 25% of the measured 17.6 minutes", () => {
  const data = json("historical-cost.json") as { estimate: CostEstimate; observedMs: number };
  const projected = projectedCost(data.estimate)!;
  assert.ok(Math.abs(projected / data.observedMs - 1) < 0.25);
  assert.ok(projected > data.estimate.projectedMs! * 5);
  const directory = mkdtempSync(join(tmpdir(), "cost-estimate-"));
  try {
    writeFileSync(join(directory, "estimate.json"), JSON.stringify({ estimate: data.estimate }));
    assert.equal(loadEstimate(directory)?.estimate.projectedMs, projected);
  } finally { rmSync(directory, { recursive: true, force: true }); }
  const cheapPilot = { ...data.estimate, pilot: { ...data.estimate.pilot, observedPerCandidateMs: 1 } };
  assert.equal(projectedCost(cheapPilot), Number(cheapPilot.totalCandidates) * (1 - cheapPilot.duplicateRate) * cheapPilot.perCandidateMs / cheapPilot.jobs);
});
test("14:31 historical return path is outside order regions, without erasing its genuine web axis", () => {
  const located = json("historical-located.json").located;
  const report = reachFromLines(graph, grammar, located);
  const tail = report.blocks.find(b => b.block === 9)!;
  assert.equal(tail.outsideRegions, true);
  assert.equal(tail.status, "varied", "ptr's web rename is not a nonexistent axis");
  assert.deepEqual(tail.axes, ["web:ptr#0"]);
  assert.match(report.caveats.find(c => c.includes("block 9"))!, /outside every statement\/control region.*not coverage of return-arm construction/);
});
test("unbound lines stay undetermined; orientation caveat is independent of statement/web reach", () => {
  const report = reachFromLines(graph, grammar, [{ block: 8, lines: [243], branchOrientation: true }, { block: 99, lines: [] }]);
  assert.equal(report.blocks[1]?.status, "undetermined");
  assert.match(report.caveats.join("\n"), /cannot add\/remove return arms/);
  assert.match(report.caveats.join("\n"), /undetermined, not certified/);
});
test("triage search-domain carries the exact reach caveat, advisory even after exhaustion", () => {
  const root = mkdtempSync(join(tmpdir(), "reach-triage-")), directory = join(root, graph.function, "historical");
  const source = readFileSync(join(fixture, "historical-input.c"), "utf8");
  const report = reachFromLines(graph, grammar, json("historical-located.json").located);
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "baseline.json"), JSON.stringify({ sourceHash: sha256(source) }));
    writeFileSync(join(directory, "grammar.json"), JSON.stringify(grammar));
    writeFileSync(join(directory, "summary.json"), JSON.stringify({ status: "exhausted-no-exact", reach: report, classes: [], classesSource: { sampled: false, evaluatedCandidates: "60672", totalCandidates: "60672" } }));
    const findings = detectSearchDomain(graph.function, source, root);
    assert.ok(findings.some(f => f.severity === "signal" && f.evidence.includes(report.caveats.find(c => c.includes("block 9"))!)));
    assert.deepEqual(detectSearchDomain(graph.function, source + "\n", root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("stale input names the preserved better source/key without claiming fresh context or refusing", () => {
  const winner: LedgerEntry = { schemaVersion: 1, function: graph.function, at: "2026-10-09T14:49:00Z", source: "lost.c", sourcePath: "build/experimentLedger/best.c", sourceHash: "s", outputHash: "o", key: [0, 5, 0, 0], matchedWords: 81, totalWords: 86, verdict: "better" };
  assert.match(staleBaseline([0, 43, 0, 0], [winner])!, /build\/experimentLedger\/best.c \[0, 5, 0, 0\].*historical measurement/);
  assert.equal(staleBaseline([0, 5, 0, 0], [winner]), undefined);
  assert.equal(staleBaseline([0, 0, 0, 0], [winner]), undefined);
  assert.equal(staleBaseline([0, 43, 0, 0], []), undefined);
});
