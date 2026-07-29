#!/usr/bin/env npx tsx

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { analyzeTargetSchedule } from "./analyzeTargetSchedule.js";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import type { CompilerTraceReport } from "./compiler-trace/types.js";
import { assertTargetScheduleAnalysis, type TargetScheduleAnalysis } from "./target-schedule/types.js";
import { projectPath } from "./variant-lab/artifacts.js";
import { schedulerConstraintRunId, writeSchedulerConstraintArtifacts } from "./scheduler-constraint/artifacts.js";
import { deriveSchedulerConstraintInput, validateSchedulerConstraintInput } from "./scheduler-constraint/derive.js";
import { deriveSchedulerSourceHandoff } from "./scheduler-constraint/handoff.js";
import { renderSchedulerConstraintResult } from "./scheduler-constraint/render-text.js";
import { solveSchedulerConstraints } from "./scheduler-constraint/solver.js";
import type { SchedulerConstraintInput, SchedulerConstraintResult } from "./scheduler-constraint/types.js";

interface CliOptions {
  functionName?: string;
  inputPath?: string;
  analysisPath?: string;
  stage: "sched" | "sched2";
  block: number;
  maxPhantoms: number;
  maxAssignments: number;
  handoff: boolean;
  json: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`searchSchedulerState: ${message}`);
  console.error("Usage: npx tsx tools/agent/searchSchedulerState.ts <function> [--analysis <project-json>] [--stage sched|sched2] [--block <n>] [--max-phantoms <0..3>] [--max-assignments <n>] [--no-handoff] [--json]");
  console.error("   or: npx tsx tools/agent/searchSchedulerState.ts --input <build/.../input.json> [--no-handoff] [--json]");
  process.exit(1);
}

function integer(raw: string | undefined, option: string, minimum: number, maximum: number): number {
  if (!raw || !/^\d+$/.test(raw)) usage(`${option} requires an integer`);
  const value = Number(raw);
  if (value < minimum || value > maximum) usage(`${option} must be ${minimum}..${maximum}`);
  return value;
}

function parseCli(args: string[]): CliOptions {
  const options: CliOptions = { stage: "sched", block: 0, maxPhantoms: 3, maxAssignments: 500_000, handoff: true, json: false };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--input") options.inputPath = args[++index] || usage("--input requires a project-relative JSON path");
    else if (argument === "--analysis") options.analysisPath = args[++index] || usage("--analysis requires a project-relative JSON path");
    else if (argument === "--stage") {
      const stage = args[++index];
      if (stage !== "sched" && stage !== "sched2") usage("--stage must be sched or sched2");
      options.stage = stage;
    } else if (argument === "--block") options.block = integer(args[++index], "--block", 0, 10_000);
    else if (argument === "--max-phantoms") options.maxPhantoms = integer(args[++index], "--max-phantoms", 0, 3);
    else if (argument === "--max-assignments") options.maxAssignments = integer(args[++index], "--max-assignments", 1, 10_000_000);
    else if (argument === "--no-handoff") options.handoff = false;
    else if (argument === "--json") options.json = true;
    else if (argument.startsWith("--")) usage(`unknown option: ${argument}`);
    else if (options.functionName) usage("only one function may be supplied");
    else options.functionName = normalizeFunctionName(argument);
  }
  if (options.inputPath && options.functionName) usage("choose either a function or --input, not both");
  if (!options.inputPath && !options.functionName) usage("missing function name or --input");
  if (options.inputPath && options.analysisPath) usage("--analysis cannot be combined with --input");
  return options;
}

function projectInput(path: string, label: string): string {
  const absolute = isAbsolute(path) ? resolve(path) : resolve(ROOT, path);
  const related = relative(ROOT, absolute);
  if (related.startsWith("..") || isAbsolute(related)) throw new Error(`${label} must stay within the project tree`);
  if (!existsSync(absolute)) throw new Error(`${label} not found: ${path}`);
  return absolute;
}

function readJson(path: string, label: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function loadAnalysis(path: string): TargetScheduleAnalysis {
  return assertTargetScheduleAnalysis(readJson(projectInput(path, "analysis"), "analysis"));
}

function traceFromAnalysis(analysis: TargetScheduleAnalysis): CompilerTraceReport {
  return readJson(projectInput(analysis.traceArtifact, "trace artifact"), "trace artifact") as CompilerTraceReport;
}

function deriveFresh(options: CliOptions): { input: SchedulerConstraintInput; analysis: TargetScheduleAnalysis } {
  const functionName = options.functionName!;
  const analysis = options.analysisPath
    ? loadAnalysis(options.analysisPath)
    : analyzeTargetSchedule({ functionName, block: options.block, maxInterventions: 8 });
  if (analysis.function !== functionName) throw new Error(`analysis targets ${analysis.function}, not ${functionName}`);
  const trace = traceFromAnalysis(analysis);
  return {
    input: deriveSchedulerConstraintInput({
      functionName,
      stage: options.stage,
      block: options.block,
      maxPhantoms: options.maxPhantoms,
      maxAssignments: options.maxAssignments,
    }, trace, analysis),
    analysis,
  };
}

export function runSchedulerConstraintSearch(options: CliOptions): SchedulerConstraintResult {
  let input: SchedulerConstraintInput;
  let analysis: TargetScheduleAnalysis | undefined;
  if (options.inputPath) {
    input = validateSchedulerConstraintInput(readJson(projectInput(options.inputPath, "constraint input"), "constraint input"));
  } else {
    const fresh = deriveFresh(options);
    input = fresh.input;
    analysis = fresh.analysis;
  }
  const runId = schedulerConstraintRunId(input);
  const directory = join(ROOT, "build", "schedulerConstraint", input.model.function, runId);
  const artifactPath = projectPath(directory);
  const result = solveSchedulerConstraints(input, artifactPath);
  let handoff;
  if (options.handoff && analysis && result.status === "sat" && result.witness && result.witness.sourceRequirements.length > 0) {
    const sourcePath = isAbsolute(analysis.source) ? analysis.source : join(ROOT, analysis.source);
    handoff = deriveSchedulerSourceHandoff(input, result, analysis, sourcePath);
    if (handoff) result.sourceSearchSpec = projectPath(join(directory, "source-search-spec.json"));
    else result.caveats.push("SAT witness had no compatible proof-admitted source recipe in the current source-shape synthesis catalog.");
  }
  const summary = renderSchedulerConstraintResult(input, result);
  writeSchedulerConstraintArtifacts(directory, input, result, summary, handoff);
  return result;
}

const isCli = process.argv[1]?.endsWith("searchSchedulerState.ts");
if (isCli) {
  try {
    const options = parseCli(process.argv.slice(2));
    const result = runSchedulerConstraintSearch(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else {
      const inputPath = join(ROOT, result.artifacts, "input.json");
      const input = validateSchedulerConstraintInput(readJson(inputPath, "written constraint input"));
      console.log(renderSchedulerConstraintResult(input, result));
    }
    if (result.status === "model-replay-failed") process.exitCode = 2;
  } catch (error) {
    console.error(`searchSchedulerState: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
