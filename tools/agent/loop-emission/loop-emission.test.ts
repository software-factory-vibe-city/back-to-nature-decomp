import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  deriveRequirement,
  innerLoopsOf,
  loopHeaders,
  pass2Routes,
  preheaderOf,
  type Pass2RouteId,
} from "./derive.ts";
import {
  assignments,
  checkPreheader,
  checkRequirement,
  classifyCandidate,
  emissionDistance,
  goalsFor,
  matchLoops,
  openReadings,
} from "./compare.ts";
import { EmissionClass, type GroupRole, type PreheaderRequirement } from "./types.ts";
import { precedentsFor } from "./precedents.ts";
import { renderPrecedents } from "./render.ts";
import type { MirBlock, MirInsn, MirProgram } from "../pipeline-reversal/types.ts";
import type { LoopTrace } from "../loop-trace/types.ts";

/* --- a small program to derive from ------------------------------------- */

let nextId = 0;
function insn(
  block: number,
  mnemonic: string,
  text: string,
  defs: string[],
  uses: string[],
  extra: Partial<MirInsn> = {},
): MirInsn {
  return {
    index: nextId, id: nextId++, mnemonic, operands: [], text, shape: text,
    defs, uses, isCall: false, isBranch: false, isJump: false, isLoad: false,
    isStore: false, isNop: false, block, ...extra,
  } as MirInsn;
}

/**
 * A preheader shaped like the one this tool was built for: a counter init, an
 * invariant address, a scaled induction init, and a second invariant address
 * AFTER it. The last is the interesting one — nothing about the instruction
 * itself says which pass emitted it; only its position does.
 */
function program(): MirProgram {
  nextId = 0;
  const preheader = [
    insn(0, "move", "move s7,zero", ["s7"], []),
    insn(0, "lui", "lui v0,0x800c", ["v0"], [], { symbol: "HDR", symbolAddress: 0x800bb86c }),
    insn(0, "addiu", "addiu s4,v0,-18324", ["s4"], ["v0"], { symbol: "HDR", symbolAddress: 0x800bb86c }),
    insn(0, "move", "move s3,zero", ["s3"], []),
    insn(0, "lui", "lui v0,0x800c", ["v0"], [], { symbol: "PAY", symbolAddress: 0x800bb9bc }),
    insn(0, "addiu", "addiu fp,v0,-17988", ["fp"], ["v0"], { symbol: "PAY", symbolAddress: 0x800bb9bc }),
  ];
  const body = [
    insn(1, "lw", "lw v1,16(s4)", ["v1"], ["s4"], { isLoad: true }),
    insn(1, "addu", "addu s1,s3,fp", ["s1"], ["s3", "fp"]),
    insn(1, "addiu", "addiu s7,s7,1", ["s7"], ["s7"], { operands: ["s7", "s7", "1"] }),
    insn(1, "addiu", "addiu s3,s3,16", ["s3"], ["s3"], { operands: ["s3", "s3", "16"] }),
    insn(1, "bnez", "bnez s7,loop", [], ["s7"], { isBranch: true }),
  ];
  const blocks: MirBlock[] = [
    { index: 0, insns: preheader.map((entry) => entry.id), successors: [1], predecessors: [] },
    { index: 1, insns: body.map((entry) => entry.id), successors: [1], predecessors: [0, 1] },
  ];
  return { waypoint: "dbr", functionName: "f", insns: [...preheader, ...body], blocks, caveats: [] };
}

/**
 * The same preheader, feeding a loop that nests another.
 *
 * Structurally the only thing that changes is the block graph, and that is the
 * point: whether the cascade route is open is decided by the nest, which is
 * readable from the target's bytes and needs no source at all.
 */
