import { strict as assert } from "node:assert";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, assembleTarget, disassembleObject, resolveAsmSource } from "../decompToolchain.js";
import { targetLoopEmission, scoreTargetLoopEmission } from "../analyzeTargetLoopEmission.js";
import { hoistKnobSweep } from "../hoistKnobSweep.js";
import { detectLoopNesting, detectLoopPreheaderOrder, type TargetFacts } from "../triage.js";
import { EmissionClass } from "./types.js";
import { classifyCandidate, checkRequirement, type PreheaderVerdict } from "./compare.js";
import { renderVerdicts } from "./render.js";
import { sourceReadingMeasurements } from "./alternatives.js";
import type { LedgerEntry } from "../experimentLedger.js";
import { renderDesirability, hoistWindows, type HoistAssessment } from "./desirability.js";
import { harvestConstraints, movableMargins, solveThreshold } from "../loop-trace/threshold.js";
import { parseLoopDump } from "../loop-trace/parse.js";
import { rtlValues, rtlValue } from "../loop-trace/values.js";
import { analyzeFrame, analyzeReturnValue } from "../frameMap.js";
import { sourceConstructFindings } from "../../../.pi/extensions/shared/source-policy.js";
import { loadConfig } from "../../../.pi/extensions/shared/config.js";
import { loopTrace, lineMapFor } from "../loopTrace.js";

const FN = "ovl_11_func_800F9BE4";
const FIXTURES = join(ROOT, "tools/agent/loop-emission/test-fixtures/hoist-guard");
const available = (() => { try { const path = resolveAsmSource(FN); return path !== null && existsSync(path); } catch { return false; } })();

function fixtureMargins(file: string) {
  const trace = parseLoopDump(readFileSync(join(FIXTURES, `${file}.loop`), "utf8"), FN);
  for (const pass of trace.passes) for (const loop of pass.loops) {
    if (loop.insnCount > 0) loop.hasCall = loop.insnCount === 39;
  }
  return movableMargins(trace, 28, solveThreshold(harvestConstraints(trace).constraints).brackets);
}

test("fixture comparisons expose the pass-1 body slack, not a final-loop premise", () => {
  const prior = fixtureMargins("prior-best");
  const seventeen = prior.find((margin) => margin.pass === 1 && margin.insn === 95)!;
  const eight = prior.find((margin) => margin.pass === 1 && margin.insn === 53)!;
  assert.equal(seventeen.effectiveThreshold, 52); assert.equal(seventeen.insnCount, 34);
  assert.equal(1 - seventeen.declineSlack, 19); assert.equal(eight.effectiveThreshold, 55);
  assert.equal(eight.moveHeadroom, 21);
  const committed = fixtureMargins("committed");
  assert.equal(committed.find((margin) => margin.pass === 1 && margin.insn === 111)!.declineSlack, 1);
  assert.equal(committed.find((margin) => margin.pass === 1 && margin.insn === 111)!.effectiveThreshold, 43);
  assert.equal(committed.find((margin) => margin.pass === 1 && margin.insn === 57)!.effectiveThreshold, 52);
  const global = fixtureMargins("all-global").find((margin) => margin.pass === 1 && margin.insn === 59)!;
  assert.equal(global.effectiveThreshold, 46); assert.equal(global.insnCount, 48);
  assert.equal(global.moveHeadroom, -2); assert.equal(global.decision, "not desirable");
});

test("windows follow movable loop order, not target order or numeric UIDs", () => {
  const margin = fixtureMargins("prior-best").find((entry) => entry.pass === 1 && entry.insn === 53)!;
  const assessments: HoistAssessment[] = [
    { goal: { block: 0, identity: "a", name: "a", required: EmissionClass.Pass1Movable }, outcome: "met", loop: margin.loop, line: 34, margin: { ...margin, loopOrder: 2, insn: 900 } },
    { goal: { block: 0, identity: "b", name: "b", required: EmissionClass.Pass1Movable }, outcome: "met", loop: margin.loop, line: 33, margin: { ...margin, loopOrder: 1, insn: 1000 } },
    { goal: { block: 0, identity: "c", name: "c", required: EmissionClass.Pass2Movable }, outcome: "not-met", loop: margin.loop, line: 38, margin: { ...margin, loopOrder: 3, insn: 5 } },
  ];
  assert.equal(hoistWindows(assessments)[0]!.after, 900);
  assert.equal(hoistWindows(assessments)[0]!.startLine, 34);
});

