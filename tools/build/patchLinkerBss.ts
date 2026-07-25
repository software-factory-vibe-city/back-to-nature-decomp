/**
 * patchLinkerBss.ts — Add library .bss entries to the generated linker script
 *
 * Splat can't handle library BSS entries in the YAML (virtual ROM offsets are
 * past file end). This tool patches the generated linker script to add
 * lib/xxx.o(.bss) entries in the BSS section, ordered by their VRAM addresses.
 *
 * Reads cached section info from build/libSections.json (written by patchSplatForLibs.ts).
 *
 * Usage:
 *   npx tsx tools/build/patchLinkerBss.ts           # dry run
 *   npx tsx tools/build/patchLinkerBss.ts --write   # update build/slus_011.ld
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { requireSectionLayout, ROOT } from "../lib/psxExeInfo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const _layout = requireSectionLayout();
const LD_SCRIPT = join(ROOT, "build", "slus_011.ld");
const CACHE_PATH = join(ROOT, "build/libSections.json");

interface LibSections {
  oPath: string;
  textRom: number;
  textSize: number;
  dataRom?: number;
  dataSize?: number;
  bssVram?: number;
  bssSize?: number;
}

const SDATA_ROM_START = _layout.sdataStart;

function main() {
  const writeMode = process.argv.includes("--write");

  // Read cached section info, or run resolveLibSections if not available
  let libSections: LibSections[];
  if (existsSync(CACHE_PATH)) {
    console.log("Reading cached section info from build/libSections.json");
    libSections = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
  } else {
    console.log("Running resolveLibSections.ts (no cache found)...");
    const output = execSync("npx tsx tools/build/resolveLibSections.ts", {
      encoding: "utf-8",
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    libSections = JSON.parse(output);
  }

  // Read linker script
  const ldContent = readFileSync(LD_SCRIPT, "utf-8");

  // Collect BSS entries sorted by VRAM
  const bssEntries = libSections
    .filter((s) => s.bssVram !== undefined && s.bssSize !== undefined)
    .map((s) => ({
      oPath: s.oPath,
      vram: s.bssVram!,
      size: s.bssSize!,
    }))
    .sort((a, b) => a.vram - b.vram);

  console.log(`Found ${bssEntries.length} library BSS entries`);
  if (bssEntries.length === 0) return;
  const lines = ldContent.split("\n");

  // Find BSS markers
  const bssStartIdx = lines.findIndex((l) => l.includes("main_BSS_START"));
  if (bssStartIdx === -1) {
    console.error("Could not find main_BSS_START in linker script");
    process.exit(1);
  }

  const bssEndIdx = lines.findIndex((l) => l.includes("main_BSS_END"));

  // Strip any existing lib BSS entries (idempotent re-runs)
  // Remove individual lib BSS lines and the entire .lib_bss section block
  const strippedLines: string[] = [];
  let inLibBssSection = false;
  for (const l of lines) {
    if (l.includes("Library BSS entries (added by patchLinkerBss.ts)")) continue;
    if (l.match(/^\s+\.lib_bss\s/)) { inLibBssSection = true; continue; }
    if (inLibBssSection) {
      if (l.trim() === "}") { inLibBssSection = false; continue; }
      continue; // skip contents of .lib_bss section
    }
    if (l.includes("lib/") && l.includes(".bss")) continue;
    if (l.match(/^\s+\. = 0x[0-9A-Fa-f]+;\s*\/\* lib BSS/)) continue;
    strippedLines.push(l);
  }

  // The original PSX linker (PSYLINK) allocated each BSS symbol independently,
  // not as contiguous blocks per .o. GNU ld places the entire .o(.bss) as one block.
  // Strategy: place .o(.bss) in a NOLOAD section (for local symbol resolution),
  // then override global BSS symbols with exact addresses extracted from the original.

  // Run extractBssSymAddrs.ts to get exact global BSS addresses from the original binary
  const bssSymsPath = join(ROOT, "build/lib_bss_syms.txt");
  console.log("Extracting BSS symbol addresses from original binary...");
  const bssSymsOutput = execSync("npx tsx tools/build/extractBssSymAddrs.ts", {
    encoding: "utf-8",
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });
  writeFileSync(bssSymsPath, bssSymsOutput);
  const bssSymCount = bssSymsOutput.trim().split("\n").length;
  console.log(`Wrote ${bssSymCount} BSS symbol definitions to build/lib_bss_syms.txt`);

  // Create a NOLOAD section for library BSS (provides storage for local symbols)
  const libBssSection: string[] = [];
  if (bssEntries.length > 0) {
    const startVram = `0x${bssEntries[0].vram.toString(16).toUpperCase()}`;
    libBssSection.push(``);
    libBssSection.push(`    /* Library BSS entries (added by patchLinkerBss.ts) */`);
    libBssSection.push(`    .lib_bss ${startVram} (NOLOAD) : SUBALIGN(4)`);
    libBssSection.push(`    {`);
    for (const e of bssEntries) {
      libBssSection.push(`        ${e.oPath}(.bss);`);
    }
    libBssSection.push(`    }`);
  }

  const newLines = [...strippedLines];

  // Insert the lib_bss section after main_VRAM_END (after .main section closes)
  const mainRomEndIdx = newLines.findIndex((l) => l.includes("main_ROM_END"));
  if (mainRomEndIdx === -1) {
    console.error("Could not find main_ROM_END in linker script");
    process.exit(1);
  }
  const mainVramEndIdx = newLines.findIndex((l, i) => i >= mainRomEndIdx && l.includes("main_VRAM_END"));
  const insertAfter = mainVramEndIdx !== -1 ? mainVramEndIdx : mainRomEndIdx;
  newLines.splice(insertAfter + 1, 0, ...libBssSection);

  // The INCLUDE for lib_bss_syms.txt is added by the Makefile after this script runs.

  console.log(`Library BSS: ${bssEntries.length} .o entries in NOLOAD section, ${bssSymCount} global symbols overridden`);

  // === Move sdata-region library .data entries from data section to sdata section ===
  // Library .o files with dataRom in the sdata ROM range have their .data placed
  // by splat in the data output section. They need to be in the sdata output section.
  const sdataLibs = new Set<string>();
  for (const s of libSections) {
    if (s.dataRom !== undefined && s.dataRom >= SDATA_ROM_START) {
      sdataLibs.add(s.oPath);
    }
  }

  if (sdataLibs.size > 0) {
    // Find and remove these entries from the data section
    const sdataLibLines: string[] = [];
    const filteredLines: string[] = [];
    const libDataRe = /^\s+(lib\/\S+\.o)\(\.data\);/;

    for (const line of newLines) {
      const m = line.match(libDataRe);
      if (m && sdataLibs.has(m[1])) {
        sdataLibLines.push(line);
      } else {
        filteredLines.push(line);
      }
    }

    if (sdataLibLines.length > 0) {
      // Insert them in the sdata section, before the first sdata asm entry
      const sdataStartIdx = filteredLines.findIndex((l) => l.includes("main_SDATA_START"));
      if (sdataStartIdx !== -1) {
        // Find the right position: interleave with sdata asm entries by ROM order
        // For now, insert them right after SDATA_START
        // We need to interleave based on dataRom ordering
        const sdataEntries = libSections
          .filter((s) => s.dataRom !== undefined && s.dataRom >= SDATA_ROM_START)
          .sort((a, b) => a.dataRom! - b.dataRom!);

        // Build insertion map: for each sdata asm entry, check if lib entries go before it
        const sdataAsmRe = /build\/asm\/data\/([0-9A-Fa-f]+)\.sdata\.s\.o/;
        const insertions: { afterIdx: number; lines: string[] }[] = [];
        let lastSdataAsmIdx = sdataStartIdx;

        // Find all sdata asm entries and their positions
        const sdataAsmEntries: { idx: number; rom: number }[] = [];
        for (let i = sdataStartIdx + 1; i < filteredLines.length; i++) {
          const am = filteredLines[i].match(sdataAsmRe);
          if (am) {
            sdataAsmEntries.push({ idx: i, rom: parseInt(am[1], 16) });
          }
          if (filteredLines[i].includes("main_SDATA_END")) break;
        }

        // For each sdata asm entry, insert lib entries that come after it (by ROM)
        // and before the next sdata asm entry
        for (let i = 0; i < sdataAsmEntries.length; i++) {
          const asm = sdataAsmEntries[i];
          const nextAsmRom = i + 1 < sdataAsmEntries.length
            ? sdataAsmEntries[i + 1].rom
            : Infinity;

          const libsAfter = sdataEntries.filter(
            (s) => s.dataRom! > asm.rom && s.dataRom! < nextAsmRom
          );

          if (libsAfter.length > 0) {
            const libLines = libsAfter.map(
              (s) => `        ${s.oPath}(.data);`
            );
            insertions.push({ afterIdx: asm.idx, lines: libLines });
          }
        }

        // Also handle libs before the first sdata asm entry
        if (sdataAsmEntries.length > 0) {
          const firstAsmRom = sdataAsmEntries[0].rom;
          const libsBefore = sdataEntries.filter(
            (s) => s.dataRom! < firstAsmRom
          );
          if (libsBefore.length > 0) {
            const libLines = libsBefore.map(
              (s) => `        ${s.oPath}(.data);`
            );
            insertions.push({ afterIdx: sdataStartIdx, lines: libLines });
          }
        }

        // Insert from bottom up
        insertions.sort((a, b) => b.afterIdx - a.afterIdx);
        for (const ins of insertions) {
          filteredLines.splice(ins.afterIdx + 1, 0, ...ins.lines);
        }

        console.log(`Moved ${sdataLibLines.length} library .data entries to sdata section`);
      }
    }

    newLines.length = 0;
    newLines.push(...filteredLines);
  }

  if (!writeMode) {
    console.log("\nDry run. Run with --write to update build/slus_011.ld");
    return;
  }

  writeFileSync(LD_SCRIPT, newLines.join("\n"));
  console.log(`Updated ${LD_SCRIPT}`);
}

main();
