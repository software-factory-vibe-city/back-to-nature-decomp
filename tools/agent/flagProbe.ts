/**
 * flagProbe.ts — early per-file flag-hypothesis check for one function.
 *
 * Usage: npx tsx tools/agent/flagProbe.ts func_8001FF98
 *
 * Run this BEFORE burning effort on source-shape archaeology. It answers:
 * "does the target carry a fingerprint that is unreachable (or nearly so)
 * from natural C under the baseline flags, and does a per-file flag delta
 * dominate?" Born from func_8001FF98, where the sound-driver TU needed
 * -fno-gcse and the evidence was visible early (see
 * notes/retros/2026-07-31-func_8001FF98-retro.md and prompts/c-style-guide.md
 * section 11 for the governed escalation bar).
 *
 * Three independent evidence sources:
 *   1. Target structural fingerprints, decoded from the original binary's
 *      bytes (no source needed):
 *      - nested loop with an in-place bottom-of-loop counter increment
 *        (unreachable from natural C under -fgcse: 2.95.2 loop-PRE splits it;
 *        signals -fno-gcse)
 *      - sequential lui/lw self-clobbering loads (signals
 *        -fno-schedule-insns -fno-schedule-insns2; SetGfxClip precedent)
 *   2. Flag-matrix compile of the current src/<name>.c (if present): masked
 *      score + instruction count per candidate flag set.
 *   3. Regional context: existing overrides near this function's VRAM
 *      (flags are per-TU; neighbors sharing a TU share flags).
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = new URL("../..", import.meta.url).pathname;

const GCC_VERSION = "2.95.2";
const CC = `tools/vendor/old-gcc/build-gcc-${GCC_VERSION}-psx/cc1`;
const MASPSX = "python3 tools/vendor/maspsx/maspsx.py";
const CROSS = "mips-linux-gnu-";
const CPPFLAGS = "-Iinclude -Iinclude/psyq -undef -D__GNUC__=2 -DINCLUDE_ASM_USE_MACRO_INC=1 -lang-c";
const CC1FLAGS = "-O2 -G8 -mips1 -mcpu=r3000 -funsigned-char -fpeephole -ffunction-cse -fpcc-struct-return -fcommon -fverbose-asm -msoft-float -mgas -fgnu-linker -quiet";
const ASFLAGS = "-march=r3000 -mtune=r3000 -EL -G8 -no-pad-sections -Iinclude -Iinclude/psyq";

const FLAG_MATRIX: [string, string][] = [
  ["baseline", ""],
  ["-fno-gcse", "-fno-gcse"],
  ["-fno-schedule-insns{,2}", "-fno-schedule-insns -fno-schedule-insns2"],
  ["-fno-gcse -fno-schedule-insns{,2}", "-fno-gcse -fno-schedule-insns -fno-schedule-insns2"],
  ["-fno-rerun-cse-after-loop", "-fno-rerun-cse-after-loop"],
];

function run(cmd: string): string {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
}

/** splat.yaml lookup (same conventions as diffFunc.ts) */
function getFuncInfo(name: string): { vram: number; size: number } | null {
  const yaml = readFileSync(join(ROOT, "configs/splat.yaml"), "utf-8");
  const segRe = /^\s*-\s*\[(0x[0-9A-Fa-f]+),\s*(?:asm|c)(?:,\s*\S+)?\]\s*#\s*(0x[0-9A-Fa-f]+)\s+(\S+)/;
  const nextRe = /^\s*-\s*\[(0x[0-9A-Fa-f]+)/;
  const offsets: number[] = [];
  let funcOffset = -1, funcVram = 0;
  for (const line of yaml.split("\n")) {
    const m = line.match(nextRe);
    if (m) offsets.push(parseInt(m[1], 16));
    const seg = line.match(segRe);
    if (seg && seg[3] === name) { funcOffset = parseInt(seg[1], 16); funcVram = parseInt(seg[2], 16); }
  }
  if (funcOffset < 0) return null;
  offsets.sort((a, b) => a - b);
  const idx = offsets.indexOf(funcOffset);
  const size = idx >= 0 && idx + 1 < offsets.length ? offsets[idx + 1] - funcOffset : 0;
  return { vram: funcVram, size };
}

function vramForStem(stem: string): number | null {
  const m = stem.match(/^func_([0-9A-Fa-f]{8})$/);
  if (m) return parseInt(m[1], 16);
  const info = getFuncInfo(stem);
  return info ? info.vram : null;
}

/** Read the function's words from the original executable. */
function targetWords(info: { vram: number; size: number }): number[] {
  const bin = readFileSync(join(ROOT, "extracted/iso/slus_011.15"));
  const off = 0x800 + (info.vram - 0x80010000);
  const words: number[] = [];
  for (let i = 0; i + 4 <= info.size; i += 4) words.push(bin.readUInt32LE(off + i));
  return words;
}

/* ---- structural fingerprints (pure MIPS-I word decoding) ---- */

interface Loop { head: number; branch: number; } /* word indices */

function findLoops(words: number[]): Loop[] {
  const loops: Loop[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const op = w >>> 26;
    const isBranch =
      op === 4 || op === 5 || op === 6 || op === 7 ||          /* beq bne blez bgtz */
      (op === 1 && [0, 1, 16, 17].includes((w >>> 16) & 0x1f)); /* bltz bgez bltzal bgezal */
    if (!isBranch) continue;
    const offs = (w << 16) >> 16; /* sign-extend imm16 */
    const target = i + 1 + offs;
    if (target >= 0 && target < i) loops.push({ head: target, branch: i });
  }
  return loops;
}

/** Nested loop whose outer body ends with an in-place counter increment
 *  (addiu rX,rX,imm between the inner loop's branch and the outer branch,
 *  or in the outer branch's delay slot). The PRE-fatal shape. */
function fingerprintBottomIncrement(words: number[]): string[] {
  const loops = findLoops(words);
  const hits: string[] = [];
  for (const outer of loops) {
    const inner = loops.find((l) => l !== outer && l.head > outer.head && l.branch < outer.branch);
    if (!inner) continue;
    for (let i = inner.branch + 1; i <= Math.min(outer.branch + 1, words.length - 1); i++) {
      const w = words[i];
      if (w >>> 26 === 9 && ((w >>> 21) & 0x1f) === ((w >>> 16) & 0x1f) && ((w >>> 16) & 0x1f) !== 0) {
        hits.push(`in-place bottom increment at word ${i} inside nested loop ` +
          `[${outer.head}..${outer.branch}] (inner [${inner.head}..${inner.branch}])`);
        break;
      }
    }
  }
  return hits;
}

/** Sequential lui rD / lw rD, off(rD) self-clobbering pairs. */
function fingerprintSelfClobberLoads(words: number[]): string[] {
  const hits: string[] = [];
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i], b = words[i + 1];
    if (a >>> 26 !== 15) continue;                    /* lui rt,imm */
    const rt = (a >>> 16) & 0x1f;
    if (b >>> 26 === 35 && ((b >>> 21) & 0x1f) === rt && ((b >>> 16) & 0x1f) === rt) {
      hits.push(`lui/lw self-clobber at words ${i}-${i + 1} (reg $${rt})`);
    }
  }
  return hits;
}

