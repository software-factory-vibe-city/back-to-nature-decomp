import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  isMultiInstruction,
  packetsByUid,
  parseEmissionAttribution,
} from "./emission-attribution.js";

/* Every fixture below is verbatim output from the pinned cc1
 * (tools/vendor/old-gcc/build-gcc-2.95.2-psx/cc1) under the project's flags
 * plus -dp, so the parser is tested against the format the compiler actually
 * writes rather than a restatement of it. */

const BLOCK_MOVE = [
  "\tsubu\t$sp,$sp,32\t # 43\tsubsi3_internal\t[length = 1]",
  "\tlui\t$2,%hi(g) # high\t # 10\thigh\t[length = 1]",
  "\tsw\t$31,24($sp)\t # 45\tmovsi_internal2/7\t[length = 1]",
  "\taddiu\t$7,$2,%lo(g)\t # 16\tmovstrsi_internal\t[length = 20]",
  "\tlb\t$3,0($7)",
  "\tlb\t$5,1($7)",
  "\tsb\t$3,16($sp)",
  "\tsb\t$5,17($sp)",
  "\taddu\t$3,$sp,16\t # 13\taddsi3_internal\t[length = 1]",
].join("\n");

test("attribution: one RTL instruction owns the whole block-move run", () => {
  const attribution = parseEmissionAttribution(BLOCK_MOVE);
  const packet = packetsByUid(attribution).get(16);

  assert.ok(packet, "the movstrsi UID must be attributed");
  assert.equal(packet!.pattern, "movstrsi_internal");
  assert.equal(packet!.lines.length, 5, "addiu + two loads + two stores are one instruction");
  assert.ok(packet!.lines[0]!.includes("addiu"));
  assert.ok(packet!.lines[4]!.includes("sb\t$5,17($sp)"));
  assert.equal(attribution.packets.length, 5, "five RTL instructions, nine assembly lines");
});

/* The declared length is in instructions and is an unrefined upper bound —
 * this pattern declares 20 and emits 5. Anything deriving a width from it is
 * wrong; the fixture pins that so the mistake cannot be reintroduced. */
test("attribution: declared length is an upper bound, not an emission width", () => {
  const packet = packetsByUid(parseEmissionAttribution(BLOCK_MOVE)).get(16)!;
  assert.equal(packet.declaredLength, 20);
  assert.equal(packet.lines.length, 5);
  assert.notEqual(packet.declaredLength, packet.lines.length);
});

test("attribution: the constraint alternative is split from the pattern name", () => {
  const packet = packetsByUid(parseEmissionAttribution(BLOCK_MOVE)).get(45)!;
  assert.equal(packet.pattern, "movsi_internal2");
  assert.equal(packet.alternative, 7);
});

/* An ordinary `# high` operand comment shares the line with the annotation.
 * The end-of-line anchor is what keeps it from being read as one. */
test("attribution: an operand comment on the annotated line is not an annotation", () => {
  const packet = packetsByUid(parseEmissionAttribution(BLOCK_MOVE)).get(10)!;
  assert.equal(packet.pattern, "high");
  assert.equal(packet.lines.length, 1);
});

const DIVISION = [
  "\tdiv\t$0,$4,$5\t # 11\tdivmodsi4_internal\t[length = 1]",
  "\tmflo\t$2\t # 28\tmovsi_internal2/12\t[length = 1]",
  "\t#nop",
  "\tbne\t$5,$0,1f\t # 13\tdiv_trap_normal\t[length = 3]",
  "\tnop",
  "\tbreak\t7",
  "1:",
  "\tj\t$31\t # 32\treturn\t[length = 1]",
].join("\n");

/* The division trap is the sharper case: one RTL instruction emits three
 * machine instructions *and* a label, so a control-flow graph derived from the
 * target sees a basic-block boundary that no source statement can produce. */
test("attribution: the division trap packet owns its branch, nop and label", () => {
  const attribution = parseEmissionAttribution(DIVISION);
  const trap = packetsByUid(attribution).get(13)!;

  assert.equal(trap.pattern, "div_trap_normal");
  assert.equal(trap.lines.length, 3, "bne + nop + break");
  assert.deepEqual(trap.labels, ["1:"], "the local label is inside the packet");
  assert.ok(isMultiInstruction(trap));
});

/* `div`/`mflo` are adjacent and cooperating but are two RTL instructions.
 * Merging on adjacency would invent a packet boundary the compiler did not
 * emit, which is the same class of error as missing one. */
test("attribution: adjacent cooperating instructions are not merged", () => {
  const byUid = packetsByUid(parseEmissionAttribution(DIVISION));
  assert.equal(byUid.get(11)!.lines.length, 1, "div is its own instruction");
  assert.equal(byUid.get(28)!.lines.length, 1, "mflo is a separate move");
  assert.equal(byUid.get(28)!.pattern, "movsi_internal2");
});

/* maspsx inserts load-delay nops that no RTL instruction emitted, and marks
 * them. Its marker line also quotes the *next* instruction's annotation inside
 * the comment, which the end-of-line anchor must not mistake for a real one. */
test("attribution: assembler-inserted nops are separated from compiler emission", () => {
  const attribution = parseEmissionAttribution([
    "\taddiu\t$7,$2,%lo(g)\t # 16\tmovstrsi_internal\t[length = 20]",
    "\tlb\t$3,0($7)",
    "\tnop # DEBUG: 'lb\t$5,1($7)' does not load from $3",
    "\tlb\t$5,1($7)",
  ].join("\n"));

  const packet = packetsByUid(attribution).get(16)!;
  assert.equal(packet.lines.length, 3, "the inserted nop is not compiler emission");
  assert.equal(packet.assemblerInserted.length, 1);
  assert.equal(attribution.packets.length, 1, "the quoted annotation did not open a packet");
});

test("attribution: instructions before the first annotation are reported, not absorbed", () => {
  const attribution = parseEmissionAttribution([
    "\tnop",
    "\tsubu\t$sp,$sp,32\t # 43\tsubsi3_internal\t[length = 1]",
  ].join("\n"));

  assert.deepEqual(attribution.unattributed, ["nop"]);
  assert.ok(attribution.caveats.some((caveat) => caveat.includes("unattributed")));
});

test("attribution: assembly without -dp fails closed", () => {
  const attribution = parseEmissionAttribution("\tlb\t$3,0($7)\n\tsb\t$3,16($sp)");
  assert.equal(attribution.packets.length, 0);
  assert.ok(attribution.caveats.some((caveat) => caveat.includes("without -dp")));
});
