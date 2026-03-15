/**
 * mergeFragments.ts — Detect and merge fall-through function fragments
 *
 * spimdisasm sometimes splits a single function into multiple fragments
 * at internal branch targets (e.g. loop labels). This tool:
 *
 * 1. Detects fragments: functions with no jr $ra / tail-call j that fall
 *    through into the next function
 * 2. Detects cross-function branches: functions that conditionally branch
 *    to the immediately-next function (if/else chains, cascading checks)
 * 3. Adds size: to the head function so spimdisasm doesn't end it early
 * 4. Changes unreferenced fragments to type:label (internal branch labels)
 * 5. Keeps externally-referenced fragments as type:func (alternative entries)
 * 6. Removes splat.yaml subsegments and stale source files for fragments
 *
 * Usage:
 *   npx tsx tools/mergeFragments.ts           # dry run
 *   npx tsx tools/mergeFragments.ts --write   # modify
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { loadPsxExeInfo, vramToRom, ROOT } from "./psxExeInfo.ts";

const SRC_DIR = join(ROOT, "src");
const SYMBOL_ADDRS = join(ROOT, "configs/symbol_addrs.txt");
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");

interface FuncEntry {
  name: string;
  addr: number;
}

function parseAllFuncEntries(): { gameEntries: FuncEntry[]; allSorted: FuncEntry[] } {
  const content = readFileSync(SYMBOL_ADDRS, "utf-8");
  const gameEntries: FuncEntry[] = [];
  const allEntries: FuncEntry[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(\w+)\s*=\s*(0x[0-9A-Fa-f]+).*type:(func|label)/i);
    if (match) {
      const entry: FuncEntry = {
        name: match[1],
        addr: parseInt(match[2], 16),
      };
      allEntries.push(entry);
      if (/^func_[0-9A-Fa-f]+$/i.test(match[1])) {
        gameEntries.push(entry);
      }
    }
  }

  allEntries.sort((a, b) => a.addr - b.addr);
  gameEntries.sort((a, b) => a.addr - b.addr);
  return { gameEntries, allSorted: allEntries };
}

function hasTerminator(
  binary: Buffer,
  funcAddr: number,
  nextFuncAddr: number,
  info: ReturnType<typeof loadPsxExeInfo>,
  allAddrs: Set<number>
): boolean {
  const funcSize = nextFuncAddr - funcAddr;
  if (funcSize < 8) return false;

  const lastInsOffset = vramToRom(nextFuncAddr - 4, info);
  const penultimateOffset = vramToRom(nextFuncAddr - 8, info);
  if (penultimateOffset < 0 || lastInsOffset + 4 > binary.length) return false;

  const penultimate = binary.readUInt32LE(penultimateOffset);
  const last = binary.readUInt32LE(lastInsOffset);

  if (penultimate === 0x03e00008 || last === 0x03e00008) return true;

  for (const word of [penultimate, last]) {
    if ((word >>> 26) === 0x02) {
      const target = ((funcAddr & 0xf0000000) | ((word & 0x03ffffff) << 2)) >>> 0;
      if ((target < funcAddr || target >= nextFuncAddr) && allAddrs.has(target)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Scan a region of the binary for branch instructions targeting a specific address.
 */
function scanBodyForBranchTarget(
  binary: Buffer,
  bodyStart: number,
  bodyEnd: number,
  targetAddr: number,
  info: ReturnType<typeof loadPsxExeInfo>
): boolean {
  const startOff = vramToRom(bodyStart, info);
  const endOff = vramToRom(bodyEnd, info);

  for (let off = startOff; off + 4 <= endOff; off += 4) {
    const word = binary.readUInt32LE(off);
    const opcode = word >>> 26;

    // Branch opcodes: REGIMM(0x01), BEQ(0x04), BNE(0x05), BLEZ(0x06), BGTZ(0x07)
    if (opcode === 0x01 || (opcode >= 0x04 && opcode <= 0x07)) {
      const instrAddr = (off - info.payloadOffset + info.loadAddr) >>> 0;
      const offset16 = word & 0xffff;
      const signedOff = offset16 >= 0x8000 ? offset16 - 0x10000 : offset16;
      const branchTarget = (instrAddr + 4 + signedOff * 4) >>> 0;

      if (branchTarget === targetAddr) return true;
    }
  }
  return false;
}

