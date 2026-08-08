import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  type RenderedWord,
  type SymbolContext,
  compareFunction,
  compareWords,
  findMatchingLow,
  locateFunctionSymbol,
  parseRelocations,
  parseSymbolTable,
  relocatedField,
  renderDiff,
  signExtend16,
  symboliseWord,
} from "./functionOracle.js";
import { ROOT } from "./psxExeInfo.js";

// --- relocation arithmetic -------------------------------------------------

test("sign extension treats the high bit of the field as negative", () => {
  assert.equal(signExtend16(0x0008), 8);
  assert.equal(signExtend16(0xffff), -1);
  assert.equal(signExtend16(0x8000), -0x8000);
});

test("R_MIPS_26 keeps the opcode and folds the field's addend into the target", () => {
  /* `jal 0` against a global: the field carries no addend. */
  const patched = relocatedField("R_MIPS_26", 0x0c000000, 0x80032b84);
  assert.equal(patched >>> 26, 0x03);
  assert.equal((patched & 0x03ffffff) << 2, 0x00032b84);

  /* Against a section symbol the addend is the offset inside it. */
  const local = relocatedField("R_MIPS_26", 0x08000000 | (0x8a4 >>> 2), 0x80011370);
  assert.equal((local & 0x03ffffff) << 2, (0x80011370 + 0x8a4) & 0x0fffffff);
});

test("R_MIPS_HI16 rounds up when the low half is negative", () => {
  /* 0x8005E870: %lo is 0xE870, which is negative as a signed 16-bit field, so
   * %hi must be 0x8006 rather than 0x8005. */
  const hi = relocatedField("R_MIPS_HI16", 0x3c020000, 0x8005e870, { lowField: 0 });
  assert.equal(hi & 0xffff, 0x8006);
  const lo = relocatedField("R_MIPS_LO16", 0x24420000, 0x8005e870);
  assert.equal(lo & 0xffff, 0xe870);
});

test("R_MIPS_HI16 carries the low half of a split addend", () => {
  /* SYM+0x10000, encoded as hi field 1 and lo field 0. */
  const shifted = relocatedField("R_MIPS_HI16", 0x3c020001, 0x80010000, { lowField: 0 });
  assert.equal(shifted & 0xffff, 0x8002);

  /* The matching LO16's field is part of the addend, so passing the wrong one
   * lands on the wrong side of the rounding boundary: 0x80018000 rounds up to
   * 0x8002, and one byte below it does not. */
  assert.equal(relocatedField("R_MIPS_HI16", 0x3c020000, 0x80018000, { lowField: 0 }) & 0xffff, 0x8002);
  assert.equal(relocatedField("R_MIPS_HI16", 0x3c020000, 0x80018000, { lowField: 0xffff }) & 0xffff, 0x8001);
});

test("R_MIPS_GPREL16 encodes the displacement from $gp", () => {
  const field = relocatedField("R_MIPS_GPREL16", 0x8f820000, 0x8005e3a8, { gp: 0x8005e274 });
  assert.equal(signExtend16(field), 0x134);
  const negative = relocatedField("R_MIPS_GPREL16", 0x8f820000, 0x8005e200, { gp: 0x8005e274 });
  assert.equal(signExtend16(negative), -0x74);
});

test("R_MIPS_PC16 counts instructions on both sides of the arithmetic", () => {
  /* The placeholder field gas leaves behind is -1 word, which supplies exactly
   * the -4 a branch displacement is measured from (the delay slot). So a branch
   * to a label two instructions ahead encodes 1, and a backward one is
   * negative. */
  assert.equal(signExtend16(relocatedField("R_MIPS_PC16", 0x1040ffff, 0x80011378, { place: 0x80011370 })), 1);
  assert.equal(signExtend16(relocatedField("R_MIPS_PC16", 0x1040ffff, 0x80011370, { place: 0x80011380 })), -5);
});

test("an unhandled relocation type is refused rather than guessed at", () => {
  assert.throws(() => relocatedField("R_MIPS_GOT16", 0, 0x80010000), /unhandled relocation/);
});

