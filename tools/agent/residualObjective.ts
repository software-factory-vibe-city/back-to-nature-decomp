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

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { ROOT, normalizeFunctionName, resolveSource } from "./decompToolchain.js";
import { type EnsuredArtifact, projectPath, renderProvenance } from "./provenance.js";
import { priorMeasurement, recordExperiment } from "./experimentLedger.js";
import { createHash } from "node:crypto";
import {
  compareObjectives,
  rankBlocks,
  summarizeObjective,
  type ResidualObjective,
} from "./pipeline-reversal/objective.js";
import { reversePipeline } from "./pipeline-reversal/reverse.js";
import { StubSourceError, compareFunction } from "../lib/functionOracle.js";
import { requireFunctionLocation } from "../lib/symbolIndex.js";

interface Entry {
  label: string;
  source?: string;
  /** Set when this row is an INCLUDE_ASM stub: there is nothing to score. */
  stub?: boolean;
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
  /** What the scored object was derived from, and whether it was rebuilt. */
  provenance: EnsuredArtifact<{ object: string; source: string }>;
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

/**
 * The baseline row for a function whose source is still a stub.
 *
 * A parked or untouched function has no candidate program, and the whole point
 * of scoring `--source` candidates against it is that there is not one yet.
 * Refusing the entire run because the *baseline* is a stub would make the tool
 * unusable exactly where a search needs it most, so the row says STUB and the
 * candidates are ranked against each other.
 */
function stubEntry(label: string, source?: string): Entry {
  const objective = {
    functionName: "",
    exact: false,
    key: [0, 0, 0, 0] as [number, number, number, number],
    controlFlow: 0, population: 0, schedule: 0, allocation: 0,
    blocks: [], undetermined: 0, degraded: false, blindBlocks: [],
  } satisfies ResidualObjective;
  const entry: Entry = {
    label,
    stub: true,
    objective,
    matchedWords: 0,
    totalWords: 0,
    objectHash: "stub",
    provenance: {
      value: { object: "", source: source ?? "" },
      provenance: { fingerprint: "stub" },
      regenerated: false,
    } as unknown as EnsuredArtifact<{ object: string; source: string }>,
  };
  if (source) entry.source = source;
  return entry;
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
    provenance: artifacts.candidateProvenance,
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
    const cell = `${block.population}/${block.schedule}/${block.allocation + block.coalescing}`;
    columns.set(block.block, block.blind ? `${cell}?` : cell);
  }
  return columns;
}

/**
 * The words that differ, for the state where the objective is zero.
 *
 * Only reached when every waypoint agreed, so this is not a second opinion on
 * the residual — it is the only remaining signal, and printing nothing here is
 * what left a search with no next move at its closest approach.
 */
