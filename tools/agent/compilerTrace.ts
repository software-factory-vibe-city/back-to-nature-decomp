#!/usr/bin/env npx tsx
/**
 * compilerTrace.ts — expose GCC 2.95 RTL/allocation/scheduling decisions.
 *
 * Usage:
 *   npx tsx tools/agent/compilerTrace.ts func_8001B4E4
 *   npx tsx tools/agent/compilerTrace.ts func_8001B4E4 --src notes/scratch/func_8001B4E4-candidate.c
 *   npx tsx tools/agent/compilerTrace.ts func_8001B4E4 --json
 *
 * Raw GCC -da dumps are retained under build/compilerTrace/<function>/.
 */

import { existsSync, readFileSync, readdirSync, rmSync } from "fs";
import { basename, join, relative } from "path";
import {
  ROOT,
  compileSource,
  normalizeFunctionName,
  resolveSource,
} from "./decompToolchain.js";

interface StageSummary {
  suffix: string;
  file: string;
  bytes: number;
  instructionCount: number;
  pseudoCount: number;
  pseudoOccurrences: number;
}

interface PseudoSummary {
  pseudo: number;
  uses?: number;
  span?: number;
  block?: number;
  sets?: number;
  attributes: string[];
  assignedHardReg?: number;
  assignedRegister?: string;
  allocationStage?: "local" | "global/reload";
  estimatedPriority?: number;
  conflicts: number[];
}

interface SchedulerSummary {
  stage: string;
  instructionPriorities: number;
  readyListDecisions: number;
  shortenedLives: number;
  extendedLives: number;
}

interface CompilerTraceReport {
  function: string;
  source: string;
  outputDirectory: string;
  assembly: string;
  flags: string[];
  stages: StageSummary[];
  pseudos: PseudoSummary[];
  schedulers: SchedulerSummary[];
  caveats: string[];
}

const STAGE_ORDER = [
  "rtl", "jump", "cse", "gcse", "loop", "cse2", "addressof", "flow",
  "combine", "regmove", "sched", "lreg", "greg", "flow2", "bp", "sched2",
  "jump2", "dbr", "mach",
];

const HARD_REGISTER_NAMES = [
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra",
];

function hardRegisterName(register: number): string {
  return HARD_REGISTER_NAMES[register] || `hard-${register}`;
}

function countInstructions(content: string): number {
  return [...content.matchAll(/^\((?:insn|jump_insn|call_insn)\s+\d+/gm)].length;
}

function pseudoOccurrences(content: string): { count: number; pseudos: Set<number> } {
  const pseudos = new Set<number>();
  let count = 0;
  const pattern = /\(reg(?:\/[a-z]+)*:[A-Z0-9]+\s+(\d+)(?:\s+[^)\s]+)?\)/gi;
  for (const match of content.matchAll(pattern)) {
    const register = parseInt(match[1], 10);
    /* FIRST_PSEUDO_REGISTER is 80 for this MIPS backend. */
    if (register >= 80) {
      pseudos.add(register);
      count++;
    }
  }
  return { count, pseudos };
}

function stageSuffix(file: string): string {
  const pieces = file.split(".");
  return pieces[pieces.length - 1];
}

function summarizeStages(directory: string, prefix: string): StageSummary[] {
  const files = readdirSync(directory)
    .filter((file) => file.startsWith(`${prefix}.i.`))
    .sort((a, b) => {
      const ai = STAGE_ORDER.indexOf(stageSuffix(a));
      const bi = STAGE_ORDER.indexOf(stageSuffix(b));
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });

  return files.map((file) => {
    const path = join(directory, file);
    const content = readFileSync(path, "utf-8");
    const occurrences = pseudoOccurrences(content);
    return {
      suffix: stageSuffix(file),
      file: relative(ROOT, path),
      bytes: Buffer.byteLength(content),
      instructionCount: countInstructions(content),
      pseudoCount: occurrences.pseudos.size,
      pseudoOccurrences: occurrences.count,
    };
  });
}

function parseAssignments(content: string): Map<number, number> {
  const result = new Map<number, number>();
  for (const match of content.matchAll(/;; Register (\d+) in (\d+)\./g)) {
    result.set(parseInt(match[1], 10), parseInt(match[2], 10));
  }

  const dispositionIndex = content.indexOf(";; Register dispositions:");
  if (dispositionIndex >= 0) {
    const disposition = content.slice(dispositionIndex).split("\n\n", 1)[0];
    for (const match of disposition.matchAll(/\b(\d+) in (\d+)\b/g)) {
      result.set(parseInt(match[1], 10), parseInt(match[2], 10));
    }
  }
  return result;
}