test("source-induction alternatives cite measured ledger spellings, never refute the reading from a key alone", () => {
  const group = { index: 0, insns: [], text: "init", role: "induction-init" as const, addressPair: false,
    admissible: [EmissionClass.Source, EmissionClass.Pass1GivInit], consistent: [EmissionClass.Source, EmissionClass.Pass1GivInit],
    destination: "a0", step: 2, value: { base: "stack" as const, offset: 16 } };
  const current: PreheaderVerdict = { preheader: { block: 0, header: 1, innerLoops: [], groups: [group], unsatisfiable: false },
    groups: [{ group, address: 16, actual: EmissionClass.Pass1GivInit, admissible: group.admissible, outcome: "met" }],
    loop: "1..9", given: ["a0 is a pass-1 giv init, as in your program"], readings: [], combinationImpossible: false, consistentWithTarget: true, undetermined: [] };
  const measured = structuredClone(current);
  measured.groups[0]!.actual = EmissionClass.Source;
  const ledger: LedgerEntry = { schemaVersion: 2, function: "f", at: "2026-10-09", source: "build/alternative.c", sourceHash: "abc",
    outputHash: "def", key: [0, 0, 1, 0], matchedWords: 85, totalWords: 86, exact: false, verdict: "same" };
  current.alternativeMeasurements = [...sourceReadingMeasurements([current], [measured], ledger).values()];
  const text = renderVerdicts([current]).join("\n");
  assert.match(text, /OTHER READING/); assert.match(text, /LEDGER build\/alternative.c \(abc\): residual 0\/0\/1\/0/);
  assert.match(text, /refutes this measured spelling only/);
  measured.groups[0]!.outcome = "undetermined";
  assert.equal(sourceReadingMeasurements([current], [measured], ledger).size, 0);
  current.alternativeMeasurements = [];
  assert.match(renderVerdicts([current]).join("\n"), /it remains open/);
});

test("RTL identities distinguish constants from addresses, and resolve affine giv adds", () => {
  const facts = rtlValues(`
(insn 8 0 9 (set (reg:SI 81) (lo_sum:SI (reg:SI 91) (symbol_ref:SI ("G")))) -1 (nil) (nil))
(insn 15 9 17 (set (reg:SI 84) (plus:SI (reg:SI 81) (const_int 21074))) -1 (nil) (nil))
(insn 53 51 54 (set (reg:SI 104) (const_int 8)))
(insn 95 94 96 (set (reg:SI 116) (const_int 17)))`);
  assert.deepEqual(facts.byInsn.get(53), { base: "constant", offset: 8 });
  assert.deepEqual(facts.byInsn.get(95), { base: "constant", offset: 17 });
  assert.deepEqual(rtlValue("(reg/v:SI 84)", facts.registers), { base: "symbol", symbol: "G", offset: 21074 });
  assert.deepEqual(rtlValue("(plus:SI (reg:SI 1 at) (const_int 16))", facts.registers), { base: "stack", offset: 16 });
  assert.equal(rtlValue("(mem:SI (symbol_ref:SI (\"G\")))", facts.registers), undefined, "loads are not invariant addresses");
});

test("frame facts remove saves, and only leaves constrain a source address next to a giv", { skip: !available }, () => {
  const requirement = targetLoopEmission(FN);
  const preheader = requirement.preheaders[0]!;
  assert.equal(preheader.excluded?.length, 4);
  assert.ok(!preheader.groups.some((group) => group.text.startsWith("sw ")));
  const base = preheader.groups.find((group) => group.symbol === "D_8006C838")!;
  assert.ok(base.consumers?.length);
  assert.ok(base.consistent.includes(EmissionClass.Source));
  assert.equal(preheader.groups.length, 6);
});