/**
 * Find all addresses that are jal targets or cross-function j targets.
 */
function findExternalCallTargets(
  binary: Buffer,
  info: ReturnType<typeof loadPsxExeInfo>,
  funcAddrs: number[]
): Set<number> {
  const targets = new Set<number>();
  const sorted = [...funcAddrs].sort((a, b) => a - b);

  function findFunc(addr: number): number {
    let lo = 0, hi = sorted.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid] <= addr) lo = mid + 1;
      else hi = mid - 1;
    }
    return hi >= 0 ? sorted[hi] : -1;
  }

  const startOff = info.payloadOffset;
  const endOff = info.payloadOffset + info.payloadSize;

  for (let off = startOff; off + 4 <= endOff; off += 4) {
    const word = binary.readUInt32LE(off);
    const opcode = word >>> 26;
    const instrAddr = (off - info.payloadOffset + info.loadAddr) >>> 0;

    if (opcode === 0x03) {
      const target = ((instrAddr & 0xf0000000) | ((word & 0x03ffffff) << 2)) >>> 0;
      targets.add(target);
    } else if (opcode === 0x02) {
      const target = ((instrAddr & 0xf0000000) | ((word & 0x03ffffff) << 2)) >>> 0;
      if (findFunc(instrAddr) !== findFunc(target)) {
        targets.add(target);
      }
    }
  }

  return targets;
}

/**
 * Find all addresses that are branch/jump targets from outside a given set of ranges.
 * This tells us which addresses within merge groups are referenced externally.
 */
function findExternalBranchTargets(
  binary: Buffer,
  info: ReturnType<typeof loadPsxExeInfo>,
  mergeRanges: { start: number; end: number }[],
  candidateAddrs: Set<number>
): Set<number> {
  const referenced = new Set<number>();
  const startOff = info.payloadOffset;
  const endOff = info.payloadOffset + info.payloadSize;

  // Quick check: is an instruction address inside any merge range?
  function isInMergeRange(addr: number): boolean {
    for (const r of mergeRanges) {
      if (addr >= r.start && addr < r.end) return true;
    }
    return false;
  }

  for (let off = startOff; off + 4 <= endOff; off += 4) {
    const instrAddr = (off - info.payloadOffset + info.loadAddr) >>> 0;
    if (isInMergeRange(instrAddr)) continue; // Skip instructions within merge groups

    const word = binary.readUInt32LE(off);
    const opcode = word >>> 26;
    let target: number | null = null;

    if (opcode === 0x02 || opcode === 0x03) {
      target = ((instrAddr & 0xf0000000) | ((word & 0x03ffffff) << 2)) >>> 0;
    } else if (opcode === 0x01 || (opcode >= 0x04 && opcode <= 0x07)) {
      const offset16 = word & 0xffff;
      const signedOff = offset16 >= 0x8000 ? offset16 - 0x10000 : offset16;
      target = (instrAddr + 4 + signedOff * 4) >>> 0;
    }

    if (target !== null && candidateAddrs.has(target)) {
      referenced.add(target);
    }
  }

  return referenced;
}

