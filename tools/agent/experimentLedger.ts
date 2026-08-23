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

import { existsSync, readFileSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import { readClosed as readClosedRows, renderClosed } from "./closedDirections.js";
import { objectHandsSymbolToAssembler } from "../lib/functionOracle.js";
import { projectPath, sha256 } from "./provenance.js";
import type { ResidualObjective } from "./pipeline-reversal/objective.js";

/**
 * 2 adds `exact`. Rows written before it carry no verdict the reader can
 * trust — `[0,0,0,0]` meant both "byte-identical" and "the reversal saw no
 * residual but the bytes still differ", and on a stub it meant "this is the
 * original assembly". `best()` treats a v1 zero row as unproven rather than as
 * a match, so an old ledger degrades to weaker evidence instead of to a lie.
 */
export const LEDGER_SCHEMA_VERSION = 2;

export interface LedgerEntry {
  schemaVersion: number;
  function: string;
  /** ISO timestamp; the ledger is append-only and ordered by it. */
  at: string;
  /** Project-relative source that was scored. */
  source: string;
  /** SHA-256 of the source text. */
  sourceHash: string;
  /**
   * Project-relative path of the preserved source text, content-addressed by
   * `sourceHash`.
   *
   * A ledger that stores only a hash can name its best program and not produce
   * it. That is not hypothetical: one function's best row named
   * `build/scratch/f17f30/rt54/s2_y_xeq.c`, a directory the agent invented,
   * untracked and one `make clean` from gone, and the park preserved a
   * different program. Every measured source is written here, so "the best
   * program" is always a file.
   *
   * Absent on rows written under schema 1.
   */
  sourcePath?: string;
  /** SHA-256 of the relocated words. Equal hashes are one experiment. */
  outputHash: string;
  /** The staged residual key: [control-flow, population, schedule, allocation]. */
  key: number[];
  /**
   * Did the candidate object reproduce the target bytes?
   *
   * Recorded separately from the key because the two really can disagree. A
   * variant can reach `[0,0,0,0]` — the reversal finds no population,
   * schedule or allocation residual — while one word still differs, because
   * the objective is derived from waypoint comparisons and a commutative
   * operand order is invisible at every waypoint. Without this field the
   * ledger's best row is a program that does not match, and everything that
   * ranks against it is ranking against a false ceiling.
   *
   * Absent on rows written under schema 1.
   */
  exact?: boolean;
  matchedWords: number;
  totalWords: number;
  verdict: string;
  /**
   * Residual signatures of this measurement's open blocks.
   *
   * A signature is the shape of a block's residual independent of where it
   * sits, so two blocks with the same one are the same problem written twice.
   * The objective already computes it and already groups by it — within one
   * function. Persisting it is what lets the grouping cross function
   * boundaries, which is where the payoff is: `ovl_10_func_800BADA4` and
   * `ovl_10_func_800BB264` carried the byte-identical signature
   * `addiu <reg>,<reg>,-17844@4|addiu <reg>,<reg>,1@4`, were worked thirty
   * minutes apart by the same loop for eighty-six minutes between them, and
   * were closed by the same one-line edit.
   *
   * Absent on rows written under schema 1.
   */
  signatures?: string[];
  /** One line from the author on what was being tested. Optional but wanted. */
  note?: string;
}

function ledgerPath(functionName: string): string {
  return join(ROOT, "build/experimentLedger", `${functionName}.jsonl`);
}

/** Where a measured source is preserved, keyed by its own hash. */
export function variantPath(functionName: string, sourceHash: string): string {
  return join(ROOT, "build/experimentLedger/sources", functionName, `${sourceHash.slice(0, 16)}.c`);
}

/**
 * Preserve a measured source and return its project-relative path.
 *
 * Content-addressed, so re-measuring the same text is a no-op and two
 * different labels for one program collapse to one file.
 */
export function preserveVariant(functionName: string, sourceHash: string, sourceText: string): string {
  const path = variantPath(functionName, sourceHash);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, sourceText);
  }
  return projectPath(path);
}

