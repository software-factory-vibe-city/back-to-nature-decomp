#!/usr/bin/env npx tsx

import { join } from "node:path";
import { buildTraceReport } from "./compilerTrace.js";
import {
  ROOT,
  assembleTarget,
  disassembleObject,
  normalizeFunctionName,
} from "./decompToolchain.js";
import { normalizeDisassembly } from "./variant-lab/compile.js";
import { analyzeTargetScheduleFromArtifacts } from "./target-schedule/analyze.js";
import { writeTargetScheduleArtifacts } from "./target-schedule/artifacts.js";
import { renderTargetSchedule } from "./target-schedule/render-text.js";
import type { TargetScheduleAnalysis } from "./target-schedule/types.js";

export interface AnalyzeTargetScheduleOptions {
  functionName: string;
  block?: number;
  maxInterventions: number;
  json?: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`analyzeTargetSchedule: ${message}`);
  console.error("Usage: npx tsx tools/agent/analyzeTargetSchedule.ts <function> [--block <number>] [--max-interventions <1..8>] [--json]");
  process.exit(1);
}

function parseCli(args: string[]): AnalyzeTargetScheduleOptions {
  if (args.length === 0) usage("missing function name");
  let functionName: string | undefined;
  let block: number | undefined;
  let maxInterventions = 3;
  let json = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--block") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw)) usage("--block requires a non-negative integer");
      block = Number(raw);
    } else if (argument === "--max-interventions") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 8) usage("--max-interventions must be 1..8");
      maxInterventions = Number(raw);
    } else if (argument === "--json") json = true;
    else if (argument.startsWith("--")) usage(`unknown option: ${argument}`);
    else if (functionName) usage("only one function may be analyzed");
    else functionName = normalizeFunctionName(argument);
  }
  if (!functionName) usage("missing function name");
  const result: AnalyzeTargetScheduleOptions = { functionName, maxInterventions, json };
  if (block !== undefined) result.block = block;
  return result;
}

export function analyzeTargetSchedule(options: AnalyzeTargetScheduleOptions): TargetScheduleAnalysis {
  const trace = buildTraceReport(options.functionName);
  const outputDirectory = join(ROOT, "build/targetSchedule", options.functionName);
  const targetObject = assembleTarget(options.functionName, outputDirectory);
  const target = normalizeDisassembly(disassembleObject(targetObject));
  const input = {
    functionName: options.functionName,
    trace,
    target,
    outputDirectory,
    maxInterventions: options.maxInterventions,
  } as const;
  const analysis = analyzeTargetScheduleFromArtifacts(
    options.block === undefined ? input : { ...input, block: options.block },
  );
  writeTargetScheduleArtifacts(outputDirectory, analysis, renderTargetSchedule(analysis));
  return analysis;
}

const isCLI = process.argv[1]?.endsWith("analyzeTargetSchedule.ts");
if (isCLI) {
  try {
    const options = parseCli(process.argv.slice(2));
    const analysis = analyzeTargetSchedule(options);
    console.log(options.json ? JSON.stringify(analysis, null, 2) : renderTargetSchedule(analysis));
  } catch (error) {
    console.error(`analyzeTargetSchedule: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