function parseConflicts(content: string): Map<number, number[]> {
  const result = new Map<number, number[]>();
  for (const line of content.split("\n")) {
    const match = line.match(/^;; (\d+) conflicts:\s*(.*)$/);
    if (!match) continue;
    const pseudo = parseInt(match[1], 10);
    const conflicts = [...match[2].matchAll(/\d+/g)].map((value) => parseInt(value[0], 10));
    result.set(pseudo, conflicts.filter((value) => value !== pseudo));
  }
  return result;
}

function parsePseudos(directory: string, prefix: string): PseudoSummary[] {
  const localPath = join(directory, `${prefix}.i.lreg`);
  const globalPath = join(directory, `${prefix}.i.greg`);
  if (!existsSync(localPath)) return [];

  const local = readFileSync(localPath, "utf-8");
  const global = existsSync(globalPath) ? readFileSync(globalPath, "utf-8") : "";
  const localAssignments = parseAssignments(local);
  const globalAssignments = parseAssignments(global);
  const assignments = new Map(localAssignments);
  for (const [pseudo, hard] of globalAssignments) assignments.set(pseudo, hard);
  const conflicts = parseConflicts(global);
  const result = new Map<number, PseudoSummary>();

  for (const line of local.split("\n")) {
    const match = line.match(
      /^Register (\d+) used (\d+) times? across (\d+) insns?(?: in block (\d+))?; set (\d+) times?;\s*(.*)$/,
    );
    if (!match) continue;
    const pseudo = parseInt(match[1], 10);
    const hard = assignments.get(pseudo);
    const summary: PseudoSummary = {
      pseudo,
      uses: parseInt(match[2], 10),
      span: parseInt(match[3], 10),
      sets: parseInt(match[5], 10),
      attributes: match[6].split(";").map((item) => item.trim().replace(/\.$/, "")).filter(Boolean),
      conflicts: conflicts.get(pseudo) || [],
    };
    if (match[4]) summary.block = parseInt(match[4], 10);
    if (summary.uses && summary.span) {
      /* Approximation of GCC 2.95.2 local-alloc.c QTY_CMP_PRI. Exact
         quantities can merge pseudos and use doubled birth/death indices. */
      const floorLog2 = Math.floor(Math.log2(summary.uses));
      summary.estimatedPriority = Math.trunc((floorLog2 * summary.uses / summary.span) * 10000);
    }
    if (hard !== undefined) {
      summary.assignedHardReg = hard;
      summary.assignedRegister = hardRegisterName(hard);
      summary.allocationStage = localAssignments.has(pseudo) ? "local" : "global/reload";
    }
    result.set(pseudo, summary);
  }

  /* Include allocated pseudos omitted from the descriptive header. */
  for (const [pseudo, hard] of assignments) {
    if (pseudo < 80 || result.has(pseudo)) continue;
    result.set(pseudo, {
      pseudo,
      attributes: [],
      assignedHardReg: hard,
      assignedRegister: hardRegisterName(hard),
      allocationStage: localAssignments.has(pseudo) ? "local" : "global/reload",
      conflicts: conflicts.get(pseudo) || [],
    });
  }

  return [...result.values()].sort((a, b) => a.pseudo - b.pseudo);
}

