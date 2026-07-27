#!/usr/bin/env npx tsx
/**
 * compilerTrace.ts — expose GCC 2.95 RTL/allocation/scheduling decisions.
 *
 * Usage:
 *   npx tsx tools/agent/compilerTrace.ts func_8001B4E4
 *   npx tsx tools/agent/compilerTrace.ts func_8001B4E4 --src build/candidate.c
 *   npx tsx tools/agent/compilerTrace.ts func_8001B4E4 --pseudo 106
 *   npx tsx tools/agent/compilerTrace.ts func_8001B4E4 --scheduler-window 24:32
 *   npx tsx tools/agent/compilerTrace.ts func_8001B4E4 --json
 *
 * Raw GCC -da dumps and a stable report.json are retained under
 * build/compilerTrace/<function>/.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { basename, join, relative } from "path";
import {
  ROOT,
  assembleCompilerOutput,
  assembleTarget,
  compileSource,
  disassembleObject,
  normalizeFunctionName,
  resolveSource,
} from "./decompToolchain.js";
import { detectAllocationFeedback } from "./compiler-trace/hard-register-hazards.js";
import { analyzeAllocation, applyAllocation } from "./compiler-trace/local-allocation.js";
import { buildPseudoProvenance } from "./compiler-trace/pseudo-provenance.js";
import { reconstructRtlMetadata } from "./compiler-trace/rtl-notes.js";
import { renderText } from "./compiler-trace/render-text.js";
import {
  FIRST_PSEUDO_REGISTER,
  parseRegisterReferences,
  parseRtlInstructions,
  parseRtlNotes,
} from "./compiler-trace/rtl-parser.js";
import { parseScheduler } from "./compiler-trace/scheduler-dag.js";
import { findTargetRegisterRecurrences } from "./compiler-trace/target-recurrence.js";
import type {
  CompilerTraceReport,
  RenderOptions,
  RtlInstruction,
  RtlStageMetadata,
  StageSummary,
} from "./compiler-trace/types.js";

export type { CompilerTraceReport } from "./compiler-trace/types.js";

const STAGE_ORDER = [
  "rtl", "jump", "cse", "gcse", "loop", "cse2", "addressof", "flow",
  "combine", "regmove", "sched", "lreg", "greg", "flow2", "bp", "sched2",
  "jump2", "dbr", "mach",
];

function countInstructions(content: string): number {
  return [...content.matchAll(/^\((?:insn|jump_insn|call_insn)\s+\d+/gm)].length;
}

function pseudoOccurrences(content: string): { count: number; pseudos: Set<number> } {
  const pseudos = new Set<number>();
  let count = 0;
  for (const reference of parseRegisterReferences(content)) {
    if (reference.register < FIRST_PSEUDO_REGISTER) continue;
    pseudos.add(reference.register);
    count++;
  }
  return { count, pseudos };
}

function stageSuffix(file: string): string {
  const pieces = file.split(".");
  return pieces[pieces.length - 1]!;
}

function dumpFiles(directory: string, prefix: string): string[] {
  return readdirSync(directory)
    .filter((file) => file.startsWith(`${prefix}.i.`))
    .sort((left, right) => {
      const leftIndex = STAGE_ORDER.indexOf(stageSuffix(left));
      const rightIndex = STAGE_ORDER.indexOf(stageSuffix(right));
      return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
    });
}

function summarizeStages(
  directory: string,
  files: string[],
  metadata: Map<string, RtlStageMetadata>,
): StageSummary[] {
  return files.map((file) => {
    const path = join(directory, file);
    const content = readFileSync(path, "utf-8");
    const occurrences = pseudoOccurrences(content);
    const stageMetadata = metadata.get(stageSuffix(file));
    return {
      suffix: stageSuffix(file),
      file: relative(ROOT, path),
      bytes: Buffer.byteLength(content),
      instructionCount: countInstructions(content),
      noteCount: stageMetadata?.notes.length || 0,
      loopRegionCount: stageMetadata?.loopRegions.length || 0,
      maximumLoopDepth: stageMetadata?.instructions.reduce(
        (maximum, instruction) => Math.max(maximum, instruction.loopDepth), 0,
      ) || 0,
      pseudoCount: occurrences.pseudos.size,
      pseudoOccurrences: occurrences.count,
    };
  });
}

function parseAllStages(
  directory: string,
  prefix: string,
  files: string[],
): {
  contents: Map<string, string>;
  instructions: Map<string, RtlInstruction[]>;
  metadata: Map<string, RtlStageMetadata>;
} {
  const contents = new Map<string, string>();
  const instructions = new Map<string, RtlInstruction[]>();
  const metadata = new Map<string, RtlStageMetadata>();
  for (const file of files) {
    const stage = stageSuffix(file);
    const content = readFileSync(join(directory, file), "utf-8");
    contents.set(stage, content);
    const stageInstructions = parseRtlInstructions(content, stage);
    const notes = parseRtlNotes(content, stage);
    instructions.set(stage, stageInstructions);
    metadata.set(stage, reconstructRtlMetadata(content, stage, stageInstructions, notes));
  }
  return { contents, instructions, metadata };
}

function nearestInstructions(
  instructions: Map<string, RtlInstruction[]>,
  candidates: string[],
): RtlInstruction[] {
  for (const stage of candidates) {
    const value = instructions.get(stage);
    if (value && value.length > 0) return value;
  }
  return [];
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
  const files = dumpFiles(outputDirectory, funcName);
  const parsed = parseAllStages(outputDirectory, funcName, files);
  const provenanceStages = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf("greg") + 1)
    .filter((stage) => parsed.instructions.has(stage));
  const pseudoMap = buildPseudoProvenance(provenanceStages, parsed.instructions);
  const caveats: string[] = [];
  let allocationOrder: CompilerTraceReport["allocationOrder"] = [];
  for (const metadata of parsed.metadata.values()) caveats.push(...metadata.caveats);

  const localContent = parsed.contents.get("lreg");
  if (localContent) {
    const allocation = analyzeAllocation(
      localContent,
      parsed.contents.get("greg") || "",
      parsed.instructions.get("lreg") || [],
    );
    applyAllocation(pseudoMap, allocation);
    allocationOrder = allocation.globalOrder;
    caveats.push(...allocation.caveats);
  } else {
    caveats.push("No .lreg dump was produced, so allocation quantities and reconstructed lifetimes are unavailable.");
  }

  const schedulers = [];
  const schedContent = parsed.contents.get("sched");
  const schedInstructions = parsed.instructions.get("sched") || [];
  const schedInput = nearestInstructions(parsed.instructions, ["regmove", "combine", "flow"]);
  if (schedContent) {
    schedulers.push(parseScheduler(
      "sched",
      schedContent,
      schedInstructions,
      schedInput.map((instruction) => instruction.uid),
    ));
  }
  const sched2Content = parsed.contents.get("sched2");
  const sched2Instructions = parsed.instructions.get("sched2") || [];
  const sched2Input = nearestInstructions(parsed.instructions, ["bp", "flow2", "greg"]);
  if (sched2Content) {
    schedulers.push(parseScheduler(
      "sched2",
      sched2Content,
      sched2Instructions,
      sched2Input.map((instruction) => instruction.uid),
    ));
  }
  for (const scheduler of schedulers) caveats.push(...scheduler.caveats);

  const pseudos = [...pseudoMap.values()].sort((left, right) => left.pseudo - right.pseudo);
  const sched1 = schedulers.find((scheduler) => scheduler.stage === "sched");
  const sched2 = schedulers.find((scheduler) => scheduler.stage === "sched2");
  const feedback = detectAllocationFeedback(
    sched1,
    sched2,
    schedInput,
    schedInstructions,
    sched2Instructions,
    pseudos,
  );

  let recurrenceHints = [];
  try {
    const candidateObject = join(outputDirectory, `${funcName}.c.o`);
    assembleCompilerOutput(artifacts.assembly, candidateObject);
    const targetObject = assembleTarget(funcName, outputDirectory);
    const target = disassembleObject(targetObject);
    const candidate = disassembleObject(candidateObject);
    recurrenceHints = findTargetRegisterRecurrences(
      target,
      candidate,
      nearestInstructions(parsed.instructions, ["dbr", "mach", "sched2"]),
      parsed.instructions.get("lreg") || [],
      pseudos,
    );
  } catch (error: any) {
    caveats.push(`Target recurrence analysis unavailable: ${error.message}`);
  }

  caveats.push(
    "Source expressions are normalized RTL SET expressions, not recovered C identifiers; heuristic mappings are explicitly labeled inferred.",
    "An assignment explains what cc1 did for this candidate; the archived target has no recoverable RTL dump.",
    "Tracing is diagnostic-only: changing allocator or scheduler behavior would invalidate compiler identity.",
  );

  const reportPath = join(outputDirectory, "report.json");
  const report: CompilerTraceReport = {
    schemaVersion: 1,
    function: funcName,
    source: relative(ROOT, source),
    outputDirectory: relative(ROOT, outputDirectory),
    assembly: relative(ROOT, artifacts.assembly),
    reportArtifact: relative(ROOT, reportPath),
    flags: artifacts.cc1Flags,
    stages: summarizeStages(outputDirectory, files, parsed.metadata),
    stageMetadata: [...parsed.metadata.values()],
    pseudos,
    allocationOrder,
    schedulers,
    feedback,
    recurrenceHints,
    caveats: [...new Set(caveats)],
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

interface CliOptions extends RenderOptions {
  functionName: string;
  requestedSource?: string;
  json: boolean;
  useOverrides: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`compilerTrace: ${message}`);
  console.error(
    "Usage: npx tsx tools/agent/compilerTrace.ts <func> [--src <file>] [--json] " +
    "[--pseudo <number>] [--scheduler-window <start:end>] [--no-overrides]",
  );
  process.exit(1);
}

function parseCli(args: string[]): CliOptions {
  let functionName: string | undefined;
  let requestedSource: string | undefined;
  let pseudo: number | undefined;
  let schedulerWindow: RenderOptions["schedulerWindow"];
  let json = false;
  let useOverrides = true;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--src") {
      requestedSource = args[++index];
      if (!requestedSource) usage("--src requires a file");
    } else if (argument === "--pseudo") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw)) usage("--pseudo requires an integer");
      pseudo = parseInt(raw, 10);
    } else if (argument === "--scheduler-window") {
      const raw = args[++index];
      const match = raw?.match(/^(\d+):(\d+)$/);
      if (!match) usage("--scheduler-window requires start:end");
      schedulerWindow = { start: parseInt(match[1], 10), end: parseInt(match[2], 10) };
      if (schedulerWindow.end < schedulerWindow.start) usage("scheduler window end precedes start");
    } else if (argument === "--json") {
      json = true;
    } else if (argument === "--no-overrides") {
      useOverrides = false;
    } else if (argument.startsWith("--")) {
      usage(`unknown option ${argument}`);
    } else if (functionName) {
      usage("only one function may be traced");
    } else {
      functionName = normalizeFunctionName(argument);
    }
  }
  if (!functionName) usage("missing function name");
  const result: CliOptions = { functionName, json, useOverrides };
  if (requestedSource) result.requestedSource = requestedSource;
  if (pseudo !== undefined) result.pseudo = pseudo;
  if (schedulerWindow) result.schedulerWindow = schedulerWindow;
  return result;
}

const isCLI = process.argv[1]?.endsWith("compilerTrace.ts");
if (isCLI) {
  const options = parseCli(process.argv.slice(2));
  try {
    const report = buildTraceReport(
      options.functionName,
      options.requestedSource,
      options.useOverrides,
    );
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else console.log(renderText(report, options));
  } catch (error: any) {
    console.error(`compilerTrace: ${error.message}`);
    process.exit(1);
  }
}
