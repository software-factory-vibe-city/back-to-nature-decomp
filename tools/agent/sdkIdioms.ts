#!/usr/bin/env npx tsx
/**
 * sdkIdioms.ts — recognize PSY-Q primitive types and macro expansions in a
 * target function.
 *
 * A GPU primitive emitter compiles to anonymous shift/mask arithmetic against
 * anonymous struct offsets. Reconstructed by hand it becomes invented types
 * and hand-rolled bitfield math; reconstructed with the SDK header it is five
 * macro calls. Nothing about the target says "libgpu" — so an agent that does
 * not already suspect it will never look.
 *
 * Born from func_80016C08 (2026-08-02), where a session was spent
 * reverse-engineering a POLY_FT4 emitter as anonymous arithmetic, and the
 * `tpage` word — a whole `getTPage()` call — was simply missing from the
 * reconstruction because nothing named the field.
 *
 * The primitive table and every struct layout are PARSED from the vendored
 * include/psyq/libgpu.h at run time. No SDK fact is duplicated here: change
 * the header vintage and this tool follows it.
 *
 * Recognition anchor: `setXxx(p)` expands to `setlen(p,L), setcode(p,C)`,
 * which emits `sb <L>, 0x3(base)` and `sb <C>, 0x7(base)` against a shared
 * base. That (len, code) pair identifies the primitive type outright, and the
 * struct layout then names every offset the function touches.
 *
 * Usage:
 *   npx tsx tools/agent/sdkIdioms.ts func_80016C08
 *   npx tsx tools/agent/sdkIdioms.ts func_80016C08 --json
 */

import { existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import {
  ROOT,
  type DisassembledInstruction,
  assembleTarget,
  disassembleObject,
  normalizeFunctionName,
} from "./decompToolchain.js";
import { defUse } from "./webAnalysis.js";

const LIBGPU = join(ROOT, "include/psyq/libgpu.h");

/* --- header parsing: primitive table and struct layouts --- */

export interface PrimitiveField {
  offset: number;
  name: string;
  size: number;
}

export interface PrimitiveType {
  /** Struct name, e.g. POLY_FT4. */
  name: string;
  /** Initializer macro, e.g. setPolyFT4. */
  macro: string;
  len: number;
  code: number;
  size: number;
  fields: PrimitiveField[];
}

const TYPE_SIZES: Record<string, number> = {
  char: 1, u_char: 1, uchar: 1, s8: 1, u8: 1,
  short: 2, u_short: 2, ushort: 2, s16: 2, u16: 2,
  int: 4, long: 4, u_long: 4, ulong: 4, unsigned: 4, s32: 4, u32: 4,
};

function align(offset: number, to: number): number {
  return Math.ceil(offset / to) * to;
}

/** Lay out a C struct body under natural alignment. Returns null if any
 *  member is a bitfield or a type whose size we do not know. */
function layoutStruct(body: string): { fields: PrimitiveField[]; size: number } | null {
  const cleaned = body.replace(/\/\*[\s\S]*?\*\//g, " ");
  const fields: PrimitiveField[] = [];
  let offset = 0;
  let maxAlign = 1;

  for (const chunk of cleaned.split(";")) {
    const text = chunk.trim();
    if (!text) continue;
    if (text.includes(":")) return null; /* bitfield — not a layout we model */

    const match = text.match(/^(\w+)\s+([\w,\s[\]]+)$/);
    if (!match) return null;
    const size = TYPE_SIZES[match[1]];
    if (!size) return null;

    for (const rawName of match[2].split(",")) {
      const name = rawName.trim();
      if (!name) continue;
      if (name.includes("[")) return null; /* arrays: not needed for primitives */
      offset = align(offset, size);
      fields.push({ offset, name, size });
      offset += size;
      maxAlign = Math.max(maxAlign, size);
    }
  }

  if (fields.length === 0) return null;
  return { fields, size: align(offset, maxAlign) };
}

/**
 * `setPolyFT4` -> `POLY_FT4`, `setSprt8` -> `SPRT_8`, `setTile16` -> `TILE_16`.
 * Matching on the underscore-stripped uppercase name avoids guessing where
 * the SDK put its separators.
 */
function structNameFor(macroSuffix: string, known: Map<string, string>): string | undefined {
  return known.get(macroSuffix.toUpperCase());
}

export function loadPrimitiveTable(): PrimitiveType[] {
  if (!existsSync(LIBGPU)) return [];
  const header = readFileSync(LIBGPU, "utf-8");

  const layouts = new Map<string, { fields: PrimitiveField[]; size: number }>();
  const byStrippedName = new Map<string, string>();
  const structRe = /typedef\s+struct\s*\{([\s\S]*?)\}\s*(\w+)\s*;/g;
  for (let m = structRe.exec(header); m; m = structRe.exec(header)) {
    const layout = layoutStruct(m[1]);
    if (!layout) continue;
    layouts.set(m[2], layout);
    byStrippedName.set(m[2].replace(/_/g, "").toUpperCase(), m[2]);
  }

  const primitives: PrimitiveType[] = [];
  const macroRe =
    /#define\s+set(\w+)\s*\(\s*p\s*\)\s*setlen\s*\(\s*p\s*,\s*(\d+)\s*\)\s*,\s*setcode\s*\(\s*p\s*,\s*(0x[0-9a-fA-F]+)\s*\)/g;
  for (let m = macroRe.exec(header); m; m = macroRe.exec(header)) {
    const structName = structNameFor(m[1], byStrippedName);
    if (!structName) continue;
    const layout = layouts.get(structName);
    if (!layout) continue;
    primitives.push({
      name: structName,
      macro: `set${m[1]}`,
      len: parseInt(m[2], 10),
      code: parseInt(m[3], 16),
      size: layout.size,
      fields: layout.fields,
    });
  }
  return primitives;
}

/** Offset of a named field, or undefined. */
function fieldOffset(type: PrimitiveType, name: string): number | undefined {
  return type.fields.find((f) => f.name === name)?.offset;
}

/* --- constant tracking --- */

function parseImmediate(text: string): number | null {
  const trimmed = text.trim();
  const m = trimmed.match(/^(-?)(?:0x([0-9a-fA-F]+)|(\d+))$/);
  if (!m) return null;
  const value = m[2] !== undefined ? parseInt(m[2], 16) : parseInt(m[3], 10);
  return m[1] === "-" ? -value : value;
}

/** objdump prints MIPS registers bare (`v0`, `3(s0)`); cc1 assembly prints
 *  them with `$`. Accept both so one parser serves either stream. */
function registerOf(operand: string): string | null {
  const m = operand.trim().match(/^\$?(\w+)$/);
  return m && !/^\d+$/.test(m[1]) ? m[1] : null;
}

/**
 * Running map of register -> known constant, folding the `lui`/`ori` pair GCC
 * uses for constants wider than 16 bits. Deliberately linear and
 * flow-insensitive: it is used only to read immediates that were materialized
 * a few instructions earlier, where a stale value is not reachable in
 * practice.
 */
export function trackConstants(
  instructions: DisassembledInstruction[],
): Map<string, number>[] {
  const states: Map<string, number>[] = [];
  const regs = new Map<string, number>();

  for (const insn of instructions) {
    states.push(new Map(regs));
    const mnemonic = insn.mnemonic.toLowerCase();
    const dest = registerOf(insn.operands[0] ?? "");
    const { defs } = defUse(insn);

    if (dest) {
      if (mnemonic === "li" || mnemonic === "lui") {
        const value = parseImmediate(insn.operands[1] ?? "");
        if (value !== null) {
          regs.set(dest, mnemonic === "lui" ? (value << 16) >>> 0 : value);
          continue;
        }
      }
      if (mnemonic === "addiu" || mnemonic === "addi" || mnemonic === "ori" || mnemonic === "addu") {
        const source = registerOf(insn.operands[1] ?? "");
        const value = parseImmediate(insn.operands[2] ?? "");
        if (source === "zero" && value !== null) { regs.set(dest, value); continue; }
        if (source === "zero" && registerOf(insn.operands[2] ?? "") === "zero") {
          regs.set(dest, 0); continue;
        }
        if (mnemonic === "ori" && source && value !== null && regs.has(source)) {
          regs.set(dest, (regs.get(source)! | value) >>> 0); continue;
        }
        if (mnemonic === "addu" && source && registerOf(insn.operands[2] ?? "") === "zero" && regs.has(source)) {
          regs.set(dest, regs.get(source)!); continue;
        }
      }
    }

    for (const def of defs) regs.delete(def);
    if (defUse(insn).isCall) {
      for (const key of [...regs.keys()]) {
        if (!/^(s[0-7]|fp|gp|sp)$/.test(key)) regs.delete(key);
      }
    }
  }
  return states;
}

/* --- recognition --- */

interface MemoryAccess {
  index: number;
  mnemonic: string;
  base: string;
  offset: number;
  isStore: boolean;
  register: string | null;
}

function memoryAccesses(instructions: DisassembledInstruction[]): MemoryAccess[] {
  const result: MemoryAccess[] = [];
  instructions.forEach((insn, index) => {
    const { isLoad, isStore } = defUse(insn);
    if (!isLoad && !isStore) return;
    const target = insn.operands[insn.operands.length - 1] ?? "";
    const m = target.match(/^(-?(?:0x)?[0-9a-fA-F]+)?\(\$?(\w+)\)$/);
    if (!m) return;
    const offset = m[1] ? parseImmediate(m[1]) ?? 0 : 0;
    result.push({
      index,
      mnemonic: insn.mnemonic.toLowerCase(),
      base: m[2],
      offset,
      isStore,
      register: registerOf(insn.operands[0] ?? ""),
    });
  });
  return result;
}

export interface IdiomFinding {
  kind: string;
  summary: string;
  evidence: string[];
}

export interface IdiomReport {
  primitive: PrimitiveType | null;
  /** Base register the primitive is addressed through. */
  base: string | null;
  /** Fields of the recognized primitive the target writes. */
  written: PrimitiveField[];
  findings: IdiomFinding[];
}

/**
 * The len/code store pair is the anchor. Both bytes must be materialized
 * constants stored through the same base at the P_TAG offsets (len at 0x3,
 * code at 0x7) — a coincidence that does not arise from ordinary struct code.
 */
function findPrimitive(
  instructions: DisassembledInstruction[],
  table: PrimitiveType[],
): { type: PrimitiveType; base: string; evidence: string[] } | null {
  const states = trackConstants(instructions);
  const accesses = memoryAccesses(instructions);

  const lens = accesses.filter((a) => a.isStore && a.mnemonic === "sb" && a.offset === 0x3);
  const codes = accesses.filter((a) => a.isStore && a.mnemonic === "sb" && a.offset === 0x7);

  for (const lenAccess of lens) {
    const lenValue = lenAccess.register ? states[lenAccess.index].get(lenAccess.register) : undefined;
    if (lenValue === undefined) continue;
    for (const codeAccess of codes) {
      if (codeAccess.base !== lenAccess.base) continue;
      const codeValue = codeAccess.register ? states[codeAccess.index].get(codeAccess.register) : undefined;
      if (codeValue === undefined) continue;
      const type = table.find((p) => p.len === lenValue && p.code === codeValue);
      if (!type) continue;
      return {
        type,
        base: lenAccess.base,
        evidence: [
          `${instructions[lenAccess.index].raw.trim()}   (len = ${lenValue})`,
          `${instructions[codeAccess.index].raw.trim()}   (code = 0x${codeValue.toString(16)})`,
          `${type.macro}(p) expands to exactly this pair — see include/psyq/libgpu.h`,
        ],
      };
    }
  }
  return null;
}

/** Field-keyed macro advice. The field name is what tells the agent which
 *  macro builds the value; the corroborating constants are secondary. */
const FIELD_MACROS: { field: string; macro: string; constants: number[]; note: string }[] = [
  {
    field: "clut",
    macro: "getClut(x, y)",
    constants: [0x3f],
    note: "CLUT id — `(y << 6) | ((x >> 4) & 0x3f)`",
  },
  {
    field: "tpage",
    macro: "getTPage(tp, abr, x, y)",
    constants: [0x3ff, 0x100, 0x200],
    note: "texture page id — abr/tp folded away when passed as constants",
  },
];

export function recognizeIdioms(
  instructions: DisassembledInstruction[],
  sourceText?: string,
): IdiomReport {
  const table = loadPrimitiveTable();
  const found = findPrimitive(instructions, table);
  const findings: IdiomFinding[] = [];

  if (!found) return { primitive: null, base: null, written: [], findings };

  const { type, base, evidence } = found;
  const accesses = memoryAccesses(instructions);
  const throughBase = accesses.filter((a) => a.base === base);
  const writtenOffsets = new Set(throughBase.filter((a) => a.isStore).map((a) => a.offset));
  const written = type.fields.filter((f) => writtenOffsets.has(f.offset));

  const sourceKnows = sourceText ? new RegExp(`\\b${type.name}\\b`).test(sourceText) : false;
  findings.push({
    kind: "sdk-primitive",
    summary:
      `the primitive built through $${base} is a PSY-Q ${type.name} ` +
      `(sizeof ${hex(type.size)}), initialized by ${type.macro}(p)` +
      (sourceKnows ? "" : " — your source does not mention this type"),
    evidence: [
      ...evidence,
      `add \`#include "psyq/libgpu.h"\` and declare the pointer as \`${type.name} *\``,
    ],
  });

  /* Field map: the whole point. Every offset the function touches gets a name. */
  const map = type.fields
    .map((f) => `${hex(f.offset)} ${f.name}${writtenOffsets.has(f.offset) ? "  <- written" : ""}`)
    .join("\n");
  findings.push({
    kind: "sdk-fields",
    summary: `${type.name} field map (offsets the target writes are marked)`,
    evidence: map.split("\n"),
  });

  const constants = new Set<number>();
  for (const state of trackConstants(instructions)) for (const value of state.values()) constants.add(value);
  for (const insn of instructions) {
    const immediate = parseImmediate(insn.operands[insn.operands.length - 1] ?? "");
    if (immediate !== null) constants.add(immediate);
  }

  for (const rule of FIELD_MACROS) {
    const offset = fieldOffset(type, rule.field);
    if (offset === undefined || !writtenOffsets.has(offset)) continue;
    const seen = rule.constants.filter((c) => constants.has(c));
    findings.push({
      kind: "sdk-macro",
      summary: `writes ${type.name}.${rule.field} (${hex(offset)}) — build it with \`${rule.macro}\``,
      evidence: [
        rule.note,
        seen.length > 0
          ? `corroborating immediates present: ${seen.map((c) => hex(c)).join(", ")}`
          : "no corroborating mask constants found — confirm against the assembly",
      ],
    });
  }

  const rgb = ["r0", "g0", "b0"].map((name) => fieldOffset(type, name));
  if (rgb.every((offset) => offset !== undefined && writtenOffsets.has(offset))) {
    findings.push({
      kind: "sdk-macro",
      summary: `writes r0/g0/b0 — use \`setRGB0(p, r, g, b)\``,
      evidence: [`offsets ${rgb.map((o) => hex(o!)).join(", ")}`],
    });
  }

  /* addPrim(ot, p) = setaddr(p, getaddr(ot)), setaddr(ot, p): the 0xFFFFFF
   * address mask plus a store into the primitive's tag word. */
  const tagOffset = fieldOffset(type, "tag") ?? 0;
  if (constants.has(0xffffff) && writtenOffsets.has(tagOffset)) {
    findings.push({
      kind: "sdk-macro",
      summary:
        "writes the tag word with the 0xFFFFFF address mask in play — this is " +
        "`addPrim(ot, p)`; the other pointer argument is an ordering-table pointer",
      evidence: [
        "addPrim(ot, p) = setaddr(p, getaddr(ot)), setaddr(ot, p)",
        `tag at ${hex(tagOffset)}; length nibble lives in the same word (setlen)`,
      ],
    });
  }

  const stride = instructions.find((insn) =>
    insn.mnemonic.toLowerCase() === "addiu" &&
    registerOf(insn.operands[1] ?? "") === base &&
    parseImmediate(insn.operands[2] ?? "") === type.size);
  if (stride) {
    findings.push({
      kind: "sdk-stride",
      summary: `pointer advances by sizeof(${type.name}) = ${hex(type.size)} — confirms the type`,
      evidence: [stride.raw.trim()],
    });
  }

  return { primitive: type, base, written, findings };
}

function hex(value: number): string {
  return `0x${(value < 0 ? -value : value).toString(16).toUpperCase()}`;
}

/* --- CLI --- */

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const positional = args.filter((a) => !a.startsWith("--"));
  if (positional.length !== 1) {
    console.error("Usage: npx tsx tools/agent/sdkIdioms.ts <func_name> [--json]");
    process.exit(1);
  }

  const name = normalizeFunctionName(positional[0]);
  const scratch = join(ROOT, "build/triage", `${name}-sdk`);
  let instructions: DisassembledInstruction[];
  try {
    instructions = disassembleObject(assembleTarget(name, scratch));
  } catch (error) {
    console.error(`sdkIdioms: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  const sourcePath = join(ROOT, "src", `${name}.c`);
  const sourceText = existsSync(sourcePath) ? readFileSync(sourcePath, "utf-8") : undefined;
  const report = recognizeIdioms(instructions, sourceText);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!report.primitive) {
    console.log(`sdkIdioms ${name}: no PSY-Q primitive signature found.`);
    console.log("  (the anchor is a setlen/setcode byte pair at +0x3/+0x7 through one base)");
    return;
  }
  console.log(`sdkIdioms ${name} — ${report.primitive.name} via ${report.primitive.macro}\n`);
  for (const finding of report.findings) {
    console.log(`[${finding.kind}] ${finding.summary}`);
    for (const line of finding.evidence) console.log(`    | ${line}`);
    console.log();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
