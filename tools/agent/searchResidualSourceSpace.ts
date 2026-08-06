#!/usr/bin/env npx tsx

/**
 * Automatic exhaustive residual source-space search.
 *
 * Derives a finite, versioned semantic-equivalence grammar from the current
 * clean C, the exact residual machine diff, and the configured compiler's
 * trace/schedule artifacts, then deterministically enumerates and exactly
 * evaluates every representation in the serialized domain.
 *
 * There are no tuning knobs. A run always goes to exhaustion: worker count is
 * derived from the CPU count, checkpointing and resume are automatic, and
 * there is no candidate cap that could turn an exhaustive search into a
 * partial one wearing a terminal state. `--derive-only` reports the exact
 * domain size and the projected wall time first, so the cost of a run is known
 * before it starts.
 */

import { isAbsolute, relative, resolve } from "node:path";
import { existsSync } from "node:fs";
import { ROOT, normalizeFunctionName, resolveSource } from "./decompToolchain.js";
import { runResidualSourceSearch } from "./residual-source-search/run.js";
import { renderResidualSummary } from "./residual-source-search/render-text.js";

interface CliOptions {
  functionName: string;
  sourcePath?: string;
  deriveOnly: boolean;
  json: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`searchResidualSourceSpace: ${message}`);
  console.error(
    "Usage: npx tsx tools/agent/searchResidualSourceSpace.ts <function> [--derive-only] [--source <path.c>] [--json]\n" +
    "\n" +
    "The required input is one function name. --source names which reconstruction\n" +
    "to search, which is an input rather than a knob. A run has no ceiling and no\n" +
    "partial sweep; use --derive-only first to see what exhausting it will cost.",
  );
  process.exit(1);
}

function parseCli(args: string[]): CliOptions {
  if (args.length === 0 || args[0]!.startsWith("--")) usage("missing function name");
  const options: CliOptions = {
    functionName: normalizeFunctionName(args[0]!),
    deriveOnly: false,
    json: false,
  };
  for (let index = 1; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--source") {
      const raw = args[++index];
      if (!raw) usage("--source requires a path");
      options.sourcePath = raw;
    } else if (argument === "--derive-only") options.deriveOnly = true;
    else if (argument === "--json") options.json = true;
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
    signal: abort.signal,
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
