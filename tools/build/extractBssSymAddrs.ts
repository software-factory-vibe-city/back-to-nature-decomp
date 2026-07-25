/**
 * extractBssSymAddrs.ts — Extract absolute addresses of BSS symbols from library .o files
 *
 * For each library .o file in libSections.json, scans .rel.text for HI16/LO16 relocation
 * pairs referencing BSS symbols, reads the resolved instructions from the original binary,
 * and computes the absolute VRAM address for each BSS symbol.
 *
 * Output: sorted list of `symbolName = 0xADDRESS;` lines suitable for a linker script.
 *
 * Usage:
 *   npx tsx tools/build/extractBssSymAddrs.ts
 */

import { readFileSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadPsxExeInfo, ROOT } from "../lib/psxExeInfo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const _info = loadPsxExeInfo();
const BINARY_PATH = _info.binaryPath;

interface LibSectionEntry {
  oPath: string;
  textRom: number;
  textSize: number;
  bssVram?: number;
  bssSize?: number;
}

interface RelocEntry {
  offset: number;
  type: string;
  symIndex: number;
  symName: string;
  symValue: number;
}

interface SymEntry {
  index: number;
  value: number;
  size: number;
  sectionIndex: number;
  name: string;
  bind: string;
}

interface ElfSection {
  index: number;
  name: string;
  size: number;
}

/** Parse `readelf -S` output to get section info */
function parseSections(oPath: string): Map<number, ElfSection> {
  const output = execSync(`mips-linux-gnu-readelf -S "${oPath}" 2>/dev/null`, {
    encoding: "utf-8",
  });
  const sections = new Map<number, ElfSection>();
  const re =
    /\[\s*(\d+)\]\s+(\S+)\s+\S+\s+[0-9a-f]+\s+[0-9a-f]+\s+([0-9a-f]+)\s+/gi;
  let m;
  while ((m = re.exec(output)) !== null) {
    sections.set(parseInt(m[1]), {
      index: parseInt(m[1]),
      name: m[2],
      size: parseInt(m[3], 16),
    });
  }
  return sections;
}

/** Parse `readelf -s` to get symbol table */
function parseSymbols(oPath: string): Map<number, SymEntry> {
  const output = execSync(`mips-linux-gnu-readelf -sW "${oPath}" 2>/dev/null`, {
    encoding: "utf-8",
  });
  const symbols = new Map<number, SymEntry>();
  const re =
    /^\s*(\d+):\s+([0-9a-f]+)\s+(\d+)\s+(\S+)\s+(\S+)\s+\S+\s+(\S+)\s+(.*)/gim;
  let m;
  while ((m = re.exec(output)) !== null) {
    const ndx = m[6];
    if (ndx === "ABS") continue;
    symbols.set(parseInt(m[1]), {
      index: parseInt(m[1]),
      value: parseInt(m[2], 16),
      size: parseInt(m[3]),
      sectionIndex: ndx === "UND" ? -1 : parseInt(ndx),
      name: m[7].trim(),
      bind: m[5],
    });
  }
  return symbols;
}

/** Parse `readelf -r` to get .rel.text relocations */
function parseRelocs(oPath: string): RelocEntry[] {
  const output = execSync(`mips-linux-gnu-readelf -r "${oPath}" 2>/dev/null`, {
    encoding: "utf-8",
  });
  const relocs: RelocEntry[] = [];
  let inRelText = false;
  for (const line of output.split("\n")) {
    if (line.includes(".rel.text")) {
      inRelText = true;
      continue;
    }
    if (inRelText && line.startsWith("Relocation section")) {
      break;
    }
    if (!inRelText) continue;

    const rm = line.match(
      /^([0-9a-f]+)\s+([0-9a-f]+)\s+(R_MIPS_\S+)\s+([0-9a-f]+)\s+(.*)/i
    );
    if (rm) {
      const info = parseInt(rm[2], 16);
      const symIndex = info >> 8;
      relocs.push({
        offset: parseInt(rm[1], 16),
        type: rm[3],
        symIndex,
        symName: rm[5].trim(),
        symValue: parseInt(rm[4], 16),
      });
    }
  }
  return relocs;
}

