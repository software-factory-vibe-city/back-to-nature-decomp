/**
 * analyzeAccess.ts — Determine section types by analyzing how code accesses data symbols
 *
 * Two-phase analysis:
 *   1. Scan build/functions/*.s for references to data symbols and classify each by access pattern
 *   2. Aggregate per region (contiguous code/data blocks from build/functions.csv)
 *      and infer section type per region using heuristics:
 *        - Any GP-relative access in region → .sdata
 *        - No GP, any absolute write → .data
 *        - No GP, no writes, all reads/jump tables → .rodata
 *        - Ambiguous symbols don't override classified ones
 *
 * The critical distinction is .sdata vs everything else (GP-relative is unambiguous).
 * .rodata vs .data is approximate — refinable later during C decompilation.
 *
 * Usage: npx tsx tools/analyzeAccess.ts
 * Output: notes/access-patterns.md
 */

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

const CSV_PATH = "build/functions.csv";
const FUNCTIONS_DIR = "build/functions";
const OUTPUT_PATH = "notes/access-patterns.md";
const GP_VALUE = 0x8005e274;
const GP_RANGE_LOW = GP_VALUE - 0x8000;
const GP_RANGE_HIGH = GP_VALUE + 0x7fff;

// --- Types ---

interface CsvEntry {
  vrom: number;
  address: number;
  name: string;
  length: number;
  type: "code" | "data";
}

interface Region {
  index: number;
  startAddr: number;
  endAddr: number;
  type: "code" | "data";
  entryCount: number;
}

type AccessType =
  | "gp_read"
  | "gp_write"
  | "abs_read"
  | "abs_write"
  | "addr_taken"
  | "hi_only"
  | "jump_table";

interface SymbolAccess {
  symbol: string;
  address: number; // parsed from symbol name
  accessTypes: Set<AccessType>;
  refCount: number;
}

interface RegionAnalysis {
  region: Region;
  symbols: SymbolAccess[];
  accessTally: Map<AccessType, number>; // count of symbols (not refs) with each type
  inferredSection: string;
  confidence: string;
}

// --- Helpers ---

function hex(n: number): string {
  return "0x" + n.toString(16).toUpperCase().padStart(8, "0");
}

function hexSize(n: number): string {
  return "0x" + n.toString(16).toUpperCase();
}

function parseAddress(symbolName: string): number {
  const match = symbolName.match(/([0-9A-Fa-f]{8})$/);
  return match ? parseInt(match[1], 16) : 0;
}

// --- Phase 0: Parse CSV and build regions ---

function parseCSV(): CsvEntry[] {
  const lines = readFileSync(CSV_PATH, "utf-8").trim().split("\n");
  const entries: CsvEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const vrom = parseInt(parts[0], 16);
    const address = parseInt(parts[1], 16);
    const name = parts[2];
    const length = parseInt(parts[4], 16);
    const type: "code" | "data" =
      name.startsWith("T_") || name.startsWith("D_") ? "data" : "code";
    entries.push({ vrom, address, name, length, type });
  }
  return entries;
}

function mergeIntoRegions(entries: CsvEntry[]): Region[] {
  if (entries.length === 0) return [];
  const regions: Region[] = [];
  let idx = 0;
  let current: Region = {
    index: idx,
    startAddr: entries[0].address,
    endAddr: entries[0].address + entries[0].length,
    type: entries[0].type,
    entryCount: 1,
  };
  for (let i = 1; i < entries.length; i++) {
    const e = entries[i];
    if (e.type === current.type) {
      current.endAddr = e.address + e.length;
      current.entryCount++;
    } else {
      regions.push(current);
      idx++;
      current = {
        index: idx,
        startAddr: e.address,
        endAddr: e.address + e.length,
        type: e.type,
        entryCount: 1,
      };
    }
  }
  regions.push(current);
  return regions;
}

// --- Phase 1: Scan assembly files for access patterns ---

const LOAD_OPS = new Set([
  "lw", "lh", "lhu", "lb", "lbu", "lwl", "lwr", "lwc2",
]);
const STORE_OPS = new Set([
  "sw", "sh", "sb", "swl", "swr", "swc2",
]);

