/**
 * analyzeLayout.ts — Classify binary entries as code or data using byte-level heuristics
 *
 * Reads build/functions.csv (from spimdisasm with --disasm-unknown) and the raw binary,
 * then independently classifies each entry by inspecting actual bytes rather than
 * trusting spimdisasm's T_/func_ labels.
 *
 * Heuristics for DATA:
 * - High percentage of zero words
 * - No jr $ra (function return)
 * - No addiu $sp prologue
 * - Not called by any other function (no jal references)
 * - Branch/jump targets point outside the binary
 *
 * Usage: npx tsx tools/analyzeLayout.ts
 * Output: notes/layout_new.md
 *
 * Also exports classifyEntries() for programmatic use by bootstrap.ts.
 */

import { readFileSync, writeFileSync } from "fs";
import { loadPsxExeInfo, type PsxExeInfo } from "./psxExeInfo.ts";

// Known code addresses that heuristics may misclassify
// (e.g. __start has no jr $ra because it never returns, uses addi not addiu)
const KNOWN_CODE: Set<number> = new Set([
  0x80011278, // __start — entry point, never returns, uses addi not addiu
  0x80041AB4, // GTE/COP0 code — handwritten, spimdisasm refuses without --disasm-unknown
  0x800425A4, // interrupt trampoline — jr $t2 not jr $ra
  0x800425C4, // GTE/COP0 code — handwritten, spimdisasm refuses without --disasm-unknown
]);

export interface CsvEntry {
  vrom: number;
  address: number;
  name: string;
  length: number;
  spimdisasmType: "code" | "data"; // what spimdisasm thinks
}

export type Classification = "code" | "data";

export interface HeuristicResult {
  entry: CsvEntry;
  classification: Classification;
  confidence: "high" | "medium" | "low";
  signals: string[];
  // Raw signal values for debugging
  zeroWordPct: number;
  hasJrRa: boolean;
  hasPrologue: boolean;
  isCalled: boolean;
  validBranchPct: number;
}

export interface LayoutSection {
  startAddr: number;
  endAddr: number;
  type: Classification;
  entryCount: number;
  sectionName: string; // .rodata, .text, .data, .sdata
}

function hex(n: number): string {
  return "0x" + n.toString(16).toUpperCase().padStart(8, "0");
}

function hexSize(n: number): string {
  return "0x" + n.toString(16).toUpperCase();
}

export function parseCSV(path: string): CsvEntry[] {
  const lines = readFileSync(path, "utf-8").trim().split("\n");
  const entries: CsvEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const vrom = parseInt(parts[0], 16);
    const address = parseInt(parts[1], 16);
    const name = parts[2];
    const length = parseInt(parts[4], 16);
    const spimdisasmType: "code" | "data" =
      name.startsWith("T_") || name.startsWith("D_") ? "data" : "code";

    entries.push({ vrom, address, name, length, spimdisasmType });
  }

  return entries;
}

/** Build set of addresses that are jal targets, and set of addresses that call others */
function buildCallInfo(csvPath: string): { callTargets: Set<number>; callers: Set<number> } {
  const lines = readFileSync(csvPath, "utf-8").trim().split("\n");
  const callTargets = new Set<number>();
  const callers = new Set<number>();

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const address = parseInt(parts[1], 16);
    // Column 6 (index 6) is "functions called by this function" — bracket-delimited list
    const match = lines[i].match(/\[([^\]]*)\]/);
    if (match && match[1] && match[1].length > 0) {
      callers.add(address);
      const names = match[1].split(";");
      for (const name of names) {
        const trimmed = name.trim();
        if (trimmed.startsWith("func_") || trimmed === "__start") {
          const addrMatch = trimmed.match(/func_([0-9a-fA-F]+)/);
          if (addrMatch) {
            callTargets.add(parseInt(addrMatch[1], 16));
          }
          if (trimmed === "__start") {
            callTargets.add(0x80011278);
          }
        }
      }
    }
  }

  return { callTargets, callers };
}

