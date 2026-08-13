import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { DisassembledInstruction } from "./decompToolchain.js";
import {
  evaluateWord,
  layoutStruct,
  loadPacketRecipes,
  loadPrimitiveTable,
  parseAttributeMacros,
  parseExpression,
  parseMacroDefinitions,
  recognizeIdioms,
  type PacketMatch,
  type PrimitiveMatch,
} from "./sdkIdioms.js";

/**
 * Fixtures are transcribed target windows, assembled here as objdump-shaped
 * instructions. Nothing reads `build/`: the artifacts there are ignored, and a
 * detector whose regression test depends on a generated file has no regression
 * test on a fresh checkout.
 */
function code(lines: string[]): DisassembledInstruction[] {
  return lines.map((line, index) => {
    const [mnemonic, rest = ""] = line.trim().split(/\s+(.*)/);
    const operands = rest
      ? rest.split(/,(?![^(]*\))/).map((operand) => operand.trim()).filter(Boolean)
      : [];
    return {
      address: index * 4,
      mnemonic,
      operands,
      operandText: operands.join(","),
      raw: line.trim(),
    };
  });
}

/* --- func_800134C4's target windows ---------------------------------- */

/**
 * The POLY_F4 window. The code byte is 0x2A, not setPolyF4's 0x28: bit 1 was
 * added by setSemiTrans, which is ordinary SDK composition and used to hide the
 * primitive from the detector completely.
 */
const POLY_F4_WINDOW = [
  "addu a0,a0,v0",
  "li v1,5",
  "li v0,640",
  "sb v1,3(a0)",
  "li v1,480",
  "sh v0,12(a0)",
  "sh v0,20(a0)",
  "li v0,42",
  "sb v0,7(a0)",
  "sh v1,18(a0)",
  "sh v1,22(a0)",
  "sb a3,4(a0)",
  "sb a3,5(a0)",
  "sb a3,6(a0)",
  "sh zero,8(a0)",
  "sh zero,10(a0)",
  "sh zero,14(a0)",
  "sh zero,16(a0)",
];

/** The DR_MODE window: len 2, an E1 mode command, and a zero window word. */
const DR_MODE_WINDOW = [
  "addu a1,a1,v0",
  "lui a2,0xe100",
  "ori a2,a2,0x740",
  "li v1,2",
  "sb v1,3(a1)",
  "sw a2,4(a1)",
  "sw zero,8(a1)",
];

/** Both 24-bit tag merges of `addPrim(ot, poly)` and `addPrim(ot, drawMode)`. */
const ADD_PRIM_WINDOW = [
  "lui t0,0xff",
  "ori t0,t0,0xffff",
  "lui a3,0xff00",
  "lw v1,0(a0)",
  "lw v0,0(a2)",
  "and v1,v1,a3",
  "and v0,v0,t0",
  "or v1,v1,v0",
  "sw v1,0(a0)",
  "lw v0,0(a2)",
  "and a0,a0,t0",
  "and v0,v0,a3",
  "or v0,v0,a0",
  "sw v0,0(a2)",
  "lw v1,0(a1)",
  "and v0,v0,t0",
  "and v1,v1,a3",
  "or v1,v1,v0",
  "sw v1,0(a1)",
  "and a1,a1,t0",
  "lw v0,0(a2)",
  "and v0,v0,a3",
  "or v0,v0,a1",
  "sw v0,0(a2)",
];

const MOTIVATING = [...POLY_F4_WINDOW, ...DR_MODE_WINDOW, ...ADD_PRIM_WINDOW];

function primitives(report: ReturnType<typeof recognizeIdioms>): PrimitiveMatch[] {
  return report.objects.filter((object): object is PrimitiveMatch => object.kind === "primitive");
}

function packets(report: ReturnType<typeof recognizeIdioms>): PacketMatch[] {
  return report.objects.filter((object): object is PacketMatch => object.kind === "command-packet");
}

/* --- header parsing --------------------------------------------------- */

