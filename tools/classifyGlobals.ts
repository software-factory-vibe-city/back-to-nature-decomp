/**
 * classifyGlobals.ts — Generate include/globals.h with correct extern declarations
 *
 * GCC -G8 uses $gp-relative addressing for extern variables ≤ 8 bytes.
 * Symbols outside $gp's signed-16-bit range need absolute (lui + lo) addressing.
 * This tool generates declarations that make GCC choose the right mode.
 *
 * Symbols in GP range:  normal externs (GCC uses $gp-relative)
 * Symbols outside:      >8-byte array with __asm__("real_name") + #define wrapper
 *                        (GCC uses absolute addressing, emits real symbol name)
 *
 * Usage: npx tsx tools/classifyGlobals.ts [--write]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname;
const writeMode = process.argv.includes("--write");

// --- Read gp_value from splat.yaml ---

function readGpValue(): number {
  const yaml = readFileSync(join(ROOT, "configs/splat.yaml"), "utf-8");
  const match = yaml.match(/gp_value:\s*(0x[0-9a-fA-F]+)/);
  if (!match) {
    console.error("Could not find gp_value in configs/splat.yaml");
    process.exit(1);
  }
  return parseInt(match[1], 16);
}

// --- Read symbols from undefined_syms_auto.txt ---

interface SymbolInfo {
  name: string;
  addr: number;
  inGpRange: boolean;
  cType: string; // inferred C type
}

function readSymbols(gpValue: number): SymbolInfo[] {
  const symsPath = join(ROOT, "build/undefined_syms_auto.txt");
  if (!existsSync(symsPath)) {
    console.error("build/undefined_syms_auto.txt not found. Run 'make split' first.");
    process.exit(1);
  }

  const gpLo = gpValue - 0x7ff0;
  const gpHi = gpValue + 0x7fef;

  const lines = readFileSync(symsPath, "utf-8").split("\n");
  const symbols: SymbolInfo[] = [];

  for (const line of lines) {
    const m = line.match(/^(\w+)\s*=\s*(0x[0-9a-fA-F]+)/);
    if (!m) continue;

    const name = m[1];
    const addr = parseInt(m[2], 16);

    // Only process D_ data symbols — skip functions and named symbols
    if (!name.startsWith("D_")) continue;

    const inGpRange = addr >= gpLo && addr <= gpHi;
    symbols.push({ name, addr, inGpRange, cType: "s32" }); // default type
  }

  return symbols;
}

// --- Infer types by scanning the original binary ---
//
// Scans the .text section for lui+load/store pairs to determine the C type
// of each absolute-addressed global. This works directly on the original
// binary so it's independent of which functions have been decompiled.
//
// For GP-relative symbols, scans the spimdisasm asm (which always exists
// for non-decompiled functions) and decompiled C source.

const BINARY_PATH = join(ROOT, "extracted/iso/slus_011.15");
const PAYLOAD_OFFSET = 0x800;
const LOAD_ADDR = 0x80010000;
const TEXT_START = 0x80011270;
const TEXT_END = 0x80048190;

function inferTypesFromBinary(symbols: SymbolInfo[]): void {
  if (!existsSync(BINARY_PATH)) {
    console.warn("Original binary not found, skipping binary type inference");
    return;
  }

  const payload = readFileSync(BINARY_PATH);
  const textOff = PAYLOAD_OFFSET + (TEXT_START - LOAD_ADDR);
  const textSize = TEXT_END - TEXT_START;

  /* Build address -> symbol lookup for ALL symbols.
   * Some symbols within GP address range are actually accessed via lui+lo
   * (absolute) because their original declaration was >8 bytes. We need to
   * detect this and reclassify them. */
  const addrToSym = new Map<number, SymbolInfo>();
  for (const s of symbols) {
    addrToSym.set(s.addr, s);
  }

  /* MIPS opcode -> C type */
  const opTypeMap: Record<number, string> = {
    0x20: "s8",  /* lb */
    0x24: "u8",  /* lbu */
    0x28: "s8",  /* sb */
    0x21: "s16", /* lh */
    0x25: "u16", /* lhu */
    0x29: "s16", /* sh */
    0x23: "s32", /* lw */
    0x2B: "s32", /* sw */
  };

  /* Track which symbols are accessed via lui (absolute addressing) */
  const absoluteAccessed = new Set<string>();

  /* Scan .text for lui + load/store pairs */
  for (let i = 0; i < textSize; i += 4) {
    const off = textOff + i;
    const word = payload.readUInt32LE(off);
    const op = (word >>> 26) & 0x3F;

    if (op !== 0xF) continue; /* lui */

    const rt = (word >>> 16) & 0x1F;
    const hi = word & 0xFFFF;

    /* Look at next 4 instructions for a load/store using rt as base */
    for (let j = 1; j <= 4; j++) {
      const nextOff = off + j * 4;
      if (nextOff + 4 > payload.length) break;

      const nextWord = payload.readUInt32LE(nextOff);
      const nextOp = (nextWord >>> 26) & 0x3F;
      const nextBase = (nextWord >>> 21) & 0x1F;
      let nextLo = nextWord & 0xFFFF;
      if (nextLo >= 0x8000) nextLo -= 0x10000; /* sign-extend */

      if (nextBase !== rt) continue;
      if (!(nextOp in opTypeMap)) continue;

      const addr = ((hi << 16) + nextLo) >>> 0;
      const sym = addrToSym.get(addr);
      if (sym) {
        absoluteAccessed.add(sym.name);
        if (sym.cType === "s32") {
          const inferred = opTypeMap[nextOp];
          if (inferred !== "s32") {
            sym.cType = inferred;
          }
        }
      }
      break; /* only use first matching load/store after lui */
    }
  }

  /* Reclassify: symbols in GP address range that are accessed via lui
   * need absolute addressing (their original declaration was >8 bytes) */
  let reclassified = 0;
  for (const sym of symbols) {
    if (sym.inGpRange && absoluteAccessed.has(sym.name)) {
      sym.inGpRange = false;
      reclassified++;
    }
  }
  if (reclassified > 0) {
    console.log(`  Reclassified ${reclassified} GP-range symbol(s) to absolute (lui access detected)`);
  }
}