function scanAccessPatterns(): Map<string, SymbolAccess> {
  const symbols = new Map<string, SymbolAccess>();

  function getOrCreate(name: string): SymbolAccess {
    let s = symbols.get(name);
    if (!s) {
      s = { symbol: name, address: parseAddress(name), accessTypes: new Set(), refCount: 0 };
      symbols.set(name, s);
    }
    return s;
  }

  const files = readdirSync(FUNCTIONS_DIR).filter((f) => f.endsWith(".s"));

  const gpRelRegex = /^\s*\/\*.*\*\/\s+(\w+)\s+.*%gp_rel\((\w+)\)/;
  const loRegex = /^\s*\/\*.*\*\/\s+(\w+)\s+.*%lo\((\w+)\)/;
  const hiRegex = /^\s*\/\*.*\*\/\s+lui\s+.*%hi\((\w+)\)/;
  const jtblRegex = /\b(jtbl_[0-9A-Fa-f]+)\b/;

  for (const file of files) {
    const path = join(FUNCTIONS_DIR, file);
    const lines = readFileSync(path, "utf-8").split("\n");
    const hiSymbols = new Set<string>();
    const loSymbols = new Set<string>();

    for (const line of lines) {
      // GP-relative
      const gpMatch = gpRelRegex.exec(line);
      if (gpMatch) {
        const [, mnemonic, sym] = gpMatch;
        const s = getOrCreate(sym);
        s.accessTypes.add(STORE_OPS.has(mnemonic) ? "gp_write" : "gp_read");
        s.refCount++;
        continue;
      }

      // %lo
      const loMatch = loRegex.exec(line);
      if (loMatch) {
        const [, mnemonic, sym] = loMatch;
        const s = getOrCreate(sym);
        loSymbols.add(sym);
        if (STORE_OPS.has(mnemonic)) s.accessTypes.add("abs_write");
        else if (LOAD_OPS.has(mnemonic)) s.accessTypes.add("abs_read");
        else s.accessTypes.add("addr_taken");
        s.refCount++;
        continue;
      }

      // %hi
      const hiMatch = hiRegex.exec(line);
      if (hiMatch) {
        hiSymbols.add(hiMatch[1]);
        continue;
      }

      // Jump tables
      const jtblMatch = jtblRegex.exec(line);
      if (jtblMatch) {
        const s = getOrCreate(jtblMatch[1]);
        s.accessTypes.add("jump_table");
        s.refCount++;
      }
    }

    // hi-only symbols
    for (const sym of hiSymbols) {
      if (!loSymbols.has(sym)) {
        const s = getOrCreate(sym);
        if (s.accessTypes.size === 0) s.accessTypes.add("hi_only");
        s.refCount++;
      }
    }
  }

  return symbols;
}

// --- Phase 2: Map symbols to regions and aggregate ---

function findRegion(regions: Region[], address: number): Region | undefined {
  // Data regions only — code regions don't have data symbols
  for (const r of regions) {
    if (r.type === "data" && address >= r.startAddr && address < r.endAddr) {
      return r;
    }
  }
  return undefined;
}

function inferSectionForSymbol(s: SymbolAccess): string {
  const t = s.accessTypes;
  if (t.has("jump_table")) return ".rodata";
  if (t.has("gp_read") || t.has("gp_write")) return ".sdata";
  if (t.has("abs_write")) return ".data";
  if (t.has("abs_read")) return ".rodata or .data";
  if (t.has("addr_taken")) return "ambiguous";
  if (t.has("hi_only")) return "ambiguous";
  return "unknown";
}

