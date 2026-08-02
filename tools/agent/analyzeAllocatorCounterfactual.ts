#!/usr/bin/env npx tsx
/**
 * Diagnose the minimum lifetime/allocation changes needed for target hard-register roles.
 *
 * Usage:
 *   npx tsx tools/agent/analyzeAllocatorCounterfactual.ts func_80016280
 *   npx tsx tools/agent/analyzeAllocatorCounterfactual.ts func_80016280 \
 *     --trace build/compilerTrace/func_80016280/report.json \
 *     --analysis build/targetSchedule/func_80016280/analysis.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { analyzeTargetSchedule } from "./analyzeTargetSchedule.js";
import { parseRtlInstructions } from "./compiler-trace/rtl-parser.js";
import type { CompilerTraceReport } from "./compiler-trace/types.js";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import { analyzeAllocatorCounterfactual } from "./allocator-counterfactual/analyze.js";
import { renderAllocatorCounterfactual } from "./allocator-counterfactual/render-text.js";
import { assertTargetScheduleAnalysis, type TargetScheduleAnalysis } from "./target-schedule/types.js";

interface CliOptions {
  functionName: string;
  tracePath?: string;
  analysisPath?: string;
  json: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`analyzeAllocatorCounterfactual: ${message}`);
  console.error(
    "Usage: npx tsx tools/agent/analyzeAllocatorCounterfactual.ts <function> " +
    "[--trace <report.json> --analysis <analysis.json>] [--json]",
  );
  process.exit(1);
}

function parseCli(args: string[]): CliOptions {
  let functionName: string | undefined;
  let tracePath: string | undefined;
  let analysisPath: string | undefined;
  let json = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--trace") {
      tracePath = args[++index];
      if (!tracePath) usage("--trace requires report.json");
    } else if (argument === "--analysis") {
      analysisPath = args[++index];
      if (!analysisPath) usage("--analysis requires analysis.json");
    } else if (argument === "--json") {
      json = true;
    } else if (argument.startsWith("--")) {
      usage(`unknown option ${argument}`);
    } else if (functionName) {
      usage("only one function may be analyzed");
    } else {
      functionName = normalizeFunctionName(argument);
    }
  }
  if (!functionName) usage("missing function name");
  if (Boolean(tracePath) !== Boolean(analysisPath)) usage("--trace and --analysis must be supplied together");
  const result: CliOptions = { functionName, json };
  if (tracePath) result.tracePath = tracePath;
  if (analysisPath) result.analysisPath = analysisPath;
  return result;
}

function absolute(path: string): string {
  return isAbsolute(path) ? path : join(ROOT, path);
}

function readTrace(path: string, functionName: string): CompilerTraceReport {
  const value = JSON.parse(readFileSync(absolute(path), "utf8")) as CompilerTraceReport;
  if (value.schemaVersion !== 2 || value.function !== functionName || !Array.isArray(value.pseudos)) {
    throw new Error(`${path} is not a compatible compiler trace for ${functionName}`);
  }
  return value;
}

function readTargetSchedule(path: string, functionName: string): TargetScheduleAnalysis {
  const value = assertTargetScheduleAnalysis(JSON.parse(readFileSync(absolute(path), "utf8")));
  if (value.function !== functionName) throw new Error(`${path} targets ${value.function}, not ${functionName}`);
  return value;
}

function loadInputs(options: CliOptions): {
  trace: CompilerTraceReport;
  targetSchedule: TargetScheduleAnalysis;
  targetScheduleArtifact: string;
} {
  if (options.tracePath && options.analysisPath) {
    if (!existsSync(absolute(options.tracePath))) throw new Error(`trace artifact not found: ${options.tracePath}`);
    if (!existsSync(absolute(options.analysisPath))) throw new Error(`target-schedule artifact not found: ${options.analysisPath}`);
    return {
      trace: readTrace(options.tracePath, options.functionName),
      targetSchedule: readTargetSchedule(options.analysisPath, options.functionName),
      targetScheduleArtifact: relative(ROOT, absolute(options.analysisPath)),
    };
  }
  const targetSchedule = analyzeTargetSchedule({ functionName: options.functionName, maxInterventions: 3 });
  return {
    trace: readTrace(targetSchedule.traceArtifact, options.functionName),
    targetSchedule,
    targetScheduleArtifact: join("build/targetSchedule", options.functionName, "analysis.json"),
  };
}

export function runAllocatorCounterfactual(options: CliOptions) {
  const loaded = loadInputs(options);
  const lregStage = loaded.trace.stages.find((stage) => stage.suffix === "lreg");
  if (!lregStage) throw new Error("compiler trace has no .lreg stage");
  const lregContent = readFileSync(absolute(lregStage.file), "utf8");
  const outputDirectory = join(ROOT, "build/allocatorCounterfactual", options.functionName);
  const outputRelative = relative(ROOT, outputDirectory);
  const analysis = analyzeAllocatorCounterfactual({
    functionName: options.functionName,
    trace: loaded.trace,
    targetSchedule: loaded.targetSchedule,
    targetScheduleArtifact: loaded.targetScheduleArtifact,
    outputDirectory: outputRelative,
    lregContent,
    lregInstructions: parseRtlInstructions(lregContent, "lreg"),
  });
  mkdirSync(outputDirectory, { recursive: true });
  const summary = renderAllocatorCounterfactual(analysis);
  writeFileSync(join(outputDirectory, "analysis.json"), `${JSON.stringify(analysis, null, 2)}\n`);
  writeFileSync(join(outputDirectory, "summary.txt"), summary);
  return { analysis, summary };
}

const isCLI = process.argv[1]?.endsWith("analyzeAllocatorCounterfactual.ts");
if (isCLI) {
  try {
    const options = parseCli(process.argv.slice(2));
    const result = runAllocatorCounterfactual(options);
    console.log(options.json ? JSON.stringify(result.analysis, null, 2) : result.summary);
  } catch (error) {
    console.error(`analyzeAllocatorCounterfactual: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
