/**
 * detectLibFunctions.ts — Detect PSY-Q library functions in the binary
 *
 * Scans the binary with PSY-Q 4.7 signatures, cross-checks against the
 * pre-compiled .o files in lib/, and outputs a JSON mapping of matched
 * library objects with their VRAM ranges and labels.
 *
 * Usage:
 *   npx tsx tools/detectLibFunctions.ts [--verbose]
 *
 * Output (stdout): JSON array of matched library objects:
 *   [{ vramStart, vramEnd, oPath, textSize, sigLength, labels }]
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const BINARY_PATH = "extracted/iso/slus_011.15";
const SIGS_DIR = "tools/psx_psyq_signatures";
const VERSION = "470";
const PAYLOAD_OFFSET = 0x800;
const LOAD_ADDR = 0x80010000;
const TEXT_START = 0x80011270;
const TEXT_END = 0x80048190;

interface SigLabel {
  name: string;
  offset: number;
}

interface SigEntry {
  name: string;
  sig: string;
  labels: SigLabel[];
}

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

interface CandidateMatch {
  offsets: number[];       // all ROM offsets where sig matched
  entry: SigEntry;
  oPath: string;
  libDir: string;
  textSize: number;
  sigLength: number;
}

/** Parse a hex signature string with ?? wildcards into bytes + mask. */
function parseSig(sigStr: string): { bytes: number[]; mask: boolean[] } {
  const tokens = sigStr.trim().split(/\s+/);
  const bytes: number[] = [];
  const mask: boolean[] = [];

  for (const token of tokens) {
    if (token === "??") {
      bytes.push(0);
      mask.push(false);
    } else {
      bytes.push(parseInt(token, 16));
      mask.push(true);
    }
  }

  return { bytes, mask };
}

/** Find all byte pattern matches in the binary at 4-byte aligned offsets. */
function findAllPatterns(
  binary: Buffer,
  searchStart: number,
  searchEnd: number,
  sigBytes: number[],
  sigMask: boolean[]
): number[] {
  const sigLen = sigBytes.length;
  if (sigLen === 0) return [];
  const results: number[] = [];

  for (let i = searchStart; i <= searchEnd - sigLen; i += 4) {
    let match = true;
    for (let j = 0; j < sigLen; j++) {
      if (sigMask[j] && binary[i + j] !== sigBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) results.push(i);
  }
  return results;
}

function fileOffsetToVram(offset: number): number {
  return offset - PAYLOAD_OFFSET + LOAD_ADDR;
}

interface Relocation {
  offset: number;
  type: string;
  symbolName: string;
}

/** Read R_MIPS_26 and R_MIPS_HI16/LO16 relocations from .text section. */
function getTextRelocations(oPath: string): Relocation[] {
  try {
    const output = execSync(`readelf -r "${oPath}" 2>/dev/null`, {
      encoding: "utf-8",
    });
    const relocs: Relocation[] = [];
    let inTextRelocs = false;
    for (const line of output.split("\n")) {
      if (line.includes(".rel.text")) {
        inTextRelocs = true;
        continue;
      }
      if (inTextRelocs && line.trim() === "") {
        inTextRelocs = false;
        continue;
      }
      if (!inTextRelocs) continue;
      const m = line.match(
        /^([0-9a-f]+)\s+[0-9a-f]+\s+(R_MIPS_\w+)\s+[0-9a-f]+\s+(\S+)/
      );
      if (
        m &&
        (m[2] === "R_MIPS_26" ||
          m[2] === "R_MIPS_HI16" ||
          m[2] === "R_MIPS_LO16")
      ) {
        relocs.push({
          offset: parseInt(m[1], 16),
          type: m[2],
          symbolName: m[3],
        });
      }
    }
    return relocs;
  } catch {
    return [];
  }
}

/** Load symbol_addrs.txt into a map of name -> VRAM address. */
function loadSymbolAddrs(filePath: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!fs.existsSync(filePath)) return map;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^(\w+)\s*=\s*(0x[0-9a-fA-F]+)/);
    if (m) {
      map.set(m[1], parseInt(m[2], 16));
    }
  }
  return map;
}

/**
 * Verify a candidate placement by checking relocations against known symbol addresses.
 * Handles R_MIPS_26 (JAL), R_MIPS_HI16/LO16 (lui/addiu pairs).
 * Returns the number of relocations that match (verified) and total checked.
 */