function inferTypesFromAsm(symbols: SymbolInfo[]): void {
  /* Scan nonmatchings asm for GP-relative symbols */
  const nonmatchingsDir = join(ROOT, "build/asm/nonmatchings");
  if (!existsSync(nonmatchingsDir)) return;

  const allAsm: string[] = [];
  for (const funcDir of readdirSync(nonmatchingsDir)) {
    const dirPath = join(nonmatchingsDir, funcDir);
    try {
      for (const f of readdirSync(dirPath)) {
        if (f.endsWith(".s")) {
          allAsm.push(readFileSync(join(dirPath, f), "utf-8"));
        }
      }
    } catch { /* skip non-directories */ }
  }
  const combined = allAsm.join("\n");

  const typeMap: Record<string, string> = {
    sb: "s8", lb: "s8", lbu: "u8",
    sh: "s16", lh: "s16", lhu: "u16",
    sw: "s32", lw: "s32", lwu: "u32",
  };

  for (const sym of symbols) {
    if (!sym.inGpRange) continue; /* absolute symbols handled by binary scan */
    if (sym.cType !== "s32") continue; /* already typed */

    const accessPattern = new RegExp(
      `(\\w+)\\s+\\$\\w+,\\s*%gp_rel\\(${sym.name}\\)`, "g"
    );

    let match: RegExpExecArray | null;
    while ((match = accessPattern.exec(combined)) !== null) {
      const instr = match[1].toLowerCase();
      if (typeMap[instr]) {
        sym.cType = typeMap[instr];
        break;
      }
    }
  }
}

function inferTypesFromSource(symbols: SymbolInfo[]): void {
  /* Scan decompiled C source for explicit extern declarations (GP-relative only) */
  const srcDir = join(ROOT, "src");
  if (!existsSync(srcDir)) return;

  const symByName = new Map<string, SymbolInfo>();
  for (const s of symbols) {
    if (s.inGpRange) symByName.set(s.name, s);
  }

  const externRe = /extern\s+(s8|u8|s16|u16|s32|u32|void)\s+(\w+)\s*[\[;]/gm;
  for (const file of readdirSync(srcDir)) {
    if (!file.endsWith(".c")) continue;
    const content = readFileSync(join(srcDir, file), "utf-8");
    if (content.includes("INCLUDE_ASM(")) continue;
    let m: RegExpExecArray | null;
    externRe.lastIndex = 0;
    while ((m = externRe.exec(content)) !== null) {
      const [, cType, name] = m;
      const sym = symByName.get(name);
      if (sym) sym.cType = cType;
    }
  }
}

function inferTypes(symbols: SymbolInfo[]): void {
  inferTypesFromBinary(symbols);  /* absolute-addressed: scan original binary */
  inferTypesFromAsm(symbols);     /* GP-relative: scan spimdisasm output */
  inferTypesFromSource(symbols);  /* GP-relative: scan decompiled C source */
}

// --- Read override symbols ---

function readOverrideSymbols(): Set<string> {
  const overridePath = join(ROOT, "include/globals_override.h");
  const overridden = new Set<string>();
  if (!existsSync(overridePath)) return overridden;

  const content = readFileSync(overridePath, "utf-8");
  // Match D_XXXXXXXX in extern declarations, #define lines, or __asm__ strings
  const re = /\bD_[0-9a-fA-F]{8}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    overridden.add(m[0]);
  }
  return overridden;
}

