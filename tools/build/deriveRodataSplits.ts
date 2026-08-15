/**
 * deriveRodataSplits.ts — Derive the game-rodata subsegment block of
 * configs/splat.yaml from first principles, so it is never hand-edited.
 *
 * A switch function's jump table lives in the rodata window. While the
 * function is an INCLUDE_ASM stub, the table must be extracted as asm data
 * (a generic `rodata` subsegment); once the function is compiled as C, its
 * translation unit emits the table itself and the range must be attributed
 * to the TU (`.rodata` subsegment). The attribution extent must equal the
 * .rodata section size of the TU's object file — the original may carry
 * alignment pad words after the table (e.g. 4 zero bytes) that the compiled
 * TU does not emit, and those must remain generic asm data or the whole
 * binary shifts.
 *
 * Derivation, per compiled C function with a non-empty .o .rodata section:
 *   - table address A: the smallest lui/addiu-formed constant inside the
 *     rodata window referenced by the function's original code (the
 *     function must also contain a `jr` — the tablejump);
 *   - extent S: the .rodata section size of build/src/<fn>.c.o;
 *   - attribution line `[A, .rodata, fn]`, and a generic `[A+S, rodata]`
 *     residue line when A+S does not coincide with the next subsegment.
 * Stub functions get no attribution: their tables stay in generic rodata.
 *
 * Usage:
 *   npx tsx tools/build/deriveRodataSplits.ts           # check (exit 1 on drift)
 *   npx tsx tools/build/deriveRodataSplits.ts --write   # rewrite the block
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { loadPsxExeInfo, vramToRom, ROOT } from "../lib/psxExeInfo.ts";

const SPLAT_YAML = join(ROOT, "configs/splat.yaml");
const SYMBOL_ADDRS = join(ROOT, "configs/symbol_addrs.txt");
const OBJDUMP = "mips-linux-gnu-objdump";

interface FuncExtent {
  name: string;
  start: number;
  end: number;
}

interface SubsegLine {
  index: number;
  raw: string;
  addr: number;
  kind: string;
  name?: string;
}

interface Attribution {
  addr: number;
  end: number;
  name: string;
}

function parseFuncExtents(): FuncExtent[] {
  const entries: { name: string; addr: number }[] = [];
  for (const line of readFileSync(SYMBOL_ADDRS, "utf-8").split("\n")) {
    const m = line.trim().match(/^(\w+)\s*=\s*(0x[0-9A-Fa-f]+).*type:func/i);
    if (m) entries.push({ name: m[1], addr: parseInt(m[2], 16) });
  }
  entries.sort((a, b) => a.addr - b.addr);
  return entries.map((e, i) => ({
    name: e.name,
    start: e.addr,
    end: i + 1 < entries.length ? entries[i + 1].addr : e.addr + 0x10000,
  }));
}

function parseSubsegments(lines: string[]): SubsegLine[] {
  const out: SubsegLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)- \[(0x[0-9A-Fa-f]+), ([^,\]]+)(?:, ([^,\]]+))?/);
    if (!m) continue;
    out.push({
      index: i,
      raw: lines[i],
      addr: parseInt(m[2], 16),
      kind: m[3].trim(),
      name: m[4]?.trim(),
    });
  }
  return out;
}

/** The managed window: the contiguous run of rodata/.rodata subsegments
 *  starting at the first one, ending at the first entry of another kind. */
function findWindow(subsegs: SubsegLine[]): { start: number; endAddr: number; members: SubsegLine[] } {
  const first = subsegs.findIndex((s) => s.kind === "rodata" || s.kind === ".rodata");
  if (first < 0) throw new Error("no rodata subsegments found");
  const members: SubsegLine[] = [];
  let i = first;
  for (; i < subsegs.length; i++) {
    const k = subsegs[i].kind;
    if (k !== "rodata" && k !== ".rodata") break;
    members.push(subsegs[i]);
  }
  if (i >= subsegs.length) throw new Error("rodata window has no terminating subsegment");
  return { start: members[0].addr, endAddr: subsegs[i].addr, members };
}

function objRodataSize(fn: string): number | null {
  const obj = join(ROOT, `build/src/${fn}.c.o`);
  if (!existsSync(obj)) return null;
  const out = execFileSync(OBJDUMP, ["-h", obj], { encoding: "utf-8" });
  const m = out.match(/\.rodata\s+([0-9a-f]{8})/);
  return m ? parseInt(m[1], 16) : 0;
}

function isCompiledC(fn: string): boolean {
  const src = join(ROOT, `src/${fn}.c`);
  if (!existsSync(src)) return false;
  const text = readFileSync(src, "utf-8");
  const re = new RegExp(`INCLUDE_ASM\\([^)]*,\\s*${fn}\\s*\\)`);
  return !re.test(text);
}

