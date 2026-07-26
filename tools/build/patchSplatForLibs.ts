/**
 * patchSplatForLibs.ts — Patch splat YAML to use `o` segments for PSY-Q library objects
 *
 * For each detected library .o file:
 * 1. Replaces/adds `o` entries in the .text region (replacing `c` entries)
 * 2. Adds `o` entries in the .rodata region for .rdata sections
 * 3. Adds `o` entries in the .data/.sdata regions for .data sections
 *
 * Idempotent: strips previous data/rdata patches and re-applies from scratch.
 * Text `o` entries are preserved across re-runs; missing ones are inserted.
 *
 * Usage:
 *   npx tsx tools/build/patchSplatForLibs.ts           # dry run
 *   npx tsx tools/build/patchSplatForLibs.ts --write   # update configs/splat.yaml
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Buffer } from "buffer";
import { loadPsxExeInfo, requireSectionLayout, ROOT } from "../lib/psxExeInfo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");
const _info = loadPsxExeInfo();
const _layout = requireSectionLayout();
const LOAD_ADDR = _info.loadAddr;
const PAYLOAD_OFFSET = _info.payloadOffset;
const DEFAULT_DATA_START = _layout.dataStart;
const SDATA_START = _layout.sdataStart;
const FILE_END = _info.fileEnd;

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

function vramToRom(vram: number): number {
  return vram - LOAD_ADDR + PAYLOAD_OFFSET;
}

function romHex(rom: number): string {
  return `0x${rom.toString(16).toUpperCase()}`;
}

function oSegPath(oPath: string): string {
  return "../" + oPath.replace(/\.o$/, "");
}

interface SectionEntry {
  rom: number;
  size: number;
  oPath: string;
  sectionArg: string;
}

/** Load function addresses from symbol_addrs.txt within a VRAM range */
function loadFuncAddrsInRange(
  vramStart: number,
  vramEnd: number
): { vram: number; name: string }[] {
  const symAddrsPath = join(ROOT, "configs/symbol_addrs.txt");
  const content = readFileSync(symAddrsPath, "utf-8");
  const funcs: { vram: number; name: string }[] = [];
  const re = /^(\w+)\s*=\s*(0x[0-9A-Fa-f]+)\s*;.*type:func/;
  for (const line of content.split("\n")) {
    const m = line.match(re);
    if (m) {
      const addr = parseInt(m[2], 16);
      if (addr >= vramStart && addr < vramEnd) {
        funcs.push({ vram: addr, name: m[1] });
      }
    }
  }
  return funcs.sort((a, b) => a.vram - b.vram);
}

/** Load ALL symbol names by VRAM address (not just type:func) */
function loadSymbolsByVram(): Map<number, string> {
  const symAddrsPath = join(ROOT, "configs/symbol_addrs.txt");
  const content = readFileSync(symAddrsPath, "utf-8");
  const map = new Map<number, string>();
  for (const line of content.split("\n")) {
    const m = line.match(/^(\w+)\s*=\s*(0x[0-9A-Fa-f]+)\s*;/);
    if (m) {
      map.set(parseInt(m[2], 16), m[1]);
    }
  }
  return map;
}

/**
 * Scan a MIPS binary for function boundaries within a ROM range.
 * Detects `jr $ra` (0x03E00008) + delay slot pattern.
 * Returns sorted list of function-start ROM offsets.
 */
function scanFuncBoundaries(
  binaryData: Buffer,
  romStart: number,
  romEnd: number
): number[] {
  const JR_RA = 0x03e00008;
  const starts: number[] = [romStart];

  for (let pos = romStart; pos < romEnd - 8; pos += 4) {
    const instr = binaryData.readUInt32LE(pos);
    if (instr === JR_RA) {
      // Next function starts after delay slot (pos + 8)
      const nextFunc = pos + 8;
      if (nextFunc < romEnd && nextFunc % 4 === 0) {
        starts.push(nextFunc);
      }
    }
  }

  return [...new Set(starts)].sort((a, b) => a - b);
}

/**
 * Interleave o entries within a region.
 */