function nestedProgram(): MirProgram {
  nextId = 0;
  const preheader = [
    insn(0, "move", "move s7,zero", ["s7"], []),
    insn(0, "lui", "lui v0,0x800c", ["v0"], [], { symbol: "HDR", symbolAddress: 0x800bb86c }),
    insn(0, "addiu", "addiu s4,v0,-18324", ["s4"], ["v0"], { symbol: "HDR", symbolAddress: 0x800bb86c }),
    insn(0, "move", "move s3,zero", ["s3"], []),
    insn(0, "lui", "lui v0,0x800c", ["v0"], [], { symbol: "PAY", symbolAddress: 0x800bb9bc }),
    insn(0, "addiu", "addiu fp,v0,-17988", ["fp"], ["v0"], { symbol: "PAY", symbolAddress: 0x800bb9bc }),
  ];
  const outerHead = [insn(1, "lw", "lw v1,16(s4)", ["v1"], ["s4"], { isLoad: true })];
  const inner = [
    insn(2, "addu", "addu s1,s3,fp", ["s1"], ["s3", "fp"]),
    insn(2, "bnez", "bnez s1,inner", [], ["s1"], { isBranch: true }),
  ];
  const latch = [
    insn(3, "addiu", "addiu s7,s7,1", ["s7"], ["s7"], { operands: ["s7", "s7", "1"] }),
    insn(3, "addiu", "addiu s3,s3,16", ["s3"], ["s3"], { operands: ["s3", "s3", "16"] }),
    insn(3, "bnez", "bnez s7,outer", [], ["s7"], { isBranch: true }),
  ];
  const blocks: MirBlock[] = [
    { index: 0, insns: preheader.map((entry) => entry.id), successors: [1], predecessors: [] },
    { index: 1, insns: outerHead.map((entry) => entry.id), successors: [2], predecessors: [0, 3] },
    { index: 2, insns: inner.map((entry) => entry.id), successors: [2, 3], predecessors: [1, 2] },
    { index: 3, insns: latch.map((entry) => entry.id), successors: [1], predecessors: [2] },
  ];
  return {
    waypoint: "dbr", functionName: "f",
    insns: [...preheader, ...outerHead, ...inner, ...latch],
    blocks, caveats: [],
  };
}

const REQUIREMENT = deriveRequirement(program(), "f");
const PREHEADER = REQUIREMENT.preheaders[0]!;
const NESTED = deriveRequirement(nestedProgram(), "f").preheaders.find((entry) => entry.header === 1)!;

/* --- the derivation ----------------------------------------------------- */

test("a block reached from at or after itself is a loop header, and its earlier predecessor is its preheader", () => {
  const mir = program();
  assert.deepEqual(loopHeaders(mir), [1]);
  assert.equal(preheaderOf(mir, 1), 0);
});

test("an address pair is one emitted unit, not two", () => {
  /* move_movables moves a %hi/%lo pair as a forced unit and emit_iv_add_mult
     emits one as a unit; counted separately they would read as two
     independently placed emissions. */
  assert.equal(PREHEADER.groups.length, 4);
  assert.deepEqual(PREHEADER.groups.map((group) => group.insns.length), [1, 2, 1, 2]);
});

test("each group admits only the classes its own evidence allows", () => {
  const [counter, header, offset, payload] = PREHEADER.groups;
  assert.equal(counter!.role, "induction-init");
  assert.equal(counter!.step, 1);
  assert.equal(header!.role, "invariant");
  assert.equal(offset!.role, "induction-init");
  assert.equal(offset!.step, 16, "a scaled step is what a reduced giv looks like");
  assert.equal(payload!.role, "invariant");
});

test("the ordering constraint is what turns evidence into a requirement", () => {
  const [, header, offset, payload] = PREHEADER.groups;
  /* An invariant on its own could be a source-level name or either pass's
     hoist. The header's pass-2 option dies because the offset after it can
     only be source or a pass-1 giv init. */
  assert.deepEqual(header!.consistent, [EmissionClass.Source, EmissionClass.Pass1Movable]);
  assert.deepEqual(offset!.consistent, [EmissionClass.Source, EmissionClass.Pass1GivInit]);
  assert.deepEqual(payload!.consistent,
    [EmissionClass.Source, EmissionClass.Pass1Movable, EmissionClass.Pass2Movable]);
  assert.equal(PREHEADER.unsatisfiable, false);
});

test("every consistent reading of the preheader is enumerated", () => {
  const options = assignments(PREHEADER);
  assert.ok(options.every((option) => option.every((value, index) => index === 0 || value >= option[index - 1]!)),
    "each reading is non-decreasing");
  assert.ok(options.some((option) => option.every((value) => value === EmissionClass.Source)),
    "including the one where the C named everything and nothing was hoisted");
});

/* --- the goal ----------------------------------------------------------- */

