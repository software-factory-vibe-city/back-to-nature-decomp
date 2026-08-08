/**
 * mergeFragments.ts — Detect and merge fall-through function fragments
 *
 * spimdisasm sometimes splits a single function into multiple fragments
 * at internal branch targets (e.g. loop labels). This tool:
 *
 * 1. Detects fragments: functions with no jr $ra / tail-call j that fall
 *    through into the next function. A trailing `j` counts as a tail call
 *    only when its target is a proven entry point; a `j` to an address
 *    nothing else can reach is intra-function control flow.
 * 2. Detects cross-function branches: a conditional branch crossing the
 *    boundary between a function and the immediately-next one, in either
 *    direction (if/else chains, cascading checks, rotated-loop back-edges)
 * 3. Adds size: to the head function so spimdisasm doesn't end it early
 * 4. Changes unreferenced fragments to type:label (internal branch labels)
 * 5. Keeps externally-referenced fragments as type:func (alternative entries)
 * 6. Removes splat.yaml subsegments and stale source files for fragments
 *
 * Usage:
 *   npx tsx tools/build/mergeFragments.ts           # dry run
 *   npx tsx tools/build/mergeFragments.ts --write   # modify
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { loadPsxExeInfo, vramToRom, ROOT } from "../lib/psxExeInfo.ts";

const SRC_DIR = join(ROOT, "src");
const SYMBOL_ADDRS = join(ROOT, "configs/symbol_addrs.txt");
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");

interface FuncEntry {
  name: string;
  addr: number;
  isLabel: boolean;
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
        isLabel: match[3].toLowerCase() === "label",
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
  allAddrs: Set<number>,
  provenEntries: Set<number>
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
      /* A `j` terminates the function only when it is a real tail call — i.e.
       * the target is independently reachable (jal, data pointer, address
       * taken, entry point). A `j` to a target nothing else can reach is
       * intra-function control flow: GCC's expand_end_loop emits exactly such
       * a jump when it rotates a loop's trailing body above the loop head, so
       * the function's own entry jumps over the rotated block. Treating that
       * as a tail call splits one function into a preheader plus a body. */
      if (
        (target < funcAddr || target >= nextFuncAddr) &&
        allAddrs.has(target) &&
        provenEntries.has(target)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Find addresses that are provably independent entry points.
 *
 * An address qualifies when something other than intra-function control flow
 * can reach it: a `jal`, a function pointer stored in data (jump tables
 * included), an address taken in code via lui/addiu|ori, or the EXE entry
 * point. A bare `j` is deliberately NOT evidence — GCC 2.95 emits no tail
 * calls, so a `j` to an address nothing else references is intra-function
 * control flow (see hasTerminator). Counting it as an entry point makes the
 * target look like a real function and suppresses fragment detection for it.
 *
 * Over-reporting here is the safe direction: a spurious entry point only
 * declines a merge, leaving the existing (unmerged) boundaries in place.
 *
 * Returns two sets. `calls` holds control-transfer entry points only (jal,
 * address taken in code, EXE entry). `proven` adds function pointers stored in
 * data. The jump-table pass needs `calls`: its case targets are by definition
 * reachable through a data pointer, so testing them against `proven` would
 * disqualify every one of them and disable that pass entirely.
 */
function findProvenEntryPoints(
  binary: Buffer,
  info: ReturnType<typeof loadPsxExeInfo>,
  funcAddrs: number[]
): { proven: Set<number>; calls: Set<number> } {
  const targets = new Set<number>();
  const calls = new Set<number>();
  const candidates = new Set(funcAddrs);
  const sorted = [...funcAddrs].sort((a, b) => a - b);

  const startOff = info.payloadOffset;
  const endOff = info.payloadOffset + info.payloadSize;

  /* Text is the union of the function symbol ranges; anything else in the
   * payload is data, where a word equal to a function address is a pointer. */
  const textEnd = sorted.length > 0 ? sorted[sorted.length - 1] : info.loadAddr;
  function inText(addr: number): boolean {
    return sorted.length > 0 && addr >= sorted[0] && addr < textEnd;
  }

  calls.add(info.entryPoint >>> 0);

  /* lui $r, hi / addiu|ori $r, $r, lo — an address taken in code. */
  const luiHi = new Map<number, number>();

  for (let off = startOff; off + 4 <= endOff; off += 4) {
    const word = binary.readUInt32LE(off);
    const opcode = word >>> 26;
    const instrAddr = (off - info.payloadOffset + info.loadAddr) >>> 0;

    if (!inText(instrAddr)) {
      if (candidates.has(word >>> 0)) targets.add(word >>> 0);
      continue;
    }

    if (opcode === 0x03) {
      calls.add(((instrAddr & 0xf0000000) | ((word & 0x03ffffff) << 2)) >>> 0);
      continue;
    }

    if (opcode === 0x0f) {
      luiHi.set((word >>> 16) & 0x1f, (word & 0xffff) << 16);
    } else if (opcode === 0x09 || opcode === 0x0d) {
      const rs = (word >>> 21) & 0x1f;
      const hi = luiHi.get(rs);
      if (hi !== undefined) {
        const imm = word & 0xffff;
        const lo = opcode === 0x09 && imm >= 0x8000 ? imm - 0x10000 : imm;
        const addr = (hi + lo) >>> 0;
        if (candidates.has(addr)) calls.add(addr);
      }
    }
  }

  for (const addr of calls) targets.add(addr);
  return { proven: targets, calls };
}

/**
 * Does any conditional branch cross `boundary` within [regionStart, regionEnd)?
 *
 * A MIPS conditional branch can never be a call, so a branch whose source and
 * target sit on opposite sides of a symbol boundary proves the two symbols are
 * one function. Both directions count: a forward branch from the head into the
 * next symbol, and a backward branch from the next symbol into the head (which
 * is what a rotated loop's back-edge looks like).
 */
function crossesBoundary(
  binary: Buffer,
  regionStart: number,
  boundary: number,
  regionEnd: number,
  info: ReturnType<typeof loadPsxExeInfo>
): boolean {
  const startOff = vramToRom(regionStart, info);
  const endOff = vramToRom(regionEnd, info);
  if (startOff < 0 || endOff > binary.length) return false;

  for (let off = startOff; off + 4 <= endOff; off += 4) {
    const word = binary.readUInt32LE(off);
    const opcode = word >>> 26;

    // Branch opcodes: REGIMM(0x01), BEQ(0x04), BNE(0x05), BLEZ(0x06), BGTZ(0x07)
    if (opcode !== 0x01 && (opcode < 0x04 || opcode > 0x07)) continue;

    const instrAddr = (off - info.payloadOffset + info.loadAddr) >>> 0;
    const offset16 = word & 0xffff;
    const signedOff = offset16 >= 0x8000 ? offset16 - 0x10000 : offset16;
    const target = (instrAddr + 4 + signedOff * 4) >>> 0;

    if (target < regionStart || target >= regionEnd) continue;
    if (instrAddr < boundary !== target < boundary) return true;
  }
  return false;
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

/**
 * A function compiled from C emits its own jump table into its object, so the
 * extracted `jtbl_*` copy must be dropped from the monolithic rodata segment or
 * the link fails on `.L` labels that no longer exist. While the function is
 * still an INCLUDE_ASM stub the opposite holds: the included assembly supplies
 * those labels, so the extracted table must stay.
 *
 * Ownership is independent of fall-through merging — a function can own a jump
 * table without absorbing any fragment — so this is driven by the jtbl owner
 * map rather than by merge groups.
 */
/**
 * Whether the compiled object emits a jump table, or `undefined` when it
 * cannot say. A compiled artifact only answers for the source it was built
 * from: if it is missing, or older than the source, it is stale and consulting
 * it decides the wrong way in both directions -- keeping an entry after a
 * revert to a stub, or dropping one for C that has not been rebuilt yet.
 */
function objectEmitsJumpTable(sourcePath: string, compiledPath: string): boolean | undefined {
  if (!existsSync(compiledPath)) return undefined;
  try {
    if (statSync(compiledPath).mtimeMs < statSync(sourcePath).mtimeMs) return undefined;
  } catch {
    return undefined;
  }
  return /^\s*\.word\s+\$L\d+/m.test(readFileSync(compiledPath, "utf-8"));
}

function collectJumpTableRodataInserts(
  jtblByOwnerFunc: Map<number, { romStart: number; romEnd: number }[]>,
  nameOfAddr: Map<number, string>,
): { romStart: number; romEnd: number; name: string }[] {
  const inserts: { romStart: number; romEnd: number; name: string }[] = [];
  for (const [ownerAddr, jtbls] of jtblByOwnerFunc) {
    const owner = nameOfAddr.get(ownerAddr);
    if (!owner) continue;
    /* The subsegment asserts that this object supplies the ROM range, so the
     * question is whether the object actually emits a jump table -- not
     * whether the source happens to be C. A switch that lowers to comparisons
     * emits no table, and the range would then come from nowhere: bytes go
     * missing at link time, far from the cause. Ask the compiled assembly
     * when it exists, and fall back to source state on a tree that has not
     * been built yet. */
    const sourcePath = join(SRC_DIR, `${owner}.c`);
    const compiledPath = join(ROOT, "build/src", `${owner}.s`);
    /* Source state decides stub-versus-C, because it is always current; a
     * compiled artifact can be stale, and trusting it would keep the entry
     * after a revert to INCLUDE_ASM, leaving the extracted table dropped with
     * nothing supplying the range. The object is consulted only to confirm
     * that a C source really emits a table -- a switch lowered to comparisons
     * emits none. */
    if (!existsSync(sourcePath)) continue;
    if (/INCLUDE_ASM/.test(readFileSync(sourcePath, "utf-8"))) continue;
    if (objectEmitsJumpTable(sourcePath, compiledPath) === false) continue;
    for (const jtbl of jtbls) {
      if (jtbl.romStart > 0) inserts.push({ romStart: jtbl.romStart, romEnd: jtbl.romEnd, name: owner });
    }
  }
  return inserts.sort((a, b) => a.romStart - b.romStart);
}

/**
 * Rewrite splat.yaml's subsegment list: drop entries for absorbed fragments and
 * re-derive the `.rodata` splits for C-owned jump tables. The strip-then-insert
 * shape makes it idempotent, so it is safe to run when nothing has changed.
 */
function syncSplatSubsegments(options: {
  absorbedVrams: Set<number>;
  payloadOffset: number;
  loadAddr: number;
  rodataInserts: { romStart: number; romEnd: number; name: string }[];
  write: boolean;
}): void {
  if (!existsSync(SPLAT_YAML)) return;
  const { absorbedVrams, payloadOffset, loadAddr, write } = options;
  let rodataInserts = options.rodataInserts;

  const filteredYaml: string[] = [];
  let removedYaml = 0;
  for (const line of readFileSync(SPLAT_YAML, "utf-8").split("\n")) {
    const segMatch = line.match(/\[\s*0x([0-9A-Fa-f]+)\s*,\s*c\s*,/);
    if (segMatch) {
      const vram = parseInt(segMatch[1]!, 16) - payloadOffset + loadAddr;
      if (absorbedVrams.has(vram)) { removedYaml++; continue; }
    }
    filteredYaml.push(line);
  }

  /* Lift out the existing .rodata entries with their continuation segments,
   * then merge rather than re-derive.
   *
   * Re-deriving does not work and is not safe: once an entry exists, splat
   * routes that table into the owning object and stops emitting it into the
   * monolithic rodata assembly, so the detector that found it can no longer
   * see it. Stripping and re-deriving therefore deletes every entry on the
   * run after the one that created it. An entry is only dropped when its
   * function has gone back to being an INCLUDE_ASM stub, which is the one
   * case where the extracted table genuinely has to come back. */
  const merged = new Map<number, { romStart: number; romEnd: number; name: string }>();
  const stripped: string[] = [];
  for (let k = 0; k < filteredYaml.length; k++) {
    const existing = filteredYaml[k]!.match(/\[\s*0x([0-9A-Fa-f]+)\s*,\s*\.rodata\s*,\s*(\w+)\s*\]/);
    if (existing) {
      const romStart = parseInt(existing[1]!, 16);
      const name = existing[2]!;
      /* The extent comes from whatever follows. Usually that is the
       * continuation segment, which is consumed with the entry. When two
       * tables touch there is no continuation, and the next entry's own start
       * is this one's end -- reading only continuations would leave the extent
       * at zero and re-emit the zero-length segment on the next run. */
      let romEnd = romStart;
      const following = filteredYaml[k + 1];
      if (following) {
        const continuation = following.match(/\[\s*0x([0-9A-Fa-f]+)\s*,\s*rodata\s*\]/);
        if (continuation) {
          romEnd = parseInt(continuation[1]!, 16);
          k++;
        } else {
          const adjacent = following.match(/\[\s*0x([0-9A-Fa-f]+)\s*,/);
          if (adjacent) romEnd = parseInt(adjacent[1]!, 16);
        }
      }
      const sourcePath = join(SRC_DIR, `${name}.c`);
      const compiledPath = join(ROOT, "build/src", `${name}.s`);
      const stillC = existsSync(sourcePath)
        && !/INCLUDE_ASM/.test(readFileSync(sourcePath, "utf-8"));
      const emitsTable = objectEmitsJumpTable(sourcePath, compiledPath) !== false;
      if (stillC && emitsTable) merged.set(romStart, { romStart, romEnd, name });
      continue;
    }
    stripped.push(filteredYaml[k]!);
  }
  for (const insert of rodataInserts) merged.set(insert.romStart, insert);
  rodataInserts = [...merged.values()].sort((a, b) => a.romStart - b.romStart);

  let addedRodata = 0;
  const finalYaml: string[] = [];
  for (let i = 0; i < stripped.length; i++) {
    const line = stripped[i]!;
    const rodataMatch = line.match(/^(\s*)-\s*\[\s*0x([0-9A-Fa-f]+)\s*,\s*rodata\s*\]/);
    if (rodataMatch && rodataInserts.length > 0) {
      const indent = rodataMatch[1]!;
      const rodataStart = parseInt(rodataMatch[2]!, 16);
      let rodataEnd = 0xFFFFFFFF;
      for (let j = i + 1; j < stripped.length; j++) {
        const nextSeg = stripped[j]!.match(/\[\s*0x([0-9A-Fa-f]+)\s*,/);
        if (nextSeg) { rodataEnd = parseInt(nextSeg[1]!, 16); break; }
      }
      const insertsHere = rodataInserts.filter((ins) => ins.romStart >= rodataStart && ins.romStart < rodataEnd);
      if (insertsHere.length > 0) {
        /* Emit a segment only where a gap actually exists. Tables can touch:
         * jtbl_80010008 ends at 0x85C and jtbl_8001005C begins there. A
         * segment the following entry immediately overrides is zero-length,
         * and splat materialises it as an empty extracted file. */
        if (insertsHere[0]!.romStart > rodataStart) finalYaml.push(line);
        insertsHere.forEach((ins, position) => {
          finalYaml.push(`${indent}- [0x${ins.romStart.toString(16).toUpperCase()}, .rodata, ${ins.name}]`);
          const nextStart = insertsHere[position + 1]?.romStart ?? rodataEnd;
          if (nextStart > ins.romEnd) {
            finalYaml.push(`${indent}- [0x${ins.romEnd.toString(16).toUpperCase()}, rodata]`);
          }
          addedRodata++;
        });
        continue;
      }
    }
    finalYaml.push(line);
  }

  const before = readFileSync(SPLAT_YAML, "utf-8");
  const after = finalYaml.join("\n");
  if (before === after) return;
  if (!write) {
    console.log(`Would update splat.yaml: -${removedYaml} subsegment(s), ${addedRodata} .rodata split(s)`);
    return;
  }
  writeFileSync(SPLAT_YAML, after);
  console.log(`Updated splat.yaml: -${removedYaml} subsegment(s), ${addedRodata} .rodata split(s) for jump tables`);
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

  /* Where a merged function actually ends. Unlike getNextFuncAddr (which is
   * used for adjacency and must see every symbol, so that a foreign symbol
   * between two entries counts as a gap), this skips type:label entries:
   * those are internal branch targets of the function being sized, so
   * stopping at one would truncate the head's size annotation and leave the
   * tail of the function outside the merge range. */
  function getNextFuncBoundary(addr: number): number {
    for (const e of allSorted) {
      if (e.addr > addr && !e.isLabel) return e.addr;
    }
    return info.loadAddr + info.payloadSize;
  }

  const { proven: jalTargets, calls: callTargets } = findProvenEntryPoints(
    binary,
    info,
    allSorted.map((e) => e.addr)
  );

  // Pass 1: Detect fall-through — func has no terminator, next func is not an entry point
  const isFragment = new Set<number>();
  for (let i = 0; i < gameEntries.length - 1; i++) {
    const func = gameEntries[i];
    const next = gameEntries[i + 1];
    if (getNextFuncBoundary(func.addr) !== next.addr) continue;
    if (jalTargets.has(next.addr)) continue;
    if (!hasTerminator(binary, func.addr, next.addr, info, allAddrs, jalTargets)) {
      isFragment.add(next.addr);
    }
  }

  // Pass 2: Detect cross-function branches — a conditional branch crosses the
  // head/next boundary in either direction (if/else chains, rotated loops).
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
      if (getNextFuncBoundary(gameEntries[j - 1].addr) !== nextFunc.addr) continue;

      // Scan the head (plus already-absorbed fragments) and nextFunc together
      // for a conditional branch crossing the boundary between them.
      if (crossesBoundary(binary, gameEntries[i].addr, nextFunc.addr, getNextFuncBoundary(nextFunc.addr), info)) {
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
            /* A table whose entries are all `.L` internal labels still owns
             * its rodata even though none of its targets are registered
             * symbols. Requiring resolvable targets here hid precisely the
             * C-owned case, so gate on having parsed any words at all. */
            if (currentJtbl && currentJtbl.romStart > 0) {
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
            /* `.word .LXXXXXXXX` is an internal label rather than a registered
             * symbol, but it is still an address, and it is the only thing that
             * identifies the owning function when that function is already C
             * and so has no extracted assembly left to scan for %hi(jtbl). */
            const wordLabel = line.match(/\.word\s+\.L([0-9A-Fa-f]{8})/i);
            if (wordLabel) {
              currentJtbl.targets.push(parseInt(wordLabel[1]!, 16));
            }
          }
        }
      }
    }

    // Step 2: For each jump table, find the owning function (references jtbl in its asm)
    for (const jtbl of jumpTables) {
      /* Absorption needs targets that are registered symbols, but ownership
       * does not: the `%hi(jtbl_name)` scan below names the owner on its own.
       * Bailing here on an empty target set hid every jump table whose `.L`
       * labels spimdisasm never registered, which is all of them in practice,
       * so no rodata subsegment was ever emitted for a C-owned table. */
      const uniqueTargets = [...new Set(jtbl.targets)].filter((t) => allKnownAddrs.has(t));

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
      /* Uses the raw targets, not the symbol-filtered ones: an owner that is
       * already decompiled has no extracted assembly to scan, and its table's
       * `.L` targets are never registered symbols. */
      if (ownerAddr === null && jtbl.targets.length > 0) {
        const symContent = readFileSync(SYMBOL_ADDRS, "utf-8");
        for (const symLine of symContent.split("\n")) {
          const sizeMatch = symLine.match(/^(?:func_|_)([0-9A-Fa-f]+)\s*=\s*(0x[0-9A-Fa-f]+).*size:0x([0-9A-Fa-f]+)/i);
          if (sizeMatch) {
            const funcAddr = parseInt(sizeMatch[2], 16);
            const funcSize = parseInt(sizeMatch[3], 16);
            const funcEnd = funcAddr + funcSize;
            // Check if any jtbl target falls within this function's range
            if (jtbl.targets.some((t) => t >= funcAddr && t < funcEnd)) {
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
      if (uniqueTargets.length === 0) continue;

      // Step 3: Absorb targets that are separate functions not externally called
      for (const targetAddr of uniqueTargets) {
        if (targetAddr === ownerAddr) continue;
        if (isFragment.has(targetAddr)) continue;
        if (jtblAbsorbed.has(targetAddr)) continue;
        if (callTargets.has(targetAddr)) continue;

        jtblAbsorbed.add(targetAddr);
        jtblOwners.set(targetAddr, ownerAddr);
      }
    }
  }

  if (isFragment.size === 0 && jtblAbsorbed.size === 0) {
    console.log("No fragments detected.");
    /* Jump-table rodata ownership is independent of fragment merging, so it
     * still has to be reconciled — this is the common path once a project has
     * no fragments left to absorb. */
    syncSplatSubsegments({
      absorbedVrams: new Set<number>(),
      payloadOffset: info.payloadOffset,
      loadAddr: info.loadAddr,
      rodataInserts: collectJumpTableRodataInserts(jtblByOwnerFunc, new Map(allSorted.map((e) => [e.addr, e.name]))),
      write: writeMode,
    });
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
      endAddr: getNextFuncBoundary(lastAddr),
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
        endAddr: getNextFuncBoundary(ownerAddr),
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
    existing.endAddr = Math.max(existing.endAddr, getNextFuncBoundary(maxAddr));
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

  syncSplatSubsegments({
    absorbedVrams: new Set(merges.flatMap((m) => m.absorbed.map((a) => a.addr))),
    payloadOffset: info.payloadOffset,
    loadAddr: info.loadAddr,
    rodataInserts: collectJumpTableRodataInserts(jtblByOwnerFunc, new Map(allSorted.map((e) => [e.addr, e.name]))),
    write: writeMode,
  });

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