/** Read a 32-bit little-endian word from a buffer */
function readU32(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}

/** Extract the 16-bit immediate from a MIPS instruction */
function extractImm16(instruction: number): number {
  return instruction & 0xffff;
}

/** Sign-extend a 16-bit value to 32-bit */
function signExtend16(value: number): number {
  if (value & 0x8000) {
    return value - 0x10000;
  }
  return value;
}

/**
 * Resolve a HI16/LO16 pair from the binary, subtracting the addend from the .o file.
 *
 * MIPS HI16/LO16 relocations for global symbols use the instruction's existing
 * immediate as an addend.  The linker computes:
 *     result = symAddr + addend
 * So to recover the symbol address we need:
 *     symAddr = result - addend
 *
 * textFileOffset is the file offset of the .text section start in the binary.
 * oTextBytes is the raw .text bytes from the .o file (for reading addends).
 */
function resolveHiLoPair(
  binary: Buffer,
  textFileOffset: number,
  hiRelocOffset: number,
  loRelocOffset: number,
  oTextBytes?: Buffer
): number | null {
  const hiFileOff = textFileOffset + hiRelocOffset;
  const loFileOff = textFileOffset + loRelocOffset;
  if (hiFileOff + 4 > binary.length || loFileOff + 4 > binary.length) {
    return null;
  }
  const hiInstr = readU32(binary, hiFileOff);
  const loInstr = readU32(binary, loFileOff);
  const hiImm = extractImm16(hiInstr);
  const loImm = signExtend16(extractImm16(loInstr));
  const resolved = ((hiImm << 16) + loImm) >>> 0;

  // Subtract addend from .o file if available
  if (oTextBytes && hiRelocOffset + 4 <= oTextBytes.length && loRelocOffset + 4 <= oTextBytes.length) {
    const hiOrig = readU32(oTextBytes, hiRelocOffset);
    const loOrig = readU32(oTextBytes, loRelocOffset);
    const hiAddend = extractImm16(hiOrig);
    const loAddend = signExtend16(extractImm16(loOrig));
    const addend = (hiAddend << 16) + loAddend;
    if (addend !== 0) {
      return (resolved - addend) >>> 0;
    }
  }

  return resolved;
}

/**
 * Find the paired LO16 for a HI16 reloc.
 * Per MIPS ABI: HI16 pairs with next LO16 for the same symbol index.
 */
function findPairedLo16(
  relocs: RelocEntry[],
  startIdx: number,
  symIndex: number
): RelocEntry | null {
  for (let j = startIdx + 1; j < relocs.length; j++) {
    if (
      relocs[j].type === "R_MIPS_LO16" &&
      relocs[j].symIndex === symIndex
    ) {
      return relocs[j];
    }
  }
  return null;
}

/** Extract raw .text bytes from a .o file */
function extractOTextBytes(oPath: string): Buffer | null {
  try {
    const tmpPath = "/tmp/extractBss_text.bin";
    execSync(
      `mips-linux-gnu-objcopy -O binary -j .text "${oPath}" "${tmpPath}" 2>/dev/null`
    );
    return readFileSync(tmpPath);
  } catch {
    return null;
  }
}