function verifyRelocations(
  binary: Buffer,
  fileOffset: number,
  relocs: Relocation[],
  symbolAddrs: Map<string, number>
): { verified: number; checked: number } {
  let verified = 0;
  let checked = 0;

  // Build HI16→LO16 pairs: for each HI16, find the next LO16 with the same symbol
  const hi16Processed = new Set<number>();

  for (let ri = 0; ri < relocs.length; ri++) {
    const reloc = relocs[ri];
    const targetAddr = symbolAddrs.get(reloc.symbolName);
    if (targetAddr === undefined) continue;

    const relocPos = fileOffset + reloc.offset;
    if (relocPos + 4 > binary.length) continue;

    if (reloc.type === "R_MIPS_26") {
      checked++;
      const jalWord = binary.readUInt32LE(relocPos);
      const jalImmediate = jalWord & 0x03ffffff;
      const vram = fileOffsetToVram(fileOffset);
      const computedTarget =
        ((vram & 0xf0000000) | (jalImmediate << 2)) >>> 0;
      if (computedTarget === targetAddr) {
        verified++;
      }
    } else if (reloc.type === "R_MIPS_HI16" && !hi16Processed.has(ri)) {
      // Find the paired LO16 for this HI16 (next LO16 with same symbol)
      let lo16Reloc: Relocation | null = null;
      for (let lj = ri + 1; lj < relocs.length; lj++) {
        if (
          relocs[lj].type === "R_MIPS_LO16" &&
          relocs[lj].symbolName === reloc.symbolName
        ) {
          lo16Reloc = relocs[lj];
          break;
        }
      }
      if (!lo16Reloc) continue;

      const lo16Pos = fileOffset + lo16Reloc.offset;
      if (lo16Pos + 4 > binary.length) continue;

      hi16Processed.add(ri);
      checked++;

      const hiWord = binary.readUInt32LE(relocPos);
      const loWord = binary.readUInt32LE(lo16Pos);
      const hi = (hiWord & 0xffff) << 16;
      const lo = loWord & 0xffff;
      // Sign-extend lo16
      const loSigned = lo >= 0x8000 ? lo - 0x10000 : lo;
      const computedAddr = ((hi + loSigned) >>> 0);

      if (computedAddr === targetAddr) {
        verified++;
      }
    }
    // R_MIPS_LO16 handled as part of HI16 pairs above
  }
  return { verified, checked };
}

/** Get the .text section size from an ELF .o file using readelf. */
function getTextSize(oPath: string): number | null {
  try {
    const output = execSync(`readelf -S "${oPath}" 2>/dev/null`, {
      encoding: "utf-8",
    });
    // Match: [ N] .text             PROGBITS        00000000 OFFSET SIZE ...
    const match = output.match(
      /\] \.text\s+PROGBITS\s+[0-9a-f]+\s+[0-9a-f]+\s+([0-9a-f]+)/i
    );
    if (match) {
      return parseInt(match[1], 16);
    }
  } catch {
    // readelf failed
  }
  return null;
}

/** Get all section names from an ELF .o file. */
function getSections(oPath: string): string[] {
  try {
    const output = execSync(`readelf -S "${oPath}" 2>/dev/null`, {
      encoding: "utf-8",
    });
    const sections: string[] = [];
    for (const line of output.split("\n")) {
      const m = line.match(/\]\s+(\.[\w.]+)\s/);
      if (m) sections.push(m[1]);
    }
    return sections;
  } catch {
    return [];
  }
}

/**
 * Map a signature file name + obj name to a lib/.o path.
 *
 * For .LIB.json files: LIBAPI.LIB.json / C57.OBJ -> lib/libapi/c57.o
 * For standalone .OBJ.json files: MCGUI.OBJ.json -> lib/mcgui.o
 */
function sigToOPath(
  sigFileName: string,
  objName: string
): { oPath: string; libDir: string } | null {
  const obj = objName.replace(/\.OBJ$/i, "").toLowerCase();

  if (sigFileName.endsWith(".LIB.json")) {
    const lib = sigFileName.replace(/\.LIB\.json$/i, "").toLowerCase();
    return { oPath: `lib/${lib}/${obj}.o`, libDir: lib };
  } else if (sigFileName.endsWith(".OBJ.json")) {
    // Standalone object — lives directly in lib/
    return { oPath: `lib/${obj}.o`, libDir: "" };
  }

  return null;
}

