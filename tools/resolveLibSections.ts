/**
 * resolveLibSections.ts — Resolve ROM offsets for non-text sections of matched library .o files
 *
 * For each matched .o file that has .data/.rdata/.bss sections, determines where
 * those sections are placed in the binary by cross-referencing .rel.text relocations
 * with the resolved instructions in the binary.
 *
 * Usage:
 *   npx tsx tools/resolveLibSections.ts [--verbose]
 *
 * Output (stdout): JSON array of LibSections objects
 */

import { readFileSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadPsxExeInfo, requireSectionLayout, ROOT } from "./psxExeInfo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const _info = loadPsxExeInfo();
const _layout = requireSectionLayout();
const BINARY_PATH = _info.binaryPath;
const LOAD_ADDR = _info.loadAddr;
const PAYLOAD_OFFSET = _info.payloadOffset;

interface LibMatch {
  vramStart: number;
  vramEnd: number;
  oPath: string;
  textSize: number;
  sigLength: number;
  labels: { name: string; vramAddr: number }[];
  libName: string;
  objName: string;
}

interface LibSections {
  oPath: string;
  textRom: number;
  textSize: number;
  rdataRom?: number;
  rdataSize?: number;
  dataRom?: number;
  dataSize?: number;
  bssVram?: number;
  bssSize?: number;
}

interface ElfSection {
  index: number;
  name: string;
  size: number;
  align: number;
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
  sectionIndex: number;
  name: string;
}

function vramToRom(vram: number): number {
  return vram - LOAD_ADDR + PAYLOAD_OFFSET;
}

/** Parse `readelf -S` output to get section index→name+size map */
function parseSections(oPath: string): Map<number, ElfSection> {
  const output = execSync(`mips-linux-gnu-readelf -S "${oPath}" 2>/dev/null`, {
    encoding: "utf-8",
  });
  const sections = new Map<number, ElfSection>();
  // Match: [ N] .name  TYPE  addr  off  size  es  flg  lk  inf  al
  const re =
    /\[\s*(\d+)\]\s+(\S+)\s+\S+\s+[0-9a-f]+\s+[0-9a-f]+\s+([0-9a-f]+)\s+[0-9a-f]+\s+\S*\s+\d+\s+\d+\s+(\d+)/gi;
  let m;
  while ((m = re.exec(output)) !== null) {
    sections.set(parseInt(m[1]), {
      index: parseInt(m[1]),
      name: m[2],
      size: parseInt(m[3], 16),
      align: parseInt(m[4]),
    });
  }
  return sections;
}