test("the payload address is forced past pass 1 the moment anything earlier is hoisted", () => {
  const goals = goalsFor(PREHEADER);
  assert.equal(goals.length, 1, "only the trailing invariant is constrained");
  assert.equal(goals[0]!.symbol, "PAY");
  assert.equal(goals[0]!.address, 0x800bb9bc);
  assert.equal(goals[0]!.whenAnythingHoisted, true);
  assert.equal(goals[0]!.unconditional, false, "the all-source reading is still open, and says so");
});

/* --- the routes to a pass-2 emission ------------------------------------ */

test("a %hi/%lo pair is recognised as one inseparable unit, which is what floors its product", () => {
  const payload = PREHEADER.groups[3]!;
  assert.equal(payload.addressPair, true);
  assert.equal(PREHEADER.groups[0]!.addressPair, false, "a single move is not a pair");
});

test("the nest is read off the block graph, so the cascade route needs no source", () => {
  const mir = nestedProgram();
  assert.deepEqual(loopHeaders(mir), [1, 2]);
  assert.deepEqual(innerLoopsOf(mir, 1), [2]);
  assert.deepEqual(innerLoopsOf(mir, 2), [], "the inner loop nests nothing");
  assert.deepEqual(NESTED.innerLoops, [2]);
});

test("without a nest there are two routes to a pass-2 emission; with one there are three", () => {
  /* The enumeration this exists for. The reachability analysis behind a reading
     used to assume a pass-2 movable must have declined at pass 1 — under which
     a forced pair's product floor of 2x2 closes the direction outright, which
     is how a correct reading was recorded as impossible. */
  const flat = pass2Routes(PREHEADER, PREHEADER.groups[3]!).map((route) => route.id);
  assert.deepEqual(flat, ["pass1-decline", "induction"]);

  const nested = pass2Routes(NESTED, NESTED.groups[3]!).map((route) => route.id);
  assert.deepEqual(nested, ["pass1-decline", "inner-cascade", "induction"]);
});

test("the cascade route states that no pass-1 decline is needed, and what the source must do", () => {
  const cascade = pass2Routes(NESTED, NESTED.groups[3]!).find((route) => route.id === "inner-cascade")!;
  assert.ok(cascade.evidence.some((line) => /never evaluated it/.test(line)),
    "the point of the route: pass 1 of this loop did not run the test");
  assert.ok(cascade.evidence.some((line) => /A product floor is not an argument against this route/.test(line)));
  /* And the source-side conditions, including the one that keeps the pair a
     pair — a one-register index folds the %lo away and leaves nothing to hoist. */
  assert.ok(cascade.requirements.some((line) => /per-iteration/.test(line)));
  assert.ok(cascade.requirements.some((line) => /two-register-sum index/.test(line)));
  assert.ok(cascade.requirements.some((line) => /phony/.test(line)));
});

test("the pass-1-decline route carries the floor that refutes it, and only it", () => {
  const decline = pass2Routes(NESTED, NESTED.groups[3]!).find((route) => route.id === "pass1-decline")!;
  assert.ok(decline.evidence.some((line) => /floors at 2x2 = 4/.test(line)));
});

test("a goal carries its routes, so the requirement is a mechanism and not a coordinate", () => {
  const goal = goalsFor(NESTED).find((entry) => entry.symbol === "PAY")!;
  assert.deepEqual(goal.routes.map((route) => route.id), ["pass1-decline", "inner-cascade", "induction"]);
});

/* --- scoring a candidate ------------------------------------------------ */

function trace(
  loops: Array<{ key: [number, number]; pass: number; movables: Array<{ insn: number; symbol?: string; moved?: boolean; forces?: number }> }>,
): LoopTrace {
  const passes = [1, 2].map((index) => ({
    index,
    loops: loops.filter((entry) => entry.pass === index).map((entry) => ({
      from: entry.key[0], to: entry.key[1], insnCount: 40, phony: false,
      movables: entry.movables.map((movable) => ({
        insn: movable.insn, regno: 500 + movable.insn, life: 2, cond: false, force: false,
        global: false, done: false, moveInsn: true, halved: false, savings: 2,
        decision: (movable.moved === false ? "not desirable" : "moved") as "moved" | "not desirable",
        movedTo: 1000 + movable.insn, raw: `Insn ${movable.insn}`,
        ...(movable.symbol === undefined ? {} : { symbol: movable.symbol }),
        ...(movable.forces === undefined ? {} : { forces: movable.forces }),
      })),
      bivs: [], givs: [], combineStatistics: [], notes: [],
    })),
  }));
  return { functionName: "f", passes, unrecognised: [], rtlStartsAt: 0 };
}