function interleaveEntries(
  regionStart: number,
  regionEnd: number,
  regionType: string,
  entries: SectionEntry[],
  indent: string
): string[] {
  const sorted = [...entries].sort((a, b) => a.rom - b.rom);
  const lines: string[] = [];
  let cursor = regionStart;

  for (const entry of sorted) {
    if (entry.rom > cursor) {
      lines.push(`${indent}- [${romHex(cursor)}, ${regionType}]`);
    }
    lines.push(
      `${indent}- [${romHex(entry.rom)}, o, ${oSegPath(entry.oPath)}, ${entry.sectionArg}] # ${entry.oPath}`
    );
    cursor = entry.rom + entry.size;
  }

  if (cursor < regionEnd) {
    lines.push(`${indent}- [${romHex(cursor)}, ${regionType}]`);
  }

  return lines;
}

/**
 * Strip non-text library patches from the YAML.
 * Removes rdata/data/bss `o` entries and gap segments, restoring single
 * rodata/data/sdata region lines. Preserves text `o` entries.
 */
function stripNonTextPatches(lines: string[], dataRomStart: number, sdataRomStart: number): string[] {
  const result: string[] = [];
  const libONonTextRe =
    /^\s+- \[0x[0-9A-Fa-f]+,\s*o,\s*\.\.\/lib\/[^,]+,\s*\.\w+\]/;

  let seenRodata = false;
  let seenData = false;
  let seenSdata = false;

  for (const line of lines) {
    if (libONonTextRe.test(line)) continue;
    if (/# text-gap/.test(line)) continue;
    if (/^\s+- \[0x[0-9A-Fa-f]+, bss\]/i.test(line)) continue;
    if (/virtual BSS/.test(line)) {
      result.push(
        `  - [${romHex(FILE_END)}]  # End of file`
      );
      continue;
    }

    if (line.match(/^(\s+)- \[0x[0-9A-Fa-f]+, rodata\]/i)) {
      if (!seenRodata) {
        const indent = line.match(/^(\s+)/)?.[1] || "      ";
        result.push(`${indent}- [0x800, rodata]`);
        seenRodata = true;
      }
      continue;
    }

    if (line.match(/^(\s+)- \[0x[0-9A-Fa-f]+, data\]/i)) {
      if (!seenData) {
        const indent = line.match(/^(\s+)/)?.[1] || "      ";
        result.push(`${indent}- [${romHex(dataRomStart)}, data]`);
        seenData = true;
      }
      continue;
    }

    if (line.match(/^(\s+)- \[0x[0-9A-Fa-f]+, sdata\]/i)) {
      if (!seenSdata) {
        const indent = line.match(/^(\s+)/)?.[1] || "      ";
        result.push(`${indent}- [${romHex(sdataRomStart)}, sdata]`);
        seenSdata = true;
      }
      continue;
    }

    result.push(line);
  }

  return result;
}

/**
 * Parse all subsegment ROM offsets from YAML lines to build an ordered list.
 * Returns sorted array of {rom, lineIndex} for text region entries.
 */
function parseTextSegments(lines: string[]): {
  rom: number;
  lineIndex: number;
}[] {
  const entries: { rom: number; lineIndex: number }[] = [];
  const segRe = /^\s+- \[(0x[0-9A-Fa-f]+),\s*(?:c|o)/i;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(segRe);
    if (m) {
      const rom = parseInt(m[1], 16);
      // Only text region entries (between rodata end and data start)
      if (rom >= _layout.textStart && rom < DEFAULT_DATA_START) {
        entries.push({ rom, lineIndex: i });
      }
    }
  }

  return entries.sort((a, b) => a.rom - b.rom);
}

function main() {
  const writeMode = process.argv.includes("--write");

  // Run resolveLibSections.ts
  console.log("Running resolveLibSections.ts...");
  const sectionsOutput = execSync("npx tsx tools/build/resolveLibSections.ts", {
    encoding: "utf-8",
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });
  const libSections: LibSections[] = JSON.parse(sectionsOutput);
  console.log(`Got ${libSections.length} library matches with section info`);

  // Cache for patchLinkerBss.ts to avoid re-running detection
  mkdirSync(join(ROOT, "build"), { recursive: true });
  writeFileSync(
    join(ROOT, "build/libSections.json"),
    JSON.stringify(libSections, null, 2)
  );
  console.log("Cached section info to build/libSections.json");

  // Compute actual data section start: if any library .o's .text extends past
  // the default text/data boundary, push the boundary forward (aligned to 4).
  // This handles cases where a library object's .text spans into what was
  // originally classified as the data section.
  let DATA_ROM_START = DEFAULT_DATA_START;
  for (const s of libSections) {
    const textEnd = s.textRom + s.textSize;
    if (textEnd > DATA_ROM_START && textEnd <= SDATA_START) {
      DATA_ROM_START = (textEnd + 3) & ~3; // align to 4
    }
  }
  if (DATA_ROM_START !== DEFAULT_DATA_START) {
    console.log(`Adjusted data section start: 0x${DEFAULT_DATA_START.toString(16)} -> ${romHex(DATA_ROM_START)} (library .text extends past boundary)`);
  }

  // Build match structures
  const sortedMatches = libSections
    .map((s) => ({
      vramStart: s.textRom - PAYLOAD_OFFSET + LOAD_ADDR,
      vramEnd: s.textRom - PAYLOAD_OFFSET + LOAD_ADDR + s.textSize,
      oPath: s.oPath,
      textRom: s.textRom,
      textSize: s.textSize,
    }))
    .sort((a, b) => a.vramStart - b.vramStart);

  function findMatch(vram: number): (typeof sortedMatches)[0] | null {
    let lo = 0,
      hi = sortedMatches.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const m = sortedMatches[mid];
      if (vram < m.vramStart) hi = mid - 1;
      else if (vram >= m.vramEnd) lo = mid + 1;
      else return m;
    }
    return null;
  }

  // Collect data section entries
  const rdataEntries: SectionEntry[] = [];
  const dataEntries: SectionEntry[] = [];
  const sdataDataEntries: SectionEntry[] = [];

  for (const s of libSections) {
    if (s.rdataRom !== undefined && s.rdataSize !== undefined) {
      rdataEntries.push({
        rom: s.rdataRom,
        size: s.rdataSize,
        oPath: s.oPath,
        sectionArg: ".rdata",
      });
    }
    if (s.dataRom !== undefined && s.dataSize !== undefined) {
      const entry: SectionEntry = {
        rom: s.dataRom,
        size: s.dataSize,
        oPath: s.oPath,
        sectionArg: ".data",
      };
      if (s.dataRom >= SDATA_START) {
        sdataDataEntries.push(entry);
      } else {
        dataEntries.push(entry);
      }
    }
  }

  // Compute effective sdata start: if any data entry extends past SDATA_START,
  // push the sdata start forward to avoid overlap with the data assembly.
  let effectiveSdataStart = SDATA_START;
  for (const entry of dataEntries) {
    const entryEnd = entry.rom + entry.size;
    if (entryEnd > effectiveSdataStart) {
      effectiveSdataStart = (entryEnd + 3) & ~3; // align to 4
    }
  }
  if (effectiveSdataStart !== SDATA_START) {
    console.log(`Adjusted sdata start: 0x${SDATA_START.toString(16)} -> ${romHex(effectiveSdataStart)} (library .data extends past boundary)`);
  }

  const bssCount = libSections.filter((s) => s.bssVram !== undefined).length;
  console.log(
    `Sections: ${rdataEntries.length} rdata, ${dataEntries.length} data, ` +
      `${sdataDataEntries.length} sdata-data, ${bssCount} bss`
  );

  // Phase 1: Strip previous non-text patches
  const rawYaml = readFileSync(SPLAT_YAML, "utf-8");
  const stripped = stripNonTextPatches(rawYaml.split("\n"), DATA_ROM_START, effectiveSdataStart);
  console.log(
    `Strip: ${rawYaml.split("\n").length} -> ${stripped.length} lines`
  );

  // Phase 2: Handle text region
  // Strategy: walk through lines, replacing `c` entries in library ranges with `o`,
  // and inserting `o` entries for libraries that have no corresponding `c` entry.
  const rodataLineRe = /^(\s+)- \[0x800, rodata\]/;
  const dataLineRe = /^(\s+)- \[0x[0-9A-Fa-f]+, data\]/;
  const sdataLineRe = /^(\s+)- \[0x[0-9A-Fa-f]+, sdata\]/i;
  const subsegRe =
    /^(\s+- \[)(0x[0-9A-Fa-f]+)(,\s*)(c|o)(,\s*)([^\]]+)\](.*)$/;
  const textORe =
    /^\s+- \[(0x[0-9A-Fa-f]+),\s*o,\s*(\.\.\/lib\/[^\]]+)\]/;

  // Build set of library text ROM ranges to know which c entries to replace
  const libTextRanges = sortedMatches.map((m) => ({
    romStart: m.textRom,
    romEnd: m.textRom + m.textSize,
    oPath: m.oPath,
  }));

  // Build a set of libraries that already have text o entries
  const existingTextO = new Set<string>();
  for (const line of stripped) {
    const m = line.match(textORe);
    if (m) {
      const pathStr = m[2].trim();
      // ../lib/libmath/adddf3 -> lib/libmath/adddf3.o
      const oPath = pathStr.replace("../", "") + ".o";
      existingTextO.add(oPath);
    }
  }
  console.log(`Existing text o entries: ${existingTextO.size}`);

  // Libraries that need text o entries inserted (new or relocated)
  const needTextInsert = sortedMatches.filter(
    (m) => !existingTextO.has(m.oPath)
  );
  console.log(`Libraries needing text o insertion: ${needTextInsert.length}`);

  // Build insertion map: for each needed library, determine where to insert
  // (just before the first c entry at or after the library's text ROM)
  // Actually, we'll handle this during the line-by-line pass.

  const newLines: string[] = [];
  const placed = new Set<string>();
  let replacedCount = 0;
  let removedCount = 0;
  let insertedCount = 0;
  let keptTextO = 0;
  let rdataPatched = false;
  let dataPatched = false;
  let sdataPatched = false;

  // Sort needed insertions by ROM offset for insertion during walk
  const pendingInserts = [...needTextInsert].sort(
    (a, b) => a.textRom - b.textRom
  );
  let insertIdx = 0;

  for (const line of stripped) {
    // === Rodata region ===
    if (!rdataPatched && rodataLineRe.test(line)) {
      const indent = line.match(rodataLineRe)![1];
      let rodataEnd = _layout.textStart;
      const lineIdx = stripped.indexOf(line);
      for (let j = lineIdx + 1; j < stripped.length; j++) {
        const rm = stripped[j].match(/- \[(0x[0-9A-Fa-f]+),\s*(?:c|o)/i);
        if (rm) {
          rodataEnd = parseInt(rm[1], 16);
          break;
        }
      }
      if (rdataEntries.length > 0) {
        newLines.push(
          ...interleaveEntries(0x800, rodataEnd, "rodata", rdataEntries, indent)
        );
      } else {
        newLines.push(line);
      }
      rdataPatched = true;
      continue;
    }

    // === Data region ===
    if (!dataPatched && dataLineRe.test(line)) {
      const indent = line.match(dataLineRe)![1];
      if (dataEntries.length > 0) {
        newLines.push(
          ...interleaveEntries(
            DATA_ROM_START,
            effectiveSdataStart,
            "data",
            dataEntries,
            indent
          )
        );
      } else {
        newLines.push(line);
      }
      dataPatched = true;
      continue;
    }

    // === Sdata region ===
    if (!sdataPatched && sdataLineRe.test(line)) {
      const indent = line.match(sdataLineRe)![1];
      if (sdataDataEntries.length > 0) {
        newLines.push(
          ...interleaveEntries(
            effectiveSdataStart,
            FILE_END,
            "sdata",
            sdataDataEntries,
            indent
          )
        );
      } else {
        // Even if no sdata entries, emit the sdata line with adjusted start
        newLines.push(`${indent}- [${romHex(effectiveSdataStart)}, sdata]`);
      }
      sdataPatched = true;
      continue;
    }

    // === Text region: handle c entries and text o entries ===
    // Check if we need to insert any library o entries before this line
    const lineRomMatch = line.match(
      /^\s+- \[(0x[0-9A-Fa-f]+),\s*(?:c|o)/i
    );
    if (lineRomMatch) {
      const lineRom = parseInt(lineRomMatch[1], 16);
      // Insert any pending library o entries that come before this ROM offset
      while (
        insertIdx < pendingInserts.length &&
        pendingInserts[insertIdx].textRom <= lineRom
      ) {
        const ins = pendingInserts[insertIdx];
        if (!placed.has(ins.oPath)) {
          placed.add(ins.oPath);
          const oPath = oSegPath(ins.oPath);
          const comment = ` # ${ins.oPath}`;
          newLines.push(
            `      - [${romHex(ins.textRom)}, o, ${oPath}]${comment}`
          );
          insertedCount++;
        }
        insertIdx++;
      }
    }

    // Keep existing text o entries (unless excluded, stale, or no longer in detection results)
    const textOMatch = line.match(textORe);
    if (textOMatch) {
      const pathStr = textOMatch[2].trim();
      const oPath = pathStr.replace("../", "") + ".o";
      // Remove stale o entries not in current detection results
      const validOPaths = new Set(sortedMatches.map((m) => m.oPath));
      if (!validOPaths.has(oPath)) {
        console.log(`Removing stale o entry: ${oPath}`);
        removedCount++;
        continue;
      }
      newLines.push(line);
      placed.add(oPath);
      keptTextO++;
      continue;
    }

    // Handle c entries
    const m = line.match(subsegRe);
    if (m && m[4] === "c") {
      const romOffset = parseInt(m[2], 16);
      const vram = romOffset - PAYLOAD_OFFSET + LOAD_ADDR;
      const libMatch = findMatch(vram);

      if (libMatch) {
        if (!placed.has(libMatch.oPath)) {
          placed.add(libMatch.oPath);
          const oPath = oSegPath(libMatch.oPath);
          const romStr = romHex(libMatch.textRom);
          const comment = ` # ${libMatch.oPath}`;
          newLines.push(
            `${m[1]}${romStr}${m[3]}o${m[5]}${oPath}]${comment}`
          );
          replacedCount++;
        } else {
          removedCount++;
        }
        continue;
      }
    }

    newLines.push(line);
  }

  // Insert any remaining pending entries at the end of text region
  while (insertIdx < pendingInserts.length) {
    const ins = pendingInserts[insertIdx];
    if (!placed.has(ins.oPath)) {
      placed.add(ins.oPath);
      const oPath = oSegPath(ins.oPath);
      const comment = ` # ${ins.oPath}`;
      newLines.push(
        `      - [${romHex(ins.textRom)}, o, ${oPath}]${comment}`
      );
      insertedCount++;
    }
    insertIdx++;
  }

  console.log(
    `\nText: ${replacedCount} replaced, ${removedCount} removed, ` +
      `${keptTextO} kept, ${insertedCount} inserted`
  );

  // === Phase: Fill text-region gaps with per-function c entries ===
  // Strategy: keep ALL existing c entries (they have correct boundaries from
  // the disassembler). Only ADD new c entries for addresses that fall in gaps
  // between o entries and existing c entries. Scan binary for function
  // boundaries within those true gaps.
  const binaryData = readFileSync(_info.binaryPath);

  // Load all symbols by VRAM address for name lookups
  const symbolsByVram = loadSymbolsByVram();

  const TEXT_ROM_START = _layout.textStart;
  const TEXT_ROM_END = DATA_ROM_START;
  const textGapComment = "# text-gap";

  // Strip old text-gap entries for idempotency, collect existing segment ROMs
  const textSegRe = /^\s+- \[(0x[0-9A-Fa-f]+),\s*(c|o)/i;
  const cSegNameRe = /^\s+- \[0x[0-9A-Fa-f]+,\s*c,\s*(\S+)\]/;
  const cleanedLines: string[] = [];
  const existingSegRoms = new Set<number>();
  // Track c segment names by VRAM so we don't create conflicting func_XXXX symbols
  const existingSegNames = new Map<number, string>();

  for (const line of newLines) {
    if (line.includes(textGapComment)) continue; // remove old gap entries
    cleanedLines.push(line);

    const m = line.match(textSegRe);
    if (m) {
      const rom = parseInt(m[1], 16);
      if (rom >= TEXT_ROM_START && rom < TEXT_ROM_END) {
        existingSegRoms.add(rom);
        const cm = line.match(cSegNameRe);
        if (cm) {
          const vram = rom - PAYLOAD_OFFSET + LOAD_ADDR;
          existingSegNames.set(vram, cm[1]);
        }
      }
    }
  }

  // Build merged o coverage: merge overlapping/adjacent ranges
  const rawORanges: { start: number; end: number }[] = [];
  for (const s of libSections) {
    rawORanges.push({ start: s.textRom, end: s.textRom + s.textSize });
  }
  rawORanges.sort((a, b) => a.start - b.start);

  const mergedORanges: { start: number; end: number }[] = [];
  for (const r of rawORanges) {
    if (r.start < TEXT_ROM_START || r.start >= TEXT_ROM_END) continue;
    const last = mergedORanges[mergedORanges.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      mergedORanges.push({ start: r.start, end: r.end });
    }
  }

  // Find gaps BETWEEN consecutive merged o ranges only.
  // Do NOT include the game code region before the first o range or after the
  // last o range — splat already handles function boundaries there.
  // Text-gap filling is only needed for unaccounted-for functions that exist
  // between adjacent library objects (e.g., functions from undetected .o files).
  const trueGaps: { start: number; end: number }[] = [];
  for (let gi = 1; gi < mergedORanges.length; gi++) {
    const prevEnd = mergedORanges[gi - 1].end;
    const nextStart = mergedORanges[gi].start;
    if (nextStart > prevEnd) {
      trueGaps.push({ start: prevEnd, end: nextStart });
    }
  }

  // Scan the ENTIRE text region for function boundaries to populate symbol_addrs.txt.
  // Splat needs symbols for all functions it discovers via disassembly, even if
  // they're sub-functions inside a parent c segment (e.g., switch cases, helpers).
  // Without these symbols, splat assertions fail.
  const newSymbols: { name: string; vram: number }[] = [];
  {
    const allFuncRoms = scanFuncBoundaries(binaryData, TEXT_ROM_START, TEXT_ROM_END);
    for (const fRom of allFuncRoms) {
      const vram = fRom - PAYLOAD_OFFSET + LOAD_ADDR;
      // Skip addresses already in symbol_addrs.txt
      if (symbolsByVram.has(vram)) continue;
      // Skip addresses inside o ranges (library objects handle their own symbols)
      const inO = mergedORanges.some((r) => fRom >= r.start && fRom < r.end);
      if (!inO) {
        const name = `func_${vram.toString(16).toUpperCase()}`;
        newSymbols.push({ name, vram });
        symbolsByVram.set(vram, name);
      }
    }
  }

  // Create c entries and src files ONLY for gaps between library objects.
  // Game code functions are handled by splat's normal segment splitting.
  const gapFuncEntries: { rom: number; name: string }[] = [];
  const newSourceFiles: { name: string }[] = [];

  // Add c entries for type:func symbols across the full text region that
  // don't have c segments yet. This handles game-code functions that were
  // discovered by previous runs and exist in symbol_addrs.txt.
  const allTypeFuncSymbols = loadFuncAddrsInRange(
    TEXT_ROM_START - PAYLOAD_OFFSET + LOAD_ADDR,
    TEXT_ROM_END - PAYLOAD_OFFSET + LOAD_ADDR
  );
  for (const sym of allTypeFuncSymbols) {
    const rom = vramToRom(sym.vram);
    if (existingSegRoms.has(rom)) continue;
    const inO = mergedORanges.some((r) => rom >= r.start && rom < r.end);
    if (inO) continue;
    gapFuncEntries.push({ rom, name: sym.name });
    const srcPath = join(ROOT, "src", `${sym.name}.c`);
    if (!existsSync(srcPath)) {
      newSourceFiles.push({ name: sym.name });
    }
  }

  // In gaps between library objects, also scan for function boundaries
  // (binary scan for jr $ra patterns) to find new functions.
  for (const gap of trueGaps) {
    const funcRoms = scanFuncBoundaries(binaryData, gap.start, gap.end);
    for (const fRom of funcRoms) {
      if (existingSegRoms.has(fRom)) continue;
      if (gapFuncEntries.some((e) => e.rom === fRom)) continue;

      const vram = fRom - PAYLOAD_OFFSET + LOAD_ADDR;
      const name = symbolsByVram.get(vram) || `func_${vram.toString(16).toUpperCase()}`;

      gapFuncEntries.push({ rom: fRom, name });

      if (!symbolsByVram.has(vram)) {
        newSymbols.push({ name, vram });
      }

      const srcPath = join(ROOT, "src", `${name}.c`);
      if (!existsSync(srcPath)) {
        newSourceFiles.push({ name });
      }
    }
  }

  // Sort gap entries by ROM for insertion
  gapFuncEntries.sort((a, b) => a.rom - b.rom);

  // Build a set of ROMs that fall within true gaps (between library objects)
  // to distinguish text-gap entries from game-code split entries
  const inTrueGap = (rom: number): boolean =>
    trueGaps.some((g) => rom >= g.start && rom < g.end);

  // Insert gap entries into cleanedLines at correct positions
  const finalLines: string[] = [];
  let gapIdx = 0;

  for (const line of cleanedLines) {
    // Before each segment line, insert any gap entries that come before it
    const m = line.match(/^\s+- \[(0x[0-9A-Fa-f]+)/);
    if (m) {
      const lineRom = parseInt(m[1], 16);
      while (gapIdx < gapFuncEntries.length && gapFuncEntries[gapIdx].rom < lineRom) {
        const entry = gapFuncEntries[gapIdx++];
        const comment = inTrueGap(entry.rom) ? `       ${textGapComment}` : "";
        finalLines.push(
          `      - [${romHex(entry.rom)}, c, ${entry.name}]${comment}`
        );
      }
    }
    finalLines.push(line);
  }

  // Append any remaining gap entries
  while (gapIdx < gapFuncEntries.length) {
    const entry = gapFuncEntries[gapIdx++];
    const comment = inTrueGap(entry.rom) ? `       ${textGapComment}` : "";
    finalLines.push(
      `      - [${romHex(entry.rom)}, c, ${entry.name}]${comment}`
    );
  }

  newLines.length = 0;
  newLines.push(...finalLines);

  if (gapFuncEntries.length > 0) {
    console.log(
      `Text gaps filled: ${gapFuncEntries.length} new c entries across ${trueGaps.length} gap(s)`
    );
  }

  if (!writeMode) {
    console.log("\nDry run. Run with --write to update configs/splat.yaml");
    return;
  }

  writeFileSync(SPLAT_YAML, newLines.join("\n"));
  console.log(`\nUpdated ${SPLAT_YAML}`);

  // Update symbol_addrs.txt with new type:func entries
  if (newSymbols.length > 0) {
    const symAddrsPath = join(ROOT, "configs/symbol_addrs.txt");
    let symContent = readFileSync(symAddrsPath, "utf-8");
    const symLines = symContent.split("\n");

    // Build set of existing addresses to avoid duplicates
    const existingAddrs = new Set<number>();
    for (const line of symLines) {
      const m = line.match(/=\s*0x([0-9A-Fa-f]+)/);
      if (m) existingAddrs.add(parseInt(m[1], 16));
    }

    let addedCount = 0;
    for (const { name, vram } of newSymbols) {
      if (existingAddrs.has(vram)) continue; // skip duplicates
      existingAddrs.add(vram);

      const addrHex = `0x${vram.toString(16).toUpperCase()}`;
      const newLine = `${name} = ${addrHex}; // type:func`;

      // Insert in sorted position by address
      let inserted = false;
      for (let i = 0; i < symLines.length; i++) {
        const m = symLines[i].match(/=\s*0x([0-9A-Fa-f]+)/);
        if (m && parseInt(m[1], 16) > vram) {
          symLines.splice(i, 0, newLine);
          inserted = true;
          break;
        }
      }
      if (!inserted) symLines.push(newLine);
      addedCount++;
    }

    if (addedCount > 0) {
      writeFileSync(symAddrsPath, symLines.join("\n"));
      console.log(`Added ${addedCount} new symbols to symbol_addrs.txt`);
    }
  }

  // Also ensure existing symbols used in gaps have type:func
  {
    const symAddrsPath = join(ROOT, "configs/symbol_addrs.txt");
    let symContent = readFileSync(symAddrsPath, "utf-8");
    let updatedCount = 0;

    for (const gap of trueGaps) {
      const funcRoms = scanFuncBoundaries(binaryData, gap.start, gap.end);
      for (const fRom of funcRoms) {
        const vram = fRom - PAYLOAD_OFFSET + LOAD_ADDR;
        const name = symbolsByVram.get(vram);
        if (!name) continue;

        const addrHex = `0x${vram.toString(16).toUpperCase()}`;
        // Find the line and ensure it has type:func
        const lineRe = new RegExp(
          `^(${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*${addrHex}\\s*;)(.*)$`,
          "m"
        );
        const match = symContent.match(lineRe);
        if (match && !match[2].includes("type:func")) {
          const existing = match[0].trimEnd();
          if (existing.includes("//")) {
            symContent = symContent.replace(existing, `${existing} type:func`);
          } else {
            symContent = symContent.replace(
              existing,
              `${existing} // type:func`
            );
          }
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      writeFileSync(symAddrsPath, symContent);
      console.log(
        `Updated ${updatedCount} existing symbols with type:func`
      );
    }
  }

  // Create source files for gap functions
  if (newSourceFiles.length > 0) {
    const srcDir = join(ROOT, "src");
    for (const { name } of newSourceFiles) {
      const srcPath = join(srcDir, `${name}.c`);
      const content = [
        '#include "common.h"',
        '#include "include_asm.h"',
        "",
        `INCLUDE_ASM("build/asm/nonmatchings/${name}", ${name});`,
        "",
      ].join("\n");
      writeFileSync(srcPath, content);
    }
    console.log(`Created ${newSourceFiles.length} source files`);
  }

  // === Phase: Remove orphaned source files ===
  // The Makefile compiles ALL src/*.c files. Source files for functions now
  // covered by `o` segments will fail to compile (no nonmatchings dir).
  // Collect all `c` segment names from the final YAML.
  const cSegNames = new Set<string>();
  const cSegRe = /^\s+- \[0x[0-9A-Fa-f]+,\s*c,\s*(\S+)\]/;
  for (const line of newLines) {
    const m = line.match(cSegRe);
    if (m) cSegNames.add(m[1]);
  }

  const srcFiles = readdirSync(join(ROOT, "src")).filter((f) =>
    f.endsWith(".c")
  );

  // Map VRAM -> c-segment name so renamed functions (e.g. func_80019FAC ->
  // GetPairedTpage) can have their real source MIGRATED to the new file name
  // instead of deleted (splat would otherwise scaffold an INCLUDE_ASM stub,
  // silently regressing a matched decompilation).
  const vramToCName = new Map<number, string>();
  const symLines = readFileSync(join(ROOT, "configs/symbol_addrs.txt"), "utf-8").split("\n");
  for (const line of symLines) {
    const m = line.match(/^(\S+)\s*=\s*(0x[0-9A-Fa-f]+);\s*\/\/\s*type:func/);
    if (m && cSegNames.has(m[1])) {
      vramToCName.set(parseInt(m[2], 16), m[1]);
    }
  }

  let removedSrcCount = 0;
  let migratedSrcCount = 0;
  let keptSrcCount = 0;
  for (const f of srcFiles) {
    const name = f.replace(/\.c$/, "");
    if (cSegNames.has(name)) continue;

    const srcPath = join(ROOT, "src", f);
    const content = readFileSync(srcPath, "utf-8");

    // INCLUDE_ASM stubs are regenerable by splat -- always safe to remove.
    if (content.includes("INCLUDE_ASM(")) {
      unlinkSync(srcPath);
      removedSrcCount++;
      continue;
    }

    // Real source: never delete it. A func_<VRAM> orphan whose address still
    // has a c segment under another name is a rename -- migrate the content.
    const funcMatch = name.match(/^func_([0-9A-Fa-f]{8})$/);
    const renameTarget = funcMatch
      ? vramToCName.get(parseInt(funcMatch[1], 16))
      : undefined;
    if (renameTarget) {
      const newPath = join(ROOT, "src", `${renameTarget}.c`);
      const targetContent = existsSync(newPath) ? readFileSync(newPath, "utf-8") : "";
      if (targetContent && !targetContent.includes("INCLUDE_ASM(")) {
        keptSrcCount++;
        console.log(
          `WARNING: keeping ${f}; rename target ${renameTarget}.c already exists with real source`
        );
      } else {
        writeFileSync(newPath, content.replace(new RegExp(name, "g"), renameTarget));
        unlinkSync(srcPath);
        migratedSrcCount++;
        console.log(`Migrated renamed source ${f} -> ${renameTarget}.c`);
      }
    } else {
      keptSrcCount++;
      console.log(
        `WARNING: keeping orphaned non-stub source ${f} (no c segment named ${name}; refusing to delete real source)`
      );
    }
  }

  if (removedSrcCount > 0) {
    console.log(
      `Removed ${removedSrcCount} orphaned stub source files (covered by o segments)`
    );
  }
  if (migratedSrcCount > 0) {
    console.log(`Migrated ${migratedSrcCount} renamed source file(s)`);
  }
  if (keptSrcCount > 0) {
    console.log(
      `Kept ${keptSrcCount} orphaned non-stub source file(s) -- resolve manually`
    );
  }

}

main();