/* ---- flag-matrix compile & masked score ---- */

function maskedInstrs(objdumpOut: string): string[] {
  const branch = new Set(["b","beq","beql","beqz","beqzl","bgez","bgezl","bgtz","bgtzl","blez","blezl","bltz","bltzl","bne","bnel","bnez","bnezl"]);
  return objdumpOut.split("\n")
    .filter((l) => /^\s+[0-9a-f]+:\s/.test(l))
    .map((l) => {
      const t = l.trim().replace(/^[0-9a-f]+:\s+/, "");
      const mn = t.split(/\s/)[0].toLowerCase();
      return branch.has(mn) ? t.replace(/\s+<[^>]+>$/, "") : t;
    });
}

function assembleTargetInstrs(name: string): string[] | null {
  const asmSrc = `build/asm/nonmatchings/${name}/${name}.s`;
  if (!existsSync(join(ROOT, asmSrc))) return null;
  const dir = "build/flagProbe";
  mkdirSync(join(ROOT, dir), { recursive: true });
  const wrapper = `${dir}/${name}.target.s`;
  writeFileSync(join(ROOT, wrapper),
    `.include "include/macro.inc"\n.set noat\n.set noreorder\n.include "${asmSrc}"\n`);
  run(`${CROSS}as ${ASFLAGS} ${wrapper} -o ${dir}/${name}.target.o`);
  return maskedInstrs(run(`${CROSS}objdump -d --no-show-raw-insn ${dir}/${name}.target.o`));
}