const ADDRESS_OF = (name: string): number | undefined =>
  ({ HDR: 0x800bb86c, PAY: 0x800bb9bc } as Record<string, number>)[name];

function verdictFor(
  loops: Parameters<typeof trace>[0],
): ReturnType<typeof checkRequirement>[number] {
  const classing = classifyCandidate(trace(loops), ADDRESS_OF);
  return checkRequirement([PREHEADER], classing)[0]!;
}

test("a class the target cannot hold at that position fails on its own", () => {
  /* The offset group sits between the two addresses, so nothing after it can be
     a pass-1 movable. */
  const verdict = verdictFor([{ key: [10, 90], pass: 1, movables: [{ insn: 1, symbol: "HDR" }, { insn: 2, symbol: "PAY" }] }]);
  assert.equal(verdict.consistentWithTarget, false);
  assert.deepEqual(verdict.groups.map((group) => group.outcome), ["met", "met"]);
  assert.equal(verdict.combinationImpossible, true,
    "each class is possible alone; it is the pair that no reading holds");
});

test("an impossible combination names the single change, and how to make it in source", () => {
  const verdict = verdictFor([{ key: [10, 90], pass: 1, movables: [{ insn: 1, symbol: "HDR" }, { insn: 2, symbol: "PAY" }] }]);
  const open = openReadings(verdict);
  assert.ok(open.length > 0, "there is at least one one-change-away reading");

  const toPassTwo = open.find((change) =>
    change.group.address === 0x800bb9bc && change.to === EmissionClass.Pass2Movable);
  assert.ok(toPassTwo, "moving the payload to pass 2 is one of them — the target's own reading");

  /* The point of the whole tool. A coordinate ("pass-1 movable -> pass-2
     movable") is not guidance; the agent has to be told what to type. */
  assert.ok(toPassTwo!.moves.some((move) => /BREAK PASS-1 INVARIANCE/.test(move)));
  assert.ok(toPassTwo!.moves.some((move) => /INDUCTION EXPRESSION/.test(move)));

  const toSource = open.find((change) => change.to === EmissionClass.Source);
  assert.ok(toSource!.moves.some((move) => /Hold the address in a local/.test(move)),
    "and the other direction gets its own edit, not the same one reworded");
});

test("the cascade route reaches the candidate's moves only when the target's loop nests one", () => {
  /* The sequence that closed a function for six sessions: the candidate's pair
     is inseparable, its product floors at 4, and the floor was read as closing
     the whole direction. It closes route (i) and (ii); route (iii) never faced
     the test, because pass 1 of the outer loop cannot see an insn pass 1 of the
     inner loop created. */
  const classing = classifyCandidate(trace([{
    key: [10, 90], pass: 1,
    movables: [{ insn: 1, symbol: "HDR" }, { insn: 2, symbol: "PAY" }, { insn: 3, symbol: "PAY", forces: 2 }],
  }]), ADDRESS_OF);

  const nested = openReadings(checkPreheader(NESTED, classing.loops[0]!, classing.unresolved))
    .find((entry) => entry.to === EmissionClass.Pass2Movable)!;
  assert.ok(nested.moves.some((move) => /CASCADE OUT OF A NESTED LOOP/.test(move)));
  assert.ok(nested.moves.some((move) => /this floor closes the pass-1-decline route ONLY/.test(move)),
    "and the floor is explicitly scoped, since it is what closed the direction wrongly");

  const flat = openReadings(checkPreheader(PREHEADER, classing.loops[0]!, classing.unresolved))
    .find((entry) => entry.to === EmissionClass.Pass2Movable)!;
  assert.equal(flat.moves.some((move) => /CASCADE OUT OF A NESTED LOOP/.test(move)), false,
    "no nest, no route — the tool does not offer a mechanism the target's shape forecloses");
});

