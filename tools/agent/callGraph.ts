/**
 * callGraph.ts
 *
 * Builds a call graph from disassembled functions and outputs
 * a prioritized JSON file for the decompilation pipeline.
 *
 * Usage:
 *   npx tsx tools/agent/callGraph.ts              # build graph + summary
 *   npx tsx tools/agent/callGraph.ts --top 20     # also print top 20 priority functions
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");
const SRC_DIR = join(ROOT, "src");
const ASM_DIR = join(ROOT, "build/asm/nonmatchings");
const OUT_FILE = join(ROOT, "build/callGraph.json");

const args = process.argv.slice(2);
const topIdx = args.indexOf("--top");
const topN = topIdx >= 0 ? parseInt(args[topIdx + 1], 10) : 0;

/* Binary geometry shared by Step 1's VRAM recovery and Step 3b's dead-code
   scan. splat.yaml offsets are file offsets a fixed PAYLOAD_OFFSET below the
   loaded image; every segment satisfies vram = offset + (LOAD_ADDR - PAYLOAD_OFFSET). */
const PAYLOAD_OFFSET = 0x800;
const LOAD_ADDR = 0x80010000;

// --- Step 1: Parse splat.yaml for function list + sizes ---

const yamlLines = readFileSync(SPLAT_YAML, "utf-8").split("\n");
/* Most splat segments carry their VRAM in the trailing "# 0xVRAM name" comment,
   but a handful omit it; either way the bracket names the function and the
   address is always offset + (LOAD_ADDR - PAYLOAD_OFFSET). */
const segRegex =
  /^\s*-\s*\[(0x[0-9A-Fa-f]+),\s*(asm|c)(?:,\s*(\S+))?\]\s*(?:#\s*(0x[0-9A-Fa-f]+)\s+(\S+))?/;
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
    const [, offsetStr, type, bracketName, vramHex, commentName] = match;
    const offset = parseInt(offsetStr, 16);
    const name = commentName ?? bracketName;
    if (!name) continue;
    rawSegments.push({
      offset,
      type,
      vram: vramHex ?? `0x${(offset + (LOAD_ADDR - PAYLOAD_OFFSET)).toString(16)}`,
      name,
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
  /** false = normal C, "asm" = pure handwritten asm, "gte" = C with GTE coprocessor instructions */
  handwritten: false | "asm" | "gte";
  /** true if no jal or data/pointer references exist anywhere in the binary */
  dead: boolean;
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
    handwritten: false,
    dead: false,
  });
}

// --- Step 2: Parse .s files for call targets + instruction counts ---

const jalRegex = /^\s*\/\*.*\*\/\s+jal\s+(\S+)/;
const instrRegex = /^\s*\/\*\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s+\*\//;
const gameFuncRegex = /^func_[0-9A-Fa-f]{8}$/;