test("a HI16 pairs with the next LO16 against the same symbol, in table order", () => {
  const relocations = parseRelocations([
    "000000c8 R_MIPS_26         func_8001FCE4",
    "000000cc R_MIPS_HI16       D_8005E5E8",
    "000000d0 R_MIPS_26         func_8001FEA4",
    "000000d4 R_MIPS_LO16       D_8005E5E8",
  ].join("\n"));
  assert.equal(relocations.length, 4);
  assert.equal(findMatchingLow(relocations, 1)?.offset, 0xd4);
  assert.equal(findMatchingLow(relocations, 0), null);
});

test("relocation parsing drops a printed addend, which REL already keeps in the field", () => {
  const [relocation] = parseRelocations("00000340 R_MIPS_HI16       .rodata+0x00000010");
  assert.equal(relocation.symbol, ".rodata");
  assert.equal(relocation.type, "R_MIPS_HI16");
  assert.equal(relocation.offset, 0x340);
});

// --- object inspection -----------------------------------------------------

test("the symbol table yields offset, section, size and name", () => {
  const symbols = parseSymbolTable([
    "00000000 l    df *ABS*\t00000000 src/func_80011370.c",
    "00000000 l    d  .text\t00000000 .text",
    "00000000 g     F .text\t000008b4 func_80011370",
    "000000ac g       .text\t00000000 .L80022C44",
    "00000004       O *COM*\t00000004 D_8005E3A8",
  ].join("\n"));
  const fn = symbols.find((symbol) => symbol.name === "func_80011370");
  assert.deepEqual(fn, { offset: 0, section: ".text", size: 0x8b4, name: "func_80011370" });
  const label = symbols.find((symbol) => symbol.name === ".L80022C44");
  assert.equal(label?.offset, 0xac);
  assert.equal(label?.section, ".text");
});

test("a function symbol named for the file is found by its address instead", () => {
  const symbols = parseSymbolTable([
    "00000000 g     O .text\t000000f8 func_80011278.NON_MATCHING",
    "00000000 g     F .text\t000000f8 func_80011278",
  ].join("\n"));
  const addresses = new Map([["func_80011278", 0x80011278]]);
  assert.equal(locateFunctionSymbol(symbols, "__start", 0x80011278, addresses)?.name, "func_80011278");
  assert.equal(locateFunctionSymbol(symbols, "__start", 0x80099999, addresses), null);
});

// --- symbolisation ---------------------------------------------------------

const context: SymbolContext = {
  index: {
    byAddress: new Map([[0x80032b84, "VSync"], [0x8005e3a8, "D_8005E3A8"]]),
    addresses: [0x80032b84, 0x8005e3a8].sort((a, b) => a - b),
  },
  gp: 0x8005e274,
  functionName: "func_80011370",
  functionStart: 0x80011370,
  functionExtent: 0x8b4,
};

test("a target inside the function is shown relative to it, and aligned by PC delta", () => {
  const word = symboliseWord(context, 0x80011994, "j", "0x80011c14");
  assert.equal(word.text, "j       func_80011370+0x8a4");
  assert.equal(word.key, "j pc+0x280");
});

test("a call out of the function is named", () => {
  assert.equal(symboliseWord(context, 0x80011400, "jal", "0x80032b84").text, "jal     VSync");
});

test("an unknown target is shown as an address, never as a nearby symbol", () => {
  assert.equal(symboliseWord(context, 0x80011400, "jal", "0x80000000").text, "jal     0x80000000");
});

test("a $gp displacement is resolved back to the symbol it reaches", () => {
  assert.equal(
    symboliseWord(context, 0x80011390, "sw", "v0,308(gp)").text,
    "sw      v0,%gp_rel(D_8005E3A8)(gp)",
  );
  assert.equal(
    symboliseWord(context, 0x80011390, "addiu", "v0,gp,308").text,
    "addiu   v0,gp,%gp_rel(D_8005E3A8)",
  );
});

