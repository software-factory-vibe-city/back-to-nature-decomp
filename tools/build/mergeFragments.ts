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
 *   npx tsx tools/build/mergeFragments.ts           # dry run
 *   npx tsx tools/build/mergeFragments.ts --write   # modify
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { loadPsxExeInfo, vramToRom, ROOT } from "../lib/psxExeInfo.ts";

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

  // Pass 3: Detect jump table case targets — small functions that are only
  // reachable via a jump table (not called via JAL or J from elsewhere).
  // These are case handler stubs that spimdisasm split into separate functions.
  // Unlike fall-through fragments, jtbl targets must stay type:func (not type:label)
  // so spimdisasm emits them with alabel (global visibility) for rodata references.
  const jtblAbsorbed = new Set<number>(); // absorbed but keep as type:func
  const jtblOwners = new Map<number, number>(); // target addr → owner addr
  const jtblByOwnerFunc = new Map<number, JtblInfo[]>(); // owner addr → jtbl infos
  {
    const ASM_DATA_DIR = join(ROOT, "build/asm/data");
    const ASM_NM_DIR = join(ROOT, "build/asm/nonmatchings");
    // Include all known addresses (func_ and _prefixed labels) as potential jtbl targets
    const allKnownAddrs = new Set(allSorted.map((e) => e.addr));

    // Step 1: Parse jump tables from rodata, extract target addresses
    interface JtblInfo {
      name: string;
      targets: number[];
      romStart: number; // ROM offset of first .word
      romEnd: number;   // ROM offset past last .word
    }
    const jumpTables: JtblInfo[] = [];

    if (existsSync(ASM_DATA_DIR)) {
      for (const f of readdirSync(ASM_DATA_DIR).filter((f: string) => f.endsWith(".s"))) {
        const content = readFileSync(join(ASM_DATA_DIR, f), "utf-8");
        let currentJtbl: JtblInfo | null = null;
        for (const line of content.split("\n")) {
          const jtblStart = line.match(/^dlabel (jtbl_[0-9A-Fa-f]+)/);
          if (jtblStart) {
            currentJtbl = { name: jtblStart[1], targets: [], romStart: 0, romEnd: 0 };
            continue;
          }
          if (line.match(/^enddlabel jtbl_/)) {
            if (currentJtbl && currentJtbl.targets.length > 0) {
              jumpTables.push(currentJtbl);
            }
            currentJtbl = null;
            continue;
          }
          if (currentJtbl) {
            // Parse ROM offset from comment: /* 944 80010144 ... */
            const romComment = line.match(/\/\*\s+([0-9A-Fa-f]+)\s+/);
            if (romComment) {
              const rom = parseInt(romComment[1], 16);
              if (currentJtbl.romStart === 0) currentJtbl.romStart = rom;
              currentJtbl.romEnd = rom + 4;
            }
            // Match .word with raw hex address or function/label name
            const wordHex = line.match(/\.word\s+0x([0-9A-Fa-f]+)/i);
            if (wordHex) {
              currentJtbl.targets.push(parseInt(wordHex[1], 16));
            }
            const wordFunc = line.match(/\.word\s+(?:func_|_)([0-9A-Fa-f]{8})/i);
            if (wordFunc) {
              currentJtbl.targets.push(parseInt(wordFunc[1], 16));
            }
            // .word .LXXXXXXXX is already an internal label, skip
          }
        }
      }
    }

    // Step 2: For each jump table, find the owning function (references jtbl in its asm)
    for (const jtbl of jumpTables) {
      const uniqueTargets = [...new Set(jtbl.targets)].filter((t) => allKnownAddrs.has(t));
      if (uniqueTargets.length === 0) continue;

      // Find the owning function by scanning asm files for %hi(jtbl_name)
      let ownerAddr: number | null = null;
      if (existsSync(ASM_NM_DIR)) {
        for (const sub of readdirSync(ASM_NM_DIR)) {
          const subPath = join(ASM_NM_DIR, sub);
          try {
            for (const sf of readdirSync(subPath).filter((f: string) => f.endsWith(".s"))) {
              const content = readFileSync(join(subPath, sf), "utf-8");
              if (content.includes(`%hi(${jtbl.name})`)) {
                const funcMatch = sub.match(/[0-9A-Fa-f]{8}/);
                if (funcMatch) ownerAddr = parseInt(funcMatch[0], 16);
                break;
              }
            }
          } catch {}
          if (ownerAddr !== null) break;
        }
      }

      // Fallback: if no asm file found (function compiled as C), find the owner
      // by checking which function with size: encompasses the jtbl targets
      if (ownerAddr === null) {
        const symContent = readFileSync(SYMBOL_ADDRS, "utf-8");
        for (const symLine of symContent.split("\n")) {
          const sizeMatch = symLine.match(/^(?:func_|_)([0-9A-Fa-f]+)\s*=\s*(0x[0-9A-Fa-f]+).*size:0x([0-9A-Fa-f]+)/i);
          if (sizeMatch) {
            const funcAddr = parseInt(sizeMatch[2], 16);
            const funcSize = parseInt(sizeMatch[3], 16);
            const funcEnd = funcAddr + funcSize;
            // Check if any jtbl target falls within this function's range
            if (uniqueTargets.some((t) => t >= funcAddr && t < funcEnd)) {
              ownerAddr = funcAddr;
              break;
            }
          }
        }
      }
      if (ownerAddr === null) continue;

      // Track jtbl ownership for rodata migration
      if (!jtblByOwnerFunc.has(ownerAddr)) jtblByOwnerFunc.set(ownerAddr, []);
      jtblByOwnerFunc.get(ownerAddr)!.push(jtbl);

      // Step 3: Absorb targets that are separate functions not externally called
      for (const targetAddr of uniqueTargets) {
        if (targetAddr === ownerAddr) continue;
        if (isFragment.has(targetAddr)) continue;
        if (jtblAbsorbed.has(targetAddr)) continue;
        if (jalTargets.has(targetAddr)) continue;

        jtblAbsorbed.add(targetAddr);
        jtblOwners.set(targetAddr, ownerAddr);
      }
    }
  }

  if (isFragment.size === 0 && jtblAbsorbed.size === 0) {
    // Even with no fragments, strip orphaned .rodata entries from prior runs
    if (writeMode && existsSync(SPLAT_YAML)) {
      const yaml = readFileSync(SPLAT_YAML, "utf-8");
      const yamlLines = yaml.split("\n");
      const cleanedLines: string[] = [];
      let stripped = 0;
      for (let k = 0; k < yamlLines.length; k++) {
        const line = yamlLines[k];
        if (line.match(/\[\s*0x[0-9A-Fa-f]+\s*,\s*\.rodata\s*,\s*\w+\s*\]/)) {
          // Also strip continuation rodata line immediately after
          if (k + 1 < yamlLines.length && yamlLines[k + 1].match(/\[\s*0x[0-9A-Fa-f]+\s*,\s*rodata\s*\]/)) {
            k++;
          }
          stripped++;
          continue;
        }
        cleanedLines.push(line);
      }
      if (stripped > 0) {
        writeFileSync(SPLAT_YAML, cleanedLines.join("\n"));
        console.log(`Stripped ${stripped} orphaned .rodata entry/entries from splat.yaml`);
      }
    }
    console.log("No fragments detected.");
    return;
  }

  // Build merge groups from fall-through fragments
  interface MergeGroup {
    head: string;
    headAddr: number;
    absorbed: { name: string; addr: number; isJtbl?: boolean }[];
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

  // Build merge groups from jump table case targets
  // Group jtbl targets by their owner function
  const jtblByOwner = new Map<number, number[]>();
  for (const [targetAddr, ownerAddr] of jtblOwners) {
    if (!jtblByOwner.has(ownerAddr)) jtblByOwner.set(ownerAddr, []);
    jtblByOwner.get(ownerAddr)!.push(targetAddr);
  }

  const allAddrToName = new Map(allSorted.map((e) => [e.addr, e.name]));

  for (const [ownerAddr, targets] of jtblByOwner) {
    const ownerName = allAddrToName.get(ownerAddr);
    if (!ownerName) continue;

    // Check if owner already has a merge group (from fall-through detection)
    let existing = merges.find((m) => m.headAddr === ownerAddr);
    if (!existing) {
      existing = {
        head: ownerName,
        headAddr: ownerAddr,
        absorbed: [],
        endAddr: getNextFuncAddr(ownerAddr),
      };
      merges.push(existing);
    }

    for (const targetAddr of targets.sort((a, b) => a - b)) {
      const targetName = allAddrToName.get(targetAddr);
      if (!targetName) continue;
      existing.absorbed.push({ name: targetName, addr: targetAddr, isJtbl: true });
    }

    // Extend endAddr to cover all jtbl targets
    const allAddrsInGroup = [existing.headAddr, ...existing.absorbed.map((a) => a.addr)];
    const maxAddr = Math.max(...allAddrsInGroup);
    existing.endAddr = Math.max(existing.endAddr, getNextFuncAddr(maxAddr));
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
      if (a.isJtbl || externallyReferenced.has(a.addr)) {
        // Jump table targets must stay type:func so spimdisasm emits alabel
        // (global visibility) — the rodata jump table references them by name
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
    const details = m.absorbed.map((a) => {
      const tag = a.isJtbl ? " [jtbl target, stays func]"
        : externallyReferenced.has(a.addr) ? " [ext ref, stays func]"
        : "";
      return `${a.name}${tag}`;
    }
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
    const match = line.match(/^((?:func_|_)[0-9A-Fa-f]+)\s*=\s*(0x[0-9A-Fa-f]+)/i);
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

      // Ensure jtbl targets that should stay as func have the right name/type
      // (they may have been previously converted to _XXXX type:label)
      if (toKeepFunc.has(addr)) {
        let newLine = line;
        if (newLine.includes("type:label")) {
          newLine = newLine.replace("type:label", "type:func");
        }
        // Rename _800XXXXX → func_800XXXXX if needed
        const oldName = match[1];
        if (oldName.startsWith("_") && !oldName.startsWith("func_")) {
          const newName = `func_${oldName.slice(1)}`;
          newLine = newLine.replace(oldName, newName);
        }
        outputLines.push(newLine);
        continue;
      }
    }

    outputLines.push(line);
  }

  writeFileSync(SYMBOL_ADDRS, outputLines.join("\n"));
  console.log(`\nWrote symbol_addrs.txt: ${changedSize} size attrs, ${changedLabel} → type:label`);

  // Remove splat.yaml subsegments for ALL absorbed fragments (label or func)
  // Match by ROM offset since names may differ (func_ vs _)
  const allAbsorbedAddrsForYaml = new Set(merges.flatMap((m) => m.absorbed.map((a) => a.addr)));
  const allAbsorbedNames = new Set(merges.flatMap((m) => m.absorbed.map((a) => a.name)));
  if (existsSync(SPLAT_YAML)) {
    const yaml = readFileSync(SPLAT_YAML, "utf-8");
    const yamlLines = yaml.split("\n");
    const filteredYaml: string[] = [];
    let removedYaml = 0;
    for (const line of yamlLines) {
      const segMatch = line.match(/\[\s*0x([0-9A-Fa-f]+)\s*,\s*c\s*,/);
      if (segMatch) {
        const romOffset = parseInt(segMatch[1], 16);
        const vram = romOffset - info.payloadOffset + info.loadAddr;
        if (allAbsorbedAddrsForYaml.has(vram)) {
          removedYaml++;
          continue;
        }
      }
      filteredYaml.push(line);
    }
    // Insert .rodata subsegments for merge-group heads that own jump tables.
    // These must be inserted within the rodata section (in ROM order), splitting
    // the monolithic rodata segment. After the jtbl, add a continuation rodata segment.
    let addedRodata = 0;
    const rodataInserts: { romStart: number; romEnd: number; name: string }[] = [];
    for (const m of merges) {
      const jtbls = jtblByOwnerFunc.get(m.headAddr);
      if (jtbls && jtbls.length > 0) {
        for (const jtbl of jtbls) {
          if (jtbl.romStart > 0) {
            rodataInserts.push({ romStart: jtbl.romStart, romEnd: jtbl.romEnd, name: m.head });
          }
        }
      }
    }

    // Sort by ROM offset
    rodataInserts.sort((a, b) => a.romStart - b.romStart);

    // Insert rodata splits in ROM-offset order among existing subsegments.
    // Find any line matching [0xNNN, rodata] that covers a jtbl range and split it.
    const finalYaml: string[] = [];
    // First, strip any previously-inserted .rodata entries and their continuation
    // rodata segments for idempotency. This must work even when rodataInserts is
    // empty (e.g. function already decomped as C, no merge groups detected).
    const stripped: string[] = [];
    for (let k = 0; k < filteredYaml.length; k++) {
      const line = filteredYaml[k];
      // Match a .rodata entry with a function name: [0xNNN, .rodata, func_name]
      const dotRodataMatch = line.match(/\[\s*0x([0-9A-Fa-f]+)\s*,\s*\.rodata\s*,\s*(\w+)\s*\]/);
      if (dotRodataMatch) {
        // Also strip the continuation rodata line immediately after, if present
        if (k + 1 < filteredYaml.length) {
          const nextLine = filteredYaml[k + 1];
          if (nextLine.match(/\[\s*0x[0-9A-Fa-f]+\s*,\s*rodata\s*\]/)) {
            k++; // skip the continuation line too
          }
        }
        continue; // remove the .rodata entry
      }
      stripped.push(line);
    }

    for (let i = 0; i < stripped.length; i++) {
      const line = stripped[i];
      // Match monolithic rodata: [0xNNN, rodata] (not .rodata, not o with .rdata)
      const rodataMatch = line.match(/^(\s*)-\s*\[\s*0x([0-9A-Fa-f]+)\s*,\s*rodata\s*\]/);
      if (rodataMatch && rodataInserts.length > 0) {
        const indent = rodataMatch[1];
        const rodataStart = parseInt(rodataMatch[2], 16);
        // Find the end of this rodata segment (next subsegment's ROM offset)
        let rodataEnd = 0xFFFFFFFF;
        for (let j = i + 1; j < stripped.length; j++) {
          const nextSeg = stripped[j].match(/\[\s*0x([0-9A-Fa-f]+)\s*,/);
          if (nextSeg) {
            rodataEnd = parseInt(nextSeg[1], 16);
            break;
          }
        }

        // Check if any jtbl falls within this rodata segment
        const insertsHere = rodataInserts.filter(
          (ins) => ins.romStart >= rodataStart && ins.romStart < rodataEnd
        );
        if (insertsHere.length > 0) {
          // Emit: [rodataStart, rodata] (part before first jtbl)
          finalYaml.push(line);
          for (const ins of insertsHere) {
            finalYaml.push(`${indent}- [0x${ins.romStart.toString(16).toUpperCase()}, .rodata, ${ins.name}]`);
            finalYaml.push(`${indent}- [0x${ins.romEnd.toString(16).toUpperCase()}, rodata]`);
            addedRodata++;
          }
          continue;
        }
      }
      finalYaml.push(line);
    }

    if (removedYaml > 0 || addedRodata > 0) {
      writeFileSync(SPLAT_YAML, finalYaml.join("\n"));
      console.log(`Removed ${removedYaml} subsegment(s) from splat.yaml`);
      if (addedRodata > 0) {
        console.log(`Added ${addedRodata} .rodata split(s) for jump tables`);
      }
    }
  }

  // Delete stale source files for absorbed fragments (check both func_ and _ prefixes)
  let deletedSrc = 0;
  for (const a of merges.flatMap((m) => m.absorbed)) {
    const addrHex = a.addr.toString(16).toUpperCase();
    for (const prefix of ["func_", "_"]) {
      const srcFile = join(SRC_DIR, `${prefix}${addrHex}.c`);
      if (existsSync(srcFile)) {
        unlinkSync(srcFile);
        deletedSrc++;
      }
    }
  }
  if (deletedSrc > 0) {
    console.log(`Deleted ${deletedSrc} stale source file(s)`);
  }

  // Reset head function source files to INCLUDE_ASM only if they contain
  // stale inline __asm__ blocks (from pre-merge decomps that included sub-functions).
  // Do NOT reset files that have real C code (switch statements, function bodies, etc.)
  const includeAsmStub = (name: string) =>
    `#include "common.h"\n#include "include_asm.h"\n\nINCLUDE_ASM("build/asm/nonmatchings/${name}", ${name});\n`;

  let resetSrc = 0;
  for (const m of merges) {
    const srcFile = join(SRC_DIR, `${m.head}.c`);
    if (existsSync(srcFile)) {
      const content = readFileSync(srcFile, "utf-8");
      // Only reset if it's an inline __asm__ block (not real C, not already a stub)
      if (!content.includes("INCLUDE_ASM") && content.includes("__asm__")) {
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
