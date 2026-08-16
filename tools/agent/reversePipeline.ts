#!/usr/bin/env npx tsx

/**
 * reversePipeline.ts — run the deterministic backward chain over one function.
 *
 * Answers "which pass owns this residual, and what is left to choose", not
 * "what should the source say". The output is a waypoint ladder, the round-trip
 * checks that license it, and the enumerated branch points.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import { renderBacktest, runBacktest, type PerturbationKind } from "./pipeline-reversal/backtest.js";
import { renderBlock, renderReversal } from "./pipeline-reversal/render-text.js";
import { reversePipeline } from "./pipeline-reversal/reverse.js";

interface CliOptions {
  functionName: string;
  objectPath?: string;
  source?: string;
  json: boolean;
  replay: boolean;
  /** Perturb a matching source in a known way and check the chain names the
   *  pass that owns the result. */
  backtest: boolean;
  /** Print one block target-beside-candidate instead of the report. */
  block?: number;
}

function usage(message?: string): never {
  if (message) console.error(`reversePipeline: ${message}`);
  console.error("Usage: npx tsx tools/agent/reversePipeline.ts <function...> [--object <path>] [--source <path>] [--block <n>] [--backtest] [--no-replay] [--json]");
  process.exit(1);
}

function parseCli(args: string[]): CliOptions {
  let functionName: string | undefined;
  let objectPath: string | undefined;
  let source: string | undefined;
  let json = false;
  let replay = true;
  let backtest = false;
  let block: number | undefined;
  const extra: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--json") json = true;
    else if (argument === "--backtest") backtest = true;
    else if (argument === "--no-replay") replay = false;
    else if (argument === "--block") {
      const value = args[++index];
      if (!value || !/^\d+$/.test(value)) usage("--block needs a non-negative integer");
      block = Number(value);
    }
    else if (argument === "--object") objectPath = args[++index];
    else if (argument === "--source") source = args[++index];
    else if (argument.startsWith("--")) usage(`unknown option: ${argument}`);
    else if (functionName) extra.push(normalizeFunctionName(argument));
    else functionName = normalizeFunctionName(argument);
  }
  if (!functionName) usage("missing function name");
  if (extra.length > 0 && !backtest) usage("only one function may be reversed outside --backtest");
  const options: CliOptions = { functionName, json, replay, backtest };
  if (block !== undefined) options.block = block;
  if (extra.length > 0) (options as CliOptions & { others: string[] }).others = extra;
  if (objectPath) options.objectPath = objectPath;
  if (source) options.source = source;
  return options;
}

const isCLI = process.argv[1]?.endsWith("reversePipeline.ts");
if (isCLI) {
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.backtest) {
      const others = (options as CliOptions & { others?: string[] }).others ?? [];
      const kinds: PerturbationKind[] = ["declaration-order", "statement-order", "constant-value"];
      const cases = runBacktest([options.functionName, ...others], kinds);
      console.log(options.json ? JSON.stringify(cases, null, 2) : renderBacktest(cases));
      process.exit(0);
    }
    const artifacts = reversePipeline(options);
    if (options.block !== undefined) {
      console.log(renderBlock(artifacts.target.preDbr, artifacts.candidate.preDbr, options.block));
      process.exit(0);
    }
    const text = renderReversal(artifacts.report);
    const directory = join(ROOT, "build/pipelineReversal", options.functionName);
    writeFileSync(join(directory, "report.txt"), `${text}\n`);
    console.log(options.json ? JSON.stringify(artifacts.report, null, 2) : text);
  } catch (error) {
    console.error(`reversePipeline: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

export { reversePipeline };
