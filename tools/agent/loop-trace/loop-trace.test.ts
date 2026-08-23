import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseLoopDump } from "./parse.ts";
import { preheaderLayouts, pseudoOf } from "./preheader.ts";
import {
  admissibleMultipliers,
  harvestConstraints,
  movableMargins,
  solveThreshold,
  thresholdsFor,
} from "./threshold.ts";
import { recordConstraints, readThresholdLedger } from "./ledger.ts";
import { findCascades } from "./cascade.ts";
import { addKind, mechanismsOf } from "./mechanisms.ts";
import { codeOnly, parseLineNotes, sameCode } from "./lines.ts";

const FIXTURES = join(import.meta.dirname, "test-fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

const REAL = parseLoopDump(fixture("ovl_10_func_800BA394.loop"), "ovl_10_func_800BA394");
const SYNTHETIC = parseLoopDump(fixture("synthetic.loop"), "first_function");
/* The measured `&&`-tail / break-tail pair. Same function, same loops; the only
   difference is the inner loop's tail, and everything below turns on it. */
const AND_TAIL = parseLoopDump(fixture("and-tail.loop"), "ovl_10_func_800BA394");
const BREAK_TAIL = parseLoopDump(fixture("break-tail.loop"), "ovl_10_func_800BA394");
const SIBLING = parseLoopDump(fixture("sibling-parked.loop"), "ovl_10_func_800B95F0");

/* --- the grammar ------------------------------------------------------- */

test("a real dump parses with nothing left over", () => {
  /* The whole point of reporting unrecognised lines is that this assertion can
     be made at all: a parser that silently dropped what it did not understand
     would pass this test while hiding decisions. */
  assert.deepEqual(REAL.unrecognised, []);
  assert.equal(REAL.functionName, "ovl_10_func_800BA394");
});

test("the pass boundary is derived from a repeated loop range, not assumed", () => {
  assert.equal(REAL.passes.length, 2);
  assert.deepEqual(REAL.passes.map((pass) => pass.loops.map((loop) => `${loop.from}..${loop.to}`)), [
    ["1237..1312", "1194..1355", "1082..1146"],
    ["1237..1312", "1194..1355", "1082..1146"],
  ]);
  /* The counts differ because pass 1 shrank the loops — that is what makes a
     second pass worth reading at all. */
  assert.deepEqual(REAL.passes.map((pass) => pass.loops.map((loop) => loop.insnCount)), [
    [29, 55, 23],
    [22, 42, 16],
  ]);
});

test("a movable's flags, product and decision are all read", () => {
  const loop = REAL.passes[0]!.loops[1]!;
  const forced = loop.movables.find((movable) => movable.insn === 1226)!;
  assert.equal(forced.forces, 1225, "the %lo half is forced by the %hi half");
  assert.equal(forced.decision, "moved");
  assert.equal(forced.movedTo, 1649);

  const matched = loop.movables.filter((movable) => movable.matches === 1213);
  assert.deepEqual(matched.map((movable) => movable.insn), [1298, 1325]);
  for (const movable of matched) {
    assert.ok(movable.done);
    assert.equal(movable.decision, "skipped", "a done movable never reaches the desirability test");
    assert.equal(movable.savings, undefined, "and therefore never prints savings");
  }

  const notDesirable = REAL.passes[0]!.loops[0]!.movables.find((movable) => movable.insn === 1298)!;
  assert.equal(notDesirable.decision, "not desirable");
  assert.equal(notDesirable.savings, 1);
  assert.equal(notDesirable.life, 1);
});

test("givs carry their cost, their combine chain and the pseudo they became", () => {
  const loop = REAL.passes[0]!.loops[1]!;
  assert.deepEqual(loop.givs.map((giv) => giv.insn).sort((a, b) => a - b), [1211, 1329, 1635]);
  for (const giv of loop.givs) {
    assert.equal(giv.srcReg, 85);
    assert.equal(giv.mult, "16");
    assert.equal(giv.add, "0");
    assert.equal(giv.reducedTo, "(reg:SI 600)");
  }
  assert.equal(loop.givs.find((giv) => giv.insn === 1329)!.combinedWith, 1211);
  assert.equal(loop.givs.find((giv) => giv.insn === 1635)!.combinedWith, 1211);

  const rejected = REAL.passes[0]!.loops[0]!.givs.find((giv) => giv.insn === 1244)!;
  assert.deepEqual(rejected.rejected, { product: -124, insnCount: 29 });
});

test("pass 2 sees the reduced pseudo as a biv of its own", () => {
  const loop = REAL.passes[1]!.loops[1]!;
  const biv = loop.bivs.find((entry) => entry.regno === 600)!;
  assert.equal(biv.verified, true);
  assert.equal(biv.increment, "16");
  assert.equal(biv.initInsn, 1655, "which is the only place the giv init's UID is printed");
  assert.equal(loop.movables.length, 0, "and pass 2 hoists nothing out of this loop");
});

test("the post-pass RTL is skipped, not read as log lines", () => {
  assert.ok(REAL.rtlStartsAt > 130 && REAL.rtlStartsAt < 160, `rtl starts at ${REAL.rtlStartsAt}`);
  const insnUids = REAL.passes.flatMap((pass) => pass.loops.flatMap((loop) => loop.movables.map((movable) => movable.insn)));
  assert.equal(insnUids.includes(4), false, "an `(insn 4 ...)` line is rtl, not a movable");
});

test("the synthetic dump exercises the grammar this target has not produced", () => {
  assert.deepEqual(SYNTHETIC.unrecognised, [{ line: 42, text: "Something the grammar has never seen." }]);

  const first = SYNTHETIC.passes[0]!.loops[0]!;
  const consec = first.movables[0]!;
  assert.equal(consec.consec, 2);
  assert.ok(consec.cond && consec.global && consec.moveInsn);
  assert.equal(consec.halved, true, "halved since already moved doubles the denominator");
  assert.equal(consec.savings, 3);
  assert.equal(first.movables[1]!.decision, "not safe");
  assert.equal(first.movables[1]!.savings, undefined);
  assert.equal(first.movables[2]!.matches, 20);
  assert.equal(first.movables[3]!.force, true);
  assert.equal(first.movables[3]!.decision, "not desirable");

  assert.equal(first.bivs.find((biv) => biv.regno === 105)!.discarded, "not analyzable");
  const wrapped = first.givs.find((giv) => giv.insn === 65)!;
  assert.equal(wrapped.add, "(plus:SI (reg:SI 200) (const_int 8 [0x8]))", "a wrapped rtx is rejoined");
  assert.equal(wrapped.derivedFrom!.insn, 66);
  assert.equal(first.givs.find((giv) => giv.insn === 70)!.finalValueReplaceable, true);
  assert.equal(first.givs.find((giv) => giv.insn === 70)!.recombinedWith!.as, "(reg:SI 601)");
  assert.deepEqual(first.combineStatistics[0], [{ insn: 65, totalBenefit: 12 }, { insn: 70, totalBenefit: 0 }]);
  assert.ok(first.notes.some((note) => note.startsWith("Hoisted regno 108")));

  const phony = SYNTHETIC.passes[0]!.loops[1]!;
  assert.equal(phony.phony, true);
  assert.equal(SYNTHETIC.passes[0]!.loops[2]!.ignored, "setjmp");
});

test("one section of a multi-function dump is selected, and only that one", () => {
  const other = parseLoopDump(fixture("synthetic.loop"), "second_function");
  assert.equal(other.functionName, "second_function");
  assert.deepEqual(other.passes.flatMap((pass) => pass.loops.map((loop) => loop.from)), [700]);
  assert.equal(SYNTHETIC.passes.flatMap((pass) => pass.loops).some((loop) => loop.from === 700), false);
});

test("a dump with no section for the wanted function names no function at all", () => {
  /* This is the precondition loopTrace's stub guard keys on. It matters
     because recording an empty constraint set under a function's name would
     *erase* that function's real evidence from the running threshold record —
     a re-trace replaces a function's constraints by design. */
  const absent = parseLoopDump(fixture("synthetic.loop"), "no_such_function");
  assert.equal(absent.functionName, "");
  assert.deepEqual(absent.passes, []);
});

/* --- phony loops, and why ---------------------------------------------- */

test("the tail spelling decides whether the inner loop is scanned at all", () => {
  /* The whole pair in one assertion: same function, same three loops, and the
     `&&` tail loses one of them entirely. A loop the pass discarded records no
     movable, biv or giv, so its silence is an absence — reading it as "nothing
     was worth hoisting here" inverts the evidence. */
  const phony = (trace: typeof AND_TAIL): string[] =>
    trace.passes.flatMap((pass) => pass.loops.filter((loop) => loop.phony).map((loop) => `${loop.from}..${loop.to}`));
  assert.deepEqual(phony(AND_TAIL), ["1228..1314", "1228..1314"], "discarded in both passes");
  assert.deepEqual(phony(BREAK_TAIL), [], "the break-form tail keeps its fallthrough entry");
});

test("a phony loop's cause is resolved from the dump's own RTL, not guessed", () => {
  const loop = AND_TAIL.passes[0]!.loops.find((entry) => entry.phony)!;
  assert.equal(loop.phonyCause?.kind, "insns-before-entry");
  assert.equal(loop.phonyCause?.scanStart?.kind, "insn",
    "scan_start is a plain insn, which is what fails loop.c's CODE_LABEL test");
  assert.deepEqual(loop.phonyCause?.intruders, [1640, 1643]);
  /* And it names what those insns are, which is what identifies the pass that
     put them there: gcse's PRE hoisted two %hi halves into the gap. */
  assert.deepEqual(loop.phonyCause?.symbols, ["D_800BB9BC", "D_800B86C4"]);
});

test("a phony loop with no RTL to read is undetermined, not attributed", () => {
  const loop = SYNTHETIC.passes[0]!.loops.find((entry) => entry.phony)!;
  assert.equal(loop.phonyCause?.kind, "undetermined");
  assert.match(loop.phonyCause!.detail, /NOTE_INSN_LOOP_BEG with UID 100 is in this dump's RTL/);
});

/* --- the cascade -------------------------------------------------------- */

test("a pass-1 inner hoist re-hoisted by pass 2 of the enclosing loop is reported as a cascade", () => {
  /* The route to a pass-2 movable that faces no pass-1 test: scan_loop cannot
     record a movable for an insn a loop pass created, so pass 1 of the outer
     loop never saw these at all. */
  const cascades = findCascades(BREAK_TAIL);
  assert.equal(cascades.length, 2, "the %hi/%lo pair moves as two movables and one materialisation");

  const exact = cascades.find((cascade) => cascade.certainty === "exact")!;
  assert.equal(exact.inner, "1221..1314");
  assert.equal(exact.outer, "1194..1357");
  assert.equal(exact.innerInsn, 1228, "pass 1 hoisted this out of the inner loop");
  assert.equal(exact.reHoisted, 1643, "and 1643 is the UID it landed at — the one pass 2 re-hoisted");
  assert.equal(exact.finalAt, 1695);

  /* The other half of the pair is inside the emitted range without being a
     printed landing UID, and says so rather than claiming the same standing. */
  const bracketed = cascades.find((cascade) => cascade.certainty === "bracketed")!;
  assert.equal(bracketed.reHoisted, 1642);
});

test("no cascade is reported where the inner loop was never scanned", () => {
  /* The trap this is about: a phony inner loop silently converts the cascade
     into an outer-level emission, which is a regime that may already have been
     refuted — so the experiment comes back agreeing with the refutation. */
  assert.deepEqual(findCascades(AND_TAIL), []);
});

/* --- mechanisms, and the donor comparison ------------------------------- */

test("a giv's add term is classified by arity, which is what the source controls", () => {
  assert.equal(addKind("0"), "const");
  assert.equal(addKind(undefined), "const");
  assert.equal(addKind("(reg:SI 596)"), "simple");
  assert.equal(addKind("(reg/v:SI 85)"), "simple");
  assert.equal(addKind("(plus:SI (reg:SI 596) (reg:SI 520))"), "compound");
});

test("the same giv shape reduced in one program and refused in another is the donor signal", () => {
  /* The comparison neither function's sessions made. Both programs offered the
     pass a giv of the same shape — the loop counter plus one other value — and
     got opposite answers, so the difference is in the source and the log prints
     both sides of the inequality. */
  const donor = mechanismsOf(BREAK_TAIL).map((mechanism) => mechanism.id);
  const parked = mechanismsOf(SIBLING).map((mechanism) => mechanism.id);

  assert.ok(donor.includes("giv-reduced:mult=1/add=simple"));
  assert.ok(parked.includes("giv-declined:mult=1/add=simple"));
  assert.equal(parked.includes("giv-reduced:mult=1/add=simple"), false);

  /* And how the donor got there: two occurrences whose benefits summed. */
  assert.ok(donor.includes("giv-combined"));
  assert.equal(parked.includes("giv-combined"), false);

  /* What is NOT a difference, so a reader is not sent after it: both reach the
     cascade and both reduce the two-register-sum address. */
  for (const shared of ["cascade", "pass2-movable", "giv-reduced:mult=1/add=compound"]) {
    assert.ok(donor.includes(shared) && parked.includes(shared), shared);
  }
});

test("a refusal no source edit could flip is not recorded as a refusal", () => {
  /* Two of them in this trace, and neither is evidence about the source.
     Insn 1238 is refused at benefit 0 — a dest-address giv over the pseudo an
     earlier pass already reduced, where `lifetime * threshold * 0` loses to any
     insn_count whatever the C says. Insn 1099 is refused at product -31, and
     the lever for a refused giv is combining, which SUMS benefits: two
     occurrences of a negative benefit is a worse number, not a better one. */
  const declined = mechanismsOf(BREAK_TAIL).filter((mechanism) => mechanism.id.startsWith("giv-declined:"));
  assert.deepEqual(declined, [], "this program asked no question a second spelling could answer differently");

  const refused = BREAK_TAIL.passes
    .flatMap((pass) => pass.loops.flatMap((loop) => loop.givs))
    .filter((giv) => giv.rejected !== undefined);
  assert.deepEqual(
    refused.map((giv) => [giv.insn, giv.benefit, giv.rejected!.product]),
    [[1099, 3, -31], [1238, 0, -124], [1107, 0, -124]],
    "three refusals in the log, and every one of them is out of a source edit's reach");
});

/* --- the preheader ----------------------------------------------------- */

test("the preheader is reassembled in emission order: movables, then giv inits", () => {
  const layout = preheaderLayouts(REAL).find((entry) => entry.pass === 1 && entry.from === 1194)!;
  assert.deepEqual(layout.slots.map((slot) => [slot.kind, slot.uid]), [
    ["movable", 1645],
    ["movable", 1647],
    ["movable", 1649],
    ["giv-init", 1655],
  ]);
  /* Three givs reduced to one pseudo, and one pseudo is one initialisation. */
  assert.match(layout.slots[3]!.detail, /reg 600.*insns 1211, 1635, 1329/);
});

test("a giv init the pass never numbered is left blank rather than guessed", () => {
  const layout = preheaderLayouts(REAL).find((entry) => entry.pass === 1 && entry.from === 1082)!;
  const unnumbered = layout.slots.filter((slot) => slot.kind === "giv-init" && slot.uid === undefined);
  assert.equal(unnumbered.length, 1, "reg 605 never becomes a biv, so no pass ever prints its init UID");
});

test("pseudoOf reads the register out of a reduced-to expression", () => {
  assert.equal(pseudoOf("(reg:SI 600)"), 600);
  assert.equal(pseudoOf("(reg/v:SI 81)"), 81);
  assert.equal(pseudoOf(undefined), undefined);
  assert.equal(pseudoOf("(const_int 4 [0x4])"), undefined);
});

/* --- the threshold ----------------------------------------------------- */

test("only decisions the product actually decided become constraints", () => {
  const { constraints, rejected } = harvestConstraints(REAL, { cc1Flags: ["-O2"] });

  const forced = rejected.find((entry) => entry.raw.includes("Insn 1226"));
  assert.ok(forced, "a movable carrying `forces` could have moved through the fourth clause");
  assert.match(forced!.reason, /forces 1225/);
  assert.equal(constraints.some((entry) => entry.kind === "movable" && entry.insn === 1226), false);

  /* 1262 and 1298 have identical savings and life in the same loop and decided
     differently. That is the threshold decaying by 3 after 1262 moved, not a
     contradiction — and both inequalities are sound. */
  const moved = constraints.find((entry) => entry.kind === "movable" && entry.insn === 1262)!;
  const stayed = constraints.find((entry) => entry.kind === "movable" && entry.insn === 1298 && entry.pass === 1)!;
  assert.deepEqual(moved.kind === "movable" && moved.bound, { op: ">=", value: 29 });
  assert.deepEqual(stayed.kind === "movable" && stayed.bound, { op: "<=", value: 31 });
  assert.equal(stayed.kind === "movable" && stayed.decay, 1);
});

test("a rejected giv bounds the strength-reduce threshold by divisibility", () => {
  const { constraints } = harvestConstraints(REAL, { cc1Flags: ["-O2"] });
  const divisors = constraints.filter((entry) => entry.kind === "giv").map((entry) => entry.kind === "giv" && entry.divides);
  assert.deepEqual(divisors.sort(), [124, 124, 124, 31]);
});

test("a flag that defeats the desirability test voids every constraint", () => {
  const { constraints, rejected } = harvestConstraints(REAL, { cc1Flags: ["-O2", "-fmove-all-movables"] });
  assert.equal(constraints.length, 0);
  assert.ok(rejected.every((entry) => /fmove-all-movables/.test(entry.reason)));
});

test("one function pins n_non_fixed_regs, and it is the value the target's config implies", () => {
  /* 76 hard registers, minus $0/$at/$k0/$k1/$gp/$sp/$ra and the fake frame
     register, minus the 32 float and 8 status registers that -msoft-float
     fixes: 28. Nothing in the tool knows that; it is solved from the log, so
     agreeing with mips.h is a check on the model rather than an input to it. */
  const { constraints } = harvestConstraints(REAL, { cc1Flags: ["-O2"] });
  const solution = solveThreshold(constraints);
  assert.deepEqual(solution.candidates, [28]);
  assert.deepEqual(thresholdsFor(28), {
    moveWithCall: 29, moveWithoutCall: 58, reduceWithCall: 31, reduceWithoutCall: 62,
  });
});

test("nesting settles a loop's call multiplier when its own decisions do not", () => {
  const { constraints } = harvestConstraints(REAL, { cc1Flags: ["-O2"] });
  const solution = solveThreshold(constraints);
  const outer = solution.brackets.find((bracket) => bracket.pass === 1 && bracket.loop === "1194..1355")!;
  assert.deepEqual(admissibleMultipliers(outer, 28), [1, 2], "its own bound of >= 17 admits both");

  /* The inner loop 1237..1312 is pinned to 1, and it sits inside 1194..1355.
     A call in an inner loop is a call in every loop that contains it. */
  const margins = movableMargins(REAL, 28, solution.brackets);
  const pinned = margins.filter((margin) => margin.loop === "1194..1355");
  assert.ok(pinned.length > 0, "so the outer loop's decisions become arithmetic");
  assert.ok(pinned.every((margin) => margin.multiplier === 1));
});

test("the margin states what each decision hinged on, as a number", () => {
  const { constraints } = harvestConstraints(REAL, { cc1Flags: ["-O2"] });
  const margins = movableMargins(REAL, 28, solveThreshold(constraints).brackets);

  /* The residual this tool was built for: the %hi of D_800BB9BC. */
  const hi = margins.find((margin) => margin.insn === 1225)!;
  assert.equal(hi.effectiveThreshold, 26, "29 minus 3 for the one movable moved before it");
  assert.equal(hi.requiredProduct, 3);
  assert.equal(hi.actualProduct, 4);

  /* And the one that moved on a clause the product test would have refused,
     reported as such rather than as a contradiction. */
  const lo = margins.find((margin) => margin.insn === 1226)!;
  assert.ok(lo.actualProduct < lo.requiredProduct);
  assert.equal(lo.carriedBy, "forces 1225");
});

test("an inconsistent constraint set is reported as a defect in the model", () => {
  const impossible = solveThreshold([
    { kind: "movable", function: "f", pass: 1, loop: "1..2", insn: 1, regno: 1, savings: 1, life: 1,
      denominator: 10, decay: 0, bound: { op: ">=", value: 40 }, raw: "a" },
    { kind: "movable", function: "f", pass: 1, loop: "1..2", insn: 2, regno: 2, savings: 1, life: 1,
      denominator: 10, decay: 0, bound: { op: "<=", value: 3 }, raw: "b" },
  ]);
  assert.equal(impossible.consistent, false);
  assert.deepEqual(impossible.candidates, []);
});

/* --- the running record ------------------------------------------------ */

test("the record replaces a function's constraints rather than accumulating them", () => {
  const path = join(process.env.TMPDIR ?? "/tmp", `loop-threshold-${process.pid}.json`);
  const { constraints } = harvestConstraints(REAL, { cc1Flags: ["-O2"] });
  const first = recordConstraints({ functionName: "f", sourceHash: "a", constraints, toolchainHash: "T", path });
  const second = recordConstraints({ functionName: "f", sourceHash: "b", constraints, toolchainHash: "T", path });
  assert.equal(first.all.length, second.all.length, "a re-trace of one function is not a second witness");

  /* A different toolchain is a different constant, so the record starts over
     rather than intersecting two compilers' evidence. */
  assert.deepEqual(readThresholdLedger("OTHER", path).functions, {});
});

test("a negatively-valued refusal is not a near miss, and is not reported as one", () => {
  /* The lever for a refused giv is combining, which SUMS benefits. The product
     is `benefit * lifetime * threshold` with both other terms positive, so a
     negative product means the pass valued the giv below zero — and two
     occurrences of a negative benefit is a worse number. Reporting those pairs
     them with genuine near-misses in other functions and manufactures a
     contradiction between programs that asked nothing of each other. */
  const declined = mechanismsOf(SIBLING).filter((mechanism) => mechanism.id.startsWith("giv-declined:"));
  assert.deepEqual(declined.map((mechanism) => mechanism.id), ["giv-declined:mult=1/add=simple"]);
  assert.match(declined[0]!.witness, /not worth while, 0 vs 25/, "the one whose benefit reached zero");
});

test("several givs of one shape are one mechanism, merged rather than first-wins", () => {
  /* The survivor of a combine carries `reduced to`; the giv folded into it
     carries `combined with`. First-wins keeps whichever the log printed first
     and loses both the fact that combining is what cleared the gate and the
     second occurrence's insn — which is the line of source a reader needs. */
  const reduced = mechanismsOf(BREAK_TAIL).find((mechanism) => mechanism.id === "giv-reduced:mult=1/add=simple")!;
  assert.equal(reduced.combined, true);
  assert.deepEqual(reduced.insns.sort((a, b) => a - b), [1234, 1303],
    "both occurrences, so both source lines can be quoted");
});

/* --- source-line attribution -------------------------------------------- */

test("an insn takes the line of the note before it, and a dump with no notes yields no map", () => {
  const withNotes = [
    '(note 12 1440 13 ("/tmp/f.c") 17)',
    "(insn 100 12 101 (set (reg:SI 5)",
    "        (reg:SI 6)) 3 {movsi} (nil))",
    '(note 200 100 201 ("/tmp/f.c") 42)',
    "(jump_insn 300 200 301 (set (pc) (label_ref 9)) -1 (nil))",
  ].join("\n");
  const map = parseLineNotes(withNotes)!;
  assert.equal(map.file, "/tmp/f.c");
  assert.equal(map.byInsn.get(100), 17);
  assert.equal(map.byInsn.get(300), 42);

  /* Without `-g` the compiler suppresses every line note — `no_line_numbers`
     returns before the note is built — so this is the ordinary case, and it has
     to be an absence rather than a map of guesses. */
  assert.equal(parseLineNotes("(insn 100 0 101 (set (reg:SI 5) (reg:SI 6)) 3 {movsi} (nil))"), undefined);
});

test("the two compiles are compared on instructions only, and any difference voids the map", () => {
  /* `-g` adds directives and its own labels and nothing else; that is the claim
     the whole attribution rests on, so it is checked rather than assumed. */
  const plain = ["\t.text", "\taddiu\t$2,$2,1", "\tjr\t$31"].join("\n");
  const debug = [
    "\t.text", "\t.stabs\t\"f.c\",100,0,0,Ltext0", "LM1:", "$Lb0:",
    "\taddiu\t$2,$2,1", "\t.loc\t1 17", "LM2:", "\tjr\t$31",
  ].join("\n");
  assert.equal(sameCode(plain, debug), true);
  assert.deepEqual(codeOnly(debug), ["addiu\t$2,$2,1", "jr\t$31"]);

  /* And a real difference is a real difference: one instruction more and the
     map is refused, because a wrong line sends a reader to code the decision
     was never about. */
  assert.equal(sameCode(plain, `${debug}\n\tnop`), false);
});
