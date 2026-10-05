import { test } from "node:test";
import assert from "node:assert/strict";
import { elf32SectionSizes } from "./elfSections.js";
function fixture(be = false, extended = false): Buffer {
  const b = Buffer.alloc(52 + 4 * 40 + 32);
  b.write("\x7fELF", 0, "binary"); b[4] = 1; b[5] = be ? 2 : 1; b[6] = 1;
  const u16 = (at: number, x: number) => be ? b.writeUInt16BE(x, at) : b.writeUInt16LE(x, at);
  const u32 = (at: number, x: number) => be ? b.writeUInt32BE(x, at) : b.writeUInt32LE(x, at);
  u32(20, 1); u32(32, 52); u16(40, 52); u16(46, 40); u16(48, extended ? 0 : 4); u16(50, extended ? 0xffff : 1);
  if (extended) { u32(52 + 20, 4); u32(52 + 24, 1); }
  const strings = "\0.shstrtab\0.rodata\0.bss\0", start = 212;
  b.write(strings, start, "binary");
  u32(92, 1); u32(96, 3); u32(108, start); u32(112, strings.length);
  u32(132, 11); u32(136, 1); u32(148, start + strings.length); u32(152, 4);
  u32(172, 19); u32(176, 8); u32(188, 0xffffffff); u32(192, 4000);
  return b;
}
for (const be of [false, true]) for (const extended of [false, true]) test(`ELF32 endian=${be} extended=${extended} preserves NOBITS size`, () => {
  assert.deepEqual([...elf32SectionSizes(fixture(be, extended))], [[".shstrtab", 24], [".rodata", 4], [".bss", 4000]]);
});
test("malformed ELF tables and names are rejected rather than guessed", () => {
  const b = fixture();
  for (const limit of [0, 51, 80, 211]) assert.throws(() => elf32SectionSizes(b.subarray(0, limit)), /Invalid ELF32/);
  const mutate = (at: number, value: number) => { const copy = Buffer.from(b); copy.writeUInt32LE(value, at); return copy; };
  assert.throws(() => elf32SectionSizes(mutate(148, b.length)), /extent/);
  assert.throws(() => elf32SectionSizes(mutate(132, 200)), /name offset/);
  assert.throws(() => elf32SectionSizes(mutate(172, 11)), /duplicate/);
  const unsupported = Buffer.from(b); unsupported[4] = 2; assert.throws(() => elf32SectionSizes(unsupported), /class/);
});