test("layoutStruct places a fixed array as an aggregate plus addressable elements", () => {
  const layout = layoutStruct("u_long tag; u_long code[2];");
  assert.ok(layout);
  assert.equal(layout!.size, 12);
  assert.deepEqual(
    layout!.fields.map((field) => [field.offset, field.name, field.size, field.elementCount ?? null]),
    [
      [0, "tag", 4, null],
      [4, "code", 8, 2],
      [4, "code[0]", 4, null],
      [8, "code[1]", 4, null],
    ],
  );
});

test("layoutStruct refuses what it cannot place exactly", () => {
  assert.equal(layoutStruct("unsigned addr: 24; unsigned len: 8;"), null, "bitfields");
  assert.equal(layoutStruct("u_long code[];"), null, "flexible array");
  assert.equal(layoutStruct("u_long code[MAX];"), null, "non-literal dimension");
  assert.equal(layoutStruct("RECT clip;"), null, "unknown element type");
  assert.equal(layoutStruct("struct { int a; } inner;"), null, "nested aggregate");
});

test("attribute masks are read out of the configured header, not restated here", () => {
  const attributes = parseAttributeMacros(
    "#define setSemiTrans(p, abe) \\\n" +
    "\t((abe)?setcode(p, getcode(p)|0x02):setcode(p, getcode(p)&~0x02))\n" +
    "#define setShadeTex(p, tge) \\\n" +
    "\t((tge)?setcode(p, getcode(p)|0x01):setcode(p, getcode(p)&~0x01))\n" +
    "#define setClut(p,x,y) ((p)->clut = getClut(x,y))\n",
  );
  assert.deepEqual(attributes, [
    { macro: "setSemiTrans", mask: 0x02 },
    { macro: "setShadeTex", mask: 0x01 },
  ]);
});

test("an attribute macro whose set and clear masks disagree is not an attribute", () => {
  const attributes = parseAttributeMacros(
    "#define setBogus(p, f) ((f)?setcode(p, getcode(p)|0x02):setcode(p, getcode(p)&~0x04))\n",
  );
  assert.deepEqual(attributes, []);
});

test("the configured header yields setPolyF4 with base code 0x28 and DR_MODE at 12 bytes", () => {
  const polyF4 = loadPrimitiveTable().find((entry) => entry.macro === "setPolyF4");
  assert.ok(polyF4, "setPolyF4 must be parsed from the configured header");
  assert.equal(polyF4!.name, "POLY_F4");
  assert.equal(polyF4!.len, 5);
  assert.equal(polyF4!.code, 0x28);
  assert.equal(polyF4!.size, 0x18);

  const drawMode = loadPacketRecipes().find((recipe) => recipe.macro === "setDrawMode");
  assert.ok(drawMode, "setDrawMode must be parsed from the configured header");
  assert.equal(drawMode!.type, "DR_MODE");
  assert.equal(drawMode!.size, 12);
  assert.equal(drawMode!.len, 2);
  assert.deepEqual(drawMode!.writes.map((write) => write.offset), [4, 8]);
});

test("a command word inverts to the arguments the target establishes", () => {
  const macros = parseMacroDefinitions(
    "#define _get_mode(dfe, dtd, tpage)\t\\\n" +
    "\t\t((0xe1000000)|((dtd)?0x0200:0)| \\\n" +
    "\t\t((dfe)?0x0400:0)|((tpage)&0x9ff))\n",
  );
  const evaluation = evaluateWord(parseExpression("_get_mode(dfe, dtd, tpage)", macros), 0xe1000740);
  assert.equal(evaluation.ok, true);
  assert.ok(evaluation.ok);
  assert.deepEqual(
    evaluation.arguments.map((argument) => [argument.name, argument.value, argument.confidence]),
    [["dtd", 1, "exact"], ["dfe", 1, "exact"], ["tpage", 0x140, "compatible"]],
  );
});

test("a word carrying bits the expression cannot produce is proven incompatible", () => {
  const macros = parseMacroDefinitions("#define _get_stp(pbw) (0xe6000000|(pbw?0x01:0))\n");
  const evaluation = evaluateWord(parseExpression("_get_stp(pbw)", macros), 0xe1000740);
  assert.equal(evaluation.ok, false);
  assert.ok(!evaluation.ok);
  assert.equal(evaluation.incompatible, true);
});