function main() {
  const verbose = process.argv.includes("--verbose");

  if (!fs.existsSync(BINARY_PATH)) {
    console.error(`Binary not found: ${BINARY_PATH}`);
    process.exit(1);
  }

  const binary = fs.readFileSync(BINARY_PATH);
  const searchStart = TEXT_START - LOAD_ADDR + PAYLOAD_OFFSET;
  const searchEnd = TEXT_END - LOAD_ADDR + PAYLOAD_OFFSET;

  const versionDir = path.join(SIGS_DIR, VERSION);
  const sigFiles = fs
    .readdirSync(versionDir)
    .filter((f) => f.endsWith(".json"));

  const candidates: CandidateMatch[] = [];
  let skippedNoFile = 0;
  let skippedSizeMismatch = 0;

  for (const sigFile of sigFiles) {
    const data: SigEntry[] = JSON.parse(
      fs.readFileSync(path.join(versionDir, sigFile), "utf-8")
    );

    for (const entry of data) {
      if (!entry.sig) continue;
      const { bytes, mask } = parseSig(entry.sig);
      if (bytes.length < 8) continue; // skip tiny sigs

      const offsets = findAllPatterns(binary, searchStart, searchEnd, bytes, mask);
      if (offsets.length === 0) continue;

      const mapping = sigToOPath(sigFile, entry.name);
      if (!mapping) continue;

      const { oPath, libDir } = mapping;

      // Validate .o file exists
      if (!fs.existsSync(oPath)) {
        if (verbose) {
          console.error(`  SKIP: .o not found: ${oPath} (${entry.name})`);
        }
        skippedNoFile++;
        continue;
      }

      // Get .text section size from .o file
      const textSize = getTextSize(oPath);
      if (textSize === null || textSize === 0) {
        if (verbose) {
          console.error(
            `  SKIP: no .text section in ${oPath} (${entry.name})`
          );
        }
        continue;
      }

      if (bytes.length > textSize) {
        if (verbose) {
          console.error(
            `  SKIP: sig (${bytes.length}B) > .text (${textSize}B) for ${oPath} (${entry.name})`
          );
        }
        continue;
      }

      candidates.push({
        offsets,
        entry,
        oPath,
        libDir,
        textSize,
        sigLength: bytes.length,
      });

      if (verbose && offsets.length > 1) {
        console.error(
          `  MULTI: ${oPath} (${entry.name}) matched at ${offsets.length} offsets`
        );
      }
    }
  }

  // --- Helper: convert a candidate + chosen offset into a LibMatch ---
  function candidateToMatch(c: CandidateMatch, offset: number): LibMatch {
    const vramStart = fileOffsetToVram(offset);
    const vramEnd = vramStart + c.textSize;
    const labels = (c.entry.labels || [])
      .filter(
        (l) => !l.name.startsWith("loc_") && !l.name.startsWith("text_")
      )
      .map((l) => ({
        name: l.name,
        vramAddr: vramStart + l.offset,
      }));

    // Check for extra sections
    const sections = getSections(c.oPath);
    const dataSections = sections.filter(
      (s) =>
        s === ".data" ||
        s === ".sdata" ||
        s === ".bss" ||
        s === ".sbss" ||
        s === ".rdata" ||
        s === ".rodata"
    );
    if (verbose && dataSections.length > 0) {
      console.error(
        `  NOTE: ${c.oPath} has extra sections: ${dataSections.join(", ")}`
      );
    }

    return {
      vramStart,
      vramEnd,
      oPath: c.oPath,
      textSize: c.textSize,
      sigLength: c.sigLength,
      labels,
      libName: c.libDir || path.basename(c.oPath, ".o"),
      objName: c.entry.name,
    };
  }

  // Load symbol addresses for relocation verification (used in dedup + Pass 2)
  const symbolAddrs = loadSymbolAddrs("configs/symbol_addrs.txt");

  // Cache relocations per .o path
  const relocCache = new Map<string, Relocation[]>();
  function getRelocs(oPath: string): Relocation[] {
    let r = relocCache.get(oPath);
    if (r === undefined) {
      r = getTextRelocations(oPath);
      relocCache.set(oPath, r);
    }
    return r;
  }

  // --- Pass 1: Place all candidates using first-match (old behavior) ---
  let matches: LibMatch[] = candidates.map((c) => candidateToMatch(c, c.offsets[0]));
  matches.sort((a, b) => a.vramStart - b.vramStart);

  // Deduplicate: same address → keep largest .text, break ties with relocation verification
  const deduped: LibMatch[] = [];
  const seenAddrs = new Map<number, number>();
  // Collect all candidates per address for tie-breaking
  const candidatesByAddr = new Map<number, { match: LibMatch; candidate: CandidateMatch }[]>();
  for (const m of matches) {
    const c = candidates.find((cc) => cc.oPath === m.oPath)!;
    if (!candidatesByAddr.has(m.vramStart)) {
      candidatesByAddr.set(m.vramStart, []);
    }
    candidatesByAddr.get(m.vramStart)!.push({ match: m, candidate: c });
  }

  for (const [addr, group] of [...candidatesByAddr.entries()].sort((a, b) => a[0] - b[0])) {
    if (group.length === 1) {
      seenAddrs.set(addr, deduped.length);
      deduped.push(group[0].match);
      continue;
    }

    // Multiple candidates at same address — find largest textSize
    const maxTextSize = Math.max(...group.map((g) => g.match.textSize));
    const largest = group.filter((g) => g.match.textSize === maxTextSize);

    if (largest.length === 1) {
      // Clear winner by size
      if (verbose) {
        for (const g of group) {
          if (g !== largest[0]) {
            console.error(
              `  DEDUP: ${largest[0].match.oPath} (${largest[0].match.textSize}B) replaces ${g.match.oPath} (${g.match.textSize}B) at 0x${addr.toString(16)}`
            );
          }
        }
      }
      seenAddrs.set(addr, deduped.length);
      deduped.push(largest[0].match);
    } else {
      // Tie in textSize — use relocation verification to break tie
      const fileOffset = addr - LOAD_ADDR + PAYLOAD_OFFSET;
      let bestMatch = largest[0].match;
      let bestScore = -1;

      for (const g of largest) {
        const relocs = getRelocs(g.candidate.oPath);
        const result = verifyRelocations(binary, fileOffset, relocs, symbolAddrs);
        if (verbose) {
          console.error(
            `  DEDUP TIE: ${g.match.oPath} at 0x${addr.toString(16)} reloc score ${result.verified}/${result.checked}`
          );
        }
        if (result.verified > bestScore) {
          bestScore = result.verified;
          bestMatch = g.match;
        }
      }

      if (verbose) {
        console.error(
          `  DEDUP WINNER: ${bestMatch.oPath} at 0x${addr.toString(16)} (score ${bestScore})`
        );
      }
      seenAddrs.set(addr, deduped.length);
      deduped.push(bestMatch);
    }
  }

  // Resolve overlaps: keep larger
  let placed: LibMatch[] = [];
  for (const m of deduped) {
    if (placed.length === 0) {
      placed.push(m);
      continue;
    }
    const prev = placed[placed.length - 1];
    if (m.vramStart < prev.vramEnd) {
      if (m.textSize > prev.textSize) {
        if (verbose) {
          console.error(
            `  OVERLAP: dropping ${prev.oPath} (${prev.textSize}B), keeping ${m.oPath} (${m.textSize}B)`
          );
        }
        placed[placed.length - 1] = m;
      } else {
        if (verbose) {
          console.error(
            `  OVERLAP: dropping ${m.oPath} (${m.textSize}B), keeping ${prev.oPath} (${prev.textSize}B)`
          );
        }
      }
    } else {
      placed.push(m);
    }
  }

  // --- Pass 2: Fix multi-match objects using relocation verification ---
  {
  const placedPaths = new Set<string>(placed.map((m) => m.oPath));

  // Check if a range overlaps any placed object (optionally excluding one path)
  function overlapsPlaced(
    vramStart: number,
    vramEnd: number,
    excludePath?: string
  ): boolean {
    for (const m of placed) {
      if (excludePath && m.oPath === excludePath) continue;
      if (vramStart < m.vramEnd && vramEnd > m.vramStart) return true;
    }
    return false;
  }

  // Step 2a: For placed multi-match objects, verify current placement
  // and relocate if another offset has better relocation matches
  for (let i = 0; i < placed.length; i++) {
    const c = candidates.find(
      (cc) => cc.oPath === placed[i].oPath && cc.offsets.length > 1
    );
    if (!c) continue;

    const relocs = getRelocs(c.oPath);
    if (relocs.length === 0) continue;

    // Check current placement
    const currentFileOffset =
      placed[i].vramStart - LOAD_ADDR + PAYLOAD_OFFSET;
    const current = verifyRelocations(
      binary,
      currentFileOffset,
      relocs,
      symbolAddrs
    );

    // Try other offsets
    let bestOffset: number | null = null;
    let bestVerified = current.verified;

    for (const offset of c.offsets) {
      const vramStart = fileOffsetToVram(offset);
      if (vramStart === placed[i].vramStart) continue;
      const vramEnd = vramStart + c.textSize;
      if (overlapsPlaced(vramStart, vramEnd, c.oPath)) continue;

      const result = verifyRelocations(binary, offset, relocs, symbolAddrs);
      if (result.verified > bestVerified) {
        bestVerified = result.verified;
        bestOffset = offset;
      }
    }

    if (bestOffset !== null) {
      const oldVram = placed[i].vramStart;
      placed[i] = candidateToMatch(c, bestOffset);

      if (verbose) {
        console.error(
          `  RELOCATED: ${c.oPath} from 0x${oldVram.toString(16)} to 0x${placed[i].vramStart.toString(16)} (relocs ${current.verified}/${current.checked} -> ${bestVerified}/${current.checked})`
        );
      }
    }
  }

  // Step 2b: Try to place multi-match candidates that lost dedup/overlap
  // at alternative offsets verified by relocations (score > 0).
  for (const c of candidates) {
    if (c.offsets.length <= 1) continue;
    if (placedPaths.has(c.oPath)) continue;

    const relocs = getRelocs(c.oPath);
    if (relocs.length === 0) continue;

    let bestOffset: number | null = null;
    let bestVerified = 0; // require at least 1 verified relocation

    for (const offset of c.offsets) {
      const vramStart = fileOffsetToVram(offset);
      const vramEnd = vramStart + c.textSize;
      if (overlapsPlaced(vramStart, vramEnd)) continue;

      const result = verifyRelocations(binary, offset, relocs, symbolAddrs);
      if (result.verified > bestVerified) {
        bestVerified = result.verified;
        bestOffset = offset;
      }
    }

    if (bestOffset !== null) {
      const match = candidateToMatch(c, bestOffset);
      placed.push(match);
      placedPaths.add(c.oPath);

      if (verbose) {
        console.error(
          `  PLACED: ${c.oPath} at 0x${match.vramStart.toString(16)} (alt offset, reloc score ${bestVerified})`
        );
      }
    }
  }

  // Re-sort placed after any relocations/additions
  placed.sort((a, b) => a.vramStart - b.vramStart);

  } // end of Pass 2

  // --- Final safety: overlap resolution on placed array ---
  let resolved: LibMatch[] = [];
  for (const m of placed) {
    if (resolved.length === 0) {
      resolved.push(m);
      continue;
    }
    const prev = resolved[resolved.length - 1];
    if (m.vramStart < prev.vramEnd) {
      if (m.textSize > prev.textSize) {
        if (verbose) {
          console.error(
            `  OVERLAP: dropping ${prev.oPath} (${prev.textSize}B), keeping ${m.oPath} (${m.textSize}B)`
          );
        }
        resolved[resolved.length - 1] = m;
      } else {
        if (verbose) {
          console.error(
            `  OVERLAP: dropping ${m.oPath} (${m.textSize}B), keeping ${prev.oPath} (${prev.textSize}B)`
          );
        }
      }
    } else {
      resolved.push(m);
    }
  }

  // Verify no remaining overlaps
  const warnings: string[] = [];
  for (let i = 1; i < resolved.length; i++) {
    const prev = resolved[i - 1];
    const curr = resolved[i];
    if (curr.vramStart < prev.vramEnd) {
      warnings.push(
        `OVERLAP: ${prev.oPath} [0x${prev.vramStart.toString(16)}–0x${prev.vramEnd.toString(16)}] ` +
          `overlaps ${curr.oPath} [0x${curr.vramStart.toString(16)}–0x${curr.vramEnd.toString(16)}]`
      );
    }
  }

  // Summary to stderr
  const totalTextBytes = resolved.reduce((sum, m) => sum + m.textSize, 0);
  const totalLabels = resolved.reduce((sum, m) => sum + m.labels.length, 0);
  console.error(`\nPSY-Q ${VERSION} library detection results:`);
  console.error(`  Matched objects: ${resolved.length}`);
  console.error(
    `  Total .text coverage: ${totalTextBytes} bytes (0x${totalTextBytes.toString(16)})`
  );
  console.error(`  Named function labels: ${totalLabels}`);
  if (skippedNoFile > 0) {
    console.error(`  Skipped (no .o file): ${skippedNoFile}`);
  }
  if (skippedSizeMismatch > 0) {
    console.error(`  Skipped (size mismatch): ${skippedSizeMismatch}`);
  }
  if (warnings.length > 0) {
    console.error(`\n  Warnings:`);
    for (const w of warnings) {
      console.error(`    ${w}`);
    }
  }

  // Output JSON to stdout
  const output = resolved.map((m) => ({
    vramStart: m.vramStart,
    vramEnd: m.vramEnd,
    oPath: m.oPath,
    textSize: m.textSize,
    sigLength: m.sigLength,
    labels: m.labels,
    libName: m.libName,
    objName: m.objName,
  }));

  console.log(JSON.stringify(output, null, 2));
}

main();
