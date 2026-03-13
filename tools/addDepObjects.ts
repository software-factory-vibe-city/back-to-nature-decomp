/**
 * addDepObjects.ts — Link dependency .o files into the build
 *
 * After detectLibFunctions matches library .o files by signature, those matched
 * objects may reference symbols defined in OTHER .o files that weren't detected.
 * This tool finds those "dependency" .o files and integrates them into the build:
 *
 * - For deps with .text that don't overlap existing o segments: adds `o` segments to splat.yaml
 * - For deps with .text that DO overlap existing o segments: writes symbol defs to build/dep_syms.txt
 * - For BSS-only deps: computes VRAM base from symbol addresses, adds to libSections cache
 *   so patchLinkerBss.ts can add them to the linker script
 *
 * Usage:
 *   npx tsx tools/addDepObjects.ts           # dry run
 *   npx tsx tools/addDepObjects.ts --write   # update configs/splat.yaml + build/libSections.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");
const CACHE_PATH = join(ROOT, "build/libSections.json");
const DEP_SYMS_PATH = join(ROOT, "build/dep_syms.txt");
const LOAD_ADDR = 0x80010000;
const PAYLOAD_OFFSET = 0x800;
const DATA_REGION_START = 0x38990; // ROM offset where .data begins

interface ResolvedSymbol {
  name: string;
  vramAddr: number;
  type: string;
  definedIn: string;
  referencedBy: string[];
}

interface DepObject {
  oPath: string;
  symbols: ResolvedSymbol[];
  textSize: number;
  bssSize: number;
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

function vramToRom(vram: number): number {
  return vram - LOAD_ADDR + PAYLOAD_OFFSET;
}

function romToVram(rom: number): number {
  return rom - PAYLOAD_OFFSET + LOAD_ADDR;
}

function romHex(rom: number): string {
  return `0x${rom.toString(16).toUpperCase()}`;
}

function vramHex(vram: number): string {
  return `0x${vram.toString(16).padStart(8, "0")}`;
}

function oSegPath(oPath: string): string {
  return "../" + oPath.replace(/\.o$/, "");
}

/** Get section sizes from readelf -S */
function getSectionSizes(oPath: string): { textSize: number; bssSize: number } {
  let textSize = 0;
  let bssSize = 0;
  try {
    const output = execSync(
      `mips-linux-gnu-readelf -S "${oPath}" 2>/dev/null`,
      { encoding: "utf-8", cwd: ROOT }
    );
    for (const line of output.split("\n")) {
      const m = line.match(
        /\[\s*\d+\]\s+(\S+)\s+\S+\s+[0-9a-f]+\s+[0-9a-f]+\s+([0-9a-f]+)/i
      );
      if (m) {
        if (m[1] === ".text") textSize = parseInt(m[2], 16);
        else if (m[1] === ".bss") bssSize = parseInt(m[2], 16);
      }
    }
  } catch {}
  return { textSize, bssSize };
}

/** Get symbol names and their offsets within their section from nm */
function getSymbolOffsets(
  oPath: string
): { name: string; offset: number; type: string }[] {
  const results: { name: string; offset: number; type: string }[] = [];
  try {
    const output = execSync(`mips-linux-gnu-nm "${oPath}" 2>/dev/null`, {
      encoding: "utf-8",
      cwd: ROOT,
    });
    for (const line of output.split("\n")) {
      const m = line.match(/^([0-9a-f]+)\s+([TDBRCSW])\s+(\S+)/i);
      if (m) {
        results.push({
          offset: parseInt(m[1], 16),
          type: m[2],
          name: m[3],
        });
      }
    }
  } catch {}
  return results;
}

/** Extract .text bytes from a .o file */
function extractTextBytes(oPath: string): Buffer | null {
  const tmpPath = "/tmp/addDepObjects_text.bin";
  try {
    execSync(
      `mips-linux-gnu-objcopy -O binary -j .text "${oPath}" "${tmpPath}" 2>/dev/null`,
      { cwd: ROOT }
    );
    return readFileSync(tmpPath);
  } catch {
    return null;
  }
}

/** Check if an o segment already exists in the YAML for this path */
function hasExistingOSegment(yamlContent: string, oPath: string): boolean {
  const segPath = oSegPath(oPath);
  return (
    yamlContent.includes(segPath + "]") ||
    yamlContent.includes(segPath + ",")
  );
}