test("a $gp displacement no symbol covers keeps the raw number", () => {
  const blank: SymbolContext = { ...context, index: { byAddress: new Map(), addresses: [] } };
  assert.equal(symboliseWord(blank, 0x80011390, "sw", "v0,308(gp)").text, "sw      v0,308(gp)");
});

// --- alignment and verdict -------------------------------------------------

function words(entries: Array<[number, string, string?]>): RenderedWord[] {
  return entries.map(([raw, text], index) => ({
    vram: 0x80011370 + index * 4,
    raw,
    text,
    key: text,
  }));
}

test("identical streams are a match with an empty diff", () => {
  const stream = words([[1, "nop"], [2, "jr      ra"]]);
  const result = compareWords(stream, words([[1, "nop"], [2, "jr      ra"]]));
  assert.equal(result.verdict, "match");
  assert.equal(result.same, 2);
  assert.equal(result.rows.every((row) => row.kind === "same"), true);
});

test("a differing word is a mismatch and is reported by address", () => {
  const result = compareWords(
    words([[1, "nop"], [2, "lw      v0,-7252(v0)"]]),
    words([[1, "nop"], [3, "lw      v0,-7256(v0)"]]),
  );
  assert.equal(result.verdict, "mismatch");
  assert.deepEqual(result.differing, [0x80011374]);
});

test("words that render alike but encode differently are still a mismatch", () => {
  /* `or rd,rs,$0` and `addu rd,rs,$0` both disassemble to `move`. Aligning on
   * text must not be able to call two different encodings a match. */
  const result = compareWords(words([[0x00a02025, "move    a0,a1"]]), words([[0x00a02021, "move    a0,a1"]]));
  assert.equal(result.verdict, "mismatch");
  assert.deepEqual(result.differing, [0x80011370]);
});

test("an unresolved word is undetermined, on its own row, and never a match", () => {
  const candidate = words([[1, "nop"], [0, "lui     <undetermined>"]]);
  candidate[1].undetermined = "R_MIPS_HI16 against Foo: no address in the symbol tables";
  const result = compareWords(words([[1, "nop"], [0x3c048007, "lui     a0,0x8007"]]), candidate);
  assert.equal(result.verdict, "undetermined");
  assert.equal(result.undetermined.length, 1);
  assert.equal(result.differing.length, 0);
  assert.equal(result.rows.filter((row) => row.kind === "undetermined").length, 1);
});

test("a proven difference outranks an unresolved one — undetermined is not a hiding place", () => {
  const candidate = words([[9, "nop"], [0, "lui     <undetermined>"]]);
  candidate[1].undetermined = "no address";
  const result = compareWords(words([[1, "nop"], [2, "lui     a0,0x8007"]]), candidate);
  assert.equal(result.verdict, "mismatch");
  assert.equal(result.undetermined.length, 1);
});

test("an extra instruction is structural, not a run of wrong operands", () => {
  const result = compareWords(
    words([[1, "nop"], [2, "jr      ra"]]),
    words([[1, "nop"], [3, "addiu   sp,sp,8"], [2, "jr      ra"]]),
  );
  assert.equal(result.verdict, "mismatch");
  assert.equal(result.rows.filter((row) => row.kind === "candidate-only").length, 1);
});

// --- the regression this whole tool exists for -----------------------------

const REGRESSION_FUNCTION = "func_80011370";
const regressionObject = join(ROOT, "build/src", `${REGRESSION_FUNCTION}.c.o`);

test(
  `${REGRESSION_FUNCTION} is byte-exact against the original image, with an empty diff`,
  { skip: existsSync(regressionObject) ? false : "build/src object not present; run make first" },
  () => {
    const result = compareFunction(REGRESSION_FUNCTION, { objectPath: regressionObject });
    /* The old oracle rendered six of these words as differences — a jump target
     * and a `lui` immediate that are identical once linked. They are artifacts
     * of comparing two pre-link encodings, and must not come back. */
    assert.deepEqual(renderDiff(result, false).filter((line) => !line.startsWith(" ")), []);
    assert.equal(result.verdict, "match");
    assert.equal(result.same, result.targetWords.length);
    assert.equal(result.undetermined.length, 0);
  },
);