/** Read 32-bit little-endian words from the binary for a given entry */
function readWords(binary: Buffer, entry: CsvEntry, loadAddr: number, headerSize: number): Uint32Array {
  const offset = entry.address - loadAddr + headerSize;
  const wordCount = Math.floor(entry.length / 4);
  const words = new Uint32Array(wordCount);
  for (let i = 0; i < wordCount; i++) {
    words[i] = binary.readUInt32LE(offset + i * 4);
  }
  return words;
}

/** Check if a MIPS word is a jr $ra instruction */
function isJrRa(word: number): boolean {
  return word === 0x03e00008;
}

/** Check if a word is addiu $sp, $sp, -N (function prologue) */
function isSpPrologue(word: number): boolean {
  const opRsRt = word >>> 16;
  if (opRsRt !== 0x27bd) return false;
  const imm = word & 0xffff;
  return imm >= 0x8000; // negative immediate = allocating stack
}

/** Check if a word is a JAL instruction and if its target is within the binary */
function analyzeJal(word: number, binaryStart: number, binaryEnd: number): { isJal: boolean; targetInRange: boolean } {
  const op = word >>> 26;
  if (op !== 3) return { isJal: false, targetInRange: false };
  const target = ((word & 0x03ffffff) << 2) | 0x80000000;
  return { isJal: true, targetInRange: target >= binaryStart && target < binaryEnd };
}

/** Check if a word is a branch instruction */
function isBranch(word: number): boolean {
  const op = word >>> 26;
  if (op >= 4 && op <= 7) return true;
  if (op === 1) return true;
  return false;
}

/** Check if a word is a J (jump) instruction */
function analyzeJ(word: number, binaryStart: number, binaryEnd: number): { isJ: boolean; targetInRange: boolean } {
  const op = word >>> 26;
  if (op !== 2) return { isJ: false, targetInRange: false };
  const target = ((word & 0x03ffffff) << 2) | 0x80000000;
  return { isJ: true, targetInRange: target >= binaryStart && target < binaryEnd };
}