/** Parse all o segment ROM ranges from the YAML */
function parseOSegmentRanges(
  yamlContent: string
): { romStart: number; romEnd: number; oPath: string }[] {
  const lines = yamlContent.split("\n");
  const oSegRe =
    /^\s+- \[(0x[0-9A-Fa-f]+),\s*o,\s*(\.\.\/lib\/[^\],]+)/i;

  // Load libSections.json for actual text sizes
  const libSectionsPath = join(ROOT, "build/libSections.json");
  let textSizeMap = new Map<string, number>();
  if (existsSync(libSectionsPath)) {
    const libSections = JSON.parse(readFileSync(libSectionsPath, "utf-8"));
    for (const s of libSections) {
      textSizeMap.set(s.oPath, s.textSize);
    }
  }

  const oSegs: { rom: number; path: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const oMatch = lines[i].match(oSegRe);
    if (oMatch) {
      // Only include text-region o entries (not data/sdata)
      if (lines[i].includes(".data") || lines[i].includes(".rdata")) continue;
      oSegs.push({
        rom: parseInt(oMatch[1], 16),
        path: oMatch[2].replace("../", "") + ".o",
      });
    }
  }

  // Use actual text sizes from libSections.json for romEnd
  return oSegs.map((seg) => {
    const textSize = textSizeMap.get(seg.path);
    return {
      romStart: seg.rom,
      romEnd: textSize !== undefined ? seg.rom + textSize : seg.rom + 0x10, // fallback to small size
      oPath: seg.path,
    };
  });
}