function differingWords(functionName: string, entry: Entry): string[] {
  try {
    const container = requireFunctionLocation(functionName).container;
    const oracle = compareFunction(functionName, {
      objectPath: entry.provenance.value.object,
      container,
    });
    if (oracle.differing.length === 0) return [];
    const rows: string[] = [];
    for (let index = 0; index < oracle.rows.length; index++) {
      const row = oracle.rows[index]!;
      if (row.kind !== "target-only") continue;
      const next = oracle.rows[index + 1];
      if (next?.kind !== "candidate-only") continue;
      rows.push(`0x${row.target!.vram.toString(16).toUpperCase()}: target \`${row.target!.text}\`  candidate \`${next.candidate!.text}\``);
    }
    return rows.slice(0, 12);
  } catch {
    return [];
  }
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
    /* A stub baseline has no program, so "better" and "worse" would be
       comparisons against nothing — every candidate would read as worse than a
       zero key that means "not measured". Candidates are simply scored. */
    const verdict = entry.stub ? "STUB"
      : entry.objective.exact ? "EXACT"
      : entry.objective.undetermined > 0 ? "undetermined"
      : entry === baseline ? "baseline"
      : baseline.stub ? "scored"
      : entry.objectHash === baseline.objectHash ? "identical"
      : order < 0 ? "better"
      : order > 0 ? (tradedTerms(entry.objective, baseline.objective) ? "traded" : "worse")
      : "same";
    return [
      entry.label,
      verdict,
      entry.stub ? "—" : `${entry.matchedWords}/${entry.totalWords}`,
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

  const scored = entries.filter((entry) => !entry.stub);
  const best = [...(scored.length > 0 ? scored : entries)].sort((left, right) =>
    compareObjectives(left.objective, right.objective, block === undefined ? {} : { block }))[0]!;
  lines.push("");
  if (best.objective.exact) {
    lines.push(`BEST: ${best.label} — byte exact.`);
    return lines.join("\n");
  }
  if (baseline.stub) {
    lines.push(`BEST: ${best.label} — ${summarizeObjective(best.objective)} (the function's own source is still a stub)`);
  } else if (best !== baseline) {
    lines.push(`BEST: ${best.label} — ${summarizeObjective(best.objective)} (baseline ${summarizeObjective(baseline.objective)})`);
  } else if (entries.length > 1) {
    lines.push("BEST: none of the variants improves on the baseline.");
  }

  const work = rankBlocks(best.objective);
  if (work.length === 0) {
    if (best.objective.blindBlocks.length > 0) {
      lines.push("NEXT: nothing readable — every open block holds an undetermined word.");
    } else if (!best.objective.exact) {
      /* Zero residual, bytes still differ. This is the most informative state
         the search can be in and it used to print nothing: the reversal agrees
         at every waypoint, so the difference is something no waypoint can see —
         a commutative operand order, a same-shape symbol, an immediate. Name
         the words. */
      lines.push("NEXT: the reversal finds no residual and the bytes still differ.");
      lines.push("      Every waypoint agrees, so the difference is invisible to all of them:");
      lines.push("      a commutative operand order, a transposed same-shape global, or an");
      lines.push("      immediate. Read the words themselves — `psx_diff_func` names them.");
      for (const line of differingWords(functionName, best)) lines.push(`      ${line}`);
    } else {
      lines.push("NEXT: no open block — the residual is outside the per-block reading; read the full reversal report.");
    }
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
  if (best.objective.blindBlocks.length > 0) {
    lines.push("");
    lines.push(`BLIND: block ${best.objective.blindBlocks.join(", ")} contain${best.objective.blindBlocks.length === 1 ? "s" : ""} ` +
      `${best.objective.undetermined} word(s) whose relocation could not be resolved.`);
    lines.push("       Their terms are shown with a trailing ? and are excluded from the key —");
    lines.push("       no source edit can move them. Fix the configuration instead: an unattributed");
    lines.push("       jump table is the usual cause (`deriveRodataSplits.ts --container <id>`).");
  }
  if (best.objective.degraded) lines.push(`DEGRADED: ${best.objective.reason}`);
  lines.push("");
  lines.push(renderProvenance(entries.filter((entry) => !entry.stub)
    .map((entry) => ({ label: entry.label, ensured: entry.provenance }))));
  return lines.join("\n");
}

/**
 * Record each scored row and report any that repeats earlier work.
 *
 * The warning matters more than the record. A variant that compiles to words
 * already measured is not a new experiment however differently it is spelled,
 * and the sessions this ledger exists for spent turns discovering that by hand
 * — after paying for the compile and, worse, after building a story about what
 * the edit would do.
 */
function recordAndWarn(functionName: string, entries: Entry[]): string {
  const at = new Date().toISOString();
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.stub) continue;
    const sourcePath = entry.source ?? resolveSource(functionName);
    const sourceText = readFileSync(sourcePath, "utf8");
    const prior = priorMeasurement(functionName, sourceText, entry.objectHash);
    if (prior.sameOutput && prior.sameOutput.sourceHash !== prior.sameSource?.sourceHash) {
      lines.push(`  ${entry.label} compiles to words already measured on ${prior.sameOutput.at.slice(0, 10)} ` +
        `from ${prior.sameOutput.source} — same experiment, different spelling`);
    }
    recordExperiment({
      functionName,
      source: sourcePath,
      sourceText,
      objectPath: entry.provenance.value.object,
      outputHash: entry.objectHash,
      objective: entry.objective,
      matchedWords: entry.matchedWords,
      totalWords: entry.totalWords,
      verdict: entry === entries[0] ? "baseline" : "scored",
      at,
    });
  }
  const ledgerLine = `  recorded in build/experimentLedger/${functionName}.jsonl (psx_experiment_ledger to read it)`;
  return lines.length > 0
    ? ["ALREADY MEASURED", ...lines, "", ledgerLine].join("\n")
    : ledgerLine;
}

const isCLI = process.argv[1]?.endsWith("residualObjective.ts");
if (isCLI) {
  try {
    const options = parseCli(process.argv.slice(2));
    /* The baseline row is labelled with the file it measured, not "baseline".
     * A row that names no source reads as "the current state" whatever it was
     * actually derived from, which is how a stale object went unnoticed for a
     * day of iteration. */
    const baselineSource = projectPath(resolveSource(options.functionName));
    let entries: Entry[];
    try {
      entries = [score(options.functionName, baselineSource)];
    } catch (error) {
      /* A stub baseline is only fatal when it is the only thing being asked
         about. With candidates to score it is a row, not a failure. */
      if (!(error instanceof StubSourceError) || options.sources.length === 0) throw error;
      entries = [stubEntry(baselineSource, baselineSource)];
    }
    options.sources.forEach((source, index) => {
      entries.push(score(options.functionName, `v${index + 1}:${source.split("/").pop()}`, source));
    });
    /* Recorded on both output paths. The loop takes its end-of-turn reading
       with `--json`, and while that path skipped the ledger the stall counter
       was counting over a history with the loop's own measurements missing
       from it — the majority of them, on any function the loop worked. */
    const recorded = recordAndWarn(options.functionName, entries);
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
          provenance: {
            derivedFrom: entry.provenance.value.source,
            regenerated: entry.provenance.regenerated,
            fingerprint: entry.provenance.provenance.fingerprint,
          },
        })),
        work: rankBlocks(entries[0]!.objective),
        ledger: recorded.split("\n").filter(Boolean),
      }, null, 2));
    } else {
      console.log(render(options.functionName, entries, options.block));
      console.log("");
      console.log(recorded);
    }
  } catch (error) {
    console.error(`residualObjective: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