/** The preserved text of a ledger row, when it has one. */
export function variantText(entry: LedgerEntry): string | undefined {
  const path = entry.sourcePath ? join(ROOT, entry.sourcePath) : variantPath(entry.function, entry.sourceHash);
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
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
  /**
   * The object that was scored, when the caller has it.
   *
   * Supplied so the ledger can refuse to record a measurement of an
   * `INCLUDE_ASM` stub. The object answers that on its own — it defines
   * `<name>.NON_MATCHING` — which is why the ledger asks it rather than parsing
   * the source: this module is loaded by the autonomous loop's extension, which
   * deliberately keeps the C grammar out of process.
   */
  objectPath?: string;
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
  /* A stub is the assembly measured against itself. Recording it writes a
     perfect score no source can ever beat, and `best()` then reports the
     original disassembly as the best program — after which every later
     measurement is "no improvement" and the stall counter fires forever. This
     is the last gate before that row reaches the file. */
  if (input.objectPath && objectHandsSymbolToAssembler(input.objectPath, input.functionName)) {
    throw new StubMeasurementError(input.functionName, input.source);
  }
  const sourceHash = sha256(input.sourceText);
  /* Preserved even when the row is a duplicate: the text is what makes the
     ledger's verdict reproducible, and a re-measurement of a source whose file
     was cleaned away is exactly when it is missing. */
  const preserved = preserveVariant(input.functionName, sourceHash, input.sourceText);
  if (readLedger(input.functionName).some((entry) =>
    entry.sourceHash === sourceHash && entry.outputHash === input.outputHash)) {
    return undefined;
  }
  return appendExperiment(input, sourceHash, preserved);
}

export class StubMeasurementError extends Error {
  constructor(readonly functionName: string, readonly source: string) {
    super(
      `${functionName}: refusing to record a measurement of ${projectPath(source)} — it hands ` +
        "the function to the assembler, so the words scored are the original's own.",
    );
    this.name = "StubMeasurementError";
  }
}