function main() {
  const writeMode = process.argv.includes("--write");

  // Step 1: Run findMissingLibDeps.ts to get dependency info
  console.log("Running findMissingLibDeps.ts...");
  const depsOutput = execSync("npx tsx tools/findMissingLibDeps.ts", {
    encoding: "utf-8",
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });
  const resolvedSymbols: ResolvedSymbol[] = JSON.parse(depsOutput);
  console.log(`Got ${resolvedSymbols.length} resolved dependency symbols`);

  // Step 2: Group symbols by defining .o file
  const depsByFile = new Map<string, ResolvedSymbol[]>();
  for (const sym of resolvedSymbols) {
    if (!depsByFile.has(sym.definedIn)) {
      depsByFile.set(sym.definedIn, []);
    }
    depsByFile.get(sym.definedIn)!.push(sym);
  }

  // Step 3: Build dep object list with section info
  const deps: DepObject[] = [];
  for (const [oPath, symbols] of depsByFile) {
    const { textSize, bssSize } = getSectionSizes(oPath);
    deps.push({ oPath, symbols, textSize, bssSize });
  }

  console.log(`\nDependency .o files: ${deps.length}`);

  // Read binary for verification
  const binary = readFileSync(join(ROOT, "extracted/iso/slus_011.15"));

  // Read current YAML, strip previous addDepObjects entries (idempotent)
  let yamlContent = readFileSync(SPLAT_YAML, "utf-8");
  const DEP_MARKER = "# dep-obj";

  // Build set of dep .o paths for stripping stale entries
  const depOPaths = new Set(depsByFile.keys());
  const depSegPaths = new Set(
    [...depOPaths].map((p) => oSegPath(p))
  );

  // Strip: (1) lines with DEP_MARKER, (2) o entries for dep .o files, (3) gap c entries right after removed o entries
  {
    const lines = yamlContent.split("\n");
    const filtered: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Strip DEP_MARKER lines
      if (line.includes(DEP_MARKER)) continue;
      // Strip o entries for dep .o files (may have been added in prior runs without marker)
      const oMatch = line.match(
        /^\s+- \[0x[0-9A-Fa-f]+,\s*o,\s*(\.\.\/lib\/[^\],\s]+)/
      );
      if (oMatch && depSegPaths.has(oMatch[1].trim())) {
        // Also check if next line is a gap c entry (added by addDepObjects)
        // and skip it too if it has a func_ name pattern right after this o entry
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (/^\s+- \[0x[0-9A-Fa-f]+,\s*c,\s*func_/.test(nextLine)) {
            i++; // skip the gap c entry too
          }
        }
        continue;
      }
      filtered.push(line);
    }
    yamlContent = filtered.join("\n");
  }

  const existingORanges = parseOSegmentRanges(yamlContent);

  // Categorize deps
  const textDeps: { dep: DepObject; romStart: number; romEnd: number }[] = [];
  const overlappingDeps: {
    dep: DepObject;
    romStart: number;
    overlapWith: string;
  }[] = [];
  const bssDeps: { dep: DepObject; bssVram: number }[] = [];
  const symbolDefs: { name: string; vram: number }[] = [];

  for (const dep of deps) {
    if (dep.textSize > 0) {
      // Find the VRAM for the first function symbol in this .o
      const funcSymbols = dep.symbols.filter((s) => s.type === "func");
      if (funcSymbols.length === 0) {
        console.log(
          `  SKIP ${dep.oPath}: has .text but no func symbols resolved`
        );
        continue;
      }

      // Compute base VRAM from symbol offset within .text
      const symOffsets = getSymbolOffsets(dep.oPath);
      const funcOffset = symOffsets.find(
        (s) => s.name === funcSymbols[0].name && s.type === "T"
      );
      const offsetInText = funcOffset ? funcOffset.offset : 0;
      const baseVram = funcSymbols[0].vramAddr - offsetInText;
      const romStart = vramToRom(baseVram);
      const romEnd = romStart + dep.textSize;

      // Check if already in YAML as o segment
      if (hasExistingOSegment(yamlContent, dep.oPath)) {
        console.log(`  SKIP ${dep.oPath}: already has o segment in YAML`);
        continue;
      }

      // Verify bytes match
      const textBytes = extractTextBytes(dep.oPath);
      if (!textBytes || textBytes.length !== dep.textSize) {
        console.log(
          `  SKIP ${dep.oPath}: could not extract .text or size mismatch`
        );
        continue;
      }

      const fileOffset = romStart;
      if (fileOffset + dep.textSize > binary.length) {
        console.log(
          `  SKIP ${dep.oPath}: ROM range beyond binary`
        );
        continue;
      }

      // Compare non-relocated bytes
      let skipOffsets = new Set<number>();
      try {
        const relOutput = execSync(
          `mips-linux-gnu-readelf -r "${dep.oPath}" 2>/dev/null`,
          { encoding: "utf-8", cwd: ROOT }
        );
        for (const line of relOutput.split("\n")) {
          const m = line.match(/^([0-9a-f]+)\s+[0-9a-f]+\s+R_MIPS_/i);
          if (m) {
            const offset = parseInt(m[1], 16);
            for (let i = 0; i < 4; i++) skipOffsets.add(offset + i);
          }
        }
      } catch {}

      let mismatchCount = 0;
      for (let i = 0; i < dep.textSize; i++) {
        if (skipOffsets.has(i)) continue;
        if (textBytes[i] !== binary[fileOffset + i]) mismatchCount++;
      }

      if (mismatchCount > 0) {
        console.log(
          `  MISMATCH ${dep.oPath}: ${mismatchCount} byte mismatches at ROM ${romHex(romStart)} → symbol defs`
        );
        // Add all symbols as definitions since we can't link the .o file
        for (const sym of dep.symbols) {
          symbolDefs.push({ name: sym.name, vram: sym.vramAddr });
        }
        overlappingDeps.push({ dep, romStart, overlapWith: "byte mismatch" });
        continue;
      }

      // Check if dep crosses text/data region boundary
      if (romEnd > DATA_REGION_START && romStart < DATA_REGION_START) {
        console.log(
          `  BOUNDARY ${dep.oPath}: ROM ${romHex(romStart)}-${romHex(romEnd)} crosses text/data boundary`
        );
        overlappingDeps.push({
          dep,
          romStart,
          overlapWith: "text/data boundary",
        });
        for (const sym of dep.symbols) {
          symbolDefs.push({ name: sym.name, vram: sym.vramAddr });
        }
        continue;
      }

      // Check for overlap with existing o segments
      const overlap = existingORanges.find(
        (r) => romStart < r.romEnd && romEnd > r.romStart
      );

      if (overlap) {
        console.log(
          `  OVERLAP ${dep.oPath}: ROM ${romHex(romStart)} overlaps with ${overlap.oPath} at ${romHex(overlap.romStart)}`
        );
        overlappingDeps.push({ dep, romStart, overlapWith: overlap.oPath });

        // Add symbol definitions for all symbols in this dep
        for (const sym of dep.symbols) {
          symbolDefs.push({ name: sym.name, vram: sym.vramAddr });
        }
        continue;
      }

      console.log(
        `  MATCH ${dep.oPath}: .text=${dep.textSize} bytes at ROM ${romHex(romStart)}`
      );
      textDeps.push({ dep, romStart, romEnd });
    } else if (dep.bssSize > 0) {
      // BSS-only object: compute base VRAM from symbol addresses
      const symOffsets = getSymbolOffsets(dep.oPath);

      // Find the minimum VRAM among all resolved symbols for ordering
      let minVram = Infinity;
      let hasConsistentBase = true;
      let firstBase: number | null = null;

      for (const sym of dep.symbols) {
        if (sym.vramAddr < minVram) minVram = sym.vramAddr;
        const offsetInfo = symOffsets.find((s) => s.name === sym.name);
        if (offsetInfo) {
          const base = sym.vramAddr - offsetInfo.offset;
          if (firstBase === null) firstBase = base;
          else if (firstBase !== base) hasConsistentBase = false;
        }
      }

      const bssVram = firstBase !== null ? firstBase : minVram;

      if (!hasConsistentBase) {
        console.log(
          `  BSS  ${dep.oPath}: .bss=0x${dep.bssSize.toString(16)} (inconsistent layout, using base ${vramHex(bssVram)} for ordering)`
        );
      } else {
        console.log(
          `  BSS  ${dep.oPath}: .bss=0x${dep.bssSize.toString(16)} at VRAM ${vramHex(bssVram)}`
        );
      }
      bssDeps.push({ dep, bssVram });
    } else {
      // Data-only deps: symbols should be handled by addLibSymbols → symbol_addrs.txt
      console.log(`  DATA ${dep.oPath}: handled via symbol_addrs.txt`);
    }
  }

  // Step 4: Patch YAML for non-overlapping text deps
  if (textDeps.length > 0) {
    console.log(
      `\nPatching YAML for ${textDeps.length} text-bearing deps...`
    );
    const lines = yamlContent.split("\n");
    const newLines: string[] = [];

    // Sort text deps by ROM start
    textDeps.sort((a, b) => a.romStart - b.romStart);

    const depRanges = textDeps.map((td) => ({
      romStart: td.romStart,
      romEnd: td.romEnd,
      oPath: td.dep.oPath,
      inserted: false,
      gapAdded: false,
    }));

    const subsegRe = /^(\s+)- \[(0x[0-9A-Fa-f]+),\s*(c|o)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(subsegRe);

      if (!m) {
        newLines.push(line);
        continue;
      }

      const indent = m[1];
      const rom = parseInt(m[2], 16);
      const segType = m[3];

      // Insert pending dep o entries before this line
      for (const dr of depRanges) {
        if (!dr.inserted && dr.romStart <= rom) {
          newLines.push(
            `${indent}- [${romHex(dr.romStart)}, o, ${oSegPath(dr.oPath)}] ${DEP_MARKER} ${dr.oPath}`
          );
          dr.inserted = true;
        }
      }

      // Check if this entry falls within any dep range
      const containingDep = depRanges.find(
        (dr) => rom >= dr.romStart && rom < dr.romEnd
      );

      if (containingDep && segType === "c") {
        console.log(
          `  Remove c entry at ${romHex(rom)} (within ${containingDep.oPath})`
        );

        // Check if we need a gap filler after this dep
        // Look ahead to find the next segment ROM
        if (!containingDep.gapAdded) {
          let nextRom = Infinity;
          for (let j = i + 1; j < lines.length; j++) {
            const jm = lines[j].match(subsegRe);
            if (!jm) continue;
            const jRom = parseInt(jm[2], 16);
            if (jRom >= containingDep.romEnd) {
              nextRom = jRom;
              break;
            }
            // If this is still within the dep range, check the one after
            if (jRom >= containingDep.romStart) continue;
          }

          // Also check if another dep starts at or before containingDep.romEnd
          const nextDep = depRanges.find(
            (dr) => dr !== containingDep && dr.romStart >= containingDep.romStart && dr.romStart <= containingDep.romEnd
          );
          if (nextDep && nextDep.romStart <= containingDep.romEnd) {
            nextRom = Math.min(nextRom, nextDep.romStart);
          }

          // Check if there are no more c entries within this dep's range after this one
          let moreInRange = false;
          for (let j = i + 1; j < lines.length; j++) {
            const jm = lines[j].match(subsegRe);
            if (!jm) continue;
            const jRom = parseInt(jm[2], 16);
            if (jRom >= containingDep.romEnd) break;
            if (jRom >= containingDep.romStart) {
              moreInRange = true;
              break;
            }
          }

          if (!moreInRange && nextRom > containingDep.romEnd) {
            // Need a gap c entry
            const gapVram = romToVram(containingDep.romEnd);
            const gapName = `func_${gapVram.toString(16).toUpperCase()}`;
            newLines.push(
              `${indent}- [${romHex(containingDep.romEnd)}, c, ${gapName}] ${DEP_MARKER} ${vramHex(gapVram)} ${gapName}`
            );
            containingDep.gapAdded = true;
            console.log(
              `  Add gap c entry at ${romHex(containingDep.romEnd)} (${gapName})`
            );
          }
        }
        continue; // skip this c entry
      }

      newLines.push(line);
    }

    // Insert any remaining deps
    for (const dr of depRanges) {
      if (!dr.inserted) {
        newLines.push(
          `      - [${romHex(dr.romStart)}, o, ${oSegPath(dr.oPath)}] ${DEP_MARKER} ${dr.oPath}`
        );
        dr.inserted = true;
      }
    }

    yamlContent = newLines.join("\n");
  }

  // Step 5: Write symbol definitions for overlapping deps
  if (overlappingDeps.length > 0 || symbolDefs.length > 0) {
    console.log(
      `\n${overlappingDeps.length} overlapping deps → ${symbolDefs.length} symbol definitions`
    );
    const defLines = symbolDefs.map(
      (s) => `${s.name} = ${vramHex(s.vram)};`
    );

    if (writeMode && defLines.length > 0) {
      mkdirSync(join(ROOT, "build"), { recursive: true });
      writeFileSync(DEP_SYMS_PATH, defLines.join("\n") + "\n");
      console.log(`Wrote ${DEP_SYMS_PATH}`);
    } else if (defLines.length > 0) {
      console.log("Symbol definitions (dry run):");
      for (const line of defLines) console.log(`  ${line}`);
    }
  }

  // Step 6: Update libSections cache for BSS-only deps
  if (bssDeps.length > 0) {
    console.log(
      `\nUpdating libSections cache with ${bssDeps.length} BSS-only deps...`
    );

    let libSections: LibSections[] = [];
    if (existsSync(CACHE_PATH)) {
      libSections = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
    }

    const existingPaths = new Set(libSections.map((s) => s.oPath));

    for (const bd of bssDeps) {
      if (existingPaths.has(bd.dep.oPath)) {
        console.log(`  SKIP ${bd.dep.oPath}: already in cache`);
        continue;
      }

      libSections.push({
        oPath: bd.dep.oPath,
        textRom: 0,
        textSize: 0,
        bssVram: bd.bssVram,
        bssSize: bd.dep.bssSize,
      });
      console.log(
        `  Added ${bd.dep.oPath}: BSS at ${vramHex(bd.bssVram)}, size 0x${bd.dep.bssSize.toString(16)}`
      );
    }

    if (writeMode) {
      mkdirSync(join(ROOT, "build"), { recursive: true });
      writeFileSync(CACHE_PATH, JSON.stringify(libSections, null, 2));
      console.log(`Updated ${CACHE_PATH}`);
    }
  }

  // Summary
  console.log(`\nSummary:`);
  console.log(`  Text deps added to YAML: ${textDeps.length}`);
  console.log(
    `  Overlapping deps (symbol defs): ${overlappingDeps.length}`
  );
  console.log(`  BSS deps added to cache: ${bssDeps.length}`);

  if (!writeMode) {
    console.log("\nDry run. Run with --write to apply changes.");
    return;
  }

  if (textDeps.length > 0) {
    writeFileSync(SPLAT_YAML, yamlContent);
    console.log(`Updated ${SPLAT_YAML}`);
  }

  console.log("\nDone.");
}

main();