test("prior best has a conditional 17:p2 failure, 8:p1 holds, committed source meets both", { skip: !available }, () => {
  const prior = scoreTargetLoopEmission(FN, join(FIXTURES, "prior-best.c"));
  assert.deepEqual(prior.assessments.map((entry) => [entry.goal.name, entry.outcome]), [["8", "met"], ["17", "not-met"]]);
  assert.ok(prior.verdicts[0]!.given?.some((line) => line.startsWith("a0")));
  assert.ok(prior.verdicts[0]!.given?.some((line) => line.startsWith("a1")));
  const text = renderDesirability(prior.assessments).join("\n");
  assert.match(text, /short by 19/); assert.match(text, /headroom 21/); assert.match(text, /source lines/);
  const committed = scoreTargetLoopEmission(FN);
  assert.deepEqual(committed.assessments.map((entry) => entry.outcome), ["met", "met"]);
  assert.equal(committed.assessments[1]!.margin!.effectiveThreshold, 43);
  assert.equal(committed.assessments[1]!.margin!.insnCount, 44);
  assert.equal(committed.assessments[0]!.margin!.effectiveThreshold, 52);
  /* The giv matcher uses both add identity and step, not step alone. */
  const wrong = structuredClone(prior.traced.trace);
  for (const pass of wrong.passes) for (const loop of pass.loops) for (const giv of loop.givs) if (giv.initial) giv.initial.offset += 1;
  const verdicts = checkRequirement(prior.requirement.preheaders, classifyCandidate(wrong, (name) => name === "D_8006C838" ? 0x8006c838 : undefined));
  assert.ok(!verdicts[0]!.given?.length, "wrong add values cannot pin target giv classes");
});

test("triage carries REQUIRED, slack, window and the sweep route; nesting names the actual pair", { skip: !available }, () => {
  const findings = detectLoopPreheaderOrder(FN, join(FIXTURES, "prior-best.c"));
  assert.equal(findings[0]!.detector, "loop-preheader-order");
  const evidence = findings[0]!.evidence.join("\n");
  assert.match(evidence, /REQUIRED of the original: 17: pass-2 movable — NOT MET/);
  assert.match(evidence, /short by 19/); assert.match(evidence, /WINDOW/);
  assert.ok(findings[0]!.see.includes("psx_hoist_knob_sweep"));
  const instructions = disassembleObject(assembleTarget(FN, join(ROOT, "build/hoistGuardTest/target")));
  const target: TargetFacts = { instructions, frame: analyzeFrame(instructions), returnValue: analyzeReturnValue(FN, instructions), raStores: [] };
  const nested = detectLoopNesting(target)[0]!;
  const inner = nested.evidence.filter((line) => line.includes("invariant in inner loop"));
  assert.ok(inner.length > 0);
  assert.ok(inner.every((line) => line.includes("outer 0xA4, inner 0xE8")));
  assert.ok(inner.every((line) => parseInt(line.split(": ")[1]!, 16) >= 0xa4));
});

