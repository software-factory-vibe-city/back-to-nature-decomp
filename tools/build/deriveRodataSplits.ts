/**
 * deriveRodataSplits.ts — Derive the game-rodata subsegment block of a
 * container's splat config from first principles, so it is never hand-edited.
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
 *   - extent S: the .rodata section size of the function's object file;
 *   - attribution line `[A, .rodata, fn]`, and a generic `[A+S, rodata]`
 *     residue line when A+S does not coincide with the next subsegment.
 * Stub functions get no attribution: their tables stay in generic rodata.
 *
 * This is per *container*, not per project. Every container the project
 * builds — the PS-X EXE and each overlay member — has its own rodata window,
 * its own symbol table and its own object tree, and a container whose
 * attribution is missing cannot link a single jump-table function as C.
 *
 * Usage:
 *   npx tsx tools/build/deriveRodataSplits.ts                    # check exe
 *   npx tsx tools/build/deriveRodataSplits.ts --container ovl_10
 *   npx tsx tools/build/deriveRodataSplits.ts --all
 *   npx tsx tools/build/deriveRodataSplits.ts --all --write
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { ROOT } from "../lib/psxExeInfo.ts";
import {
  EXE_CONTAINER_ID,
  containerPath,
  containerTargetPath,
  loadContainers,
  requireContainer,
  vramToRom,
  type Container,
} from "../lib/container.ts";

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

/** The contiguous run of rodata/.rodata subsegments a container's config owns. */
export interface RodataWindow {
  start: number;
  endAddr: number;
  members: SubsegLine[];
}

function parseFuncExtents(container: Container): FuncExtent[] {
  const entries: { name: string; addr: number; size?: number }[] = [];
  const path = containerPath(container, "symbolAddrs");
  if (!existsSync(path)) return [];
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const m = line.trim().match(/^(\w+)\s*=\s*(0x[0-9A-Fa-f]+).*type:func/i);
    if (!m) continue;
    const size = line.match(/size:(0x[0-9A-Fa-f]+|\d+)/i);
    entries.push({
      name: m[1],
      addr: parseInt(m[2], 16),
      size: size ? Number(size[1]) : undefined,
    });
  }
  entries.sort((a, b) => a.addr - b.addr);
  /* The last function ends where the container's image does. Without the
     clamp the scan runs off the end of a 16 KiB overlay member. */
  const imageEnd = container.loadAddr + container.payloadSize;
  return entries.map((e, i) => ({
    name: e.name,
    start: e.addr,
    /* A declared `size:` wins over the next symbol's address. The two disagree
       exactly where the disassembler named a branch target inside a function
       as a function of its own, and a jump table's entries are precisely those
       addresses — so trusting the next symbol truncates the extent to the
       first table entry and makes the table unrecognisable. */
    end: e.size
      ? e.addr + e.size
      : i + 1 < entries.length
        ? entries[i + 1].addr
        : Math.min(e.addr + 0x10000, imageEnd),
  }));
}

