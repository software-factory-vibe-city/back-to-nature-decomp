#!/usr/bin/env npx tsx

/**
 * residualObjective.ts — the iteration primitive.
 *
 * `diffFunc` answers the terminal question, "are the bytes identical", and it
 * should keep answering it. What it must stop being is the thing an iteration
 * hill-climbs on: the byte score is not a distance, so a variant that fixes the
 * cause of a residual scores worse than one that froze a wrong schedule into a
 * lucky register assignment, and greedy search keeps the wrong one.
 *
 * This tool scores candidate sources on the staged, per-block residual instead,
 * ranks them, and names the block to work next. Everything it prints is a
 * number a caller can act on without understanding the compiler.
 *
 *   npx tsx tools/agent/residualObjective.ts <function>
 *   npx tsx tools/agent/residualObjective.ts <function> --source a.c --source b.c
 *   npx tsx tools/agent/residualObjective.ts <function> --dir build/variants --block 6
 */

import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import { createHash } from "node:crypto";
import {
  compareObjectives,
  rankBlocks,
  summarizeObjective,
  type ResidualObjective,
} from "./pipeline-reversal/objective.js";
import { reversePipeline } from "./pipeline-reversal/reverse.js";

interface Entry {
  label: string;
  source?: string;
  objective: ResidualObjective;
  matchedWords: number;
  totalWords: number;
  /**
   * Hash of the relocated words this variant produced.
   *
   * Not of the object file: cc1 stamps the source path into a `.file`
   * directive, so two spellings of the same function hash differently as files
   * while being the same function. Two variants with the same word hash are one
   * experiment written twice — CSE collapses most re-spellings of a value — and
   * a loop that counts them separately never terminates.
   */
  objectHash: string;
}

interface CliOptions {
  functionName: string;
  sources: string[];
  block?: number;
  json: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`residualObjective: ${message}`);
  console.error("Usage: npx tsx tools/agent/residualObjective.ts <function> [--source <path>]... [--dir <path>] [--block <n>] [--json]");
  process.exit(1);
}

function parseCli(args: string[]): CliOptions {
  let functionName: string | undefined;
  const sources: string[] = [];
  let block: number | undefined;
  let json = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--json") json = true;
    else if (argument === "--source") {
      const value = args[++index];
      if (!value) usage("--source needs a path");
      sources.push(value);
    } else if (argument === "--dir") {
      const value = args[++index];
      if (!value) usage("--dir needs a path");
      const directory = isAbsolute(value) ? value : join(ROOT, value);
      if (!existsSync(directory)) usage(`no such directory: ${value}`);
      for (const file of readdirSync(directory).filter((name) => name.endsWith(".c")).sort()) {
        sources.push(join(directory, file));
      }
    } else if (argument === "--block") {
      const value = args[++index];
      if (!value || !/^\d+$/.test(value)) usage("--block needs a non-negative integer");
      block = Number(value);
    } else if (argument.startsWith("--")) usage(`unknown option: ${argument}`);
    else if (functionName) usage("only one function may be scored");
    else functionName = normalizeFunctionName(argument);
  }
  if (!functionName) usage("missing function name");
  const options: CliOptions = { functionName, sources, json };
  if (block !== undefined) options.block = block;
  return options;
}

function score(functionName: string, label: string, source?: string): Entry {
  const artifacts = reversePipeline({
    functionName,
    replay: false,
    ...(source ? { source, outputDirectory: join(ROOT, "build/pipelineReversal", functionName, "objective", label) } : {}),
  });
  const entry: Entry = {
    label,
    objective: artifacts.report.objective,
    matchedWords: artifacts.report.matchedWords,
    totalWords: artifacts.report.totalWords,
    objectHash: createHash("sha256")
      .update(artifacts.candidate.machine.insns.map((insn) => (insn.word ?? 0).toString(16)).join(","))
      .digest("hex"),
  };
  if (source) entry.source = source;
  return entry;
}

/**
 * Whether a variant lost on an earlier term but won on a later one.
 *
 * The staged ordering says a schedule difference outranks an allocation
 * difference, because allocation is downstream of the sched1 order and any
 * agreement bought by a worse schedule is coincidental. That is a claim about
 * causality, not a certainty, so a trade is reported as a trade rather than
 * folded into "worse" — a caller can keep it as a branch instead of discarding
 * it, and can see the exchange rate in the table.
 */
function tradedTerms(candidate: ResidualObjective, baseline: ResidualObjective): boolean {
  let lost = false;
  let won = false;
  for (let index = 0; index < candidate.key.length; index++) {
    if (candidate.key[index] > baseline.key[index]) lost = true;
    else if (candidate.key[index] < baseline.key[index] && lost) won = true;
  }
  return lost && won;
}

function blockColumns(objective: ResidualObjective): Map<number, string> {
  const columns = new Map<number, string>();
  for (const block of objective.blocks) {
    if (block.total === 0) continue;
    columns.set(block.block, `${block.population}/${block.schedule}/${block.allocation + block.coalescing}`);
  }
  return columns;
}