function inferSectionForRegion(analysis: RegionAnalysis): { section: string; confidence: string } {
  const { region, accessTally, symbols } = analysis;
  const total = symbols.length;

  if (total === 0) {
    // No referenced symbols in this region — use position heuristic
    const inGP = region.startAddr >= GP_RANGE_LOW && region.endAddr <= GP_RANGE_HIGH;
    if (inGP) return { section: ".sdata", confidence: "low (no refs, in GP range)" };
    return { section: ".data", confidence: "low (no refs, outside GP range)" };
  }

  const gpCount = countSymsWith(symbols, (s) =>
    s.accessTypes.has("gp_read") || s.accessTypes.has("gp_write")
  );
  const absWriteCount = countSymsWith(symbols, (s) => s.accessTypes.has("abs_write"));
  const absReadCount = countSymsWith(symbols, (s) => s.accessTypes.has("abs_read"));
  const jtblCount = countSymsWith(symbols, (s) => s.accessTypes.has("jump_table"));
  const classifiedCount = gpCount + absWriteCount + absReadCount + jtblCount;

  // Any GP-relative → .sdata (strongest signal)
  if (gpCount > 0) {
    if (absWriteCount > 0 || absReadCount > 0) {
      return {
        section: ".sdata",
        confidence: `high (${gpCount}/${total} GP-relative, ${absWriteCount + absReadCount} absolute — mixed access)`,
      };
    }
    return { section: ".sdata", confidence: `high (${gpCount}/${total} GP-relative)` };
  }

  // No GP access — check absolute patterns
  if (absWriteCount > 0) {
    return { section: ".data", confidence: `high (${absWriteCount}/${total} absolute writes)` };
  }

  if (jtblCount > 0 && absReadCount >= 0 && absWriteCount === 0) {
    return { section: ".rodata", confidence: `high (${jtblCount} jump tables, ${absReadCount} reads, no writes)` };
  }

  if (absReadCount > 0) {
    return { section: ".rodata", confidence: `medium (${absReadCount}/${total} absolute reads, no writes)` };
  }

  // All ambiguous
  const inGP = region.startAddr >= GP_RANGE_LOW && region.endAddr <= GP_RANGE_HIGH;
  if (inGP) return { section: ".sdata", confidence: `low (all ambiguous, but in GP range)` };
  return { section: ".data", confidence: `low (all ${total} symbols ambiguous)` };
}

function countSymsWith(symbols: SymbolAccess[], pred: (s: SymbolAccess) => boolean): number {
  return symbols.filter(pred).length;
}

function analyzeRegions(
  regions: Region[],
  symbols: Map<string, SymbolAccess>
): RegionAnalysis[] {
  // Build per-region analysis for data regions only
  const dataRegions = regions.filter((r) => r.type === "data");
  const analyses: RegionAnalysis[] = dataRegions.map((region) => ({
    region,
    symbols: [],
    accessTally: new Map(),
    inferredSection: "",
    confidence: "",
  }));

  // Map each symbol into its region
  const regionMap = new Map<Region, RegionAnalysis>();
  for (const a of analyses) regionMap.set(a.region, a);

  let outsideBinary = 0;
  for (const sym of symbols.values()) {
    const r = findRegion(regions, sym.address);
    if (r) {
      regionMap.get(r)!.symbols.push(sym);
    } else {
      outsideBinary++;
    }
  }

  // Build tally and infer section for each region
  for (const a of analyses) {
    for (const sym of a.symbols) {
      for (const t of sym.accessTypes) {
        a.accessTally.set(t, (a.accessTally.get(t) || 0) + 1);
      }
    }
    const result = inferSectionForRegion(a);
    a.inferredSection = result.section;
    a.confidence = result.confidence;
  }

  console.log(`  ${outsideBinary} symbols reference addresses outside the binary (external/runtime)`);

  return analyses;
}

// --- Report generation ---