/** Parse `readelf -s` to get symbol index→section index map */
function parseSymbols(oPath: string): Map<number, SymEntry> {
  const output = execSync(`mips-linux-gnu-readelf -s "${oPath}" 2>/dev/null`, {
    encoding: "utf-8",
  });
  const symbols = new Map<number, SymEntry>();
  // Match: Num: Value Size Type Bind Vis Ndx Name
  const re =
    /^\s*(\d+):\s+([0-9a-f]+)\s+\d+\s+\S+\s+\S+\s+\S+\s+(\S+)\s+(.*)/gim;
  let m;
  while ((m = re.exec(output)) !== null) {
    const ndx = m[3];
    if (ndx === "UND" || ndx === "ABS") continue;
    symbols.set(parseInt(m[1]), {
      index: parseInt(m[1]),
      value: parseInt(m[2], 16),
      sectionIndex: parseInt(ndx),
      name: m[4].trim(),
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
  // Match: offset info type sym.value sym.name
  const re =
    /^([0-9a-f]+)\s+([0-9a-f]+)\s+(R_MIPS_\S+)\s+([0-9a-f]+)\s+(.*)/gim;
  let m;
  // Only parse .rel.text section
  let inRelText = false;
  for (const line of output.split("\n")) {
    if (line.includes(".rel.text")) {
      inRelText = true;
      continue;
    }
    if (inRelText && line.startsWith("Relocation section")) {
      break; // hit next reloc section
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

/** Read a 32-bit little-endian word from the binary */
function readU32(binary: Buffer, offset: number): number {
  return binary.readUInt32LE(offset);
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
 * Resolve the VRAM address of a non-text section by reading HI16/LO16 pairs
 * from the binary at the locations indicated by relocations.
 */
function resolveSection(
  binary: Buffer,
  textRomStart: number,
  relocs: RelocEntry[],
  symbols: Map<number, SymEntry>,
  targetSectionIndex: number
): number | null {
  // Find HI16 relocs targeting symbols in the target section
  for (let i = 0; i < relocs.length; i++) {
    const reloc = relocs[i];
    if (reloc.type !== "R_MIPS_HI16") continue;

    const sym = symbols.get(reloc.symIndex);
    if (!sym || sym.sectionIndex !== targetSectionIndex) continue;

    // Find the paired LO16 (next LO16 targeting same section)
    let lo16Reloc: RelocEntry | null = null;
    for (let j = i + 1; j < relocs.length; j++) {
      if (relocs[j].type === "R_MIPS_LO16") {
        const loSym = symbols.get(relocs[j].symIndex);
        if (loSym && loSym.sectionIndex === targetSectionIndex) {
          lo16Reloc = relocs[j];
          break;
        }
      }
    }

    if (!lo16Reloc) continue;

    const loSym = symbols.get(lo16Reloc.symIndex);
    if (!loSym) continue;

    // Read resolved instructions from the binary
    const hiInstrOffset = textRomStart + reloc.offset;
    const loInstrOffset = textRomStart + lo16Reloc.offset;

    if (
      hiInstrOffset + 4 > binary.length ||
      loInstrOffset + 4 > binary.length
    ) {
      continue;
    }

    const hiInstr = readU32(binary, hiInstrOffset);
    const loInstr = readU32(binary, loInstrOffset);

    const hiImm = extractImm16(hiInstr);
    const loImm = signExtend16(extractImm16(loInstr));

    // Resolved VRAM = (HI16_imm << 16) + sign_extend(LO16_imm)
    const resolvedVram = ((hiImm << 16) + loImm) >>> 0;

    // Section base = resolved_vram - symbol_addend
    // The symbol's value IS the addend (offset within the section)
    const addend = sym.value;
    const sectionBase = (resolvedVram - addend) >>> 0;

    return sectionBase;
  }

  return null;
}

/**
 * Fuzzy match for edge cases: search for a 16-byte pattern in the binary data region.
 * Used for 3 .o files that have .data but no self-referencing code.
 */
function fuzzyMatchData(
  binary: Buffer,
  oPath: string,
  dataSize: number,
  searchStart: number,
  searchEnd: number
): number | null {
  // Read the .data section content from the .o file via temp file
  const tmpPath = "/tmp/resolveLibSections_data.bin";
  try {
    execSync(
      `mips-linux-gnu-objcopy -O binary -j .data "${oPath}" "${tmpPath}" 2>/dev/null`
    );
  } catch {
    return null;
  }
  const output = readFileSync(tmpPath);
  if (output.length !== dataSize) return null;

  // Search for the pattern in the data region, trying each aligned offset
  for (let i = searchStart; i <= searchEnd - dataSize; i += 4) {
    let match = true;
    for (let j = 0; j < dataSize; j++) {
      // Skip first byte (wildcarded per plan)
      if (j === 0) continue;
      if (binary[i + j] !== output[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return null;
}

function main() {
  const verbose = process.argv.includes("--verbose");

  // Run detectLibFunctions.ts
  console.error("Running detectLibFunctions.ts...");
  const output = execSync("npx tsx tools/detectLibFunctions.ts", {
    encoding: "utf-8",
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });
  const matches: LibMatch[] = JSON.parse(output);

  const binary = readFileSync(BINARY_PATH);

  // Data region in binary for fuzzy matching
  const dataRegionStart = _layout.dataStart;
  const dataRegionEnd = _layout.sdataStart;

  const results: LibSections[] = [];
  let resolvedData = 0,
    resolvedRdata = 0,
    resolvedBss = 0;
  let fuzzyData = 0;
  let failedData = 0,
    failedRdata = 0,
    failedBss = 0;

  for (const match of matches) {
    const sections = parseSections(match.oPath);

    // Find target sections
    let rdataSection: ElfSection | undefined;
    let dataSection: ElfSection | undefined;
    let bssSection: ElfSection | undefined;

    for (const [, sec] of sections) {
      if (sec.name === ".rdata") rdataSection = sec;
      else if (sec.name === ".data") dataSection = sec;
      else if (sec.name === ".bss") bssSection = sec;
    }

    // Skip if no non-text sections
    if (!rdataSection && !dataSection && !bssSection) {
      results.push({
        oPath: match.oPath,
        textRom: vramToRom(match.vramStart),
        textSize: match.textSize,
      });
      continue;
    }

    const textRomStart = vramToRom(match.vramStart);
    const relocs = parseRelocs(match.oPath);
    const symbols = parseSymbols(match.oPath);

    const entry: LibSections = {
      oPath: match.oPath,
      textRom: textRomStart,
      textSize: match.textSize,
    };

    // Resolve .rdata
    if (rdataSection && rdataSection.size > 0) {
      const vram = resolveSection(
        binary,
        textRomStart,
        relocs,
        symbols,
        rdataSection.index
      );
      if (vram !== null) {
        entry.rdataRom = vramToRom(vram);
        entry.rdataSize = rdataSection.size;
        resolvedRdata++;
        if (verbose) {
          console.error(
            `  ${match.oPath} .rdata: VRAM=0x${vram.toString(16)} ROM=0x${entry.rdataRom.toString(16)} size=0x${rdataSection.size.toString(16)}`
          );
        }
      } else {
        failedRdata++;
        console.error(
          `  WARN: Could not resolve .rdata for ${match.oPath} (size=0x${rdataSection.size.toString(16)})`
        );
      }
    }

    // Resolve .data
    if (dataSection && dataSection.size > 0) {
      let vram = resolveSection(
        binary,
        textRomStart,
        relocs,
        symbols,
        dataSection.index
      );
      if (vram !== null) {
        entry.dataRom = vramToRom(vram);
        entry.dataSize = dataSection.size;
        resolvedData++;
        if (verbose) {
          console.error(
            `  ${match.oPath} .data: VRAM=0x${vram.toString(16)} ROM=0x${entry.dataRom.toString(16)} size=0x${dataSection.size.toString(16)}`
          );
        }
      } else {
        // Try fuzzy match
        const romOffset = fuzzyMatchData(
          binary,
          match.oPath,
          dataSection.size,
          dataRegionStart,
          dataRegionEnd
        );
        if (romOffset !== null) {
          entry.dataRom = romOffset;
          entry.dataSize = dataSection.size;
          fuzzyData++;
          if (verbose) {
            console.error(
              `  ${match.oPath} .data: FUZZY ROM=0x${romOffset.toString(16)} size=0x${dataSection.size.toString(16)}`
            );
          }
        } else {
          failedData++;
          console.error(
            `  WARN: Could not resolve .data for ${match.oPath} (size=0x${dataSection.size.toString(16)})`
          );
        }
      }
    }

    // Resolve .bss
    if (bssSection && bssSection.size > 0) {
      const vram = resolveSection(
        binary,
        textRomStart,
        relocs,
        symbols,
        bssSection.index
      );
      if (vram !== null) {
        entry.bssVram = vram;
        entry.bssSize = bssSection.size;
        resolvedBss++;
        if (verbose) {
          console.error(
            `  ${match.oPath} .bss: VRAM=0x${vram.toString(16)} size=0x${bssSection.size.toString(16)}`
          );
        }
      } else {
        failedBss++;
        console.error(
          `  WARN: Could not resolve .bss for ${match.oPath} (size=0x${bssSection.size.toString(16)})`
        );
      }
    }

    results.push(entry);
  }

  console.error(`\nSection resolution results:`);
  console.error(
    `  .rdata: ${resolvedRdata} resolved, ${failedRdata} failed`
  );
  console.error(
    `  .data:  ${resolvedData} resolved, ${fuzzyData} fuzzy, ${failedData} failed`
  );
  console.error(
    `  .bss:   ${resolvedBss} resolved, ${failedBss} failed`
  );

  console.log(JSON.stringify(results, null, 2));
}

main();
