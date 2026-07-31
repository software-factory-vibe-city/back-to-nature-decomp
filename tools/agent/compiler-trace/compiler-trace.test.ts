import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { detectAllocationFeedback } from "./hard-register-hazards.js";
import { analyzeAllocation, applyAllocation } from "./local-allocation.js";
import { buildPseudoProvenance } from "./pseudo-provenance.js";
import { reconstructRtlMetadata } from "./rtl-notes.js";
import { parseRtlInstructions, parseRtlNotes } from "./rtl-parser.js";
import { parseScheduler } from "./scheduler-dag.js";
import { reconstructLuid, spliceSplitProducts } from "./scheduler-order.js";
import { findTargetRegisterRecurrences } from "./target-recurrence.js";
import type { DisassembledInstruction } from "../decompToolchain.js";

function fixture(name: string): string {
  return readFileSync(new URL(`test-fixtures/${name}`, import.meta.url), "utf-8");
}

const localContent = fixture("allocation.lreg.txt");
const globalContent = fixture("allocation.greg.txt");
const schedContent = fixture("scheduler.sched.txt");
const sched2Content = fixture("scheduler.sched2.txt");

function fixtureAnalysis() {
  const localInstructions = parseRtlInstructions(localContent, "lreg");
  const pseudoMap = buildPseudoProvenance(["lreg"], new Map([["lreg", localInstructions]]));
  const allocation = analyzeAllocation(localContent, globalContent, localInstructions);
  applyAllocation(pseudoMap, allocation);
  return { localInstructions, pseudos: [...pseudoMap.values()], allocation };
}

test("parses one-set local and multi-set global pseudo provenance", () => {
  const { pseudos, allocation } = fixtureAnalysis();
  const local = pseudos.find((pseudo) => pseudo.pseudo === 105)!;
  const global = pseudos.find((pseudo) => pseudo.pseudo === 106)!;

  assert.equal(local.sets, 1);
  assert.equal(local.allocationStage, "local");
  assert.equal(local.assignedRegister, "v0");
  assert.equal(local.lifetimes.length, 1);
  assert.deepEqual([local.lifetimes[0]!.birthUid, local.lifetimes[0]!.deathUid], [10, 12]);
  assert.equal(local.quantity?.confidence, "reconstructed");

  assert.equal(global.sets, 2);
  assert.equal(global.allocationStage, "global/reload");
  assert.equal(global.assignedRegister, "v1");
  assert.deepEqual(global.lifetimes.map((range) => [range.birthUid, range.deathUid]), [[14, 16], [20, 22]]);
  assert.equal(global.userVariable, true);
  assert.deepEqual(allocation.globalOrder.map((entry) => entry.pseudo), [106, 105]);
  assert.deepEqual(allocation.globalOrder.map((entry) => entry.assignedRegister), ["v1", "v0"]);
});

test("reconstructs conflicts caused only by fake lifetime extension", () => {
  const content = `
;; Function fake_conflict
108 registers.
Register 105 used 2 times across 2 insns in block 0; set 1 time; GR_REGS or none.
Register 106 used 2 times across 2 insns in block 0; set 1 time; GR_REGS or none.
;; Register 105 in 2.
;; Register 106 in 3.
;; Start of basic block 0, registers live: 4
(insn 10 0 12 (set (reg:SI 105) (const_int 1)) -1 (nil) (nil))
(insn 12 10 14 (set (mem:SI (reg:SI 4 a0) 0) (reg:SI 105)) -1 (nil)
  (expr_list:REG_DEAD (reg:SI 105) (nil)))
(insn 14 12 16 (set (reg:SI 106) (const_int 2)) -1 (nil) (nil))
(insn 16 14 0 (set (mem:SI (reg:SI 4 a0) 0) (reg:SI 106)) -1 (nil)
  (expr_list:REG_DEAD (reg:SI 106) (nil)))
`;
  const instructions = parseRtlInstructions(content, "lreg");
  const allocation = analyzeAllocation(content, "", instructions);
  assert.equal(allocation.records.get(105)!.conflicts.some((conflict) =>
    conflict.register === 106 && conflict.kind === "fake-lifetime-only"
  ), true);
});