function render(functionName: string, entries: Entry[], block: number | undefined): string {
  const lines: string[] = [];
  const baseline = entries[0]!;
  lines.push(`residual objective: ${functionName}${block === undefined ? "" : `   (ranked for block ${block})`}`);
  lines.push("");

  const openBlocks = [...new Set(entries.flatMap((entry) =>
    entry.objective.blocks.filter((item) => item.total > 0).map((item) => item.block)))]
    .sort((left, right) => left - right);

  const anyUndetermined = entries.some((entry) => entry.objective.undetermined > 0);
  const header = ["variant", "verdict", "words", ...(anyUndetermined ? ["undet"] : []), "cfg", "pop", "sched", "alloc",
    ...openBlocks.map((index) => `b${index}`)];
  const rows = entries.map((entry) => {
    const columns = blockColumns(entry.objective);
    const order = entry === baseline ? 0 : compareObjectives(entry.objective, baseline.objective, block === undefined ? {} : { block });
    const verdict = entry.objective.exact ? "EXACT"
      : entry.objective.undetermined > 0 ? "undetermined"
      : entry === baseline ? "baseline"
      : entry.objectHash === baseline.objectHash ? "identical"
      : order < 0 ? "better"
      : order > 0 ? (tradedTerms(entry.objective, baseline.objective) ? "traded" : "worse")
      : "same";
    return [
      entry.label,
      verdict,
      `${entry.matchedWords}/${entry.totalWords}`,
      ...(anyUndetermined ? [String(entry.objective.undetermined)] : []),
      String(entry.objective.controlFlow),
      String(entry.objective.population),
      String(entry.objective.schedule),
      String(entry.objective.allocation),
      ...openBlocks.map((index) => columns.get(index) ?? "·"),
    ];
  });

  const widths = header.map((_, column) =>
    Math.max(header[column].length, ...rows.map((row) => row[column].length)));
  const line = (cells: string[]) => "  " + cells.map((cell, column) => cell.padEnd(widths[column])).join("  ");
  lines.push(line(header));
  for (const row of rows) lines.push(line(row));
  lines.push("");
  lines.push("  per-block cells are population/schedule/allocation; · means clear");
  if (anyUndetermined) {
    lines.push("  undet: words whose relocation could not be resolved — neither match nor difference.");
  }

  const best = [...entries].sort((left, right) =>
    compareObjectives(left.objective, right.objective, block === undefined ? {} : { block }))[0]!;
  lines.push("");
  if (best.objective.exact) {
    lines.push(`BEST: ${best.label} — byte exact.`);
    return lines.join("\n");
  }
  if (best !== baseline) {
    lines.push(`BEST: ${best.label} — ${summarizeObjective(best.objective)} (baseline ${summarizeObjective(baseline.objective)})`);
  } else if (entries.length > 1) {
    lines.push("BEST: none of the variants improves on the baseline.");
  }

  const work = rankBlocks(best.objective);
  if (work.length === 0) {
    lines.push("NEXT: no open block — the residual is outside the per-block reading; read the full reversal report.");
  } else {
    const next = work[0]!;
    lines.push(`NEXT: block ${next.block.block}${next.block.vram === undefined ? "" : ` (0x${next.block.vram.toString(16).toUpperCase()})`}` +
      ` — population ${next.block.population}, schedule ${next.block.schedule}, allocation ${next.block.allocation + next.block.coalescing}`);
    lines.push(`      ${next.reason}`);
    if (next.duplicates.length > 0) {
      lines.push(`      fixing it should also close block ${next.duplicates.join(", ")}`);
    }
    if (work.length > 1) {
      lines.push(`      then: ${work.slice(1).map((item) =>
        `block ${item.block.block} (${item.block.total}${item.duplicates.length > 0 ? ` +${item.duplicates.join(",")}` : ""})`).join(", ")}`);
    }
  }
  if (best.objective.degraded) lines.push(`DEGRADED: ${best.objective.reason}`);
  return lines.join("\n");
}

const isCLI = process.argv[1]?.endsWith("residualObjective.ts");
if (isCLI) {
  try {
    const options = parseCli(process.argv.slice(2));
    const entries: Entry[] = [score(options.functionName, "baseline")];
    options.sources.forEach((source, index) => {
      entries.push(score(options.functionName, `v${index + 1}:${source.split("/").pop()}`, source));
    });
    if (options.json) {
      console.log(JSON.stringify({
        function: options.functionName,
        block: options.block,
        entries: entries.map((entry) => ({
          label: entry.label,
          source: entry.source,
          matchedWords: entry.matchedWords,
          totalWords: entry.totalWords,
          objective: entry.objective,
        })),
        work: rankBlocks(entries[0]!.objective),
      }, null, 2));
    } else console.log(render(options.functionName, entries, options.block));
  } catch (error) {
    console.error(`residualObjective: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