test("the target and a measured candidate together pin exactly one reading, and it is the cascade one", () => {
  /* `NESTED` is `ovl_10_func_800BA394`'s block 93 in miniature: a step-1 counter
     init, an invariant address, a step-16 induction init, and a second
     invariant address after it, feeding a loop that nests another. The real
     preheader admits five readings and this fixture admits the same five — the
     enumeration is not pruned, because the all-source reading is a real one and
     the bytes do not refute it.
     What collapses it is the measured candidate. The byte-exact source emits
     D_800BB86C as a pass-1 movable and D_800BB9BC as a pass-2 movable out of one
     loop, and exactly one of the five readings holds both at once. */
  assert.equal(assignments(NESTED).length, 5, "the requirement alone is a range, and stays one");

  const classing = classifyCandidate(trace([
    { key: [1194, 1357], pass: 1, movables: [{ insn: 1213, symbol: "HDR" }] },
    { key: [1194, 1357], pass: 2, movables: [{ insn: 1642, symbol: "PAY" }] },
  ]), ADDRESS_OF);
  const verdict = checkPreheader(NESTED, classing.loops[0]!, classing.unresolved);

  assert.equal(verdict.consistentWithTarget, true);
  assert.equal(verdict.readings.length, 1, "the two sides together leave exactly one reading");
  const reading = verdict.readings[0]!;
  assert.deepEqual(reading, [
    EmissionClass.Source,        // the counter init the source wrote
    EmissionClass.Pass1Movable,  // D_800BB86C, hoisted by pass 1
    EmissionClass.Pass1GivInit,  // the offset, which is a reduced giv and not a source variable
    EmissionClass.Pass2Movable,  // D_800BB9BC, after pass 1's giv init — the cascade
  ]);

  /* And it is the cascade reading rather than merely a pass-2 one: the group's
     route enumeration, on the target's own nest, offers the cascade. */
  const payload = NESTED.groups[3]!;
  assert.ok(pass2Routes(NESTED, payload).some((route) => route.id === "inner-cascade"));
});

test("a candidate that hoists everything in pass 1 leaves no reading at all", () => {
  /* The other side of the same measurement: `readings` is empty, which is what
     `combinationImpossible` means, and it is a different failure from a group
     being in an impossible class. */
  const classing = classifyCandidate(trace([
    { key: [1194, 1357], pass: 1, movables: [{ insn: 1213, symbol: "HDR" }, { insn: 1225, symbol: "PAY" }] },
  ]), ADDRESS_OF);
  const verdict = checkPreheader(NESTED, classing.loops[0]!, classing.unresolved);
  assert.deepEqual(verdict.readings, []);
  assert.equal(verdict.combinationImpossible, true);
});

test("the moves carry the candidate's own numbers, and name a floor when there is one", () => {
  /* A forced pair cannot reach product 2, so telling the agent to lower the
     product would spend a session on an impossible edit. */
  const classing = classifyCandidate(trace([{
    key: [10, 90], pass: 1,
    movables: [{ insn: 1, symbol: "HDR" }, { insn: 2, symbol: "PAY" }, { insn: 3, symbol: "PAY", forces: 2 }],
  }]), ADDRESS_OF);
  const verdict = checkPreheader(PREHEADER, classing.loops[0]!, classing.unresolved);
  const change = openReadings(verdict).find((entry) => entry.to === EmissionClass.Pass2Movable)!;
  assert.ok(change.moves.some((move) => /insn 2 decided on savings 2 x lifetime 2 = 4/.test(move)));
  assert.ok(change.moves.some((move) => /INSEPARABLE PAIR — insn 3 is forced by it/.test(move)));
  assert.ok(change.moves.some((move) => /go at invariance/.test(move)));
});

test("the target's own assignment is consistent", () => {
  const verdict = verdictFor([
    { key: [10, 90], pass: 1, movables: [{ insn: 1, symbol: "HDR" }] },
    { key: [10, 90], pass: 2, movables: [{ insn: 2, symbol: "PAY" }] },
  ]);
  assert.equal(verdict.consistentWithTarget, true);
  assert.equal(verdict.combinationImpossible, false);
  assert.equal(emissionDistance([verdict]), 0);
});