function parseSchedulers(directory: string, prefix: string): SchedulerSummary[] {
  const result: SchedulerSummary[] = [];
  for (const stage of ["sched", "sched2"]) {
    const path = join(directory, `${prefix}.i.${stage}`);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf-8");
    result.push({
      stage,
      instructionPriorities: [...content.matchAll(/^;; insn\[/gm)].length,
      readyListDecisions: [...content.matchAll(/^;; ready list at T-/gm)].length,
      shortenedLives: [...content.matchAll(/life shortened/g)].length,
      extendedLives: [...content.matchAll(/life extended/g)].length,
    });
  }
  return result;
}

export function buildTraceReport(
  funcName: string,
  requestedSource?: string,
  useOverrides: boolean = true,
): CompilerTraceReport {
  const source = resolveSource(funcName, requestedSource);
  const outputDirectory = join(ROOT, "build/compilerTrace", funcName);
  rmSync(outputDirectory, { recursive: true, force: true });

  const artifacts = compileSource(source, outputDirectory, funcName, {
    dumps: true,
    useOverrides,
  });

  return {
    function: funcName,
    source: relative(ROOT, source),
    outputDirectory: relative(ROOT, outputDirectory),
    assembly: relative(ROOT, artifacts.assembly),
    flags: artifacts.cc1Flags,
    stages: summarizeStages(outputDirectory, funcName),
    pseudos: parsePseudos(outputDirectory, funcName),
    schedulers: parseSchedulers(outputDirectory, funcName),
    caveats: [
      "The stock -da dumps expose pseudo lifetimes, assignments, conflicts, and scheduler traces, but not exact quantity merges, hard-register suggestions, or source-to-pseudo relationships.",
      "estimatedPriority approximates GCC 2.95.2 QTY_CMP_PRI from per-pseudo references/span; it is not exact when quantities merge or birth/death indices differ.",
      "An assignment explains what cc1 did for this candidate; the original target has no recoverable RTL dump.",
      "Tracing must remain diagnostic-only: changing allocator or scheduler behavior would invalidate compiler identity.",
    ],
  };
}

function printHuman(report: CompilerTraceReport): void {
  console.log(`Compiler trace: ${report.function}`);
  console.log(`source:    ${report.source}`);
  console.log(`artifacts: ${report.outputDirectory}`);
  console.log(`assembly:  ${report.assembly}\n`);

  console.log("Pass summaries:");
  console.log("  stage       insns  pseudos  occurrences  dump");
  for (const stage of report.stages) {
    console.log(
      `  ${stage.suffix.padEnd(10)} ${String(stage.instructionCount).padStart(5)}  ` +
      `${String(stage.pseudoCount).padStart(7)}  ${String(stage.pseudoOccurrences).padStart(11)}  ${stage.file}`,
    );
  }

  console.log("\nRegister allocation:");
  if (report.pseudos.length === 0) {
    console.log("  (no pseudo summaries found)");
  } else {
    console.log("  pseudo  uses  span  sets  assigned  pass           priority~  conflicts  attributes");
    for (const pseudo of report.pseudos) {
      const assigned = pseudo.assignedRegister
        ? `${pseudo.assignedRegister}($${pseudo.assignedHardReg})`
        : "—";
      const conflicts = pseudo.conflicts.length > 0 ? pseudo.conflicts.join(",") : "—";
      console.log(
        `  ${String(pseudo.pseudo).padStart(6)}  ${String(pseudo.uses ?? "—").padStart(4)}  ` +
        `${String(pseudo.span ?? "—").padStart(4)}  ${String(pseudo.sets ?? "—").padStart(4)}  ` +
        `${assigned.padEnd(9)} ${(pseudo.allocationStage || "—").padEnd(13)} ` +
        `${String(pseudo.estimatedPriority ?? "—").padStart(9)}  ${conflicts.padEnd(18)} ${pseudo.attributes.join("; ")}`,
      );
    }
  }

  console.log("\nScheduler traces:");
  for (const scheduler of report.schedulers) {
    console.log(
      `  ${scheduler.stage}: ${scheduler.instructionPriorities} priorities, ` +
      `${scheduler.readyListDecisions} ready-list decisions, ` +
      `${scheduler.shortenedLives} lives shortened, ${scheduler.extendedLives} extended`,
    );
  }

  console.log("\nCaveats:");
  for (const caveat of report.caveats) console.log(`  - ${caveat}`);
}

function usage(): never {
  console.error("Usage: npx tsx tools/agent/compilerTrace.ts <func> [--src <file>] [--json] [--no-overrides]");
  process.exit(1);
}

const isCLI = process.argv[1]?.endsWith("compilerTrace.ts");
if (isCLI) {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf("--src");
  const requestedSource = sourceIndex >= 0 ? args[sourceIndex + 1] : undefined;
  const positional = args.filter((arg, index) =>
    !arg.startsWith("--") && (sourceIndex < 0 || index !== sourceIndex + 1)
  );
  if (positional.length !== 1) usage();

  const funcName = normalizeFunctionName(positional[0]);
  try {
    const report = buildTraceReport(funcName, requestedSource, !args.includes("--no-overrides"));
    if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
    else printHuman(report);
  } catch (error: any) {
    console.error(`compilerTrace: ${error.message}`);
    process.exit(1);
  }
}
