import { strict as assert } from "node:assert";
import { test } from "node:test";
import { decodeWord } from "./decode.js";
import { assemble } from "./fixture-asm.js";

/* Words taken from the ovl_11_func_800F13D8 disassembly, memory order reversed
 * to their little-endian values. */

test("decodes the regression function's own encodings", () => {
  const addu = decodeWord(0x00004021, 0x800f13d8);
  assert.equal(addu.op, "addu");
  assert.equal(addu.rd, 8);
  assert.equal(addu.rs, 0);

  const lui = decodeWord(0x3c028007, 0x800f13e0);
  assert.equal(lui.op, "lui");
  assert.equal(lui.rt, 2);
  assert.equal(lui.uimm, 0x8007);

  const lh = decodeWord(0x844542b0, 0x800f13ec);
  assert.equal(lh.op, "lh");
  assert.equal(lh.rs, 2);
  assert.equal(lh.rt, 5);
  assert.equal(lh.simm, 0x42b0);

  const bnez = decodeWord(0x14a00004, 0x800f13f4);
  assert.equal(bnez.op, "bne");
  assert.equal(bnez.target, 0x800f13f4 + 4 + 4 * 4);

  const jump = decodeWord(0x0803c50d, 0x800f1400);
  assert.equal(jump.op, "j");
  assert.equal(jump.target, 0x800f1434);

  const jr = decodeWord(0x03e00008, 0x800f1444);
  assert.equal(jr.op, "jr");
  assert.equal(jr.rs, 31);
});

test("negative displacements sign-extend", () => {
  const addiu = decodeWord(0x2442c838, 0x80010000);
  assert.equal(addiu.op, "addiu");
  assert.equal(addiu.simm, 0xc838 - 0x10000);
});

test("words outside the subset decode to unknown, never to a guess", () => {
  assert.equal(decodeWord(0x40046000, 0x80010000).op, "unknown"); /* mfc0 */
});

test("special multiply/divide instructions decode correctly", () => {
  assert.equal(decodeWord(0x00000018, 0x80010000).op, "mult");
  assert.equal(decodeWord(0x00000019, 0x80010000).op, "multu");
  assert.equal(decodeWord(0x0000001a, 0x80010000).op, "div");
  assert.equal(decodeWord(0x0000001b, 0x80010000).op, "divu");
  assert.equal(decodeWord(0x00000010, 0x80010000).op, "mfhi");
  assert.equal(decodeWord(0x00000012, 0x80010000).op, "mflo");
});

test("the fixture assembler round-trips through the decoder", () => {
  const words = assemble(
    [
      ["lui", "v0", 0x8007],
      ["addiu", "v0", "v0", -0x37c8],
      ["label", "loop"],
      ["lh", "a1", 0, "v0"],
      ["bne", "a1", "zero", "loop"],
      ["nop"],
      ["jr", "ra"],
      ["nop"],
    ],
    0x80100000,
  );
  const ops = words.map((word) => decodeWord(word.raw, word.vram).op);
  assert.deepEqual(ops, ["lui", "addiu", "lh", "bne", "nop", "jr", "nop"]);
  const branch = decodeWord(words[3]!.raw, words[3]!.vram);
  assert.equal(branch.target, 0x80100000 + 8);
});