/** Classify a single entry by inspecting its bytes */
function classifyEntry(
  entry: CsvEntry,
  binary: Buffer,
  callTargets: Set<number>,
  callers: Set<number>,
  loadAddr: number,
  headerSize: number,
  binaryStart: number,
  binaryEnd: number
): HeuristicResult {
  // Override for known code
  if (KNOWN_CODE.has(entry.address)) {
    return {
      entry,
      classification: "code",
      confidence: "high",
      signals: ["known code (override)"],
      zeroWordPct: 0,
      hasJrRa: false,
      hasPrologue: false,
      isCalled: true,
      validBranchPct: 100,
    };
  }

  const words = readWords(binary, entry, loadAddr, headerSize);
  const wordCount = words.length;

  if (wordCount === 0) {
    return {
      entry,
      classification: "data",
      confidence: "low",
      signals: ["empty entry"],
      zeroWordPct: 100,
      hasJrRa: false,
      hasPrologue: false,
      isCalled: false,
      validBranchPct: 0,
    };
  }

  // Signal 1: percentage of zero words
  let zeroWords = 0;
  for (const w of words) {
    if (w === 0) zeroWords++;
  }
  const zeroWordPct = (zeroWords / wordCount) * 100;

  // Signal 2: presence of jr $ra
  let hasJrRa = false;
  for (const w of words) {
    if (isJrRa(w)) { hasJrRa = true; break; }
  }

  // Signal 3: presence of stack prologue
  let hasPrologue = false;
  for (let i = 0; i < Math.min(4, wordCount); i++) {
    if (isSpPrologue(words[i])) { hasPrologue = true; break; }
  }

  // Signal 4: is this entry a jal target? Does it call others?
  const isCalled = callTargets.has(entry.address);
  const callsOthers = callers.has(entry.address);

  // Signal 5: JAL/J target validity
  let jalCount = 0;
  let jalValid = 0;
  let jCount = 0;
  let jValid = 0;
  for (const w of words) {
    const jal = analyzeJal(w, binaryStart, binaryEnd);
    if (jal.isJal) {
      jalCount++;
      if (jal.targetInRange) jalValid++;
    }
    const j = analyzeJ(w, binaryStart, binaryEnd);
    if (j.isJ) {
      jCount++;
      if (j.targetInRange) jValid++;
    }
  }
  const totalJumps = jalCount + jCount;
  const validJumps = jalValid + jValid;
  const validBranchPct = totalJumps > 0 ? (validJumps / totalJumps) * 100 : -1;

  // Signal 6: branch instruction count
  let branchCount = 0;
  for (const w of words) {
    if (isBranch(w)) branchCount++;
  }
  const branchPct = (branchCount / wordCount) * 100;

  // --- Scoring ---
  const signals: string[] = [];
  let dataScore = 0;
  let codeScore = 0;

  if (zeroWordPct > 80) {
    dataScore += 3;
    signals.push(`${zeroWordPct.toFixed(0)}% zero words`);
  } else if (zeroWordPct > 50) {
    dataScore += 1;
    signals.push(`${zeroWordPct.toFixed(0)}% zero words`);
  }

  if (hasJrRa) {
    codeScore += 2;
    signals.push("has jr $ra");
  } else {
    dataScore += 1;
    signals.push("no jr $ra");
  }

  if (hasPrologue) {
    codeScore += 2;
    signals.push("has stack prologue");
  }

  if (isCalled) {
    codeScore += 3;
    signals.push("called by other functions");
  } else {
    dataScore += 1;
    signals.push("not called by anything");
  }

  if (callsOthers) {
    codeScore += 3;
    signals.push("calls other functions (from CSV)");
  }

  if (totalJumps > 0) {
    if (validBranchPct < 30) {
      dataScore += 3;
      signals.push(`${validJumps}/${totalJumps} jumps to valid targets`);
    } else if (validBranchPct > 80) {
      codeScore += 2;
      signals.push(`${validJumps}/${totalJumps} jumps to valid targets`);
    } else {
      signals.push(`${validJumps}/${totalJumps} jumps to valid targets`);
    }
  }

  if (branchPct > 3) {
    codeScore += 1;
    signals.push(`${branchPct.toFixed(1)}% branch instructions`);
  } else if (branchPct === 0 && wordCount > 8) {
    dataScore += 1;
    signals.push("no branch instructions");
  }

  const classification: Classification = dataScore > codeScore ? "data" : "code";
  const margin = Math.abs(dataScore - codeScore);
  const confidence = margin >= 4 ? "high" : margin >= 2 ? "medium" : "low";

  return {
    entry,
    classification,
    confidence,
    signals,
    zeroWordPct,
    hasJrRa,
    hasPrologue,
    isCalled,
    validBranchPct,
  };
}

/**
 * Classify all entries from a CSV file. Importable by bootstrap.ts.
 */
export function classifyEntries(
  csvPath: string,
  binary: Buffer,
  loadAddr: number,
  payloadOffset: number,
  payloadSize: number,
): HeuristicResult[] {
  const entries = parseCSV(csvPath);
  const { callTargets, callers } = buildCallInfo(csvPath);

  const binaryStart = loadAddr;
  const binaryEnd = loadAddr + payloadSize;

  return entries.map(e =>
    classifyEntry(e, binary, callTargets, callers, loadAddr, payloadOffset, binaryStart, binaryEnd)
  );
}

/**
 * Infer section boundaries from classification results.
 * Returns { rodataStart, textStart, dataStart, sdataStart, fileEnd } as ROM offsets.
 */