test("reconstructs a legacy sched.c LUID tie through an intervening note", () => {
  const source = parseRtlInstructions(`
(insn 10 0 11 (set (reg:SI 2 v0) (const_int 1)) -1 (nil) (nil))
(note 11 10 12 "fixture.c" 7)
(insn 12 11 0 (set (reg:SI 3 v1) (const_int 2)) -1 (nil) (nil))
`, "flow");
  const dump = `
;; -- basic block number 0 from 10 to 12 --
;; insn[  10]: priority =    1, ref_count =    0
;; insn[  12]: priority =    1, ref_count =    0
;; ready list at T-1: 10 (1) 12 (1), now 12 10
(insn 12 0 10 (set (reg:SI 3 v1) (const_int 2)) -1 (nil) (nil))
(insn 10 12 0 (set (reg:SI 2 v0) (const_int 1)) -1 (nil) (nil))
`;
  const instructions = parseRtlInstructions(dump, "sched");
  const scheduler = parseScheduler("sched", dump, instructions, source);
  const explanation = scheduler.selectionExplanations[0]!;
  assert.equal(explanation.confidence, "exact");
  assert.equal(explanation.comparisons[0]?.criterion, "luid");
  assert.equal(scheduler.luidByUid["12"], 2);
});

test("parses scheduler birth boosts, hazards, DAG edges, and lifetime changes", () => {
  const instructions = parseRtlInstructions(schedContent, "sched");
  const scheduler = parseScheduler("sched", schedContent, instructions, instructions.map((instruction) => instruction.uid));

  const birth = scheduler.decisions.find((decision) => decision.cycle === 1)!;
  assert.equal(birth.selectedUid, 12);
  assert.equal(birth.birthPriorityAdjusted, true);
  assert.equal(birth.reason, "birth-priority");

  const hazard = scheduler.decisions.find((decision) => decision.cycle === 2)!;
  assert.equal(hazard.selectedUid, 16);
  assert.equal(hazard.reason, "functional-unit-hazard");
  assert.equal(scheduler.dependencies.some((edge) =>
    edge.fromUid === 12 && edge.toUid === 20 && edge.kind === "memory/alias"
  ), true);
  assert.deepEqual(scheduler.lifetimeChanges.map((change) => change.direction), ["shortened", "extended"]);
});

test("func_800154CC regression: detects the old shared-v0 sched2 WAR and clears it with a v1 split", () => {
  const { localInstructions, pseudos } = fixtureAnalysis();
  const schedInstructions = parseRtlInstructions(schedContent, "sched");
  const sched2Instructions = parseRtlInstructions(sched2Content, "sched2");
  const sched = parseScheduler("sched", schedContent, schedInstructions, localInstructions.map((instruction) => instruction.uid));
  const sched2 = parseScheduler("sched2", sched2Content, sched2Instructions, schedInstructions.map((instruction) => instruction.uid));
  const second = pseudos.find((pseudo) => pseudo.pseudo === 106)!;

  second.assignedHardReg = 2;
  second.assignedRegister = "v0";
  const oldFindings = detectAllocationFeedback(
    sched, sched2, localInstructions, schedInstructions, sched2Instructions, pseudos,
  );
  assert.equal(oldFindings.some((finding) =>
    finding.category === "allocation-blocked" &&
    finding.message.includes("$v0 WAR") &&
    finding.pseudos.includes(105) && finding.pseudos.includes(106)
  ), true);

  second.assignedHardReg = 3;
  second.assignedRegister = "v1";
  const newFindings = detectAllocationFeedback(
    sched, sched2, localInstructions, schedInstructions, sched2Instructions, pseudos,
  );
  assert.equal(newFindings.some((finding) =>
    finding.category === "allocation-blocked" && finding.pseudos.includes(106)
  ), false);
});