function generateReport(
  regions: Region[],
  analyses: RegionAnalysis[],
  allSymbols: Map<string, SymbolAccess>
): string {
  const lines: string[] = [];

  lines.push("# Data Access Pattern Analysis");
  lines.push("");
  lines.push("Generated by `tools/analyzeAccess.ts`");
  lines.push(`GP value: ${hex(GP_VALUE)} (range: ${hex(GP_RANGE_LOW)}–${hex(GP_RANGE_HIGH)})`);
  lines.push("");

  // --- Region-level summary ---
  lines.push("## Region Classification");
  lines.push("");
  lines.push("| # | Start | End | Size | Inferred | Confidence | Symbols |");
  lines.push("|---|-------|-----|------|----------|------------|---------|");
  for (const a of analyses) {
    const r = a.region;
    const size = r.endAddr - r.startAddr;
    lines.push(
      `| ${r.index + 1} | ${hex(r.startAddr)} | ${hex(r.endAddr)} | ${hexSize(size)} | **${a.inferredSection}** | ${a.confidence} | ${a.symbols.length} |`
    );
  }
  lines.push("");

  // --- Per-region detail ---
  lines.push("## Region Details");
  lines.push("");

  for (const a of analyses) {
    const r = a.region;
    const size = r.endAddr - r.startAddr;
    lines.push(`### Region ${r.index + 1}: ${hex(r.startAddr)}–${hex(r.endAddr)} (${hexSize(size)}) → **${a.inferredSection}**`);
    lines.push("");
    lines.push(`Confidence: ${a.confidence}`);
    lines.push("");

    // Access type tally
    if (a.accessTally.size > 0) {
      lines.push("Access type breakdown (by symbol count):");
      lines.push("");
      lines.push("| Access type | Symbols |");
      lines.push("|------------|---------|");
      for (const [type, count] of [...a.accessTally.entries()].sort()) {
        lines.push(`| ${type} | ${count} |`);
      }
      lines.push("");
    }

    // Symbol list (abbreviated for large regions)
    const syms = a.symbols.sort((a, b) => a.address - b.address);
    if (syms.length === 0) {
      lines.push("No referenced symbols in this region.");
      lines.push("");
    } else if (syms.length <= 30) {
      lines.push("| Symbol | Access types | Per-symbol inference | Refs |");
      lines.push("|--------|-------------|---------------------|------|");
      for (const s of syms) {
        const types = [...s.accessTypes].sort().join(", ");
        lines.push(`| ${s.symbol} | ${types} | ${inferSectionForSymbol(s)} | ${s.refCount} |`);
      }
      lines.push("");
    } else {
      lines.push(`${syms.length} symbols (showing first 15 and last 5):`);
      lines.push("");
      lines.push("| Symbol | Access types | Per-symbol inference | Refs |");
      lines.push("|--------|-------------|---------------------|------|");
      for (const s of syms.slice(0, 15)) {
        const types = [...s.accessTypes].sort().join(", ");
        lines.push(`| ${s.symbol} | ${types} | ${inferSectionForSymbol(s)} | ${s.refCount} |`);
      }
      lines.push("| ... | ... | ... | ... |");
      for (const s of syms.slice(-5)) {
        const types = [...s.accessTypes].sort().join(", ");
        lines.push(`| ${s.symbol} | ${types} | ${inferSectionForSymbol(s)} | ${s.refCount} |`);
      }
      lines.push("");
    }
  }

  // --- Global summary ---
  lines.push("## Global Summary");
  lines.push("");
  lines.push(`Total symbols scanned: ${allSymbols.size}`);
  lines.push("");

  const sectionCounts = new Map<string, number>();
  for (const a of analyses) {
    sectionCounts.set(a.inferredSection, (sectionCounts.get(a.inferredSection) || 0) + 1);
  }
  lines.push("| Inferred section | Regions |");
  lines.push("|-----------------|---------|");
  for (const [section, count] of [...sectionCounts.entries()].sort()) {
    lines.push(`| ${section} | ${count} |`);
  }
  lines.push("");

  return lines.join("\n");
}

// --- Main ---

console.log("Phase 0: Parsing CSV and building regions...");
const csvEntries = parseCSV();
const regions = mergeIntoRegions(csvEntries);
console.log(`  ${regions.length} regions (${regions.filter((r) => r.type === "data").length} data)`);

console.log("Phase 1: Scanning assembly files for access patterns...");
const symbols = scanAccessPatterns();
console.log(`  ${symbols.size} symbols referenced`);

console.log("Phase 2: Aggregating per region...");
const analyses = analyzeRegions(regions, symbols);

const report = generateReport(regions, analyses, symbols);
writeFileSync(OUTPUT_PATH, report);
console.log(`\nWrote report to ${OUTPUT_PATH}`);