export function inferSectionBoundaries(
  results: HeuristicResult[],
  info: PsxExeInfo,
): { rodataStart: number; textStart: number; dataStart: number; sdataStart: number; fileEnd: number } {
  // Build contiguous sections from classification
  const sections: { startAddr: number; endAddr: number; type: Classification }[] = [];

  let cur = {
    startAddr: results[0].entry.address,
    endAddr: results[0].entry.address + results[0].entry.length,
    type: results[0].classification,
  };

  for (let i = 1; i < results.length; i++) {
    const r = results[i];
    if (r.classification === cur.type) {
      cur.endAddr = r.entry.address + r.entry.length;
    } else {
      sections.push(cur);
      cur = {
        startAddr: r.entry.address,
        endAddr: r.entry.address + r.entry.length,
        type: r.classification,
      };
    }
  }
  sections.push(cur);

  // Pattern: rodata(data) → text(code) → data(data) → sdata(data)
  // Find the first code section = .text start
  // The data section before .text = .rodata
  // After .text, the next data section = .data
  // The GP range determines .sdata vs .data boundary
  const gpRangeLow = info.gpValue - 0x8000;

  const rodataStart = info.payloadOffset; // always starts at payload beginning
  let textStart = info.payloadOffset;
  let dataStart = info.fileEnd;
  let sdataStart = info.fileEnd;

  // Find first code section
  for (const s of sections) {
    if (s.type === "code") {
      textStart = s.startAddr - info.loadAddr + info.payloadOffset;
      break;
    }
  }

  // Find data after text: first data section after the last code section
  let lastCodeEnd = textStart;
  for (const s of sections) {
    if (s.type === "code") {
      lastCodeEnd = s.endAddr - info.loadAddr + info.payloadOffset;
    }
  }
  dataStart = lastCodeEnd;

  // Find sdata: data section that starts within GP range
  for (const s of sections) {
    const sRom = s.startAddr - info.loadAddr + info.payloadOffset;
    if (s.type === "data" && s.startAddr >= gpRangeLow && sRom > dataStart) {
      sdataStart = sRom;
      break;
    }
  }

  return {
    rodataStart,
    textStart,
    dataStart,
    sdataStart,
    fileEnd: info.fileEnd,
  };
}

function inferSectionName(startAddr: number, endAddr: number, info: PsxExeInfo): string {
  const gpRangeLow = info.gpValue - 0x8000;
  const gpRangeHigh = info.gpValue + 0x7fff;

  // Use entry point as text/rodata boundary
  if (endAddr <= info.entryPoint) return ".rodata";
  if (startAddr >= gpRangeLow && endAddr <= gpRangeHigh + 0x1000) {
    return ".sdata";
  }
  return "";
}