test("a hoist out of a DIFFERENT loop is not credited to this preheader", () => {
  /* The regression this exists for. A function-wide address-to-class map said
     "hoisted in pass 2, the required side of the boundary" for a candidate that
     hoisted the address out of the INNER loop, into a different preheader
     entirely — the target has it in the outer loop's preheader. Attribution has
     to be per loop, so the join is made first and the classes read from it. */
  const classing = classifyCandidate(trace([
    { key: [10, 90], pass: 1, movables: [{ insn: 1, symbol: "HDR" }] },
    { key: [50, 70], pass: 2, movables: [{ insn: 2, symbol: "PAY" }] },
  ]), ADDRESS_OF);
  const outer = classing.loops.find((loop) => loop.key === "10..90")!;
  const verdict = checkPreheader(PREHEADER, outer, classing.unresolved);

  const payload = verdict.groups.find((group) => group.address === 0x800bb9bc)!;
  assert.equal(payload.actual, EmissionClass.Source, "this loop did not emit it, so it is not credited");
  assert.equal(verdict.consistentWithTarget, false);
});

test("two loops overlapping a preheader equally well leave it unjoined", () => {
  /* Refusing is the honest outcome: crediting either would be a coin flip, and
     a coin flip here reads as a clean pass. */
  const verdict = verdictFor([
    { key: [10, 90], pass: 1, movables: [{ insn: 1, symbol: "HDR" }] },
    { key: [50, 70], pass: 2, movables: [{ insn: 2, symbol: "PAY" }] },
  ]);
  assert.equal(verdict.loop, undefined);
  assert.ok(verdict.groups.every((group) => group.outcome === "undetermined"));
});

test("a movable the pass declined to move is not an emission", () => {
  const verdict = verdictFor([
    { key: [10, 90], pass: 1, movables: [{ insn: 1, symbol: "HDR" }, { insn: 2, symbol: "PAY", moved: false }] },
  ]);
  const payload = verdict.groups.find((group) => group.address === 0x800bb9bc)!;
  assert.equal(payload.actual, EmissionClass.Source);
});

test("a preheader no loop can be joined to is judged on nothing", () => {
  const verdict = verdictFor([{ key: [10, 90], pass: 1, movables: [{ insn: 1, symbol: "UNKNOWN" }] }]);
  assert.equal(verdict.loop, undefined);
  assert.ok(verdict.groups.every((group) => group.outcome === "undetermined"));
  assert.equal(verdict.consistentWithTarget, false, "unjudged is not consistent");
});

test("a symbol no address can be found for is reported, not dropped", () => {
  const classing = classifyCandidate(
    trace([{ key: [10, 90], pass: 1, movables: [{ insn: 7, symbol: "SOMETHING_ELSE" }] }]),
    ADDRESS_OF,
  );
  assert.deepEqual(classing.unresolved, ["pass 1 movable insn 7"]);
});

test("loops are assigned to preheaders by whole-assignment overlap, not greedily", () => {
  /* A greedy match with a tie-veto refused a correct join and threw the answer
     away; the optimum over whole assignments settles the tie from what the
     other preheaders need. */
  const classing = classifyCandidate(trace([
    { key: [10, 90], pass: 1, movables: [{ insn: 1, symbol: "HDR" }, { insn: 2, symbol: "PAY" }] },
    { key: [50, 70], pass: 1, movables: [{ insn: 3, symbol: "HDR" }] },
  ]), ADDRESS_OF);
  const matched = matchLoops([PREHEADER], classing);
  assert.equal(matched.get(0)?.key, "10..90", "the loop carrying both addresses wins");
});

/* --- the model's own honesty -------------------------------------------- */


test("a group no assignment satisfies constrains nothing", () => {
  const broken: PreheaderRequirement = {
    block: 0, header: 1, innerLoops: [], unsatisfiable: false,
    groups: [
      { index: 0, insns: [], text: "a", role: "invariant", addressPair: false, admissible: [], consistent: [] },
    ],
  };
  assert.deepEqual(goalsFor(broken), []);
});

test("a header with several earlier predecessors gets a caveat, not a guess", () => {
  /* loop.c emits before `loop_start`, which is one place. A header entered from
     two earlier blocks has no such place, so the ordering argument does not
     apply to either of them and neither is treated as a preheader. */
  nextId = 0;
  const blocks: MirBlock[] = [
    { index: 0, insns: [], successors: [2], predecessors: [] },
    { index: 1, insns: [], successors: [2], predecessors: [] },
    { index: 2, insns: [], successors: [2], predecessors: [0, 1, 2] },
  ];
  const derived = deriveRequirement(
    { waypoint: "dbr", functionName: "f", insns: [], blocks, caveats: [] },
    "f",
  );
  assert.deepEqual(derived.preheaders, []);
  assert.ok(derived.caveats.some((caveat) => /no single earlier predecessor/.test(caveat)));
});