function main(): void {
  const write = process.argv.includes("--write");
  const info = loadPsxExeInfo();
  const buf = readFileSync(info.binaryPath);
  const yamlLines = readFileSync(SPLAT_YAML, "utf-8").split("\n");
  const subsegs = parseSubsegments(yamlLines);
  const window = findWindow(subsegs);
  const funcs = parseFuncExtents();

  // Which functions does splat build as C?
  const cFuncs = new Set(subsegs.filter((s) => s.kind === "c" && s.name).map((s) => s.name!));

  const attributions: Attribution[] = [];
  for (const fn of funcs) {
    if (!cFuncs.has(fn.name)) continue;
    if (!isCompiledC(fn.name)) continue;
    const size = objRodataSize(fn.name);
    if (size === null) {
      throw new Error(`${fn.name}: compiled C but build/src/${fn.name}.c.o is missing — run make first`);
    }
    if (size === 0) continue;
    const vramAddr = scanTableAddr(buf, info, fn, window.start, window.endAddr);
    if (vramAddr === null) {
      throw new Error(
        `${fn.name}: object emits 0x${size.toString(16)} bytes of .rodata but no ` +
          `lui/addiu reference into the rodata window was found in its original code — undetermined`,
      );
    }
    const addr = vramToRom(vramAddr, info);
    attributions.push({ addr, end: addr + size, name: fn.name });
  }
  attributions.sort((a, b) => a.addr - b.addr);

  for (let i = 0; i + 1 < attributions.length; i++) {
    if (attributions[i].end > attributions[i + 1].addr) {
      throw new Error(
        `overlap: ${attributions[i].name} ends 0x${attributions[i].end.toString(16)} past ` +
          `${attributions[i + 1].name} at 0x${attributions[i + 1].addr.toString(16)}`,
      );
    }
  }

  // Build the derived window: generic head, attributions, generic residues.
  const indent = window.members[0].raw.match(/^(\s*)/)![1];
  const derived: string[] = [];
  let cursor = window.start;
  for (const a of attributions) {
    if (a.addr > cursor) derived.push(`${indent}- [0x${hex(cursor)}, rodata]`);
    derived.push(`${indent}- [0x${hex(a.addr)}, .rodata, ${a.name}]`);
    cursor = a.end;
  }
  if (cursor < window.endAddr) derived.push(`${indent}- [0x${hex(cursor)}, rodata]`);

  const current = window.members.map((m) => m.raw);
  const same = current.length === derived.length && current.every((l, i) => l.trim() === derived[i].trim());

  if (same) {
    console.log(`rodata window (0x${hex(window.start)}..0x${hex(window.endAddr)}): ${attributions.length} attribution(s) — splat.yaml is consistent with the derivation`);
    return;
  }

  console.log("derived rodata window differs from configs/splat.yaml:");
  console.log("  current:");
  for (const l of current) console.log(`    ${l.trim()}`);
  console.log("  derived:");
  for (const l of derived) console.log(`    ${l.trim()}`);

  if (!write) {
    console.log("run with --write to apply the derived block");
    process.exitCode = 1;
    return;
  }

  const before = yamlLines.slice(0, window.members[0].index);
  const after = yamlLines.slice(window.members[window.members.length - 1].index + 1);
  writeFileSync(SPLAT_YAML, [...before, ...derived, ...after].join("\n"));
  console.log("wrote configs/splat.yaml — re-run `make split` and `make check`");
}

function hex(n: number): string {
  return n.toString(16).toUpperCase().replace(/^0X/, "");
}

/** Scan the function's original code for the smallest lui/addiu constant
 *  inside the rodata window; require a jr (the tablejump) in the function. */
function scanTableAddr(
  buf: Buffer,
  info: ReturnType<typeof loadPsxExeInfo>,
  fn: FuncExtent,
  windowLo: number,
  windowHi: number,
): number | null {
  const windowLoVram = windowLo + info.loadAddr - vramToRom(info.loadAddr, info) + 0;
  void windowLoVram;
  const luiVal: (number | null)[] = new Array(32).fill(null);
  let sawJr = false;
  let best: number | null = null;
  const loVa = romToVramLocal(windowLo);
  const hiVa = romToVramLocal(windowHi);
  for (let va = fn.start; va < fn.end; va += 4) {
    const rom = vramToRom(va, info);
    if (rom < 0 || rom + 4 > buf.length) break;
    const w = buf.readUInt32LE(rom);
    const op = w >>> 26;
    const rs = (w >>> 21) & 31;
    const rt = (w >>> 16) & 31;
    const simm = ((w & 0xffff) << 16) >> 16;
    if (op === 0x0f && rs === 0) {
      luiVal[rt] = (w & 0xffff) << 16;
      continue;
    }
    if (op === 0x09) {
      if (luiVal[rs] !== null) {
        const c = (luiVal[rs]! + simm) >>> 0;
        if (c >= loVa && c < hiVa && (best === null || c < best)) best = c;
      }
      if (rt !== rs) luiVal[rt] = null;
      continue;
    }
    if (op === 0 && (w & 0x3f) === 0x08) sawJr = true;
    // Any other write to a register invalidates its tracked lui; keep the
    // tracker conservative rather than exhaustive.
    if (op === 0 && ((w >>> 11) & 31) !== 0) luiVal[(w >>> 11) & 31] = null;
    else if (op !== 0 && op !== 0x2b && op !== 0x29 && op !== 0x28 && rt !== 0) luiVal[rt] = null;
  }
  return sawJr ? best : null;

  function romToVramLocal(rom: number): number {
    return rom - vramToRom(info.loadAddr, info) + info.loadAddr;
  }
}

main();
