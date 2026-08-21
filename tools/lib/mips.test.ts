import assert from "node:assert/strict";
import test from "node:test";
import {
  findLuiPairs,
  isDecodableInstruction,
  isJrRa,
  isPlausibleCodeAddress,
  isStackPrologue,
  isValidRamAddress,
  jalTarget,
  signedImmOf,
} from "./mips.ts";

function words(...values: number[]): Buffer {
  const buf = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => buf.writeUInt32LE(v >>> 0, i * 4));
  return buf;
}

test("jal decodes to the KSEG0 target the PC's top nibble selects", () => {
  /* jal 0x80017A64 -> index = 0x00017A64 >> 2 = 0x5E99 */
  assert.equal(jalTarget(0x0c005e99, 0x800b0000), 0x80017a64);
});

test("a word that is not a jal has no jal target", () => {
  assert.equal(jalTarget(0x03e00008, 0x800b0000), null);
});

test("jr ra is recognised and jr on another register is not", () => {
  assert.equal(isJrRa(0x03e00008), true);
  assert.equal(isJrRa(0x03400008), false);
});

test("only a negative sp adjustment is a stack prologue", () => {
  assert.equal(isStackPrologue(0x27bdffe8), true); // addiu sp,sp,-24
  assert.equal(isStackPrologue(0x27bd0018), false); // addiu sp,sp,24
  assert.equal(signedImmOf(0x27bdffe8), -24);
});

test("addresses outside PS1 RAM are rejected, which is the jal false-positive filter", () => {
  assert.equal(isValidRamAddress(0x80017a64), true);
  assert.equal(isValidRamAddress(0x8ff40000), false);
  assert.equal(isPlausibleCodeAddress(0x80017a66), false);
});

test("decodability separates instructions from arbitrary data words", () => {
  assert.equal(isDecodableInstruction(0x27bdffe8), true); // addiu
  assert.equal(isDecodableInstruction(0x03e00008), true); // jr ra
  assert.equal(isDecodableInstruction(0x7c817c81), false); // Shift-JIS text
});

test("a lui/addiu pair resolves to its address", () => {
  /* lui v0,0x8005 ; addiu v0,v0,0x1234 */
  const pairs = findLuiPairs(words(0x3c028005, 0x24421234));
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]!.address, 0x80051234);
  assert.equal(pairs[0]!.kind, "addiu");
});

test("a negative low half borrows from the high half", () => {
  /* lui v0,0x8006 ; lw v0,-0x18(v0)  ->  0x8005FFE8 */
  const pairs = findLuiPairs(words(0x3c028006, 0x8c42ffe8));
  assert.equal(pairs[0]!.address, 0x8005ffe8);
  assert.equal(pairs[0]!.kind, "load");
});

test("a lui whose register is redefined before use yields no pair", () => {
  /* lui v0,0x8005 ; lui v0,0x8006 ; addiu v0,v0,4 */
  const pairs = findLuiPairs(words(0x3c028005, 0x3c028006, 0x24420004));
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]!.address, 0x80060004);
});