function appendExperiment(input: RecordInput, sourceHash: string, sourcePath: string): LedgerEntry {
  const entry: LedgerEntry = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    function: input.functionName,
    at: input.at,
    source: projectPath(input.source),
    sourceHash,
    sourcePath,
    outputHash: input.outputHash,
    key: input.objective.key,
    exact: input.objective.exact === true,
    /* Only the blocks that are actually open, and only those the residual can
       read: a blind block's shape is an artifact of an unresolved relocation,
       so indexing it would advertise a shared problem that is not shared. */
    signatures: [...new Set((input.objective.blocks ?? [])
      .filter((block) => block.total > 0 && !block.blind && block.signature)
      .map((block) => block.signature))],
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

/**
 * The best row, with `exact` outranking every key.
 *
 * A row is "unproven zero" when its key is all zeros and it is not exact: the
 * reversal found no residual and the bytes still differ. Ranked by key alone
 * such a row is unbeatable, so every later measurement reads as no
 * improvement, the stall counter runs away, and the search is told to stop
 * re-spelling a function it has not solved. Rank those rows by their word
 * count instead, which is the only signal left in them.
 */
export function isUnprovenZero(entry: LedgerEntry): boolean {
  return entry.exact !== true && entry.key.every((term) => term === 0);
}

export function best(entries: LedgerEntry[]): LedgerEntry | undefined {
  return [...entries].sort((left, right) => {
    if ((left.exact === true) !== (right.exact === true)) return left.exact === true ? -1 : 1;
    const leftZero = isUnprovenZero(left);
    const rightZero = isUnprovenZero(right);
    if (leftZero !== rightZero) return leftZero ? 1 : -1;
    if (leftZero && rightZero) {
      return (right.matchedWords - right.totalWords) - (left.matchedWords - left.totalWords);
    }
    for (let index = 0; index < Math.max(left.key.length, right.key.length); index++) {
      const difference = (left.key[index] ?? 0) - (right.key[index] ?? 0);
      if (difference !== 0) return difference;
    }
    return 0;
  })[0];
}

/* ---- the valley ---------------------------------------------------------
 *
 * A stall counter says the search has stopped moving. It does not say what
 * *shape* it has stopped in, and the shape decides what to do next.
 *
 * The expensive shape is a narrow valley: the best program sits one or two
 * terms from exact, and every other program the search has measured is far
 * worse. That is not a search that needs more attempts — it is a search whose
 * remaining distance is several coordinates wide. Every single-coordinate
 * respelling around the best moves at least one of the others the wrong way, so
 * each one scores worse and reads as a refutation of the direction it tried.
 * The function this was calibrated against needed index arity, no source
 * walker, no source index, a doubled giv spelling and a different loop tail
 * *simultaneously*; no sweep over one axis at a time could have crossed it, and
 * six sessions of sweeping did not.
 *
 * The escape is not another attempt from the candidate side. It is to derive
 * what the original must have done and write that — which is what the
 * requirement-side tools are for.
 */

/** How close to exact the best must be for the valley reading to apply. */
const VALLEY_MAX_TOTAL = 4;
/** How much worse every other measured program must be, as a multiple. */
const VALLEY_ISOLATION = 3;
/** Distinct programs needed before isolation means anything. */
const VALLEY_MIN_DISTINCT = 4;
/** Distinct programs with no improvement that make a *dense* floor a valley too. */
const VALLEY_UNIMPROVED = 8;

/**
 * Which evidence says the best is in a valley.
 *
 * Two, because the shape shows up two ways and only one of them was obvious.
 * `isolated` is the clean case: the best stands alone and every other program
 * measured is far worse. `unimproved` is the case that actually cost this
 * project six sessions and that isolation misses — a *crowded* floor, dozens of
 * programs clustered a term or two from exact, none of them better than the
 * best. The crowd is the tell rather than the counter-evidence: every one of
 * those neighbours is a single-coordinate move that traded one term for
 * another, which is what a multi-coordinate distance looks like from inside.
 */
export type ValleyEvidence = "isolated" | "unimproved";

export interface Valley {
  evidence: ValleyEvidence[];
  bestKey: number[];
  bestTotal: number;
  /** The nearest other distinct key's total; `undefined` when there is none. */
  nearestOther?: number;
  /** Distinct programs measured since the best key was last improved on. */
  unimproved: number;
  distinctPrograms: number;
  distinctKeys: number;
}

const keyTotal = (key: number[]): number => key.reduce((total, term) => total + term, 0);

/**
 * The valley reading, or nothing. Derived; no new state.
 *
 * Isolation is measured over distinct *keys*, not over measurements: twenty
 * spellings that all land on one key are one point in the space, and counting
 * them as twenty would make any well-explored ledger look isolated.
 */
export function valley(entries: LedgerEntry[]): Valley | undefined {
  const winner = best(entries);
  if (!winner || winner.exact === true) return undefined;
  const bestTotal = keyTotal(winner.key);
  if (bestTotal === 0 || bestTotal > VALLEY_MAX_TOTAL) return undefined;

  const distinct = measurements(entries);
  if (distinct.length < VALLEY_MIN_DISTINCT) return undefined;

  const bestKey = JSON.stringify(winner.key);
  const others = [...new Set(distinct.map((entry) => JSON.stringify(entry.key)))]
    .filter((key) => key !== bestKey)
    .map((key) => keyTotal(JSON.parse(key) as number[]));
  if (others.length === 0) return undefined;
  const nearestOther = Math.min(...others);

  /* How long the floor has held. Respellings are already excluded by
     `measurements`, so each of these was a genuinely different program.
     Unproven zeros are excluded too, and for the same reason `best` excludes
     them: a row whose key is all zeros while the bytes still differ has not
     improved on anything — the reversal simply could not see the difference.
     Counted as an improvement it resets this to zero on the measurement that
     is least informative, which is how a six-session floor read as a search
     that had just moved. */
  let running: number[] | undefined;
  let lastImprovement = 0;
  distinct.forEach((entry, index) => {
    if (isUnprovenZero(entry)) return;
    if (running === undefined || keyIsBetter(entry.key, running)) {
      running = entry.key;
      lastImprovement = index;
    }
  });
  const unimproved = distinct.length - 1 - lastImprovement;

  const evidence: ValleyEvidence[] = [];
  if (nearestOther >= bestTotal * VALLEY_ISOLATION) evidence.push("isolated");
  if (unimproved >= VALLEY_UNIMPROVED) evidence.push("unimproved");
  if (evidence.length === 0) return undefined;

  return {
    evidence,
    bestKey: winner.key,
    bestTotal,
    nearestOther,
    unimproved,
    distinctPrograms: distinct.length,
    distinctKeys: others.length + 1,
  };
}

/** Lexicographic order over the staged residual: the worst term decides. */
function keyIsBetter(candidate: number[], incumbent: number[]): boolean {
  for (let index = 0; index < Math.max(candidate.length, incumbent.length); index++) {
    const difference = (candidate[index] ?? 0) - (incumbent[index] ?? 0);
    if (difference !== 0) return difference < 0;
  }
  return false;
}

/** The one advisory a valley earns, as lines. */
export function renderValley(reading: Valley): string[] {
  const head = reading.evidence.includes("isolated")
    ? `the best key [${reading.bestKey.join(", ")}] is ${reading.bestTotal} term(s) from exact, and the ` +
      `nearest of the other ${reading.distinctKeys - 1} distinct key(s) measured is ${reading.nearestOther} — ` +
      `${reading.distinctPrograms} distinct programs, and nothing landed in between.`
    : `the best key [${reading.bestKey.join(", ")}] is ${reading.bestTotal} term(s) from exact and ` +
      `${reading.unimproved} distinct programs since have not beaten it, across ` +
      `${reading.distinctKeys} distinct keys clustered around it.`;
  return [
    `VALLEY: ${head}`,
    "That is a floor, not a gradient. A best this close that a whole sweep cannot improve on means the",
    "remaining distance is several coordinates wide: every single-coordinate respelling moves one of the",
    "other coordinates the wrong way, scores worse, and reads as a refutation of the direction it tried.",
    "Sweeping one axis at a time cannot cross it however long it runs.",
    "Take the next experiment from the REQUIREMENT side instead of from another spelling:",
    "  psx_target_loop_emission  — what the original's loop pass must have emitted, and by which route",
    "  psx_triage                — its cluster-donor finding names a sibling that already reaches a",
    "                              mechanism this program does not, with the trace that measured it",
    "  psx_analyze_target_schedule / psx_allocator_counterfactual — the same for the later passes",
    "Write the program the requirement describes, in one edit, and measure that.",
  ];
}

export function renderLedger(functionName: string, entries: LedgerEntry[]): string {
  /* The closed directions come first because they are the expensive knowledge:
     a measurement costs seconds to repeat, an UNSAT costs minutes. */
  const closed = renderClosed(functionName);
  const head = closed ? `${closed}\n\n` : "";
  if (entries.length === 0) {
    return `${head}experiment ledger: ${functionName}\n\n  no measurements recorded yet`;
  }

  const distinct = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const group = distinct.get(entry.outputHash) ?? [];
    group.push(entry);
    distinct.set(entry.outputHash, group);
  }

  const lines = [
    ...(closed ? [closed, ""] : []),
    `experiment ledger: ${functionName}`,
    "",
    `  ${entries.length} measurement(s), ${distinct.size} distinct compiled output(s)`,
  ];

  const winner = best(entries);
  if (winner) {
    const mark = winner.exact === true ? " EXACT" : isUnprovenZero(winner) ? "  (zero residual, bytes still differ)" : "";
    lines.push(`  best key so far: [${winner.key.join(", ")}] from ${winner.source} (${winner.matchedWords}/${winner.totalWords})${mark}`);
  }

  const reading = valley(entries);
  if (reading) lines.push("", ...renderValley(reading).map((line) => `  ${line}`));

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
    console.log(JSON.stringify({ function: functionName, entries, closed: readClosedRows(functionName) }, null, 2));
  } else {
    console.log(renderLedger(functionName, entries));
  }
}
