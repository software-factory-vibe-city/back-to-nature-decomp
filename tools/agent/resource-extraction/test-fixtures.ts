import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Manifest } from "./types.ts";
export function fixture() {
  const root = mkdtempSync(join(tmpdir(), "psx-assets-")); mkdirSync(join(root, "extracted"));
  const put = (path: string, bytes: string | Uint8Array): void => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), bytes); };
  return { root, put, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
export function readManifest(root: string): Manifest { return JSON.parse(readFileSync(join(root, "build/assets/manifest.json"), "utf8")); }
export function tim(mode = 2, banks = 1): Buffer {
  const colors = mode === 0 ? 16 : 256, indexed = mode < 2, paletteBytes = indexed ? 12 + colors * banks * 2 : 0, rowBytes = mode === 3 ? 4 : 2;
  const bytes = Buffer.alloc(8 + paletteBytes + 12 + rowBytes);
  bytes.writeUInt32LE(0x10, 0); bytes.writeUInt32LE(mode | (indexed ? 8 : 0), 4);
  if (indexed) {
    bytes.writeUInt32LE(paletteBytes, 8); bytes.writeUInt16LE(colors, 16); bytes.writeUInt16LE(banks, 18);
    for (let bank = 0; bank < banks; bank++) bytes.writeUInt16LE(bank % 2 ? 0x83e0 : 0x001f, 20 + bank * colors * 2);
  }
  const at = 8 + paletteBytes;
  bytes.writeUInt32LE(12 + rowBytes, at); bytes.writeUInt16LE(rowBytes / 2, at + 8); bytes.writeUInt16LE(1, at + 10);
  if (mode === 2) bytes.writeUInt16LE(0x801f, at + 12);
  if (mode === 3) bytes.set([10, 20, 30, 0x99], at + 12);
  return bytes;
}
export const I = (op: number, rs: number, rt: number, imm: number): number => ((op << 26) | (rs << 21) | (rt << 16) | (imm & 65535)) >>> 0;
export const R = (rs: number, rt: number, rd: number, sh: number, fn: number): number => ((rs << 21) | (rt << 16) | (rd << 11) | (sh << 6) | fn) >>> 0;
export const BASE = 0x80010000;
export function exe(words: number[], size = words.length * 4): Buffer {
  const bytes = Buffer.alloc(0x800 + size); bytes.write("PS-X EXE"); bytes.writeUInt32LE(BASE, 0x10); bytes.writeUInt32LE(BASE, 0x18); bytes.writeUInt32LE(size, 0x1c);
  words.forEach((word, index) => bytes.writeUInt32LE(word, 0x800 + index * 4)); return bytes;
}
export function xorWords(key: number): number[] { return [I(4, 6, 0, 8), 0, I(0x24, 4, 8, 0), I(9, 4, 4, 1), I(0xe, 8, 8, key), I(0x28, 5, 8, 0), I(9, 6, 6, -1), I(5, 6, 0, -6), I(9, 5, 5, 1), R(31, 0, 0, 0, 8), 0]; }