/* --- Phase 1: composed primitive initializers -------------------------- */

test("the composed code 0x2A is recognized as setPolyF4 plus setSemiTrans", () => {
  const report = recognizeIdioms(code(MOTIVATING));
  const found = primitives(report);
  assert.equal(found.length, 1);
  const match = found[0]!;
  assert.equal(match.type.name, "POLY_F4");
  assert.equal(match.type.macro, "setPolyF4");
  assert.equal(match.observedLen, 5);
  assert.equal(match.observedCode, 0x2a);
  assert.equal(match.baseCode, 0x28);
  assert.equal(match.confidence, "exact-composite");
  assert.deepEqual(
    match.attributes.filter((attribute) => attribute.enabled).map((attribute) => attribute.macro),
    ["setSemiTrans"],
  );
  assert.ok(
    match.evidence.some((line) => /0x2A = base 0x28 \| setSemiTrans bit 0x2/.test(line)),
    "the composition must be stated as evidence, not merely used",
  );
});

test("an exact-code primitive is still matched with no attribute bits", () => {
  const report = recognizeIdioms(code([
    "addu a0,a0,v0",
    "li v1,9",
    "sb v1,3(a0)",
    "li v0,44",
    "sb v0,7(a0)",
  ]));
  const found = primitives(report);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.type.name, "POLY_FT4");
  assert.equal(found[0]!.observedCode, found[0]!.baseCode);
  assert.deepEqual(found[0]!.attributes.filter((attribute) => attribute.enabled), []);
});

test("a code byte differing outside the parsed attribute mask is not a match", () => {
  /* len 5 pairs with setPolyF4's 0x28; 0x2C differs in bit 2, which no parsed
   * attribute macro claims, so the primitive is refused outright. */
  const report = recognizeIdioms(code([
    "addu a0,a0,v0",
    "li v1,5",
    "sb v1,3(a0)",
    "li v0,44",
    "sb v0,7(a0)",
  ]));
  assert.deepEqual(report.objects, []);
  assert.equal(report.primitive, null);
});

test("len and code stored through different bases are not one primitive", () => {
  const report = recognizeIdioms(code([
    "addu a0,a0,v0",
    "addu a1,a1,v0",
    "li v1,5",
    "sb v1,3(a0)",
    "li v0,42",
    "sb v0,7(a1)",
  ]));
  assert.deepEqual(report.objects, []);
});

test("a base register reused for another pointer does not merge two objects", () => {
  const report = recognizeIdioms(code([
    "addu a0,a0,v0",
    "li v1,5",
    "sb v1,3(a0)",
    "li v0,42",
    "sb v0,7(a0)",
    "addu a0,s1,s2",
    "li v1,9",
    "sb v1,3(a0)",
    "li v0,44",
    "sb v0,7(a0)",
  ]));
  const found = primitives(report);
  assert.deepEqual(found.map((match) => match.type.name), ["POLY_F4", "POLY_FT4"]);
  assert.notEqual(found[0]!.baseWeb, found[1]!.baseWeb);
});

test("a struct writing +3 and +7 but landing outside the packet is not a primitive", () => {
  const report = recognizeIdioms(code([
    "addu a0,a0,v0",
    "li v1,5",
    "sb v1,3(a0)",
    "li v0,42",
    "sb v0,7(a0)",
    "sw v0,32(a0)",
  ]));
  assert.deepEqual(report.objects, [], "a store past sizeof(POLY_F4) refuses the geometry");
});

/* --- Phase 2: command packets, multiple objects, addPrim --------------- */

test("the E1 command packet is recognized as DR_MODE via setDrawMode", () => {
  const report = recognizeIdioms(code(MOTIVATING));
  const found = packets(report);
  assert.equal(found.length, 1);
  const match = found[0]!;
  assert.equal(match.recipe.type, "DR_MODE");
  assert.equal(match.recipe.macro, "setDrawMode");
  assert.equal(match.confidence, "exact");
  assert.equal(match.observedLen, 2);
  assert.deepEqual(match.observedWords, [{ offset: 4, value: 0xe1000740 }, { offset: 8, value: 0 }]);
  assert.deepEqual(
    match.arguments.map((argument) => [argument.name, argument.value]),
    [["dtd", 1], ["dfe", 1], ["tpage", 0x140], ["tw", 0]],
  );
});