export function parseSubsegments(lines: string[]): SubsegLine[] {
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
export function findWindow(subsegs: SubsegLine[]): RodataWindow {
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

/**
 * The rodata block of a container's config as it stands today.
 *
 * `bootstrapOverlay.ts` regenerates an overlay's whole config, and this block
 * is the one part of it that this module owns. Handing the block back lets the
 * bootstrap carry the derived attributions across a re-split instead of
 * silently reverting them, which would deadlock the self-healing relink.
 */
export function existingRodataBlock(container: Container): string[] | null {
  const path = containerPath(container, "splat");
  if (!existsSync(path)) return null;
  try {
    const window = findWindow(parseSubsegments(readFileSync(path, "utf-8").split("\n")));
    return window.members.map((m) => m.raw);
  } catch {
    return null;
  }
}

function objRodataSize(container: Container, fn: string): number | null {
  const obj = join(ROOT, container.paths.objDir, `${fn}.c.o`);
  if (!existsSync(obj)) return null;
  const out = execFileSync(OBJDUMP, ["-h", obj], { encoding: "utf-8" });
  const m = out.match(/\.rodata\s+([0-9a-f]{8})/);
  return m ? parseInt(m[1], 16) : 0;
}

function isCompiledC(container: Container, fn: string): boolean {
  const src = join(ROOT, container.paths.srcDir, `${fn}.c`);
  if (!existsSync(src)) return false;
  const text = readFileSync(src, "utf-8");
  const re = new RegExp(`INCLUDE_ASM\\([^)]*,\\s*${fn}\\s*\\)`);
  return !re.test(text);
}

/** The derived rodata block for one container, and whether the config agrees. */
export interface Derivation {
  container: Container;
  window: RodataWindow;
  attributions: Attribution[];
  current: string[];
  derived: string[];
  consistent: boolean;
}

export function deriveContainer(container: Container): Derivation {
  const buf = readFileSync(containerTargetPath(container));
  const yamlLines = readFileSync(containerPath(container, "splat"), "utf-8").split("\n");
  const subsegs = parseSubsegments(yamlLines);
  const window = findWindow(subsegs);
  const funcs = parseFuncExtents(container);

  // Which functions does splat build as C?
  const cFuncs = new Set(subsegs.filter((s) => s.kind === "c" && s.name).map((s) => s.name!));

  const attributions: Attribution[] = [];
  for (const fn of funcs) {
    if (!cFuncs.has(fn.name)) continue;
    if (!isCompiledC(container, fn.name)) continue;
    const size = objRodataSize(container, fn.name);
    if (size === null) {
      throw new Error(
        `${fn.name}: compiled C but ${container.paths.objDir}/${fn.name}.c.o is missing — run make first`,
      );
    }
    if (size === 0) continue;
    const vramAddr = scanTableAddr(buf, container, fn, window.start, window.endAddr);
    if (vramAddr === null) {
      throw new Error(
        `${fn.name}: object emits 0x${size.toString(16)} bytes of .rodata but no ` +
          `lui/addiu reference into the rodata window was found in its original code — undetermined`,
      );
    }
    const addr = vramToRom(container, vramAddr);
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
  /* A window that starts where it ends still needs one line to exist at all. */
  if (derived.length === 0) derived.push(`${indent}- [0x${hex(window.start)}, rodata]`);

  const current = window.members.map((m) => m.raw);
  const consistent = current.length === derived.length && current.every((l, i) => l.trim() === derived[i].trim());

  return { container, window, attributions, current, derived, consistent };
}

function applyDerivation(d: Derivation): void {
  const path = containerPath(d.container, "splat");
  const yamlLines = readFileSync(path, "utf-8").split("\n");
  const before = yamlLines.slice(0, d.window.members[0].index);
  const after = yamlLines.slice(d.window.members[d.window.members.length - 1].index + 1);
  writeFileSync(path, [...before, ...d.derived, ...after].join("\n"));
}

function main(): void {
  const argv = process.argv.slice(2);
  const write = argv.includes("--write");
  const all = argv.includes("--all");
  const idx = argv.indexOf("--container");
  const ids = all
    ? loadContainers().map((c) => c.id)
    : [idx >= 0 ? argv[idx + 1] : EXE_CONTAINER_ID];

  let drift = false;
  for (const id of ids) {
    const container = requireContainer(id);
    const d = deriveContainer(container);
    const label = `${container.id} rodata window (0x${hex(d.window.start)}..0x${hex(d.window.endAddr)})`;

    if (d.consistent) {
      console.log(
        `${label}: ${d.attributions.length} attribution(s) — ${container.paths.splat} is consistent with the derivation`,
      );
      continue;
    }

    drift = true;
    console.log(`derived rodata window differs from ${container.paths.splat}:`);
    console.log("  current:");
    for (const l of d.current) console.log(`    ${l.trim()}`);
    console.log("  derived:");
    for (const l of d.derived) console.log(`    ${l.trim()}`);

    if (write) {
      applyDerivation(d);
      console.log(`wrote ${container.paths.splat} — re-run \`make split\` and \`make check\``);
    }
  }

  if (drift && !write) {
    console.log("run with --write to apply the derived block");
    process.exitCode = 1;
  }
}

function hex(n: number): string {
  return n.toString(16).toUpperCase().replace(/^0X/, "");
}

/**
 * The lowest jump-table base this function references.
 *
 * Two conditions, both necessary. The address must be formed by a lui/addiu
 * pair inside the function and land in the rodata window — that is the
 * reference. And the words at that address must read as a table of this
 * function's own code labels — that is what makes it a *jump table* rather
 * than a string or a constant pool entry.
 *
 * The content test is not a refinement, it is the whole difference between a
 * container whose rodata window holds only jump tables and one whose window is
 * the entire read-only section. In the PS-X EXE the game-rodata window happens
 * to contain nothing else, so "the lowest referenced constant" was right by
 * accident; in an overlay member the same rule picks the function's first
 * format string and attributes 20 bytes of somebody else's data to it.
 */
function scanTableAddr(
  buf: Buffer,
  container: Container,
  fn: FuncExtent,
  windowLo: number,
  windowHi: number,
): number | null {
  const luiVal: (number | null)[] = new Array(32).fill(null);
  let sawJr = false;
  const candidates: number[] = [];
  const loVa = romToVramLocal(windowLo);
  const hiVa = romToVramLocal(windowHi);
  for (let va = fn.start; va < fn.end; va += 4) {
    const rom = vramToRom(container, va);
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
        if (c >= loVa && c < hiVa) candidates.push(c);
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
  if (!sawJr) return null;
  const tables = candidates.filter((addr) => jumpTableLength(buf, container, addr, hiVa, fn) >= 2);
  return tables.length === 0 ? null : Math.min(...tables);

  function romToVramLocal(rom: number): number {
    return rom - container.payloadOffset + container.loadAddr;
  }
}

/** How many consecutive words at `addr` read as code labels inside `fn`. */
function jumpTableLength(
  buf: Buffer,
  container: Container,
  addr: number,
  windowHiVa: number,
  fn: FuncExtent,
): number {
  let n = 0;
  for (let va = addr; va < windowHiVa; va += 4) {
    const rom = vramToRom(container, va);
    if (rom < 0 || rom + 4 > buf.length) break;
    const target = buf.readUInt32LE(rom);
    if ((target & 3) !== 0) break;
    if (target < fn.start || target >= fn.end) break;
    n++;
  }
  return n;
}

if (process.argv[1]?.endsWith("deriveRodataSplits.ts")) main();