function main() {
  const writeMode = process.argv.includes("--write");
  const info = loadPsxExeInfo();
  const binary = readFileSync(info.binaryPath);
  const { gameEntries, allSorted } = parseAllFuncEntries();

  if (gameEntries.length < 2) {
    console.log("Not enough functions to check for fragments.");
    return;
  }

  const allAddrs = new Set(allSorted.map((e) => e.addr));

  function getNextFuncAddr(addr: number): number {
    for (const e of allSorted) {
      if (e.addr > addr) return e.addr;
    }
    return info.loadAddr + info.payloadSize;
  }

  const jalTargets = findExternalCallTargets(binary, info, allSorted.map((e) => e.addr));

  // Pass 1: Detect fall-through — func has no terminator, next func is not a jal/j target
  const isFragment = new Set<number>();
  for (let i = 0; i < gameEntries.length - 1; i++) {
    const func = gameEntries[i];
    const next = gameEntries[i + 1];
    if (getNextFuncAddr(func.addr) !== next.addr) continue;
    if (jalTargets.has(next.addr)) continue;
    if (!hasTerminator(binary, func.addr, next.addr, info, allAddrs)) {
      isFragment.add(next.addr);
    }
  }

  // Pass 2: Detect cross-function branches — func branches to next func (if/else chains, etc.)
  // Iterates until no new fragments are found (chain merging convergence).
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < gameEntries.length - 1; i++) {
      if (isFragment.has(gameEntries[i].addr)) continue; // only check heads

      // Find next non-fragment function
      let j = i + 1;
      while (j < gameEntries.length && isFragment.has(gameEntries[j].addr)) j++;
      if (j >= gameEntries.length) continue;

      const nextFunc = gameEntries[j];
      if (jalTargets.has(nextFunc.addr)) continue;
      // Must be adjacent (no gaps from non-game symbols)
      if (getNextFuncAddr(gameEntries[j - 1].addr) !== nextFunc.addr) continue;

      // Scan entire body (head + already-absorbed fragments) for branch to nextFunc
      if (scanBodyForBranchTarget(binary, gameEntries[i].addr, nextFunc.addr, nextFunc.addr, info)) {
        isFragment.add(nextFunc.addr);
        changed = true;
      }
    }
  }

  if (isFragment.size === 0) {
    console.log("No fragments detected.");
    return;
  }

  // Build merge groups
  interface MergeGroup {
    head: string;
    headAddr: number;
    absorbed: { name: string; addr: number }[];
    endAddr: number;
  }
  const merges: MergeGroup[] = [];

  for (let i = 0; i < gameEntries.length - 1; i++) {
    if (!isFragment.has(gameEntries[i + 1].addr)) continue;
    if (isFragment.has(gameEntries[i].addr)) continue;

    const head = gameEntries[i];
    const absorbed: { name: string; addr: number }[] = [];
    let j = i + 1;
    while (j < gameEntries.length && isFragment.has(gameEntries[j].addr)) {
      absorbed.push({ name: gameEntries[j].name, addr: gameEntries[j].addr });
      j++;
    }

    const lastAddr = absorbed[absorbed.length - 1].addr;
    merges.push({
      head: head.name,
      headAddr: head.addr,
      absorbed,
      endAddr: getNextFuncAddr(lastAddr),
    });
  }

  // Find which absorbed addresses are referenced from OUTSIDE their merge group
  const allAbsorbedAddrs = new Set(merges.flatMap((m) => m.absorbed.map((a) => a.addr)));
  const mergeRanges = merges.map((m) => ({ start: m.headAddr, end: m.endAddr }));
  const externallyReferenced = findExternalBranchTargets(binary, info, mergeRanges, allAbsorbedAddrs);

  // Classify each absorbed fragment
  const toLabelify = new Set<number>();  // becomes type:label (not externally referenced)
  const toKeepFunc = new Set<number>();  // stays type:func (externally referenced, gets glabel)

  for (const m of merges) {
    for (const a of m.absorbed) {
      if (externallyReferenced.has(a.addr)) {
        toKeepFunc.add(a.addr);
      } else {
        toLabelify.add(a.addr);
      }
    }
  }

  // Print summary
  console.log(`Found ${merges.length} merge group(s):\n`);
  for (const m of merges) {
    const size = m.endAddr - m.headAddr;
    const details = m.absorbed.map((a) =>
      `${a.name}${externallyReferenced.has(a.addr) ? " [ext ref, stays func]" : ""}`
    );
    console.log(`  ${m.head} (size:0x${size.toString(16)}) absorbs: ${details.join(", ")}`);
  }
  console.log(`\n  ${toLabelify.size} → type:label, ${toKeepFunc.size} kept as type:func`);

  if (!writeMode) {
    console.log("\nDry run — pass --write to modify symbol_addrs.txt");
    return;
  }

  // Build head sizes lookup
  const headSizes = new Map<number, number>();
  for (const m of merges) {
    headSizes.set(m.headAddr, m.endAddr - m.headAddr);
  }

  // Rewrite symbol_addrs.txt
  const content = readFileSync(SYMBOL_ADDRS, "utf-8");
  const outputLines: string[] = [];
  let changedLabel = 0;
  let changedSize = 0;

  for (const line of content.split("\n")) {
    const match = line.match(/^(func_[0-9A-Fa-f]+)\s*=\s*(0x[0-9A-Fa-f]+)/i);
    if (match) {
      const addr = parseInt(match[2], 16);

      // Add size: to head functions
      if (headSizes.has(addr)) {
        const size = headSizes.get(addr)!;
        const sizeStr = `size:0x${size.toString(16)}`;
        let newLine = line;
        if (/size:0x[0-9a-f]+/i.test(newLine)) {
          newLine = newLine.replace(/size:0x[0-9a-f]+/i, sizeStr);
        } else {
          newLine = newLine.replace(/\/\/\s*/, `// ${sizeStr} `);
        }
        outputLines.push(newLine);
        changedSize++;
        continue;
      }

      // Change unreferenced fragments to type:label and rename func_X → _X
      // so m2c treats them as internal labels (matches re_local_label pattern)
      if (toLabelify.has(addr)) {
        let newLine = line;
        if (newLine.includes("type:func")) {
          newLine = newLine.replace("type:func", "type:label");
        }
        // Rename func_800XXXXX → _800XXXXX
        const oldName = match[1];
        const newName = oldName.replace(/^func_/, "_");
        newLine = newLine.replace(oldName, newName);
        outputLines.push(newLine);
        changedLabel++;
        continue;
      }
    }

    outputLines.push(line);
  }

  writeFileSync(SYMBOL_ADDRS, outputLines.join("\n"));
  console.log(`\nWrote symbol_addrs.txt: ${changedSize} size attrs, ${changedLabel} → type:label`);

  // Remove splat.yaml subsegments for ALL absorbed fragments (label or func)
  const allAbsorbedNames = new Set(merges.flatMap((m) => m.absorbed.map((a) => a.name)));
  if (existsSync(SPLAT_YAML)) {
    const yaml = readFileSync(SPLAT_YAML, "utf-8");
    const yamlLines = yaml.split("\n");
    const filteredYaml: string[] = [];
    let removedYaml = 0;
    for (const line of yamlLines) {
      const segMatch = line.match(/,\s*c,\s*(func_[0-9A-Fa-f]+)\s*\]/);
      if (segMatch && allAbsorbedNames.has(segMatch[1])) {
        removedYaml++;
        continue;
      }
      filteredYaml.push(line);
    }
    if (removedYaml > 0) {
      writeFileSync(SPLAT_YAML, filteredYaml.join("\n"));
      console.log(`Removed ${removedYaml} subsegment(s) from splat.yaml`);
    }
  }

  // Delete stale source files for absorbed fragments
  let deletedSrc = 0;
  for (const name of allAbsorbedNames) {
    const srcFile = join(SRC_DIR, `${name}.c`);
    if (existsSync(srcFile)) {
      unlinkSync(srcFile);
      deletedSrc++;
    }
  }
  if (deletedSrc > 0) {
    console.log(`Deleted ${deletedSrc} stale source file(s)`);
  }

  // Reset head function source files to INCLUDE_ASM if they have stale C code
  const includeAsmStub = (name: string) =>
    `#include "common.h"\n#include "include_asm.h"\n\nINCLUDE_ASM("build/asm/nonmatchings/${name}", ${name});\n`;

  let resetSrc = 0;
  for (const m of merges) {
    const srcFile = join(SRC_DIR, `${m.head}.c`);
    if (existsSync(srcFile)) {
      const content = readFileSync(srcFile, "utf-8");
      if (!content.includes("INCLUDE_ASM")) {
        writeFileSync(srcFile, includeAsmStub(m.head));
        resetSrc++;
      }
    }
  }
  if (resetSrc > 0) {
    console.log(`Reset ${resetSrc} head source file(s) to INCLUDE_ASM`);
  }
}

main();