for (const [name, entry] of funcMap) {
  let sFile = join(ASM_DIR, name, `${name}.s`);
  if (!existsSync(sFile)) {
    // Handle named symbols (e.g. __start) where .s file has a different name
    const dir = join(ASM_DIR, name);
    if (existsSync(dir)) {
      const files = readdirSync(dir).filter((f) => f.endsWith(".s"));
      if (files.length === 1) {
        sFile = join(dir, files[0]);
      }
    }
    if (!existsSync(sFile)) continue;
  }

  const rawContent = readFileSync(sFile, "utf-8");
  const content = rawContent.split("\n");
  const gameCalls = new Set<string>();
  const sdkCalls = new Set<string>();
  let instrCount = 0;

  // Detect handwritten assembly (marker from spimdisasm)
  if (rawContent.includes("Handwritten function")) {
    // Classify: GTE functions have COP2 instructions (cfc2, ctc2, lwc2, etc.)
    const gtePattern = /\b(cfc2|ctc2|lwc2|swc2|mfc2|mtc2|cop2)\b/;
    entry.handwritten = gtePattern.test(rawContent) ? "gte" : "asm";
  }

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

// --- Step 3b: Detect dead code (no callers, no pointer references) ---

const BINARY_PATH = join(ROOT, "extracted/iso/slus_011.15");

function detectDeadCode(): void {
  if (!existsSync(BINARY_PATH)) {
    console.warn("Original binary not found, skipping dead code detection");
    return;
  }

  const payload = readFileSync(BINARY_PATH);

  /* Liveness must be judged against the raw image, not the residual call
     graph. The graph's calledBy edges cover only jals emitted by functions that
     still have a nonmatching .s on disk; once a caller is decompiled its .s is
     gone and every jal it made disappears with it, so a callee called only by
     matched code looks callerless and is misclassified dead. Decode jal targets
     (and literal 32-bit pointer words) directly from the bytes, range-checked
     to PS1 RAM for the small data-word/jal-shaped false-positive floor,
     mirroring tools/diagnostics/progress.ts so both tools agree on liveness. */
  const referenced = new Set<number>();
  for (let off = PAYLOAD_OFFSET; off + 4 <= payload.length; off += 4) {
    const word = payload.readUInt32LE(off);
    if (((word >>> 26) & 0x3f) === 0x03) {
      // jal: target = KSEG0 base | (instr_index << 2)
      const target = (0x80000000 | ((word & 0x03ffffff) << 2)) >>> 0;
      if (target >= 0x80000000 && target < 0x80200000) referenced.add(target);
    }
    referenced.add(word);
  }

  for (const entry of funcMap.values()) {
    const addr = parseInt(entry.vram, 16);
    const hasCallers = entry.calledBy.length > 0;
    entry.dead = !hasCallers && !referenced.has(addr);
  }
}

detectDeadCode();

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
  // Decompiled, pure-asm (not GTE), and dead code go to end
  const aSkip = a.decompiled || a.handwritten === "asm" || a.dead;
  const bSkip = b.decompiled || b.handwritten === "asm" || b.dead;
  if (aSkip !== bSkip) return aSkip ? 1 : -1;

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

const decomposable = entries.filter((e) => e.handwritten !== "asm");
const tier1 = decomposable.filter((e) => e.tier === 1).length;
const tier2 = decomposable.filter((e) => e.tier === 2).length;
const tier3 = decomposable.filter((e) => e.tier === 3).length;
const decompiledCount = entries.filter((e) => e.decompiled).length;
const gteCount = entries.filter((e) => e.handwritten === "gte").length;
const asmCount = entries.filter((e) => e.handwritten === "asm").length;
const deadCount = entries.filter((e) => e.dead).length;

const output = {
  functions: entries,
  stats: {
    total: entries.length,
    tier1,
    tier2,
    tier3,
    decompiled: decompiledCount,
    gte: gteCount,
    asm: asmCount,
    dead: deadCount,
  },
};

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));

console.log(`Call graph: ${entries.length} functions`);
console.log(`  Tier 1 (pure leaf):    ${String(tier1).padStart(3)} functions`);
console.log(`  Tier 2 (SDK-only):     ${String(tier2).padStart(3)} functions`);
console.log(`  Tier 3 (game callers): ${String(tier3).padStart(3)} functions`);
console.log(`  Already decompiled:    ${String(decompiledCount).padStart(3)} functions`);
console.log(`  GTE (C + coprocessor): ${String(gteCount).padStart(3)} functions`);
if (asmCount > 0) {
  console.log(`  Pure asm (excluded):   ${String(asmCount).padStart(3)} functions`);
}
if (deadCount > 0) {
  console.log(`  Dead code (excluded):  ${String(deadCount).padStart(3)} functions`);
}
console.log(`Wrote ${OUT_FILE}`);

if (topN > 0) {
  console.log();
  console.log(`Top ${topN} priority functions:`);
  console.log(`${"#".padStart(4)}  ${"Tier".padEnd(4)}  ${"Instrs".padStart(6)}  ${"Callers".padStart(7)}  Name`);
  console.log("-".repeat(50));
  const top = entries.filter((e) => !e.decompiled && e.handwritten !== "asm" && !e.dead).slice(0, topN);
  for (const e of top) {
    console.log(
      `${String(e.priority).padStart(4)}  T${e.tier}    ${String(e.instructionCount).padStart(6)}  ${String(e.callerCount).padStart(7)}  ${e.name}`
    );
  }
}
