/**
 * progress.ts
 *
 * Reports decompilation progress by analyzing splat.yaml segments
 * and checking for INCLUDE_ASM usage in C source files.
 *
 * Usage:
 *   npx tsx tools/progress.ts              # summary only
 *   npx tsx tools/progress.ts --list       # list all functions with status
 *   npx tsx tools/progress.ts --remaining  # list only remaining (not decompiled)
 *   npx tsx tools/progress.ts --done       # list only decompiled functions
 *   npx tsx tools/progress.ts --markdown  # markdown table with links to source and asm
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");
const SRC_DIR = join(ROOT, "src");

const args = process.argv.slice(2);
const showList = args.includes("--list");
const showRemaining = args.includes("--remaining");
const showDone = args.includes("--done");
const showMarkdown = args.includes("--markdown");

interface FuncInfo {
  name: string;
  vram: string;
  offset: number;
  size: number;
  decompiled: boolean;
}

// Parse subsegments from splat.yaml
const lines = readFileSync(SPLAT_YAML, "utf-8").split("\n");

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

for (const line of lines) {
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

const funcs: FuncInfo[] = [];
let totalFuncs = 0;
let decompFuncs = 0;
let totalBytes = 0;
let decompBytes = 0;

for (const seg of rawSegments) {
  const idx = allOffsets.indexOf(seg.offset);
  const nextOffset = idx >= 0 && idx + 1 < allOffsets.length ? allOffsets[idx + 1] : seg.offset;
  const size = nextOffset - seg.offset;

  let decompiled = false;
  if (seg.type === "c") {
    const cFile = join(SRC_DIR, `${seg.name}.c`);
    if (existsSync(cFile)) {
      const content = readFileSync(cFile, "utf-8");
      const hasIncludeAsm = content.includes(`INCLUDE_ASM(`) && content.includes(seg.name);
      if (!hasIncludeAsm) {
        decompiled = true;
      }
    }
  }

  totalFuncs++;
  totalBytes += size;
  if (decompiled) {
    decompFuncs++;
    decompBytes += size;
  }

  funcs.push({ name: seg.name, vram: seg.vram, offset: seg.offset, size, decompiled });
}

// Summary
const funcPct = totalFuncs > 0 ? ((decompFuncs / totalFuncs) * 100).toFixed(2) : "0.00";
const bytePct = totalBytes > 0 ? ((decompBytes / totalBytes) * 100).toFixed(2) : "0.00";

console.log(`Decompiled: ${decompFuncs} / ${totalFuncs} functions (${funcPct}%)`);
console.log(`Decompiled: ${decompBytes} / ${totalBytes} bytes (${bytePct}%)`);

// Detailed list
if (showList || showRemaining || showDone || showMarkdown) {
  const filtered = funcs.filter((f) => {
    if (showRemaining) return !f.decompiled;
    if (showDone) return f.decompiled;
    return true;
  });

  if (showMarkdown) {
    console.log();
    console.log("| Status | VRAM | Size | Source | ASM |");
    console.log("|--------|------|------|--------|-----|");
    for (const f of filtered) {
      const status = f.decompiled ? "OK" : "";
      const srcPath = `src/${f.name}.c`;
      const asmPath = `build/asm/nonmatchings/${f.name}/${f.name}.s`;
      console.log(`| ${status} | ${f.vram} | ${f.size} | [${f.name}.c](${srcPath}) | [${f.name}.s](${asmPath}) |`);
    }
    console.log();
    console.log(`${filtered.length} functions listed`);
  } else {
    console.log();

    // Column widths
    const header = `${"STATUS".padEnd(6)} ${"VRAM".padEnd(12)} ${"SIZE".padStart(6)}  NAME`;
    console.log(header);
    console.log("-".repeat(header.length + 10));

    for (const f of filtered) {
      const status = f.decompiled ? "  OK  " : "      ";
      const vram = f.vram.padEnd(12);
      const size = f.size.toString().padStart(6);
      console.log(`${status} ${vram} ${size}  ${f.name}`);
    }

    console.log();
    console.log(`${filtered.length} functions listed`);
  }
}
