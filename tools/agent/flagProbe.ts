#!/usr/bin/env npx tsx
/**
 * flagProbe.ts — early per-file flag-hypothesis check for one function.
 *
 * Usage:
 *   npx tsx tools/agent/flagProbe.ts func_8001FF98
 *   npx tsx tools/agent/flagProbe.ts func_8001FF98 --json
 *   npx tsx tools/agent/flagProbe.ts func_8001FF98 --with-source build/candidate.c
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
 *      - sequential lui/lw self-clobbering loads: symbolic %hi/%lo pairs
 *        signal -mno-split-addresses (unsplit assembler-macro load;
 *        func_800165D8/func_80016C08 precedent); non-symbolic or
 *        lui-grouping shapes signal -fno-schedule-insns
 *        -fno-schedule-insns2 (SetGfxClip precedent)
 *   2. Flag-matrix compile of the current src/<name>.c (if present): masked
 *      score + instruction count per candidate flag set.
 *   3. Regional context: existing overrides near this function's VRAM
 *      (flags are per-TU; neighbors sharing a TU share flags).
 *
 * The run writes `build/flagProbe/<function>/report.json`. That report is what
 * lets triage stop repeating a flag hypothesis this probe has already measured
 * as tied on the current source — and its hashes are what stop it from
 * carrying a stale conclusion past the next source edit.
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  ROOT,
  configuredAsFlags,
  configuredCc1Flags,
  configuredCppFlags,
  configuredGccVersion,
  configuredMaspsxFlags,
  configuredToolchainIdentity,
} from "./decompToolchain.js";
import { sha256, stableJson } from "./variant-lab/artifacts.js";
import { exeSplatYamlPath } from "../lib/psxExeInfo.js";

/* Version is project configuration (Makefile GCC_VERSION), not a constant. */
const GCC_VERSION = configuredGccVersion();
const CC = `tools/vendor/old-gcc/build-gcc-${GCC_VERSION}-psx/cc1`;
const MASPSX = "python3 tools/vendor/maspsx/maspsx.py";
const CROSS = "mips-linux-gnu-";
const CPPFLAGS = configuredCppFlags().join(" ");
const CC1FLAGS = configuredCc1Flags().join(" ");
const ASFLAGS = configuredAsFlags().join(" ");
const MASPSXFLAGS = configuredMaspsxFlags().join(" ");

export const BASELINE_LABEL = "baseline";

export const FLAG_MATRIX: [string, string][] = [
  [BASELINE_LABEL, ""],
  ["-fno-gcse", "-fno-gcse"],
  ["-fno-schedule-insns{,2}", "-fno-schedule-insns -fno-schedule-insns2"],
  ["-fno-schedule-insns2", "-fno-schedule-insns2"],
  ["-fno-gcse -fno-schedule-insns{,2}", "-fno-gcse -fno-schedule-insns -fno-schedule-insns2"],
  ["-fno-rerun-cse-after-loop", "-fno-rerun-cse-after-loop"],
  ["-mno-split-addresses", "-mno-split-addresses"],
  /* CSE path exploration. -O2 turns both on. They decide whether CSE carries
   * values across a branch into a block it does not straight-line dominate,
   * which is what makes an address or index re-materialise in a join block
   * instead of being folded to a register the dominator already holds. */
  ["-fno-cse-follow-jumps", "-fno-cse-follow-jumps"],
  ["-fno-cse-skip-blocks", "-fno-cse-skip-blocks"],
  ["-fno-cse-follow-jumps -fno-cse-skip-blocks", "-fno-cse-follow-jumps -fno-cse-skip-blocks"],
];

/* ---- report shape ---- */

export type FingerprintKind = "pre-fatal-shape" | "self-clobber-shape";

export interface Fingerprint {
  kind: FingerprintKind;
  detail: string;
  /** Matrix labels this fingerprint nominates as the candidate remedy. */
  candidates: string[];
}

export interface FlagMatrixRow {
  label: string;
  flags: string;
  /** Which source this row was compiled from: "current src" or a path. */
  source: string;
  /** Masked instructions matching the target by index, or null on failure. */
  masked: number | null;
  /** Compiled instruction count, or null on failure. */
  instructions: number | null;
  targetInstructions: number;
  error?: string;
}