function compileScore(name: string, extraFlags: string, target: string[]): string {
  const dir = "build/flagProbe";
  const src = `src/${name}.c`;
  try {
    run(`${CROSS}cpp ${CPPFLAGS} ${src} -o ${dir}/${name}.i`);
    run(`${CC} ${CC1FLAGS} ${extraFlags} ${dir}/${name}.i -o ${dir}/${name}.s`);
    run(`${MASPSX} --aspsx-version 2.77 --dont-force-G0 --run-assembler --gnu-as-path ${CROSS}as -o ${dir}/${name}.o ${ASFLAGS} ${dir}/${name}.s`);
  } catch (e: any) {
    return "compile failed";
  }
  const got = maskedInstrs(run(`${CROSS}objdump -d --no-show-raw-insn ${dir}/${name}.o`));
  let m = 0;
  const total = Math.max(target.length, got.length);
  for (let i = 0; i < total; i++) if (target[i] === got[i]) m++;
  return `${m}/${target.length} masked, ${got.length} instrs (target ${target.length})`;
}

/* ---- regional override context ---- */

function nearbyOverrides(vram: number): string[] {
  const path = join(ROOT, "configs/flag_overrides.mk");
  if (!existsSync(path)) return [];
  const out: string[] = [];
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const m = line.match(/^CC1FLAGS_(\S+)\s*:=\s*(.+)$/);
    if (!m) continue;
    const v = vramForStem(m[1]);
    const dist = v !== null ? Math.abs(v - vram) : null;
    const tag = dist !== null && dist <= 0x8000 ? "  <-- NEARBY (possible same TU)" : "";
    out.push(`  ${m[1]}${v !== null ? ` @0x${v.toString(16).toUpperCase()}` : ""}: ${m[2].trim()}${tag}`);
  }
  return out;
}

/* ---- main ---- */

const name = process.argv[2];
if (!name) { console.error("Usage: npx tsx tools/agent/flagProbe.ts <func_name>"); process.exit(1); }
const info = getFuncInfo(name);
if (!info || !info.size) { console.error(`${name} not found in configs/splat.yaml`); process.exit(1); }

console.log(`flagProbe ${name} @0x${info.vram.toString(16).toUpperCase()} (${info.size} bytes)\n`);

const words = targetWords(info);
const f1 = fingerprintBottomIncrement(words);
const f2 = fingerprintSelfClobberLoads(words);
console.log("Target structural fingerprints (from original bytes):");
if (f1.length === 0 && f2.length === 0) console.log("  none detected");
for (const h of f1) console.log(`  [PRE-fatal shape] ${h}`);
for (const h of f2) console.log(`  [self-clobber shape] ${h}`);
if (f1.length) {
  console.log("  PRE-fatal shape: try the counter-reuse idiom FIRST (style guide s12:");
  console.log("  one counter variable shared across sequential loops is a natural PRE");
  console.log("  shield - func_8001FF98 matched under baseline flags this way). A flag");
  console.log("  delta is the fallback, gated by the escalation bar below.");
}
if (f2.length) {
  console.log("  self-clobber shape: scheduling-override candidate class (SetGfxClip/");
  console.log("  SetGfxOffset precedent). Calibration 2026-07-31: on the decompiled");
  console.log("  corpus this fires only on documented hard cases and pinned files.");
}

console.log("\nNearby/existing flag overrides:");
const near = nearbyOverrides(info.vram);
console.log(near.length ? near.join("\n") : "  none");

const srcPath = join(ROOT, `src/${name}.c`);
if (existsSync(srcPath)) {
  const target = assembleTargetInstrs(name);
  if (target) {
    console.log("\nFlag matrix on current src (masked scores; bytes still decide):");
    for (const [label, flags] of FLAG_MATRIX) {
      console.log(`  ${label.padEnd(36)} ${compileScore(name, flags, target)}`);
    }
  } else {
    console.log("\n(no nonmatchings asm for masked scoring; skipping flag matrix)");
  }
} else {
  console.log("\n(no src/" + name + ".c yet; fingerprints above are pre-decompilation evidence)");
}

console.log(`
Escalation bar (prompts/c-style-guide.md section 11): a fingerprint above
PLUS a dominant flag column PLUS no contrary regional witness justifies
proposing a per-file override in configs/flag_overrides.mk. Verify any
adopted override with the byte verdict (diffFunc auto-verifies at 100%).`);