test("loop decisions and source windows invalidate when only included context changes", { skip: !available }, () => {
  const dir = mkdtempSync(join(ROOT, "build/hoist-header-test-"));
  try {
    const source = join(dir, "source.c"), header = join(dir, "bounds.h");
    writeFileSync(source, `#include "bounds.h"\nint G[8];\nvoid ${FN}(void) {\n    int i;\n    for (i = 0; i < COUNT; i++) G[i] = i;\n}\n`);
    writeFileSync(header, "#define COUNT 3\n");
    const variant = `header-context-${process.pid}`;
    const first = loopTrace(FN, source, variant);
    assert.equal(loopTrace(FN, source, variant).ensured.regenerated, false);
    assert.ok(lineMapFor(FN, source));
    const linesPath = join(ROOT, "build/loopTrace", FN, "lines/lines.json");
    const before = JSON.parse(readFileSync(linesPath, "utf8")).provenance;
    writeFileSync(header, "#define COUNT 4\n");
    const second = loopTrace(FN, source, variant);
    assert.ok(second.ensured.regenerated);
    assert.notEqual(first.ensured.provenance.values.contextHash, second.ensured.provenance.values.contextHash);
    assert.ok(lineMapFor(FN, source));
    const after = JSON.parse(readFileSync(linesPath, "utf8")).provenance;
    assert.notEqual(before.values.contextHash, after.values.contextHash);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("raw prior-best alone reaches EXACT through measured automatic record preparation", { skip: !available }, () => {
  const input = join(FIXTURES, "prior-best.c"), original = readFileSync(input, "utf8");
  const { report } = hoistKnobSweep(FN, input);
  assert.equal(readFileSync(input, "utf8"), original, "input and live C are never rewritten");
  assert.deepEqual(report.sites.map(site => site.alias), ["tbl", "base", "tbl", "base"]);
  assert.deepEqual(report.coverage, { evaluated: 32, total: "32", exhaustive: true });
  assert.deepEqual(report.representations.map(rep => rep.coverage), [
    { evaluated: 16, total: "16", exhaustive: true }, { evaluated: 16, total: "16", exhaustive: true },
  ]);
  assert.deepEqual(report.exact, ["m05", "m10"]);
  assert.ok(report.inputStable); assert.deepEqual(report.preparationErrors, []);
  assert.equal(report.representations[1]!.normalization!.equalStores, 2);
  assert.equal(report.measurements["sizeof(Ovl11Slot524C)"], 6);
  const raw = report.variants.filter(row => row.representation === "raw");
  assert.equal(raw.filter(row => row.premiseMet && row.goalsMet === 2).length, 2);
  assert.ok(raw.every(row => !row.objective?.exact), "raw address-only spelling is not falsely labelled EXACT");
  for (const id of report.exact) {
    const winner = report.variants.find(row => row.id === id)!;
    assert.equal(winner.goalsMet, 2); assert.ok(winner.premiseMet);
    assert.deepEqual(winner.objective!.key, [0, 0, 0, 0]);
    assert.deepEqual(sourceConstructFindings(readFileSync(join(ROOT, winner.source), "utf8"), loadConfig(ROOT),
      { name: FN, container: "ovl_11" }), [], "automatic winners must remain clean C");
  }
  assert.equal(report.closure, null);
  assert.ok(report.variants.every(row => !row.error && row.objective));
});

test("committed mixed-route fixture retains both EXACT shapes in an explicitly sampled backtest", { skip: !available }, () => {
  const { report } = hoistKnobSweep(FN, undefined, 4);
  assert.equal(report.sites.length, 4);
  assert.deepEqual(report.coverage, { evaluated: 4, total: "16", exhaustive: false });
  assert.deepEqual(report.exact, ["m05", "m10"]);
  assert.equal(report.goalMeeting, 2);
  assert.equal(report.closure, null);
});

test("prepared slot-view sweep is exhaustive, finds exactly m05/m10, and rejects the all-global must-hold flip", { skip: !available }, () => {
  const { report } = hoistKnobSweep(FN, join(FIXTURES, "slot-local.c"));
  assert.equal(report.sites.length, 4);
  assert.deepEqual(report.coverage, { evaluated: 16, total: "16", exhaustive: true });
  assert.deepEqual(report.exact, ["m05", "m10"]);
  for (const id of report.exact) assert.equal(report.variants.find((row) => row.id === id)!.goalsMet, 2);
  const global = report.variants.find((row) => row.id === "m15")!.decisions.find((entry) => entry.goal.name === "8")!;
  assert.equal(global.outcome, "not-met");
  assert.equal(global.margin!.effectiveThreshold, 46); assert.equal(global.margin!.insnCount, 48);
  assert.match(renderDesirability([global, report.variants.find((row) => row.id === "m15")!.decisions[1]!]).join("\n"), /violates a must-hold goal/);
  assert.equal(report.closure, null);
});
