/**
 * diffBinary.ts — Diagnostic tool for comparing built binary against original
 *
 * Compares payloads, finds gaps in text region coverage, detects drift between
 * library .o entries and their actual linker map positions.
 *
 * Usage:
 *   npx tsx tools/diagnostics/diffBinary.ts
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadPsxExeInfo, loadSectionLayout, ROOT } from "../lib/psxExeInfo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const _info = loadPsxExeInfo();
const _layout = loadSectionLayout();

const ORIGINAL = _info.binaryPath;
const BUILT = join(ROOT, "build/slus_011.bin");
const MAP_FILE = join(ROOT, "build/slus_011.map");
const LIB_SECTIONS = join(ROOT, "build/libSections.json");
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");

const PAYLOAD_OFFSET = _info.payloadOffset;
const PAYLOAD_SIZE = _info.payloadSize;
const LOAD_ADDR = _info.loadAddr;
const TEXT_START_ROM = _layout?.textStart ?? 0x1a70;
const TEXT_END_ROM = _layout?.dataStart ?? 0x38990;

function hex(n: number): string {
  return "0x" + n.toString(16).toUpperCase();
}

function romToVram(rom: number): number {
  return rom - PAYLOAD_OFFSET + LOAD_ADDR;
}

interface LibSection {
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

interface SplatEntry {
  rom: number;
  type: string; // "c", "o", "rodata", "data", "sdata"
  name?: string;
}

function parseSplatYaml(): SplatEntry[] {
  const yaml = readFileSync(SPLAT_YAML, "utf-8");
  const entries: SplatEntry[] = [];
  const segRe = /^\s+- \[(0x[0-9A-Fa-f]+),\s*(\w+)(?:,\s*([^\]]+))?\]/;

  for (const line of yaml.split("\n")) {
    const m = line.match(segRe);
    if (m) {
      entries.push({
        rom: parseInt(m[1], 16),
        type: m[2],
        name: m[3]?.trim(),
      });
    }
  }

  return entries;
}

function parseMapSymbols(): Map<number, string> {
  if (!existsSync(MAP_FILE)) return new Map();
  const map = readFileSync(MAP_FILE, "utf-8");
  const symbols = new Map<number, string>();
  // Parse linker map format: address symbol lines
  const symRe =
    /^\s+(0x[0-9a-f]+)\s+(\S+)/;
  for (const line of map.split("\n")) {
    const m = line.match(symRe);
    if (m) {
      const addr = parseInt(m[1], 16);
      if (addr >= LOAD_ADDR && addr < LOAD_ADDR + 0x100000) {
        symbols.set(addr, m[2]);
      }
    }
  }
  return symbols;
}

function main() {
  // === Load binaries ===
  if (!existsSync(ORIGINAL)) {
    console.error("Original binary not found:", ORIGINAL);
    process.exit(1);
  }
  if (!existsSync(BUILT)) {
    console.error("Built binary not found:", BUILT);
    process.exit(1);
  }

  const origBuf = readFileSync(ORIGINAL);
  const builtBuf = readFileSync(BUILT);

  console.log("=== Binary Comparison ===\n");
  console.log(`Original file size: ${origBuf.length} (${hex(origBuf.length)})`);
  console.log(`Built file size:    ${builtBuf.length} (${hex(builtBuf.length)})`);

  // Extract payloads
  const origPayload = origBuf.subarray(PAYLOAD_OFFSET, PAYLOAD_OFFSET + PAYLOAD_SIZE);
  const builtPayload = builtBuf.subarray(PAYLOAD_OFFSET, PAYLOAD_OFFSET + PAYLOAD_SIZE);

  console.log(`\nOriginal payload: ${origPayload.length} bytes`);
  console.log(`Built payload:    ${builtPayload.length} bytes (expected ${PAYLOAD_SIZE})`);

  if (builtPayload.length < PAYLOAD_SIZE) {
    console.log(`\n*** BUILT BINARY TOO SHORT by ${PAYLOAD_SIZE - builtPayload.length} bytes ***`);
    console.log(`Built file only has ${builtBuf.length - PAYLOAD_OFFSET} payload bytes available`);
  }

  // === Size analysis ===
  const builtPayloadAvail = Math.min(builtPayload.length, PAYLOAD_SIZE);
  const compareLen = Math.min(origPayload.length, builtPayloadAvail);

  // === Byte-level comparison ===
  let diffCount = 0;
  let firstDiffOffset = -1;
  const diffBlocks: { start: number; end: number }[] = [];
  let inDiff = false;
  let blockStart = 0;

  for (let i = 0; i < compareLen; i++) {
    if (origPayload[i] !== builtPayload[i]) {
      diffCount++;
      if (firstDiffOffset === -1) firstDiffOffset = i;
      if (!inDiff) {
        blockStart = i;
        inDiff = true;
      }
    } else {
      if (inDiff) {
        diffBlocks.push({ start: blockStart, end: i });
        inDiff = false;
      }
    }
  }
  if (inDiff) {
    diffBlocks.push({ start: blockStart, end: compareLen });
  }

  console.log(`\n=== Byte Comparison (first ${hex(compareLen)} bytes) ===`);
  console.log(`Total different bytes: ${diffCount} / ${compareLen} (${(diffCount * 100 / compareLen).toFixed(1)}%)`);

  if (firstDiffOffset >= 0) {
    const rom = firstDiffOffset + PAYLOAD_OFFSET;
    const vram = romToVram(rom);
    console.log(`First difference at payload offset ${hex(firstDiffOffset)} (ROM ${hex(rom)}, VRAM ${hex(vram)})`);
    // Show context around first diff
    const start = Math.max(0, firstDiffOffset - 4);
    const end = Math.min(compareLen, firstDiffOffset + 16);
    console.log(`  Original: ${Buffer.from(origPayload.subarray(start, end)).toString("hex")}`);
    console.log(`  Built:    ${Buffer.from(builtPayload.subarray(start, end)).toString("hex")}`);
  }

  // Show diff block summary
  if (diffBlocks.length > 0) {
    console.log(`\nDiff blocks: ${diffBlocks.length}`);
    const showMax = 30;
    for (let i = 0; i < Math.min(diffBlocks.length, showMax); i++) {
      const b = diffBlocks[i];
      const size = b.end - b.start;
      const rom = b.start + PAYLOAD_OFFSET;
      console.log(
        `  ${hex(rom)}..${hex(rom + size - 1)} (${size} bytes, VRAM ${hex(romToVram(rom))})`
      );
    }
    if (diffBlocks.length > showMax) {
      console.log(`  ... and ${diffBlocks.length - showMax} more blocks`);
    }
  }

  // === Section-level diff summary ===
  const splatEntries = parseSplatYaml();
  const textEntries = splatEntries
    .filter((e) => e.rom >= TEXT_START_ROM && e.rom < TEXT_END_ROM && (e.type === "c" || e.type === "o"))
    .sort((a, b) => a.rom - b.rom);

  console.log(`\n=== Per-Section Diff Counts ===`);
  console.log(`Text region entries: ${textEntries.length} (${textEntries.filter(e => e.type === "c").length} c, ${textEntries.filter(e => e.type === "o").length} o)`);

  // For each text entry, count diff bytes in its range
  const sectionDiffs: { rom: number; type: string; name: string; size: number; diffs: number }[] = [];
  for (let i = 0; i < textEntries.length; i++) {
    const entry = textEntries[i];
    const nextRom = i + 1 < textEntries.length ? textEntries[i + 1].rom : TEXT_END_ROM;
    const size = nextRom - entry.rom;
    let diffs = 0;
    const payStart = entry.rom - PAYLOAD_OFFSET;
    const payEnd = nextRom - PAYLOAD_OFFSET;
    for (let j = payStart; j < Math.min(payEnd, compareLen); j++) {
      if (origPayload[j] !== builtPayload[j]) diffs++;
    }
    if (diffs > 0) {
      sectionDiffs.push({
        rom: entry.rom,
        type: entry.type,
        name: entry.name || "?",
        size,
        diffs,
      });
    }
  }

  if (sectionDiffs.length > 0) {
    console.log(`\nSections with diffs (${sectionDiffs.length}):`);
    for (const s of sectionDiffs.slice(0, 50)) {
      console.log(
        `  ${hex(s.rom)} ${s.type} ${s.name}: ${s.diffs}/${s.size} bytes differ`
      );
    }
    if (sectionDiffs.length > 50) {
      console.log(`  ... and ${sectionDiffs.length - 50} more`);
    }
  } else {
    console.log("No section-level diffs detected in text region.");
  }

  // === Gap finder ===
  console.log(`\n=== Text Region Gap Analysis ===`);

  // Load libSections
  let libSections: LibSection[] = [];
  if (existsSync(LIB_SECTIONS)) {
    libSections = JSON.parse(readFileSync(LIB_SECTIONS, "utf-8"));
  }

  // Build sorted list of all text region segments from splat
  const allTextSegs = splatEntries
    .filter((e) => e.rom >= TEXT_START_ROM && e.rom < TEXT_END_ROM)
    .sort((a, b) => a.rom - b.rom);

  // Build sorted list of o entries with their sizes from libSections
  const oMap = new Map<number, LibSection>();
  for (const ls of libSections) {
    oMap.set(ls.textRom, ls);
  }

  // Walk text region and find gaps
  // A gap is a ROM range not covered by any segment
  const gaps: { start: number; end: number; hasCode: boolean }[] = [];

  for (let i = 0; i < allTextSegs.length; i++) {
    const seg = allTextSegs[i];
    if (seg.type !== "o") continue;

    const ls = oMap.get(seg.rom);
    if (!ls) continue;

    const oEnd = seg.rom + ls.textSize;
    const nextRom = i + 1 < allTextSegs.length ? allTextSegs[i + 1].rom : TEXT_END_ROM;

    if (oEnd < nextRom) {
      // Check if the gap has non-zero bytes (actual code)
      const gapPayStart = oEnd - PAYLOAD_OFFSET;
      const gapPayEnd = nextRom - PAYLOAD_OFFSET;
      let hasCode = false;
      for (let j = gapPayStart; j < Math.min(gapPayEnd, origPayload.length); j++) {
        if (origPayload[j] !== 0) {
          hasCode = true;
          break;
        }
      }
      gaps.push({ start: oEnd, end: nextRom, hasCode });
    }
  }

  const codeGaps = gaps.filter((g) => g.hasCode);
  const totalGapBytes = gaps.reduce((sum, g) => sum + (g.end - g.start), 0);
  const codeGapBytes = codeGaps.reduce((sum, g) => sum + (g.end - g.start), 0);

  console.log(`Total gaps after o entries: ${gaps.length} (${totalGapBytes} bytes)`);
  console.log(`Gaps with code: ${codeGaps.length} (${codeGapBytes} bytes)`);

  if (codeGaps.length > 0) {
    console.log(`\nCode gaps (ROM ranges between o entries not covered by c/asm):`);
    for (const g of codeGaps.slice(0, 40)) {
      const size = g.end - g.start;
      console.log(
        `  ${hex(g.start)}..${hex(g.end - 1)} (${size} bytes, VRAM ${hex(romToVram(g.start))}..${hex(romToVram(g.end - 1))})`
      );
    }
    if (codeGaps.length > 40) {
      console.log(`  ... and ${codeGaps.length - 40} more`);
    }
  }

  // === Drift detection ===
  console.log(`\n=== Drift Detection ===`);

  // Parse linker map for symbol addresses
  const mapSyms = parseMapSymbols();

  // For each library o entry, find its expected VRAM vs actual from map
  const driftEntries: {
    oPath: string;
    expectedVram: number;
    actualVram: number | null;
    drift: number;
  }[] = [];

  // Try to find symbols from each lib .o in the map
  for (const ls of libSections.slice(0, 20)) {
    const expectedVram = romToVram(ls.textRom);
    // Look for the expected VRAM address in the map
    const sym = mapSyms.get(expectedVram);
    // For now, just report expected
    driftEntries.push({
      oPath: ls.oPath,
      expectedVram,
      actualVram: sym ? expectedVram : null,
      drift: 0,
    });
  }

  // === Data/rodata/sdata region analysis ===
  console.log(`\n=== Non-text Region Analysis ===`);

  const rodataEnd = TEXT_START_ROM;
  const dataStart = TEXT_END_ROM;
  const sdataStart = _layout?.sdataStart ?? 0x4dbd8;
  const fileEnd = _info.fileEnd;

  // Compare rodata region
  let rodataDiffs = 0;
  for (let i = 0; i < rodataEnd - PAYLOAD_OFFSET; i++) {
    if (i < compareLen && origPayload[i] !== builtPayload[i]) rodataDiffs++;
  }
  console.log(`Rodata (${hex(PAYLOAD_OFFSET)}..${hex(rodataEnd)}): ${rodataDiffs} diff bytes`);

  // Compare data region
  let dataDiffs = 0;
  const dataPayStart = dataStart - PAYLOAD_OFFSET;
  const dataPayEnd = sdataStart - PAYLOAD_OFFSET;
  for (let i = dataPayStart; i < Math.min(dataPayEnd, compareLen); i++) {
    if (origPayload[i] !== builtPayload[i]) dataDiffs++;
  }
  console.log(`Data (${hex(dataStart)}..${hex(sdataStart)}): ${dataDiffs} diff bytes`);

  // Compare sdata region
  let sdataDiffs = 0;
  const sdataPayStart = sdataStart - PAYLOAD_OFFSET;
  const sdataPayEnd = fileEnd - PAYLOAD_OFFSET;
  for (let i = sdataPayStart; i < Math.min(sdataPayEnd, compareLen); i++) {
    if (origPayload[i] !== builtPayload[i]) sdataDiffs++;
  }
  console.log(`Sdata (${hex(sdataStart)}..${hex(fileEnd)}): ${sdataDiffs} diff bytes`);

  // === Summary ===
  console.log(`\n=== Summary ===`);
  console.log(`Built file size: ${builtBuf.length} (expected ${origBuf.length})`);
  console.log(`Size difference: ${builtBuf.length - origBuf.length} bytes`);
  console.log(`Payload diff bytes: ${diffCount} / ${compareLen}`);
  console.log(`Code gaps after o entries: ${codeGaps.length} (${codeGapBytes} bytes)`);

  if (diffCount === 0 && builtBuf.length === origBuf.length) {
    console.log("\n✓ MATCH!");
  } else {
    console.log("\n✗ MISMATCH");
  }
}

main();