function main() {
  const cachePath = join(ROOT, "build/libSections.json");
  const libSections: LibSectionEntry[] = JSON.parse(
    readFileSync(cachePath, "utf-8")
  );

  const binary = readFileSync(BINARY_PATH);

  // Collect all resolved BSS symbol addresses: symbolName -> address
  const bssSymAddrs = new Map<string, number>();

  // Collect all BSS symbol names from all .o files that have .bss
  const allBssSymNames = new Set<string>();

  // Phase 1: Collect all BSS symbol names
  for (const entry of libSections) {
    if (!entry.bssSize || entry.bssSize === 0) continue;

    const oPath = join(ROOT, entry.oPath);
    const sections = parseSections(oPath);
    const symbols = parseSymbols(oPath);

    let bssSectionIndex = -1;
    for (const [, sec] of sections) {
      if (sec.name === ".bss") {
        bssSectionIndex = sec.index;
        break;
      }
    }
    if (bssSectionIndex === -1) continue;

    for (const [, sym] of symbols) {
      if (sym.sectionIndex === bssSectionIndex && !sym.name.startsWith("$")) {
        allBssSymNames.add(sym.name);
      }
    }
  }

  console.error(`Found ${allBssSymNames.size} unique BSS symbol names across all .o files`);

  // Phase 2: Scan ALL .o files (not just those with .bss) for HI16/LO16 relocs
  // that reference BSS symbols, and resolve their addresses from the binary.
  // This handles the case where a BSS symbol is defined in one .o but referenced
  // from another .o's .text section.
  for (const entry of libSections) {
    if (!entry.textSize || entry.textSize === 0) continue;

    const oPath = join(ROOT, entry.oPath);
    const relocs = parseRelocs(oPath);
    if (relocs.length === 0) continue;

    const symbols = parseSymbols(oPath);
    const textFileOffset = entry.textRom; // already includes PSX-EXE header offset
    const oTextBytes = extractOTextBytes(oPath);

    for (let i = 0; i < relocs.length; i++) {
      const reloc = relocs[i];
      if (reloc.type !== "R_MIPS_HI16") continue;

      const sym = symbols.get(reloc.symIndex);
      if (!sym) continue;

      // For global symbols: check if the symbol name is a known BSS symbol
      if (sym.name.startsWith("$")) continue; // skip section-relative
      if (!allBssSymNames.has(sym.name)) continue; // not a BSS symbol
      if (bssSymAddrs.has(sym.name)) continue; // already resolved

      const lo16 = findPairedLo16(relocs, i, reloc.symIndex);
      if (!lo16) continue;

      const resolvedAddr = resolveHiLoPair(
        binary,
        textFileOffset,
        reloc.offset,
        lo16.offset,
        oTextBytes ?? undefined
      );
      if (resolvedAddr === null) continue;

      // Sanity check: address should be in PSX RAM range
      if (resolvedAddr >= 0x80000000 && resolvedAddr < 0x80800000) {
        bssSymAddrs.set(sym.name, resolvedAddr);
      } else {
        console.error(
          `WARN: ${entry.oPath} symbol ${sym.name} resolved to 0x${resolvedAddr.toString(16)} (out of PSX RAM range), skipping`
        );
      }
    }
  }

  // Phase 3: Handle section-relative (.bss section symbol) relocations.
  // For each .o file that has .bss and .text, find section-relative HI16/LO16 pairs
  // that target .bss. Use the resolved address and the sym.value (addend/offset)
  // to compute bssBase, then resolve any remaining symbols.
  for (const entry of libSections) {
    if (!entry.bssSize || entry.bssSize === 0) continue;
    if (!entry.textSize || entry.textSize === 0) continue;

    const oPath = join(ROOT, entry.oPath);
    const sections = parseSections(oPath);
    const symbols = parseSymbols(oPath);
    const relocs = parseRelocs(oPath);

    let bssSectionIndex = -1;
    for (const [, sec] of sections) {
      if (sec.name === ".bss") {
        bssSectionIndex = sec.index;
        break;
      }
    }
    if (bssSectionIndex === -1) continue;

    const textFileOffset = entry.textRom;
    const oTextBytes3 = extractOTextBytes(oPath);

    // Find section-relative BSS relocs and compute bssBase
    let bssBase: number | null = null;

    for (let i = 0; i < relocs.length && bssBase === null; i++) {
      const reloc = relocs[i];
      if (reloc.type !== "R_MIPS_HI16") continue;

      const sym = symbols.get(reloc.symIndex);
      if (!sym || sym.sectionIndex !== bssSectionIndex) continue;
      if (!sym.name.startsWith("$")) continue; // only section-relative

      const lo16 = findPairedLo16(relocs, i, reloc.symIndex);
      if (!lo16) continue;

      const resolvedAddr = resolveHiLoPair(
        binary,
        textFileOffset,
        reloc.offset,
        lo16.offset,
        oTextBytes3 ?? undefined
      );
      if (resolvedAddr === null) continue;

      // resolvedAddr = bssBase + sym.value (section-relative addend)
      bssBase = (resolvedAddr - sym.value) >>> 0;
    }

    if (bssBase === null) continue;

    // Use bssBase to resolve any remaining unnamed (section-relative) symbols
    // by mapping them to named symbols at the same offset
    for (const [, sym] of symbols) {
      if (sym.sectionIndex !== bssSectionIndex) continue;
      if (sym.name.startsWith("$")) continue;
      if (bssSymAddrs.has(sym.name)) continue;

      const addr = (bssBase + sym.value) >>> 0;
      if (addr >= 0x80000000 && addr < 0x80800000) {
        bssSymAddrs.set(sym.name, addr);
      }
    }
  }

  // Phase 4: For BSS-only .o files (no .text), try to find remaining unresolved
  // symbols by scanning all other .o files for extern references.
  const unresolved = new Set<string>();
  for (const name of allBssSymNames) {
    if (!bssSymAddrs.has(name)) {
      unresolved.add(name);
    }
  }

  if (unresolved.size > 0) {
    console.error(
      `Phase 4: ${unresolved.size} unresolved BSS symbols, scanning all lib .o files...`
    );

    // Get all .o files from lib/ directory
    const libOFiles = execSync(
      `find "${join(ROOT, "lib")}" -name "*.o" -type f`,
      { encoding: "utf-8" }
    )
      .trim()
      .split("\n")
      .filter(Boolean);

    // Build a map of textRom for each .o file from libSections
    const textRomMap = new Map<string, number>();
    for (const entry of libSections) {
      if (entry.textSize > 0) {
        textRomMap.set(join(ROOT, entry.oPath), entry.textRom);
      }
    }

    for (const oFile of libOFiles) {
      if (unresolved.size === 0) break;
      const textRom = textRomMap.get(oFile);
      if (textRom === undefined) continue; // no known text location

      let relocs: RelocEntry[];
      let symbols: Map<number, SymEntry>;
      try {
        relocs = parseRelocs(oFile);
        if (relocs.length === 0) continue;
        symbols = parseSymbols(oFile);
      } catch {
        continue;
      }

      const oTextBytes4 = extractOTextBytes(oFile);

      for (let i = 0; i < relocs.length; i++) {
        const reloc = relocs[i];
        if (reloc.type !== "R_MIPS_HI16") continue;

        const sym = symbols.get(reloc.symIndex);
        if (!sym || sym.name.startsWith("$")) continue;
        if (!unresolved.has(sym.name)) continue;

        const lo16 = findPairedLo16(relocs, i, reloc.symIndex);
        if (!lo16) continue;

        const resolvedAddr = resolveHiLoPair(
          binary,
          textRom,
          reloc.offset,
          lo16.offset,
          oTextBytes4 ?? undefined
        );
        if (resolvedAddr === null) continue;

        if (resolvedAddr >= 0x80000000 && resolvedAddr < 0x80800000) {
          bssSymAddrs.set(sym.name, resolvedAddr);
          unresolved.delete(sym.name);
        }
      }
    }

    if (unresolved.size > 0) {
      console.error(`WARN: ${unresolved.size} BSS symbols still unresolved:`);
      for (const name of unresolved) {
        console.error(`  ${name}`);
      }
    }
  }

  console.error(
    `Resolved ${bssSymAddrs.size} / ${allBssSymNames.size} BSS symbols`
  );

  // Sort by address and output
  const sorted = [...bssSymAddrs.entries()].sort((a, b) => a[1] - b[1]);
  for (const [name, addr] of sorted) {
    console.log(`${name} = 0x${addr.toString(16).toUpperCase()};`);
  }
}

main();