/* --- precedents ---------------------------------------------------------- */

test("a precedent is ranked on the roles around the forced group, not on symbols", () => {
  /* What transfers between two functions is the shape of the preheader — what
     is invariant, what is an induction initialisation, in what order. Two
     functions that solve the same problem share no globals at all, which is
     why the instruction-shape index returns their boilerplate instead. */
  const index = {
    scanned: 2, withPreheaders: 2,
    precedents: [
      { functionName: "near", source: "src/near.c", status: "matched" as const, block: 1,
        roles: ["induction-init", "invariant", "induction-init", "invariant"] as GroupRole[],
        groups: ["a", "b", "c", "d"], forced: [3], forcedSymbols: ["X"],
        routes: ["pass1-decline", "induction"] as Pass2RouteId[], innerLoops: [] },
      { functionName: "far", source: "src/far.c", status: "matched" as const, block: 1,
        roles: ["effectful", "varying"] as GroupRole[],
        groups: ["e", "f"], forced: [1], forcedSymbols: ["Y"],
        routes: ["pass1-decline"] as Pass2RouteId[], innerLoops: [] },
    ],
  };
  const hits = precedentsFor(PREHEADER, index);
  assert.equal(hits[0]!.precedent.functionName, "near");
  assert.ok(hits[0]!.score >= 4, "the whole role sequence runs in the same order there");
  assert.equal(hits.some((hit) => hit.precedent.functionName === "far"), false,
    "a preheader with no shared role run is not a precedent");
});

test("no precedent is reported as an absence, not as a weak hit", () => {
  /* `tools report only what they prove`: telling an agent to copy the closest
     thing when nothing in the corpus carries the mechanism is how five sessions
     went into compiler forensics against a worked example that did exist. */
  const empty = { scanned: 415, withPreheaders: 65, precedents: [] };
  assert.deepEqual(precedentsFor(PREHEADER, empty), []);
});

test("only preheaders that constrain something look for a precedent", () => {
  const unconstrained: PreheaderRequirement = {
    block: 0, header: 1, innerLoops: [], unsatisfiable: false,
    groups: [{ index: 0, insns: [], text: "a", role: "effectful", addressPair: false,
      admissible: [], consistent: [EmissionClass.Source] }],
  };
  const index = {
    scanned: 1, withPreheaders: 1,
    precedents: [{ functionName: "any", source: "src/any.c", status: "matched" as const, block: 1,
      roles: ["effectful"] as GroupRole[], groups: ["a"], forced: [0], forcedSymbols: ["X"],
      routes: [] as Pass2RouteId[], innerLoops: [] }],
  };
  assert.deepEqual(precedentsFor(unconstrained, index), []);
});

test("a parked shape is registered as a precedent, and never as a spelling to copy", () => {
  /* Its preheader comes off its target bytes exactly like a matched function's
     — the derivation never reads a candidate — so excluding it drops a real
     shape for a reason about the tree's progress rather than about the
     compiler, and drops precisely the population a stalled session needs. What
     it is NOT is a spelling: the C beside it does not reproduce those bytes. */
  const index = {
    scanned: 2, withPreheaders: 2,
    precedents: [
      { functionName: "parked", source: "build/experimentLedger/sources/parked/abc.c",
        status: "parked" as const, block: 1,
        roles: ["induction-init", "invariant", "induction-init", "invariant"] as GroupRole[],
        groups: ["a", "b", "c", "d"], forced: [3], forcedSymbols: ["X"],
        routes: ["pass1-decline", "inner-cascade"] as Pass2RouteId[], innerLoops: [2] },
    ],
  };
  const hits = precedentsFor(NESTED, index);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.precedent.status, "parked");
  assert.ok(hits[0]!.sharedRoutes.includes("inner-cascade"),
    "and it is found on the route, which is what transfers");

  const text = renderPrecedents(hits, 2).join("\n");
  assert.match(text, /\[PARKED\]/);
  assert.match(text, /ITS C DOES NOT PRODUCE THIS/);
  assert.match(text, /Take the shape and the measured trace, never the spelling/);
});