test("an E1 command word without the packet length is not a command packet", () => {
  const report = recognizeIdioms(code([
    "addu a1,a1,v0",
    "lui a2,0xe100",
    "ori a2,a2,0x740",
    "sw a2,4(a1)",
    "sw zero,8(a1)",
  ]));
  assert.deepEqual(report.objects, []);
});

test("a length with no trailing command word is not a command packet", () => {
  const report = recognizeIdioms(code([
    "addu a1,a1,v0",
    "li v1,2",
    "sb v1,3(a1)",
  ]));
  assert.deepEqual(report.objects, []);
});

test("the motivating function carries two objects and two complete addPrim links", () => {
  const report = recognizeIdioms(code(MOTIVATING));
  assert.equal(report.objects.length, 2);
  const exact = report.links.filter((link) => link.confidence === "exact");
  assert.equal(exact.length, 2);
  assert.equal(new Set(exact.map((link) => link.orderingTableWeb)).size, 1,
    "both links must share one ordering-table pointer");
  assert.deepEqual(exact.map((link) => link.objectType), ["POLY_F4", "DR_MODE"]);
});

test("a tag merge that does not connect both pointers is partial, never addPrim", () => {
  const report = recognizeIdioms(code([
    ...POLY_F4_WINDOW,
    "lui t0,0xff",
    "ori t0,t0,0xffff",
    "lui a3,0xff00",
    "lw v1,0(a0)",
    "lw v0,0(a2)",
    "and v1,v1,a3",
    "and v0,v0,t0",
    "or v1,v1,v0",
    "sw v1,0(a0)",
  ]));
  assert.deepEqual(report.links.map((link) => link.confidence), ["partial"]);
  assert.ok(report.findings.some((finding) => finding.kind === "sdk-link-partial"));
  assert.ok(!report.findings.some((finding) => finding.kind === "sdk-link"));
});

test("a mask constant with no merge geometry produces no link at all", () => {
  const report = recognizeIdioms(code([
    ...POLY_F4_WINDOW,
    "lui t0,0xff",
    "ori t0,t0,0xffff",
    "and v0,v0,t0",
    "sw v0,0(a0)",
  ]));
  assert.deepEqual(report.links, []);
});

/* --- report shape ------------------------------------------------------ */

test("the deprecated compatibility projection still names the first primitive", () => {
  const report = recognizeIdioms(code(MOTIVATING));
  assert.equal(report.primitive?.name, "POLY_F4");
  assert.equal(report.base, "a0");
  assert.ok(report.written.some((field) => field.name === "code"));
  assert.ok(report.written.some((field) => field.name === "x3"));
});

test("the field map names every offset the target writes, with its constant", () => {
  const report = recognizeIdioms(code(MOTIVATING));
  const map = report.findings.find((finding) => finding.kind === "sdk-fields" && finding.summary.startsWith("POLY_F4"));
  assert.ok(map);
  assert.ok(map!.evidence.some((line) => /0x14 x3\s+<- written \(0x280\)/.test(line)));
  assert.ok(map!.evidence.some((line) => /0x12 y2\s+<- written \(0x1E0\)/.test(line)));
});

test("the four screen points are reported as one setXYWH rectangle", () => {
  const report = recognizeIdioms(code(MOTIVATING));
  assert.ok(
    report.findings.some((finding) =>
      finding.kind === "sdk-macro" && finding.summary.includes("setXYWH(p, 0x0, 0x0, 0x280, 0x1E0)")),
  );
});

test("a source that already uses the type is not told it is missing", () => {
  const report = recognizeIdioms(code(MOTIVATING), "POLY_F4 *poly; DR_MODE *mode;");
  const objects = report.findings.filter((finding) => finding.kind === "sdk-object");
  assert.equal(objects.length, 2);
  assert.ok(objects.every((finding) => !finding.summary.includes("does not mention this type")));
});