function generateReport(
  results: HeuristicResult[],
  info: PsxExeInfo,
  csvPath: string,
  binaryPath: string,
): string {
  const gpRangeLow = info.gpValue - 0x8000;
  const gpRangeHigh = info.gpValue + 0x7fff;

  const lines: string[] = [];

  lines.push("# Binary Layout Analysis (Heuristic Classification)");
  lines.push("");
  lines.push("Generated by `tools/analyzeLayout.ts`");
  lines.push("Classifies each CSV entry as code or data based on byte-level heuristics,");
  lines.push("independent of spimdisasm's T_/func_ labels.");
  lines.push("");
  lines.push(`Binary: \`${binaryPath}\``);
  lines.push(`CSV: \`${csvPath}\` (without --disasm-unknown, finer entry granularity)`);
  lines.push(`GP value: ${hex(info.gpValue)} (range: ${hex(gpRangeLow)}–${hex(gpRangeHigh)})`);
  lines.push("");

  lines.push("## Disagreements with spimdisasm (without --disasm-unknown)");
  lines.push("");
  lines.push("Entries where our heuristic classification differs from spimdisasm's T_/func_ label.");
  lines.push("CSV is from the without --disasm-unknown run, which has finer entry");
  lines.push("granularity. spimdisasm's T_/func_ labels are compared against our heuristics.");
  lines.push("");

  // Build contiguous sections
  const sections: {
    startAddr: number;
    endAddr: number;
    type: Classification;
    entryCount: number;
    entries: HeuristicResult[];
  }[] = [];

  let cur = {
    startAddr: results[0].entry.address,
    endAddr: results[0].entry.address + results[0].entry.length,
    type: results[0].classification,
    entryCount: 1,
    entries: [results[0]],
  };

  for (let i = 1; i < results.length; i++) {
    const r = results[i];
    if (r.classification === cur.type) {
      cur.endAddr = r.entry.address + r.entry.length;
      cur.entryCount++;
      cur.entries.push(r);
    } else {
      sections.push(cur);
      cur = {
        startAddr: r.entry.address,
        endAddr: r.entry.address + r.entry.length,
        type: r.classification,
        entryCount: 1,
        entries: [r],
      };
    }
  }
  sections.push(cur);

  lines.push("## Section Layout");
  lines.push("");
  lines.push("| # | Type | Start | End | Size | Entries | Section |");
  lines.push("|---|------|-------|-----|------|---------|---------|");

  sections.forEach((s, i) => {
    const size = s.endAddr - s.startAddr;
    let sectionName = inferSectionName(s.startAddr, s.endAddr, info);
    if (!sectionName) {
      sectionName = s.type === "code" ? ".text" : ".data";
    }
    lines.push(
      `| ${i + 1} | ${s.type} | ${hex(s.startAddr)} | ${hex(s.endAddr)} | ${hexSize(size)} (${size.toLocaleString()}) | ${s.entryCount} | ${sectionName} |`
    );
  });

  lines.push("");

  lines.push("## Per-Entry Classification Detail");
  lines.push("");
  lines.push("Showing all entries from 0x80048000 onward (the ambiguous zone).");
  lines.push("");
  lines.push("| Address | Size | Heuristic | Conf | spimdisasm | Signals |");
  lines.push("|---------|------|-----------|------|------------|---------|");

  for (const r of results) {
    if (r.entry.address < 0x80048000) continue;
    const agree = r.classification === r.entry.spimdisasmType ? "" : " **DISAGREE**";
    lines.push(
      `| ${hex(r.entry.address)} | ${hexSize(r.entry.length)} | ${r.classification} | ${r.confidence} | ${r.entry.spimdisasmType}${agree} | ${r.signals.join("; ")} |`
    );
  }

  lines.push("");

  const codeCount = results.filter(r => r.classification === "code").length;
  const dataCount = results.filter(r => r.classification === "data").length;
  const highConf = results.filter(r => r.confidence === "high").length;
  const lowConf = results.filter(r => r.confidence === "low").length;

  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total entries | ${results.length} |`);
  lines.push(`| Classified as code | ${codeCount} |`);
  lines.push(`| Classified as data | ${dataCount} |`);
  lines.push(`| High confidence | ${highConf} |`);
  lines.push(`| Low confidence | ${lowConf} |`);
  lines.push(`| Contiguous sections | ${sections.length} |`);

  return lines.join("\n");
}

// CLI main — only runs when executed directly
const isMainModule = process.argv[1]?.endsWith("analyzeLayout.ts");
if (isMainModule) {
  const info = loadPsxExeInfo();
  const CSV_PATH = "build/without-unknown/functions.csv";
  const OUTPUT_PATH = "notes/layout_new.md";

  const binary = readFileSync(info.binaryPath);
  const results = classifyEntries(CSV_PATH, binary, info.loadAddr, info.payloadOffset, info.payloadSize);

  const report = generateReport(results, info, CSV_PATH, info.binaryPath);
  writeFileSync(OUTPUT_PATH, report);
  console.log(`Wrote report to ${OUTPUT_PATH}`);

  // Quick summary
  const sectionCounts = new Map<string, number>();
  for (const r of results) {
    const key = r.classification;
    sectionCounts.set(key, (sectionCounts.get(key) || 0) + 1);
  }
  for (const [type, count] of sectionCounts) {
    console.log(`  ${type}: ${count} entries`);
  }
}
