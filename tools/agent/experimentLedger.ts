#!/usr/bin/env npx tsx
/**
 * experimentLedger.ts — what has already been measured, and what it cost.
 *
 * Sessions kept re-running each other's experiments. One function's research
 * note records a lever closed in its second session and re-tested in its
 * fourth; the same note lists two variants whose only finding was that CSE
 * collapses them into the baseline — a result the previous session had already
 * written down. Nothing enforced any of it, because the only memory was a prose
 * note no tool reads.
 *
 * The ledger is that memory in a form the loop can consult. Every scored
 * variant lands here with its residual key and its verdict, keyed by the
 * *compiled output* as well as the source text, so the two ways an experiment
 * repeats are both caught:
 *
 *   - the same source scored twice — the obvious repeat;
 *   - a different spelling that compiles to the same words — the expensive one,
 *     because it looks like a new idea and is not.
 *
 * A `psx_residual_objective` run appends automatically. The point is that no
 * agent has to remember to record anything, and the next session opens with the
 * measured history rather than re-deriving it.
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import { projectPath, sha256 } from "./provenance.js";
import type { ResidualObjective } from "./pipeline-reversal/objective.js";

export const LEDGER_SCHEMA_VERSION = 1;

export interface LedgerEntry {
  schemaVersion: number;
  function: string;
  /** ISO timestamp; the ledger is append-only and ordered by it. */
  at: string;
  /** Project-relative source that was scored. */
  source: string;
  /** SHA-256 of the source text. */
  sourceHash: string;
  /** SHA-256 of the relocated words. Equal hashes are one experiment. */
  outputHash: string;
  /** The staged residual key: [control-flow, population, schedule, allocation]. */
  key: number[];
  matchedWords: number;
  totalWords: number;
  verdict: string;
  /** One line from the author on what was being tested. Optional but wanted. */
  note?: string;
}

function ledgerPath(functionName: string): string {
  return join(ROOT, "build/experimentLedger", `${functionName}.jsonl`);
}

export function readLedger(functionName: string): LedgerEntry[] {
  const path = ledgerPath(functionName);
  if (!existsSync(path)) return [];
  const entries: LedgerEntry[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as LedgerEntry);
    } catch {
      /* A torn append is one lost row, not a broken ledger. */
    }
  }
  return entries;
}

export interface RecordInput {
  functionName: string;
  source: string;
  sourceText: string;
  outputHash: string;
  objective: ResidualObjective;
  matchedWords: number;
  totalWords: number;
  verdict: string;
  note?: string;
  at: string;
}

/**
 * Append one measurement, unless this exact source has already produced this
 * exact output.
 *
 * Re-measuring an unchanged source is a no-op the ledger gains nothing from
 * recording. A *different* source that produces an output already seen is the
 * opposite: that is the repeat worth keeping, because it is the one that looks
 * like a new idea from the source side.
 */
export function recordExperiment(input: RecordInput): LedgerEntry | undefined {
  const sourceHash = sha256(input.sourceText);
  if (readLedger(input.functionName).some((entry) =>
    entry.sourceHash === sourceHash && entry.outputHash === input.outputHash)) {
    return undefined;
  }
  return appendExperiment(input, sourceHash);
}