// --- Generate header ---

function generateHeader(symbols: SymbolInfo[], overridden: Set<string>): string {
  const lines: string[] = [
    "/* Generated by tools/classifyGlobals.ts — do not edit manually */",
    "#ifndef GLOBALS_H",
    "#define GLOBALS_H",
    "",
    "/* Requires common.h typedefs (s8, s16, s32, u8, u16, u32) */",
    '#include "globals_override.h"',
    "",
  ];

  const gpSyms = symbols.filter(s => s.inGpRange && !overridden.has(s.name));
  const absSyms = symbols.filter(s => !s.inGpRange && !overridden.has(s.name));
  const skipped = symbols.filter(s => overridden.has(s.name));
  if (skipped.length > 0) {
    lines.push(`/* ${skipped.length} symbol(s) defined in globals_override.h */`);
    lines.push("");
  }

  if (gpSyms.length > 0) {
    lines.push("/* GP-relative symbols (within $gp ± 0x7FF0) */");
    for (const s of gpSyms) {
      lines.push(`extern ${s.cType} ${s.name};`);
    }
    lines.push("");
  }

  if (absSyms.length > 0) {
    lines.push("/* Absolute-addressed symbols (outside $gp range) */");
    lines.push("/* Declared as >8-byte arrays with __asm__ to force lui+lo addressing with -G8 */");
    lines.push("/* __asm__ makes GCC emit the real symbol name in assembly output */");

    /* Array element count must make total size > 8 bytes for -G8 threshold */
    const arrayCount: Record<string, number> = {
      s8: 9, u8: 9,     /* 9 bytes > 8 */
      s16: 5, u16: 5,   /* 10 bytes > 8 */
      s32: 3, u32: 3,   /* 12 bytes > 8 */
    };

    for (const s of absSyms) {
      const count = arrayCount[s.cType] ?? 3;
      lines.push(`extern ${s.cType} _${s.name}[${count}] __asm__("${s.name}");`);
      lines.push(`#define ${s.name} (*((${s.cType}*)_${s.name}))`);
    }
    lines.push("");
  }

  lines.push("#endif");
  lines.push("");

  return lines.join("\n");
}

/** Plain extern declarations for m2c --context (no macros, no arrays) */
function generateM2cContext(symbols: SymbolInfo[]): string {
  const lines: string[] = [
    "/* Generated by tools/classifyGlobals.ts — m2c context file */",
    "/* Plain externs so m2c knows these symbols exist and won't re-declare them */",
    "",
  ];
  for (const s of symbols) {
    lines.push(`extern ${s.cType} ${s.name};`);
  }
  lines.push("");
  return lines.join("\n");
}

// --- Main ---

const gpValue = readGpValue();
console.log(`GP value: ${gpValue.toString(16)}`);
console.log(`GP range: ${(gpValue - 0x7ff0).toString(16)} — ${(gpValue + 0x7fef).toString(16)}`);

const symbols = readSymbols(gpValue);
console.log(`Data symbols: ${symbols.length} total`);
console.log(`  In GP range:  ${symbols.filter(s => s.inGpRange).length}`);
console.log(`  Outside GP:   ${symbols.filter(s => !s.inGpRange).length}`);

inferTypes(symbols);

const overridden = readOverrideSymbols();
if (overridden.size > 0) {
  console.log(`  Overridden:   ${overridden.size} (from globals_override.h)`);
}

const header = generateHeader(symbols, overridden);
const m2cContext = generateM2cContext(symbols);

if (writeMode) {
  const headerPath = join(ROOT, "include/globals.h");
  writeFileSync(headerPath, header);
  console.log(`Wrote ${headerPath}`);

  const m2cPath = join(ROOT, "build/m2c_globals.ctx");
  writeFileSync(m2cPath, m2cContext);
  console.log(`Wrote ${m2cPath}`);
} else {
  console.log("\n--- include/globals.h (dry run) ---\n");
  console.log(header);
  console.log("Run with --write to save.");
}