export type FlagConclusion = "supported" | "not-supported-current-source" | "inconclusive";

export interface FlagCandidateVerdict {
  label: string;
  conclusion: FlagConclusion;
  reason: string;
}

export interface FlagProbeReport {
  schemaVersion: 1;
  function: string;
  /** SHA-256 of src/<function>.c, or null when there is no source yet. */
  sourceHash: string | null;
  /** SHA-256 of the original assembly the fingerprints were decoded from. */
  targetHash: string;
  toolchainHash: string;
  fingerprints: Fingerprint[];
  matrix: FlagMatrixRow[];
  conclusion: FlagConclusion;
  /** Matrix labels that strictly beat baseline on the current source. */
  dominantRows: string[];
  reasons: string[];
  /** Per-candidate verdicts, in fingerprint order. */
  candidates: FlagCandidateVerdict[];
}

function run(cmd: string): string {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
}

/** splat.yaml lookup (same conventions as diffFunc.ts) */
export function getFuncInfo(name: string): { vram: number; size: number } | null {
  const yaml = readFileSync(exeSplatYamlPath(), "utf-8");
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
export function fingerprintBottomIncrement(words: number[]): string[] {
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
export function fingerprintSelfClobberLoads(words: number[]): string[] {
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

export function fingerprintsOf(words: number[]): Fingerprint[] {
  return [
    ...fingerprintBottomIncrement(words).map((detail): Fingerprint => ({
      kind: "pre-fatal-shape",
      detail,
      candidates: ["-fno-gcse", "-fno-gcse -fno-schedule-insns{,2}"],
    })),
    ...fingerprintSelfClobberLoads(words).map((detail): Fingerprint => ({
      kind: "self-clobber-shape",
      detail,
      candidates: ["-mno-split-addresses", "-fno-schedule-insns{,2}", "-fno-schedule-insns2"],
    })),
  ];
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

function targetAsmPath(name: string): string | null {
  const relative = `build/asm/nonmatchings/${name}/${name}.s`;
  return existsSync(join(ROOT, relative)) ? relative : null;
}

function assembleTargetInstrs(name: string): string[] | null {
  const asmSrc = targetAsmPath(name);
  if (!asmSrc) return null;
  const dir = "build/flagProbe";
  mkdirSync(join(ROOT, dir), { recursive: true });
  const wrapper = `${dir}/${name}.target.s`;
  writeFileSync(join(ROOT, wrapper),
    `.include "include/macro.inc"\n.set noat\n.set noreorder\n.include "${asmSrc}"\n`);
  run(`${CROSS}as ${ASFLAGS} ${wrapper} -o ${dir}/${name}.target.o`);
  return maskedInstrs(run(`${CROSS}objdump -d --no-show-raw-insn ${dir}/${name}.target.o`));
}

function compileRow(
  name: string,
  label: string,
  extraFlags: string,
  target: string[],
  sourceLabel: string,
  sourcePath?: string,
): FlagMatrixRow {
  const dir = "build/flagProbe";
  const src = sourcePath ?? `src/${name}.c`;
  const row: FlagMatrixRow = {
    label, flags: extraFlags, source: sourceLabel,
    masked: null, instructions: null, targetInstructions: target.length,
  };
  try {
    run(`${CROSS}cpp ${CPPFLAGS} ${src} -o ${dir}/${name}.i`);
    run(`${CC} ${CC1FLAGS} ${extraFlags} ${dir}/${name}.i -o ${dir}/${name}.s`);
    run(`${MASPSX} ${MASPSXFLAGS} --gnu-as-path ${CROSS}as -o ${dir}/${name}.o ${ASFLAGS} ${dir}/${name}.s`);
  } catch (error: any) {
    row.error = "compile failed";
    return row;
  }
  const got = maskedInstrs(run(`${CROSS}objdump -d --no-show-raw-insn ${dir}/${name}.o`));
  let matched = 0;
  const total = Math.max(target.length, got.length);
  for (let i = 0; i < total; i++) if (target[i] === got[i]) matched++;
  row.masked = matched;
  row.instructions = got.length;
  return row;
}

export function renderRow(row: FlagMatrixRow): string {
  if (row.error) return row.error;
  return `${row.masked}/${row.targetInstructions} masked, ${row.instructions} instrs (target ${row.targetInstructions})`;
}

/* ---- conclusion ---- */

/**
 * A candidate flag is only "supported" when it strictly beats baseline on the
 * measured columns for THIS source. A tie is a real result and the useful one:
 * it says the flag is not the remedy for the source as written, which is what
 * killed a wrong override on func_8001FF98 in minutes.
 *
 * The scope matters and the wording has to keep it: this never proves a flag
 * irrelevant for every source shape, only for the shape that was measured.
 */
export function concludeMatrix(options: {
  rows: FlagMatrixRow[];
  fingerprints: Fingerprint[];
  /** Rows for the current source only; candidate shapes are advisory. */
  sourceLabel: string;
}): Pick<FlagProbeReport, "conclusion" | "dominantRows" | "reasons" | "candidates"> {
  const rows = options.rows.filter((row) => row.source === options.sourceLabel);
  const baseline = rows.find((row) => row.label === BASELINE_LABEL);
  const reasons: string[] = [];

  if (rows.length === 0 || !baseline || baseline.masked === null || baseline.instructions === null) {
    return {
      conclusion: "inconclusive",
      dominantRows: [],
      reasons: [rows.length === 0
        ? "no flag matrix was measured for the current source"
        : "the baseline row did not compile, so no row can be compared against it"],
      candidates: [],
    };
  }

  /* "Strictly better" means no column is worse and at least one is better:
   * a higher masked score bought with an instruction-count regression is not
   * a dominant column, it is a different wrong answer. */
  const beatsBaseline = (row: FlagMatrixRow): boolean =>
    row.masked !== null && row.instructions !== null &&
    row.masked >= baseline.masked! &&
    Math.abs(row.instructions - row.targetInstructions) <= Math.abs(baseline.instructions! - row.targetInstructions) &&
    (row.masked > baseline.masked! ||
      Math.abs(row.instructions - row.targetInstructions) < Math.abs(baseline.instructions! - row.targetInstructions));

  const dominantRows = rows.filter((row) => row.label !== BASELINE_LABEL && beatsBaseline(row)).map((row) => row.label);

  const nominated = [...new Set(options.fingerprints.flatMap((fingerprint) => fingerprint.candidates))]
    .filter((label) => rows.some((row) => row.label === label));

  const candidates: FlagCandidateVerdict[] = nominated.map((label) => {
    const row = rows.find((entry) => entry.label === label)!;
    if (row.masked === null || row.instructions === null) {
      return { label, conclusion: "inconclusive", reason: `${label} did not compile on the current source` };
    }
    if (dominantRows.includes(label)) {
      return {
        label,
        conclusion: "supported",
        reason: `${label} beats baseline on the current source (${row.masked}/${row.targetInstructions} masked, ` +
          `${row.instructions} instrs against baseline ${baseline.masked}/${baseline.targetInstructions}, ${baseline.instructions})`,
      };
    }
    return {
      label,
      conclusion: "not-supported-current-source",
      reason: `baseline ties or beats ${label} on the current source ` +
        `(baseline ${baseline.masked}/${baseline.targetInstructions} masked, ${baseline.instructions} instrs; ` +
        `${label} ${row.masked}/${row.targetInstructions}, ${row.instructions})`,
    };
  });

  let conclusion: FlagConclusion;
  if (candidates.length === 0) {
    conclusion = "inconclusive";
    reasons.push(options.fingerprints.length === 0
      ? "no target fingerprint nominated a candidate flag; the matrix stands on its own merits"
      : "the nominated candidate flags are not in the measured matrix");
  } else if (candidates.some((candidate) => candidate.conclusion === "supported")) {
    conclusion = "supported";
  } else if (candidates.every((candidate) => candidate.conclusion === "not-supported-current-source")) {
    conclusion = "not-supported-current-source";
    reasons.push(
      "scoped to the current source only: another source shape may still require one of these flags, " +
      "and the target fingerprint remains evidence in its own right");
  } else {
    conclusion = "inconclusive";
  }
  for (const candidate of candidates) reasons.push(candidate.reason);
  if (dominantRows.length > 0) reasons.push(`rows beating baseline: ${dominantRows.join(", ")}`);

  return { conclusion, dominantRows, reasons, candidates };
}

/* ---- regional override context ---- */

export function nearbyOverrides(vram: number): string[] {
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

/* ---- analysis ---- */

export const CURRENT_SOURCE_LABEL = "current src";

export function reportPath(name: string): string {
  return join(ROOT, "build/flagProbe", name, "report.json");
}

export function toolchainHash(): string {
  return sha256(stableJson(configuredToolchainIdentity()));
}

/** Hash of the original assembly the fingerprints were decoded from. */
export function targetHashOf(name: string): string | null {
  const relative = targetAsmPath(name);
  if (!relative) return null;
  return sha256(readFileSync(join(ROOT, relative), "utf-8"));
}

export interface ProbeResult {
  info: { vram: number; size: number };
  report: FlagProbeReport;
  nearby: string[];
  /** Set when no target assembly exists, so no matrix was scored. */
  matrixSkipped?: string;
}

export function probe(name: string, extraSources: string[] = []): ProbeResult {
  const info = getFuncInfo(name);
  if (!info || !info.size) throw new Error(`${name} not found in configs/splat.yaml`);

  const words = targetWords(info);
  const fingerprints = fingerprintsOf(words);
  const sourcePath = join(ROOT, `src/${name}.c`);
  const sourceHash = existsSync(sourcePath) ? sha256(readFileSync(sourcePath, "utf-8")) : null;

  const matrix: FlagMatrixRow[] = [];
  let matrixSkipped: string | undefined;
  if (sourceHash !== null) {
    const target = assembleTargetInstrs(name);
    if (!target) matrixSkipped = "no nonmatchings asm for masked scoring";
    else {
      /* The matrix is one slice through a two-dimensional space: a flag can
       * only pay off on the source shape it was meant for, and the shape that
       * needs it usually scores WORSE than the incumbent until the flag is
       * applied. Scoring candidate shapes as well as the current one is what
       * keeps a winning pair from being ranked away one axis at a time. */
      const sources: Array<[string, string | undefined]> = [
        [CURRENT_SOURCE_LABEL, undefined],
        ...extraSources.map((path) => [path, path] as [string, string]),
      ];
      for (const [label, path] of sources) {
        for (const [flagLabel, flags] of FLAG_MATRIX) {
          matrix.push(compileRow(name, flagLabel, flags, target, label, path));
        }
      }
    }
  } else {
    matrixSkipped = `no src/${name}.c yet`;
  }

  const verdict = concludeMatrix({ rows: matrix, fingerprints, sourceLabel: CURRENT_SOURCE_LABEL });
  const report: FlagProbeReport = {
    schemaVersion: 1,
    function: name,
    sourceHash,
    targetHash: targetHashOf(name) ?? "",
    toolchainHash: toolchainHash(),
    fingerprints,
    matrix,
    ...verdict,
  };
  const result: ProbeResult = { info, report, nearby: nearbyOverrides(info.vram) };
  if (matrixSkipped) result.matrixSkipped = matrixSkipped;
  return result;
}

export function writeReport(report: FlagProbeReport): string {
  const path = reportPath(report.function);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, stableJson(report));
  return path;
}

/** Read a report if one exists and parses. */
export function readReport(name: string): FlagProbeReport | null {
  const path = reportPath(name);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed && parsed.schemaVersion === 1 && parsed.function === name ? parsed as FlagProbeReport : null;
  } catch {
    return null;
  }
}

/* ---- rendering ---- */

export function renderProbe(result: ProbeResult): string {
  const { info, report, nearby } = result;
  const lines: string[] = [
    `flagProbe ${report.function} @0x${info.vram.toString(16).toUpperCase()} (${info.size} bytes)`,
    "",
    "Target structural fingerprints (from original bytes):",
  ];
  const preFatal = report.fingerprints.filter((item) => item.kind === "pre-fatal-shape");
  const selfClobber = report.fingerprints.filter((item) => item.kind === "self-clobber-shape");
  if (report.fingerprints.length === 0) {
    lines.push(
      "  none detected",
      "  Two detectors exist (nested-loop bottom increment; symbolic",
      "  lui/lw self-clobber). They are the shapes someone has encoded, not",
      "  the shapes that exist, so silence here is NOT evidence that flags",
      "  are irrelevant. Read the matrix below on its own merits, and treat a",
      "  property you have proven unreachable from any C shape as a",
      "  fingerprint in its own right — that proof is what the bar is for.");
  }
  for (const hit of preFatal) lines.push(`  [PRE-fatal shape] ${hit.detail}`);
  for (const hit of selfClobber) lines.push(`  [self-clobber shape] ${hit.detail}`);
  if (preFatal.length > 0) {
    lines.push(
      "  PRE-fatal shape: try the counter-reuse idiom FIRST (style guide s12:",
      "  one counter variable shared across sequential loops is a natural PRE",
      "  shield - func_8001FF98 matched under baseline flags this way). A flag",
      "  delta is the fallback, gated by the escalation bar below.");
  }
  if (selfClobber.length > 0) {
    lines.push(
      "  self-clobber shape: two distinct remedies, decided by the lui's operand.",
      "  If the pair is a SYMBOLIC address (lui %hi / lw %lo of a global), it is",
      "  the unsplit assembler-macro load: -mno-split-addresses candidate",
      "  (func_800165D8/func_80016C08 precedent — under split addresses the lui",
      "  is an independent insn and sched2 lifts it away; no source shape or",
      "  allocation can pin it unless an intervening insn touches its register).",
      "  If the pairs are non-symbolic or the issue is lui GROUPING across",
      "  consecutive loads, it is the scheduling class (SetGfxClip/SetGfxOffset",
      "  precedent: -fno-schedule-insns{,2}). Calibration 2026-07-31: on the",
      "  decompiled corpus this fires only on documented hard cases and pinned",
      "  files.");
  }

  lines.push("", "Nearby/existing flag overrides:", nearby.length ? nearby.join("\n") : "  none");

  if (result.matrixSkipped) {
    lines.push("", `(${result.matrixSkipped}; fingerprints above stand on their own)`);
  } else {
    for (const label of [...new Set(report.matrix.map((row) => row.source))]) {
      lines.push("", `Flag matrix on ${label} (masked scores; bytes still decide):`);
      for (const row of report.matrix.filter((item) => item.source === label)) {
        lines.push(`  ${row.label.padEnd(42)} ${renderRow(row)}`);
      }
    }
    if ([...new Set(report.matrix.map((row) => row.source))].length === 1) {
      lines.push(
        "",
        "  Only the current source was scored. If a shape you rejected on score",
        "  is still mechanically plausible, re-run with --with-source <file> for",
        "  each: the flag that matters may be the one that only pays off there.");
    }
  }

  lines.push("", `Conclusion: ${report.conclusion}`);
  for (const reason of report.reasons) lines.push(`  - ${reason}`);

  lines.push(`
Escalation bar (prompts/c-style-guide.md section 11): a fingerprint above
PLUS a dominant flag column PLUS no contrary regional witness justifies
proposing a per-file override in configs/flag_overrides.mk. Verify any
adopted override with the byte verdict (\`diffFunc <func>\` must say MATCH).`);
  return lines.join("\n");
}

/* ---- CLI ---- */

function main(): void {
  const argv = process.argv.slice(2);
  const name = argv[0];
  if (!name || name.startsWith("--")) {
    console.error("Usage: npx tsx tools/agent/flagProbe.ts <func_name> [--json] [--with-source <file>]...");
    process.exit(1);
  }
  const json = argv.includes("--json");
  const extraSources: string[] = [];
  for (let index = 1; index < argv.length; index++) {
    if (argv[index] !== "--with-source") continue;
    const value = argv[++index];
    if (!value) { console.error("--with-source requires a path"); process.exit(1); }
    extraSources.push(value);
  }

  let result: ProbeResult;
  try {
    result = probe(name, extraSources);
  } catch (error) {
    console.error(`flagProbe: ${(error as Error).message}`);
    process.exit(1);
  }
  const path = writeReport(result.report);
  if (json) console.log(stableJson(result.report));
  else console.log(`${renderProbe(result)}\n\nReport: ${path.slice(ROOT.length + 1)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