function appendExperiment(input: RecordInput, sourceHash: string): LedgerEntry {
  const entry: LedgerEntry = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    function: input.functionName,
    at: input.at,
    source: projectPath(input.source),
    sourceHash,
    outputHash: input.outputHash,
    key: input.objective.key,
    matchedWords: input.matchedWords,
    totalWords: input.totalWords,
    verdict: input.verdict,
    ...(input.note ? { note: input.note } : {}),
  };
  const path = ledgerPath(input.functionName);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(entry)}\n`);
  return entry;
}

/**
 * A measurement, plus whether it is one.
 *
 * An entry whose compiled output was already in the ledger is a *respelling*:
 * a different source reaching a program that has been measured. That is a real
 * and useful thing to record — it is how a promising-looking idea is shown to
 * be one already tried — but it is not a new measurement, and anything that
 * counts progress has to tell the two apart. Three respellings in a row is a
 * search enlarging its own space, not a search failing to move, and reading
 * them as failure is how a loop gives up while it is working.
 *
 * Derived rather than stored: the grouping is exact, costs a pass, needs no
 * schema change, and applies to every ledger already on disk.
 */
export interface AnnotatedEntry extends LedgerEntry {
  /** The `at` of the first entry that reached this output, when not the first. */
  respellingOf?: string;
}

export function annotateRespellings(entries: LedgerEntry[]): AnnotatedEntry[] {
  const firstReached = new Map<string, string>();
  return entries.map((entry) => {
    const first = firstReached.get(entry.outputHash);
    if (first === undefined) {
      firstReached.set(entry.outputHash, entry.at);
      return { ...entry };
    }
    return { ...entry, respellingOf: first };
  });
}

/** The entries that measured a program for the first time. */
export function measurements(entries: LedgerEntry[]): AnnotatedEntry[] {
  return annotateRespellings(entries).filter((entry) => entry.respellingOf === undefined);
}

export interface PriorMeasurement {
  /** A previous entry whose compiled output matched this one. */
  sameOutput?: LedgerEntry;
  /** A previous entry whose source text matched this one. */
  sameSource?: LedgerEntry;
}

/** Whether this exact experiment has been run before. */
export function priorMeasurement(
  functionName: string,
  sourceText: string,
  outputHash: string,
): PriorMeasurement {
  const sourceHash = sha256(sourceText);
  const entries = readLedger(functionName);
  const result: PriorMeasurement = {};
  for (const entry of entries) {
    if (!result.sameOutput && entry.outputHash === outputHash) result.sameOutput = entry;
    if (!result.sameSource && entry.sourceHash === sourceHash) result.sameSource = entry;
  }
  return result;
}

function best(entries: LedgerEntry[]): LedgerEntry | undefined {
  return [...entries].sort((left, right) => {
    for (let index = 0; index < Math.max(left.key.length, right.key.length); index++) {
      const difference = (left.key[index] ?? 0) - (right.key[index] ?? 0);
      if (difference !== 0) return difference;
    }
    return 0;
  })[0];
}

export function renderLedger(functionName: string, entries: LedgerEntry[]): string {
  if (entries.length === 0) {
    return `experiment ledger: ${functionName}\n\n  no measurements recorded yet`;
  }

  const distinct = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const group = distinct.get(entry.outputHash) ?? [];
    group.push(entry);
    distinct.set(entry.outputHash, group);
  }

  const lines = [
    `experiment ledger: ${functionName}`,
    "",
    `  ${entries.length} measurement(s), ${distinct.size} distinct compiled output(s)`,
  ];

  const winner = best(entries);
  if (winner) {
    lines.push(`  best key so far: [${winner.key.join(", ")}] from ${winner.source} (${winner.matchedWords}/${winner.totalWords})`);
  }

  const repeats = [...distinct.values()].filter((group) => group.length > 1);
  if (repeats.length > 0) {
    lines.push("", "  REPEATED EXPERIMENTS (different spellings, identical compiled output)");
    for (const group of repeats) {
      const sources = [...new Set(group.map((entry) => entry.source))];
      lines.push(`    ${group.length}x key [${group[0]!.key.join(", ")}]: ${sources.join(", ")}`);
    }
  }

  const annotated = annotateRespellings(entries);
  const distinctMeasurements = annotated.filter((entry) => entry.respellingOf === undefined).length;
  lines.push("", `  history (most recent last) — ${distinctMeasurements} measurement(s), ` +
    `${annotated.length - distinctMeasurements} respelling(s) of a program already measured`);
  for (const entry of annotated) {
    const note = entry.note ? ` — ${entry.note}` : "";
    const respelling = entry.respellingOf ? `  RESPELLING of ${entry.respellingOf.slice(0, 19)}` : "";
    lines.push(`    ${entry.at.slice(0, 19)}  [${entry.key.join(",")}]  ${entry.verdict.padEnd(12)} ${entry.source}${note}${respelling}`);
  }
  return lines.join("\n");
}

const isCLI = process.argv[1]?.endsWith("experimentLedger.ts");
if (isCLI) {
  const args = process.argv.slice(2);
  const name = args.find((argument) => !argument.startsWith("--"));
  if (!name) {
    console.error("Usage: npx tsx tools/agent/experimentLedger.ts <function> [--json]");
    process.exit(1);
  }
  const functionName = normalizeFunctionName(name);
  const entries = readLedger(functionName);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ function: functionName, entries }, null, 2));
  } else {
    console.log(renderLedger(functionName, entries));
  }
}
