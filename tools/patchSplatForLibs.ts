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
 *   npx tsx tools/patchSplatForLibs.ts           # dry run
 *   npx tsx tools/patchSplatForLibs.ts --write   # update configs/splat.yaml
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");
const LOAD_ADDR = 0x80010000;
const PAYLOAD_OFFSET = 0x800;
const SDATA_START = 0x4dbd8;
const FILE_END = 0x4f000;

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
function stripNonTextPatches(lines: string[]): string[] {
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
        `  - [0x4F000]  # End of file (0x800 header + 0x4E800 payload)`
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
        result.push(`${indent}- [0x38990, data]`);
        seenData = true;
      }
      continue;
    }

    if (line.match(/^(\s+)- \[0x[0-9A-Fa-f]+, sdata\]/i)) {
      if (!seenSdata) {
        const indent = line.match(/^(\s+)/)?.[1] || "      ";
        result.push(`${indent}- [${romHex(SDATA_START)}, sdata]`);
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
      if (rom >= 0x1a70 && rom < 0x38990) {
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
  const sectionsOutput = execSync("npx tsx tools/resolveLibSections.ts", {
    encoding: "utf-8",
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });
  const libSectionsRaw: LibSections[] = JSON.parse(sectionsOutput);
  // Exclude known false positives from library detection
  const EXCLUDE_OFILES = new Set([
    "lib/libgpu/font.o", // different SDK version — .data/.rdata/.text don't match binary
  ]);
  const libSections = libSectionsRaw.filter((s) => !EXCLUDE_OFILES.has(s.oPath));
  console.log(`Got ${libSections.length} library matches with section info (excluded ${libSectionsRaw.length - libSections.length})`);

  // Cache for patchLinkerBss.ts to avoid re-running detection
  mkdirSync(join(ROOT, "build"), { recursive: true });
  writeFileSync(
    join(ROOT, "build/libSections.json"),
    JSON.stringify(libSections, null, 2)
  );
  console.log("Cached section info to build/libSections.json");

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

  const bssCount = libSections.filter((s) => s.bssVram !== undefined).length;
  console.log(
    `Sections: ${rdataEntries.length} rdata, ${dataEntries.length} data, ` +
      `${sdataDataEntries.length} sdata-data, ${bssCount} bss`
  );

  // Phase 1: Strip previous non-text patches
  const rawYaml = readFileSync(SPLAT_YAML, "utf-8");
  const stripped = stripNonTextPatches(rawYaml.split("\n"));
  console.log(
    `Strip: ${rawYaml.split("\n").length} -> ${stripped.length} lines`
  );

  // Phase 2: Handle text region
  // Strategy: walk through lines, replacing `c` entries in library ranges with `o`,
  // and inserting `o` entries for libraries that have no corresponding `c` entry.
  const rodataLineRe = /^(\s+)- \[0x800, rodata\]/;
  const dataLineRe = /^(\s+)- \[0x38990, data\]/;
  const sdataLineRe = /^(\s+)- \[0x4DBD8, sdata\]/i;
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
      let rodataEnd = 0x1a70;
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
            0x38990,
            SDATA_START,
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
            SDATA_START,
            FILE_END,
            "sdata",
            sdataDataEntries,
            indent
          )
        );
      } else {
        newLines.push(line);
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

    // Keep existing text o entries (unless excluded or stale)
    const textOMatch = line.match(textORe);
    if (textOMatch) {
      const pathStr = textOMatch[2].trim();
      const oPath = pathStr.replace("../", "") + ".o";
      if (EXCLUDE_OFILES.has(oPath)) {
        // Replace excluded o entry with c entries using .o function boundaries
        const entryRom = parseInt(textOMatch[1], 16);
        const excludedMatch = libSectionsRaw.find((s) => s.oPath === oPath);
        if (excludedMatch) {
          const vramStart = entryRom - PAYLOAD_OFFSET + LOAD_ADDR;
          const vramEnd = vramStart + excludedMatch.textSize;
          const funcAddrs = loadFuncAddrsInRange(vramStart, vramEnd);
          for (const fa of funcAddrs) {
            const fRom = fa.vram - LOAD_ADDR + PAYLOAD_OFFSET;
            newLines.push(`      - [0x${fRom.toString(16).toUpperCase()}, c, ${fa.name}]`);
          }
          console.log(`Replaced excluded ${oPath} with ${funcAddrs.length} c entries`);
        }
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

  // === Phase: Fill text-region gaps after o entries ===
  // Build a map from textRom -> textSize for all library .o entries
  const textSizeMap = new Map<number, number>();
  for (const s of libSections) {
    textSizeMap.set(s.textRom, s.textSize);
  }

  // Parse text segments from newLines to find gaps
  const textSegRe = /^\s+- \[(0x[0-9A-Fa-f]+),\s*(c|o)/i;
  const textGapComment = "# text-gap";

  // Collect text-region entries with their line indices
  const textSegs: { rom: number; type: string; lineIdx: number }[] = [];
  for (let i = 0; i < newLines.length; i++) {
    // Skip existing text-gap entries (for idempotency)
    if (newLines[i].includes(textGapComment)) continue;
    const m = newLines[i].match(textSegRe);
    if (m) {
      const rom = parseInt(m[1], 16);
      if (rom >= 0x1a70 && rom < 0x38990) {
        textSegs.push({ rom, type: m[2], lineIdx: i });
      }
    }
  }
  textSegs.sort((a, b) => a.rom - b.rom);

  // Find gaps: for each o entry, check if its end < next entry's start
  const gapInserts: { afterLineIdx: number; rom: number }[] = [];
  for (let i = 0; i < textSegs.length; i++) {
    const seg = textSegs[i];
    if (seg.type !== "o") continue;

    const textSize = textSizeMap.get(seg.rom);
    if (textSize === undefined) continue;

    const oEnd = seg.rom + textSize;
    const nextRom = i + 1 < textSegs.length ? textSegs[i + 1].rom : 0x38990;

    if (oEnd < nextRom) {
      gapInserts.push({ afterLineIdx: seg.lineIdx, rom: oEnd });
    }
  }

  // Insert gap c entries (insert from bottom up to preserve line indices)
  gapInserts.sort((a, b) => b.afterLineIdx - a.afterLineIdx);
  let gapCount = 0;
  for (const gap of gapInserts) {
    const vram = gap.rom - PAYLOAD_OFFSET + LOAD_ADDR;
    const vramHex = vram.toString(16).toUpperCase();
    const gapLine = `      - [${romHex(gap.rom)}, c, func_${vramHex}]       ${textGapComment}`;
    newLines.splice(gap.afterLineIdx + 1, 0, gapLine);
    gapCount++;
  }

  if (gapCount > 0) {
    console.log(`Text gaps filled: ${gapCount} c entries inserted`);
  }

  if (!writeMode) {
    console.log("\nDry run. Run with --write to update configs/splat.yaml");
    return;
  }

  writeFileSync(SPLAT_YAML, newLines.join("\n"));
  console.log(`\nUpdated ${SPLAT_YAML}`);

}

main();