test("func_800154CC regression: suggests target-v1 recurrence for separate non-overlapping pseudos", () => {
  const instruction = (mnemonic: string, operands: string[]): DisassembledInstruction => ({
    address: 0,
    mnemonic,
    operands,
    operandText: operands.join(","),
    raw: `${mnemonic} ${operands.join(",")}`,
  });
  const target = [
    instruction("addu", ["v1", "a0", "a1"]),
    instruction("sw", ["v1", "0(t0)"]),
    instruction("lw", ["v0", "0(t1)"]),
    instruction("or", ["v1", "v0", "a0"]),
  ];
  const candidate = [
    instruction("addu", ["v0", "a0", "a1"]),
    instruction("sw", ["v0", "0(t0)"]),
    instruction("lw", ["v1", "0(t1)"]),
    instruction("or", ["v1", "v0", "a0"]),
  ];
  const finalRtl = parseRtlInstructions(`
(insn 10 0 12 (set (reg:SI 2 v0) (plus:SI (reg:SI 4 a0) (reg:SI 5 a1))) -1 (nil) (nil))
(insn 12 10 14 (set (mem:SI (reg:SI 8 t0) 0) (reg:SI 2 v0)) -1 (nil) (nil))
(insn 14 12 16 (set (reg:SI 2 v0) (mem:SI (reg:SI 9 t1) 0)) -1 (nil) (nil))
(insn 16 14 0 (set (reg:SI 3 v1) (ior:SI (reg:SI 2 v0) (reg:SI 4 a0))) -1 (nil) (nil))
`, "dbr");
  const preAllocation = parseRtlInstructions(`
(insn 10 0 12 (set (reg/v:SI 105) (plus:SI (reg:SI 4 a0) (reg:SI 5 a1))) -1 (nil) (nil))
(insn 12 10 14 (set (mem:SI (reg:SI 81) 0) (reg/v:SI 105)) -1 (nil) (nil))
(insn 14 12 16 (set (reg:SI 112) (mem:SI (reg:SI 82) 0)) -1 (nil) (nil))
(insn 16 14 0 (set (reg/v:SI 106) (ior:SI (reg:SI 112) (reg:SI 104))) -1 (nil) (nil))
`, "lreg");
  const { pseudos } = fixtureAnalysis();
  const hints = findTargetRegisterRecurrences(target, candidate, finalRtl, preAllocation, pseudos);
  assert.equal(hints.length, 1);
  assert.equal(hints[0]!.targetRegister, "v1");
  assert.deepEqual([hints[0]!.firstPseudo, hints[0]!.secondPseudo], [105, 106]);
  assert.equal(hints[0]!.confidence, "inferred");
});

test("labels ambiguous pass-to-pass pseudo mappings as inferred", () => {
  const rtl = parseRtlInstructions(`
(insn 10 0 0 (set (reg:SI 100) (const_int 7)) -1 (nil) (nil))
`, "rtl");
  const jump = parseRtlInstructions(`
(insn 12 0 14 (set (reg:SI 101) (const_int 7)) -1 (nil) (nil))
(insn 14 12 0 (set (reg:SI 102) (const_int 7)) -1 (nil) (nil))
`, "jump");
  const pseudos = buildPseudoProvenance(
    ["rtl", "jump"],
    new Map([["rtl", rtl], ["jump", jump]]),
  );
  const transition = pseudos.get(100)!.transitions[0]!;
  assert.equal(transition.kind, "ambiguous");
  assert.equal(transition.confidence, "inferred");
  assert.deepEqual(transition.relatedPseudos, [101, 102]);
});

