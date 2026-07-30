#!/usr/bin/env npx tsx

/**
 * Automatic exhaustive residual source-space search.
 *
 * Derives a finite, versioned semantic-equivalence grammar from the current
 * clean C, the exact residual machine diff, and the configured compiler's
 * trace/schedule artifacts, then deterministically enumerates and exactly
 * evaluates every representation in the serialized domain. The only required
 * input is the function name: no permutation list, transform manifest, or
 * per-function grammar JSON is accepted.
 */

import { isAbsolute, relative, resolve } from "node:path";
import { existsSync } from "node:fs";
import { ROOT, normalizeFunctionName, resolveSource } from "./decompToolchain.js";
import { runResidualSourceSearch } from "./residual-source-search/run.js";
import { renderResidualSummary } from "./residual-source-search/render-text.js";
import type { ShardSpec } from "./residual-source-search/enumerate.js";

interface CliOptions {
  functionName: string;
  sourcePath?: string;
  deriveOnly: boolean;
  jobs: number;
  shard?: ShardSpec;
  resume: boolean;
  maxCandidates?: number;
  partitionCap?: number;
  startRank?: bigint;
  json: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`searchResidualSourceSpace: ${message}`);
  console.error(
    "Usage: npx tsx tools/agent/searchResidualSourceSpace.ts <function> [--source <path.c>] [--derive-only]\n" +
    "         [--jobs <1..32>] [--shard <k/n>] [--start <index>] [--resume] [--max-candidates <n>]\n" +
    "         [--max-partitions <n>] [--json]\n" +
    "\n" +
    "The required input is one function name. Resource controls change how much\n" +
    "of the derived domain is evaluated, never which representations are in it.",
  );
  process.exit(1);
}

function parseCli(args: string[]): CliOptions {
  if (args.length === 0 || args[0]!.startsWith("--")) usage("missing function name");
  const options: CliOptions = {
    functionName: normalizeFunctionName(args[0]!),
    deriveOnly: false,
    jobs: 1,
    resume: false,
    json: false,
  };
  for (let index = 1; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--source") {
      const raw = args[++index];
      if (!raw) usage("--source requires a path");
      options.sourcePath = raw;
    } else if (argument === "--derive-only") options.deriveOnly = true;
    else if (argument === "--jobs") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 32) usage("--jobs must be 1..32");
      options.jobs = Number(raw);
    } else if (argument === "--shard") {
      const raw = args[++index];
      const match = raw?.match(/^(\d+)\/(\d+)$/);
      if (!match || Number(match[1]) < 1 || Number(match[2]) < 1 || Number(match[1]) > Number(match[2])) {
        usage("--shard must be k/n with 1 <= k <= n");
      }
      options.shard = { index: Number(match[1]), count: Number(match[2]) };
    } else if (argument === "--resume") options.resume = true;
    else if (argument === "--max-candidates") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1) usage("--max-candidates must be a positive integer");
      options.maxCandidates = Number(raw);
    } else if (argument === "--max-partitions") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1) usage("--max-partitions must be a positive integer");
      options.partitionCap = Number(raw);
    } else if (argument === "--start") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw)) usage("--start must be a non-negative shard-local index");
      options.startRank = BigInt(raw);
    } else if (argument === "--json") options.json = true;
    else usage(`unknown option: ${argument}`);
  }
  return options;
}

function resolveRequestedSource(functionName: string, requested?: string): string {
  if (!requested) return resolveSource(functionName);
  const absolute = isAbsolute(requested) ? resolve(requested) : resolve(ROOT, requested);
  const related = relative(ROOT, absolute).replace(/\\/g, "/");
  if (related.startsWith("../")) usage("--source must stay within the project tree");
  if (!existsSync(absolute)) usage(`--source not found: ${requested}`);
  if (!absolute.endsWith(".c")) usage("--source must be a complete .c translation unit");
  return absolute;
}

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2));
  const sourcePath = resolveRequestedSource(cli.functionName, cli.sourcePath);
  const abort = new AbortController();
  process.once("SIGINT", () => abort.abort());
  process.once("SIGTERM", () => abort.abort());

  const summary = await runResidualSourceSearch({
    functionName: cli.functionName,
    sourcePath,
    deriveOnly: cli.deriveOnly,
    jobs: cli.jobs,
    resume: cli.resume,
    signal: abort.signal,
    ...(cli.shard ? { shard: cli.shard } : {}),
    ...(cli.maxCandidates !== undefined ? { maxCandidates: cli.maxCandidates } : {}),
    ...(cli.partitionCap !== undefined ? { partitionCap: cli.partitionCap } : {}),
    ...(cli.startRank !== undefined ? { startRank: cli.startRank } : {}),
  });
  console.log(cli.json ? JSON.stringify(summary, null, 2) : renderResidualSummary(summary));
  if (summary.status === "failed") process.exitCode = 1;
}

const isCLI = process.argv[1]?.endsWith("searchResidualSourceSpace.ts");
if (isCLI) {
  main().catch((error) => {
    console.error(`searchResidualSourceSpace: ${error instanceof Error ? error.stack || error.message : error}`);
    process.exitCode = 1;
  });
}

export { runResidualSourceSearch } from "./residual-source-search/run.js";
