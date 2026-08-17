import { strict as assert } from "node:assert";
import { test } from "node:test";
import { analyzeFrame, analyzeReturnValue } from "./frameMap.js";
import type { DisassembledInstruction } from "./decompToolchain.js";

/* Instructions are transcribed inline rather than read from build/asm, which
 * is gitignored — a fixture pointing there passes locally and fails on a clean
 * checkout. Addresses matter only for branch targets, which none of these use. */
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

/**
 * func_800140C8's prefix. `sp+0x10` and `sp+0x11` are a two-byte address-taken
 * local — the target stores both bytes, forms `sp+0x10`, indexes it, and
 * reloads through the derived pointer. Reading them as fifth and sixth
 * outgoing arguments inflates the area to 0x18 and reports zero locals, which
 * produced a false short-callee signal against exact source.
 */
test("frameMap: byte stores at the argument boundary are an address-taken local", () => {
  const frame = analyzeFrame(code([
    "addiu $sp, $sp, -0x28",
    "lui $v0, %hi(D_8005E2AC)",
    "sw $ra, 0x20($sp)",
    "sw $s1, 0x1C($sp)",
    "sw $s0, 0x18($sp)",
    "addiu $a3, $v0, %lo(D_8005E2AC)",
    "lb $v1, 0x0($a3)",
    "lb $a1, 0x1($a3)",
    "sb $v1, 0x10($sp)",
    "sb $a1, 0x11($sp)",
    "addiu $v1, $sp, 0x10",
    "addu $s0, $v1, $a0",
    "lbu $a0, 0x0($s0)",
    "jal PadGetState",
    "addu $s1, $zero, $zero",
    "lw $ra, 0x20($sp)",
    "lw $s1, 0x1C($sp)",
    "lw $s0, 0x18($sp)",
    "jr $ra",
    "addiu $sp, $sp, 0x28",
  ]));

  assert.equal(frame.frameSize, 0x28);
  assert.equal(frame.argAreaSize, 0x10, "ABI minimum — the callee takes one argument");
  assert.equal(frame.varsSize, 0x8, "0x10..0x17 is the padded local region");
  assert.equal(frame.saveSlots.length, 3);
  assert.deepEqual(frame.addressTaken.map((entry) => entry.offset), [0x10]);
  assert.equal(frame.outgoingArgs, "up to 4");
});

/* A narrow store into the argument region is a local: under O32 an outgoing
 * argument occupies a whole word slot. func_80012A68 writes a RECT local this
 * way and used to report a 0x18 area and no locals. */
test("frameMap: halfword stores at the argument boundary are locals", () => {
  const frame = analyzeFrame(code([
    "addiu $sp, $sp, -0x20",
    "sw $ra, 0x18($sp)",
    "sh $a0, 0x10($sp)",
    "sh $a1, 0x12($sp)",
    "sh $a2, 0x14($sp)",
    "sh $a3, 0x16($sp)",
    "addiu $a0, $sp, 0x10",
    "jal ClearImage",
    "nop",
    "lw $ra, 0x18($sp)",
    "jr $ra",
    "addiu $sp, $sp, 0x20",
  ]));

  assert.equal(frame.argAreaSize, 0x10);
  assert.equal(frame.varsSize, 0x8);
});

test("frameMap: an aligned word store in a call delay slot is a fifth argument", () => {
  const frame = analyzeFrame(code([
    "addiu $sp, $sp, -0x28",
    "sw $ra, 0x24($sp)",
    "addiu $v0, $zero, 0x5",
    "jal func_80016B7C",
    "sw $v0, 0x10($sp)",
    "lw $ra, 0x24($sp)",
    "jr $ra",
    "addiu $sp, $sp, 0x28",
  ]));

  assert.equal(frame.argAreaSize, 0x18, "0x10 is written as a word and never reloaded");
  assert.equal(frame.outgoingArgs, "5-6");
});

/* Both in one function: a real fifth argument at 0x10 and an address-taken
 * local above the argument area. Neither rule may swallow the other. */
test("frameMap: a fifth argument and an address-taken local coexist", () => {
  const frame = analyzeFrame(code([
    "addiu $sp, $sp, -0x30",
    "sw $ra, 0x2C($sp)",
    "sw $s0, 0x28($sp)",
    "sw $zero, 0x18($sp)",
    "addiu $a1, $sp, 0x18",
    "addiu $v0, $zero, 0x7",
    "jal func_80016B7C",
    "sw $v0, 0x10($sp)",
    "lw $s0, 0x18($sp)",
    "lw $ra, 0x2C($sp)",
    "lw $s0, 0x28($sp)",
    "jr $ra",
    "addiu $sp, $sp, 0x30",
  ]));

  assert.equal(frame.argAreaSize, 0x18, "the word at 0x10 is still an argument");
  assert.deepEqual(frame.addressTaken.map((entry) => entry.offset), [0x18]);
  assert.equal(frame.varsSize, 0x10, "0x18 is a local, not a seventh argument");
});

/* --- return type --- */

test("a function that never writes $v0 and returns normally is proven void", () => {
  const value = analyzeReturnValue("f", code(["addiu $sp,$sp,-8", "jr $ra", "addiu $sp,$sp,8"]));
  assert.equal(value.type, "void");
  assert.equal(value.basis, "proven");
});

test("a BIOS trampoline proves nothing about its return value", () => {
  /* memcpy in this binary is three instructions that jump into the kernel
   * table. It writes no $v0 and it returns whatever the BIOS routine leaves
   * there, so reading it as proven void makes every caller's correct
   * declaration look like a defect. */
  const value = analyzeReturnValue("memcpy", code([
    "addiu $t2,$zero,0xa0",
    "jr $t2",
    "addiu $t1,$zero,0x2a",
  ]));
  assert.notEqual(value.basis, "proven");
  assert.match(value.evidence[0]!, /leaves without returning/);
});

test("a symbol with no return at all is not read as a whole function", () => {
  /* A mis-split boundary: three instructions of a longer routine. Nothing
   * about its interface can be read off the fragment. */
  const value = analyzeReturnValue("VectorNormalSS", code([
    "lh $t0,0x0($a0)",
    "lh $t1,0x2($a0)",
    "lh $t2,0x4($a0)",
  ]));
  assert.notEqual(value.basis, "proven");
  assert.match(value.evidence[0]!, /no `jr \$ra`/);
});