test("parses loop/basic-block/deleted notes and reconstructs nested loop depth", () => {
  const content = fixture("rtl-notes.txt");
  const instructions = parseRtlInstructions(content, "lreg");
  const notes = parseRtlNotes(content, "lreg");
  const metadata = reconstructRtlMetadata(content, "lreg", instructions, notes);

  assert.deepEqual(notes.map((note) => note.kind), [
    "deleted", "basic-block", "loop-begin", "loop-begin", "loop-continue", "loop-end", "loop-end",
  ]);
  assert.equal(notes.find((note) => note.kind === "basic-block")?.block, 0);
  assert.deepEqual(metadata.instructions.map((instruction) => instruction.loopDepth), [1, 2, 1]);
  assert.deepEqual(metadata.instructions[1]?.enclosingLoopNotes, [40, 44]);
  assert.deepEqual(metadata.loopRegions.map((loop) => loop.semanticInstructionSignatures.length), [3, 1]);
  assert.equal(metadata.caveats.length, 0);
});

test("confidence-labels malformed loop-note regions instead of inventing pairs", () => {
  const content = `
(note 10 0 12 "" NOTE_INSN_LOOP_END)
(note 12 10 14 "" NOTE_INSN_LOOP_CONT)
(note 14 12 16 "" NOTE_INSN_LOOP_BEG)
(insn 16 14 0 (set (reg:SI 100) (const_int 1)) -1 (nil) (nil))
`;
  const instructions = parseRtlInstructions(content, "combine");
  const notes = parseRtlNotes(content, "combine");
  const metadata = reconstructRtlMetadata(content, "combine", instructions, notes);
  assert.equal(metadata.caveats.length, 3);
  assert.match(metadata.caveats[0]!, /Unmatched NOTE_INSN_LOOP_END/);
  assert.match(metadata.caveats[1]!, /LOOP_CONT.*outside/);
  assert.match(metadata.caveats[2]!, /Unmatched NOTE_INSN_LOOP_BEG/);
});

test("parses final jump_insn scheduling suffixes instead of dropping delay-slotted returns", () => {
  const instructions = parseRtlInstructions(`
(jump_insn/s 280 0 0 (return) 453 {return} (nil) (nil))
`, "mach");
  assert.equal(instructions.length, 1);
  assert.equal(instructions[0]?.uid, 280);
  assert.equal(instructions[0]?.control, true);
});

test("reports a useful error for a truncated RTL dump", () => {
  assert.throws(
    () => parseRtlInstructions("(insn 10 0 0 (set (reg:SI 100)", "rtl"),
    /RTL parse error in \.rtl at line 1: unterminated instruction form/,
  );
  assert.throws(
    () => parseRtlNotes('(note 20 0 0 "" NOTE_INSN_LOOP_BEG', "rtl"),
    /RTL parse error in \.rtl at line 1: unterminated note form/,
  );
});

test("splices pre-scheduling split products at their deleted origin's chain position", () => {
  const insn = (uid: number, order: number, registers: number[]): any => ({
    uid, kind: "insn", stage: "combine", order, chainOrder: order, text: "",
    sets: registers.map((register) => ({ register })), uses: [], deaths: [],
    memoryRead: false, memoryWrite: false, control: false, dependencies: [],
  });
  const input = [insn(10, 0, [3]), insn(12, 1, [4]), insn(14, 2, [7]), insn(16, 3, [9])];
  const stage = [insn(10, 0, [3]), insn(256, 1, [4]), insn(257, 2, [4]),
    insn(258, 3, [7]), insn(259, 4, [7]), insn(16, 5, [9])];
  const caveats: string[] = [];
  const spliced = spliceSplitProducts(input, stage, caveats);
  assert.deepEqual(spliced.map((item) => item.uid), [10, 256, 257, 258, 259, 16]);
  assert.equal(caveats.length, 0);
  const luid = reconstructLuid(spliced);
  assert.ok(luid["256"]! < luid["257"]!);
  assert.ok(luid["257"]! < luid["258"]!);
  assert.ok(luid["259"]! < luid["16"]!);

  const ambiguous: string[] = [];
  const twin = [...input, insn(18, 4, [4])];
  const kept = spliceSplitProducts(twin, stage, ambiguous);
  assert.deepEqual(kept.map((item) => item.uid).includes(256), false);
  assert.ok(ambiguous.some((caveat) => caveat.includes("no unique split origin")));
});
