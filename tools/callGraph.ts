/**
 * callGraph.ts
 *
 * Builds a call graph from disassembled functions and outputs
 * a prioritized JSON file for the decompilation pipeline.
 *
 * Usage:
 *   npx tsx tools/callGraph.ts              # build graph + summary
 *   npx tsx tools/callGraph.ts --top 20     # also print top 20 priority functions
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");
const SRC_DIR = join(ROOT, "src");
const ASM_DIR = join(ROOT, "build/asm/nonmatchings");
const OUT_FILE = join(ROOT, "build/callGraph.json");

const args = process.argv.slice(2);
const topIdx = args.indexOf("--top");
const topN = topIdx >= 0 ? parseInt(args[topIdx + 1], 10) : 0;

// --- Step 1: Parse splat.yaml for function list + sizes ---

const yamlLines = readFileSync(SPLAT_YAML, "utf-8").split("\n");
const segRegex = /^\s*-\s*\[(0x[0-9A-Fa-f]+),\s*(asm|c)(?:,\s*(\S+))?\]\s*#\s*(0x[0-9A-Fa-f]+)\s+(\S+)/;
const nextOffsetRegex = /^\s*-\s*\[(0x[0-9A-Fa-f]+)/;

interface RawSeg {
  offset: number;
  type: string;
  vram: string;
  name: string;
}

const rawSegments: RawSeg[] = [];
const allOffsets: number[] = [];

for (const line of yamlLines) {
  const match = line.match(segRegex);
  if (match) {
    const [, offsetStr, type, , vram, funcName] = match;
    rawSegments.push({
      offset: parseInt(offsetStr, 16),
      type,
      vram,
      name: funcName,
    });
  }
  const offMatch = line.match(nextOffsetRegex);
  if (offMatch) {
    allOffsets.push(parseInt(offMatch[1], 16));
  }
}

allOffsets.sort((a, b) => a - b);

interface FuncEntry {
  name: string;
  vram: string;
  size: number;
  tier: number;
  priority: number;
  callerCount: number;
  calls: string[];
  calledBy: string[];
  sdkCalls: string[];
  instructionCount: number;
  decompiled: boolean;
}

const funcMap = new Map<string, FuncEntry>();
const funcNames = new Set<string>();

// Build initial function entries from splat.yaml
for (const seg of rawSegments) {
  const idx = allOffsets.indexOf(seg.offset);
  const nextOffset = idx >= 0 && idx + 1 < allOffsets.length ? allOffsets[idx + 1] : seg.offset;
  const size = nextOffset - seg.offset;

  funcNames.add(seg.name);
  funcMap.set(seg.name, {
    name: seg.name,
    vram: seg.vram,
    size,
    tier: 1,
    priority: 0,
    callerCount: 0,
    calls: [],
    calledBy: [],
    sdkCalls: [],
    instructionCount: 0,
    decompiled: false,
  });
}

// --- Step 2: Parse .s files for call targets + instruction counts ---

const jalRegex = /^\s*\/\*.*\*\/\s+jal\s+(\S+)/;
const instrRegex = /^\s*\/\*\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s+\*\//;
const gameFuncRegex = /^func_[0-9A-Fa-f]{8}$/;

for (const [name, entry] of funcMap) {
  const sFile = join(ASM_DIR, name, `${name}.s`);
  if (!existsSync(sFile)) continue;

  const content = readFileSync(sFile, "utf-8").split("\n");
  const gameCalls = new Set<string>();
  const sdkCalls = new Set<string>();
  let instrCount = 0;

  for (const line of content) {
    if (instrRegex.test(line)) instrCount++;

    const jalMatch = line.match(jalRegex);
    if (jalMatch) {
      const target = jalMatch[1];
      if (gameFuncRegex.test(target)) {
        if (target !== name) gameCalls.add(target); // exclude self-recursion from calls
      } else {
        sdkCalls.add(target);
      }
    }
  }

  entry.calls = [...gameCalls];
  entry.sdkCalls = [...sdkCalls];
  entry.instructionCount = instrCount;
}

// --- Step 3: Build reverse edges (calledBy) ---

for (const [name, entry] of funcMap) {
  for (const target of entry.calls) {
    const targetEntry = funcMap.get(target);
    if (targetEntry) {
      targetEntry.calledBy.push(name);
    }
  }
}

// Set callerCount
for (const entry of funcMap.values()) {
  entry.callerCount = entry.calledBy.length;
}

// --- Step 4: Classify tiers ---

for (const entry of funcMap.values()) {
  if (entry.calls.length > 0) {
    entry.tier = 3;
  } else if (entry.sdkCalls.length > 0) {
    entry.tier = 2;
  } else {
    entry.tier = 1;
  }
}

// --- Step 5: Check decompilation status ---

for (const entry of funcMap.values()) {
  const cFile = join(SRC_DIR, `${entry.name}.c`);
  if (existsSync(cFile)) {
    const content = readFileSync(cFile, "utf-8");
    const hasIncludeAsm = content.includes("INCLUDE_ASM(");
    if (!hasIncludeAsm) {
      entry.decompiled = true;
    }
  }
}

// --- Step 6: Compute Tier 3 depth ---

const depthMap = new Map<string, number>();

// Tier 1 and 2 are depth 0
for (const entry of funcMap.values()) {
  if (entry.tier <= 2) {
    depthMap.set(entry.name, 0);
  }
}

// BFS to resolve Tier 3 depths
let changed = true;
while (changed) {
  changed = false;
  for (const entry of funcMap.values()) {
    if (entry.tier !== 3 || depthMap.has(entry.name)) continue;

    let maxCalleeDepth = -1;
    let allResolved = true;

    for (const callee of entry.calls) {
      const d = depthMap.get(callee);
      if (d === undefined) {
        allResolved = false;
        break;
      }
      if (d > maxCalleeDepth) maxCalleeDepth = d;
    }

    if (allResolved) {
      depthMap.set(entry.name, maxCalleeDepth + 1);
      changed = true;
    }
  }
}

// Functions in cycles get max depth
let maxDepth = 0;
for (const d of depthMap.values()) {
  if (d > maxDepth) maxDepth = d;
}
for (const entry of funcMap.values()) {
  if (entry.tier === 3 && !depthMap.has(entry.name)) {
    depthMap.set(entry.name, maxDepth + 1);
  }
}

// --- Step 7: Assign priority and sort ---

const entries = [...funcMap.values()];

entries.sort((a, b) => {
  // Decompiled goes to end
  if (a.decompiled !== b.decompiled) return a.decompiled ? 1 : -1;

  // Sort by tier
  if (a.tier !== b.tier) return a.tier - b.tier;

  // Within Tier 3, sort by depth
  if (a.tier === 3) {
    const da = depthMap.get(a.name) ?? maxDepth + 1;
    const db = depthMap.get(b.name) ?? maxDepth + 1;
    if (da !== db) return da - db;
  }

  // Smaller instruction count first
  if (a.instructionCount !== b.instructionCount) return a.instructionCount - b.instructionCount;

  // Higher caller count first (breaks ties)
  return b.callerCount - a.callerCount;
});

// Assign sequential priority
entries.forEach((e, i) => {
  e.priority = i + 1;
});

// --- Step 8: Write JSON + print summary ---

const tier1 = entries.filter((e) => e.tier === 1).length;
const tier2 = entries.filter((e) => e.tier === 2).length;
const tier3 = entries.filter((e) => e.tier === 3).length;
const decompiledCount = entries.filter((e) => e.decompiled).length;

const output = {
  functions: entries,
  stats: {
    total: entries.length,
    tier1,
    tier2,
    tier3,
    decompiled: decompiledCount,
  },
};

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));

console.log(`Call graph: ${entries.length} functions`);
console.log(`  Tier 1 (pure leaf):    ${String(tier1).padStart(3)} functions`);
console.log(`  Tier 2 (SDK-only):     ${String(tier2).padStart(3)} functions`);
console.log(`  Tier 3 (game callers): ${String(tier3).padStart(3)} functions`);
console.log(`  Already decompiled:    ${String(decompiledCount).padStart(3)} functions`);
console.log(`Wrote ${OUT_FILE}`);

if (topN > 0) {
  console.log();
  console.log(`Top ${topN} priority functions:`);
  console.log(`${"#".padStart(4)}  ${"Tier".padEnd(4)}  ${"Instrs".padStart(6)}  ${"Callers".padStart(7)}  Name`);
  console.log("-".repeat(50));
  const top = entries.filter((e) => !e.decompiled).slice(0, topN);
  for (const e of top) {
    console.log(
      `${String(e.priority).padStart(4)}  T${e.tier}    ${String(e.instructionCount).padStart(6)}  ${String(e.callerCount).padStart(7)}  ${e.name}`
    );
  }
}
