#!/usr/bin/env npx tsx
/**
 * closedDirections.ts — what the heavy tools already answered, and what it closed.
 *
 * The matching doctrine tells a stalled session to bring heavier evidence:
 * solve for the allocator state, enumerate the source space, read the deciding
 * pass. It also tells it to "record what each of these closed". There was no
 * mechanism, so nothing was recorded, and the next session — a fresh context, a
 * different model, sometimes a different day — re-ran the same solver to
 * rediscover the same `UNSAT_WITHIN_BOUNDS`.
 *
 * That is the expensive kind of repetition. A solver run is minutes; the
 * measurement it displaces is seconds. And an `UNSAT` is not a failure to be
 * repeated until it succeeds: it is a proof that a whole region of the search
 * space is empty, which is exactly the sort of result a search should never
 * have to buy twice.
 *
 * One row per answered question. The verdict is the finding; the evidence is
 * how a later reader checks it without re-running anything.
 *
 * Usage:
 *   npx tsx tools/agent/closedDirections.ts <function>
 *   npx tsx tools/agent/closedDirections.ts <function> --tool psx_solve_local_allocation \
 *       --question "can any web assignment produce s0 for the address?" \
 *       --verdict UNSAT --evidence "bounded at 4 webs, 12s, no model"
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { sha256 } from "./provenance.js";
import { ROOT, normalizeFunctionName, resolveSource } from "./decompToolchain.js";

/**
 * 2 adds `conditionalOn`.
 *
 * Every impossibility result in this record is conditioned on something, and
 * the ones that cost most are the ones whose condition was never written down.
 * Two rows on one function read as unconditional CLOSED facts — "no spelling can
 * make this decline at pass 1", "the search space is exhausted" — and later
 * sessions correctly refused to re-run them. Both were true *under a premise*:
 * the first under an unmeasured threshold, the second under the assumption that
 * the value had to originate at the outer loop. The proofs were sound and the
 * premises were wrong, and nothing in the row said there was a premise to
 * attack. Rows written under schema 1 stay valid and simply carry no premise.
 */
export const CLOSED_SCHEMA_VERSION = 3;

/**
 * What a heavy tool's answer did to the search space.
 *
 * `closed` and `open` are the two that carry information. `inconclusive` is a
 * third on purpose: a run that hit its bound without an answer has told the
 * next session what the bound costs, which is worth recording and is not the
 * same claim as "this direction is still open".
 */
export type ClosedVerdict = "closed" | "open" | "inconclusive";

export interface ClosedDirection {
  schemaVersion: number;
  function: string;
  at: string;
  /** The tool that answered it, by its Pi name where it has one. */
  tool: string;
  /** The question it was asked, in one line. */
  question: string;
  verdict: ClosedVerdict;
  /** The tool's own words for its result — UNSAT, "no candidate", a count. */
  result: string;
  /** How a reader checks this without re-running: bounds, counts, run time. */
  evidence?: string;
  /**
   * The premise the verdict is conditional on.
   *
   * Not a hedge. A later session's job is to attack the *premise*, not to
   * re-run the proof, and it can only do that if the premise is on the row.
   * Absent on schema-1 rows, and on rows whose author did not record one —
   * which is itself worth seeing.
   */
  conditionalOn?: string;
  premiseClass?: "source-side";
  sourceHash?: string;
  /** A checked exhaustive search retires only its source/context/representation scope. */
  searchedPremise?: { report: string; reportHash: string; sourceHash: string; contextHash: string;
    windows: unknown[]; sites: unknown[]; representations: unknown[] };
}

export function sourceSidePremise(row: Pick<ClosedDirection, "tool" | "result">): boolean {
  return row.tool === "psx_loop_trace" || /\b(insn_count|threshold\w*|moved (?:movables|groups)|savings|lifetime)\b/i.test(row.result);
}

function closedPath(functionName: string): string {
  return join(ROOT, "build/experimentLedger/closed", `${functionName}.jsonl`);
}

/** Identity of a claim: same tool, same question, same verdict.
 *  JSON rather than a joined string, so no separator can appear in a question
 *  and make two different claims collide. */
const claimKey = (row: ClosedDirection): string => JSON.stringify([row.tool, row.question, row.verdict]);

/**
 * Fold repeats of one claim into the most informative row.
 *
 * The file is append-only, and the one reason to append a claim already in it
 * is to *add* to it — a premise the first author did not record. Folding here
 * rather than rewriting the file keeps the record immutable and keeps the
 * reader from seeing one fact twice; the later row wins field by field, so an
 * amendment adds without erasing what the first row said.
 */
function fold(rows: ClosedDirection[]): ClosedDirection[] {
  const byClaim = new Map<string, ClosedDirection>();
  for (const row of rows) {
    const existing = byClaim.get(claimKey(row));
    byClaim.set(claimKey(row), existing === undefined ? row : {
      ...existing,
      ...(row.result ? { result: row.result } : {}),
      ...(row.evidence ? { evidence: row.evidence } : {}),
      ...(row.conditionalOn ? { conditionalOn: row.conditionalOn } : {}),
      ...(row.sourceHash ? { sourceHash: row.sourceHash } : {}),
      ...(row.premiseClass ? { premiseClass: row.premiseClass } : {}),
      ...(row.searchedPremise ? { searchedPremise: row.searchedPremise } : {}),
    });
  }
  return [...byClaim.values()];
}

export function readClosed(functionName: string): ClosedDirection[] {
  const path = closedPath(functionName);
  if (!existsSync(path)) return [];
  const rows: ClosedDirection[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as ClosedDirection;
      if (sourceSidePremise(row)) row.premiseClass = "source-side";
      rows.push(row);
    } catch {
      /* A torn append is one lost row, not a broken record. */
    }
  }
  return fold(rows);
}

export interface RecordClosedInput {
  functionName: string;
  tool: string;
  question: string;
  verdict: ClosedVerdict;
  result: string;
  evidence?: string;
  conditionalOn?: string;
  at?: string;
  source?: string | undefined;
  sourceHash?: string;
  sweepReport?: string | undefined;
}

/** Check the scope and completeness, never turn sampling or errors into a proof. */
export function searchedPremise(report: any, sourceHash: string | undefined): boolean {
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  try {
    if (!(report?.schemaVersion === 1 && typeof sourceHash === "string" && report.sourceHash === sourceHash
      && report.inputStable === true && report.preparationErrors?.length === 0
      && typeof report.contextHash === "string" && report.contextHash.length > 0 && report.closure?.contextHash === report.contextHash
      && report.closure.sourceHash === sourceHash && report.closure.result === "exhausted-no-goal-meeting-variant"
      && same(report.closure.windows, report.windows) && same(report.closure.sites, report.sites)
      && Array.isArray(report.representations) && report.representations.length > 0 && same(report.closure.representations, report.representations)
      && report.coverage?.exhaustive === true && String(report.coverage.evaluated) === report.coverage.total
      && Array.isArray(report.variants) && report.variants.length === report.coverage.evaluated
      && report.goals?.length > 0 && report.sites?.length > 0 && report.windows?.length > 0 && report.goalMeeting === 0)) return false;
    const ids = new Set<string>(); let evaluated = 0;
    for (const family of report.representations) {
      if (typeof family.id !== "string" || ids.has(family.id) || typeof family.sourceHash !== "string"
        || !Array.isArray(family.sites) || family.sites.length === 0 || !family.windows?.length) return false;
      ids.add(family.id);
      const rows = report.variants.filter((row: any) => row.representation === family.id);
      const total = 1n << BigInt(family.sites.length);
      if (family.coverage?.exhaustive !== true || BigInt(rows.length) !== total || family.coverage.evaluated !== rows.length
        || family.coverage.total !== total.toString() || new Set(rows.map((row: any) => BigInt(row.mask).toString())).size !== rows.length
        || rows.some((row: any) => typeof row.mask !== "string" || BigInt(row.mask) < 0n || BigInt(row.mask) >= total)) return false;
      evaluated += rows.length;
    }
    const raw = report.representations.find((family: any) => family.id === "raw");
    return raw?.sourceHash === sourceHash && same(raw.sites, report.sites) && same(raw.windows, report.windows)
      && evaluated === report.variants.length && report.variants.every((row: any) => !row.error && row.objective
      && typeof row.premiseMet === "boolean" && row.decisions?.length === report.goals.length
      && row.decisions.every((decision: any) => ["met", "not-met"].includes(decision.outcome))
      && !(row.premiseMet && row.decisions.every((decision: any) => decision.outcome === "met")));
  } catch { return false; }
}

function retiredPremise(row: ClosedDirection): boolean {
  const scope = row.searchedPremise;
  return scope !== undefined && scope.sourceHash === row.sourceHash && typeof scope.contextHash === "string"
    && scope.contextHash.length > 0 && scope.representations?.length > 0 && scope.windows?.length > 0 && scope.sites?.length > 0;
}

/**
 * Does this question claim a region of the search space is empty?
 *
 * Those are the rows whose premise matters, because they are the ones later
 * sessions treat as final. A row that records what a tool measured — a count, a
 * layout, an assignment — is a fact; a row that records that something *cannot*
 * happen is a proof, and a proof runs on premises.
 *
 * Deliberately a keyword test rather than anything cleverer: it drives a
 * reminder, never a refusal, so a false positive costs one line of output and a
 * false negative costs nothing that was not already the status quo.
 */
export function claimsEmptiness(question: string): boolean {
  return /\b(can|cannot|can't|could|impossible|unreachable|reachable|exhaust\w*|no (?:source|spelling|candidate|way|variant)|any \w+|every \w+|never)\b/i
    .test(question);
}

/** The reminder a `closed` row with no premise earns. */
export const PREMISE_REMINDER = [
  "note: this verdict is CLOSED and its question claims a region of the search space is empty, but no",
  "  premise was recorded. An impossibility is conditioned on its inputs — the state you measured it",
  "  under, the origin you assumed, the threshold you had at the time — and the next session will read",
  "  the row as unconditional and refuse to re-open it. Re-record it with --conditional-on <premise>.",
].join("\n");

/**
 * Append one answered question, unless the same tool has already answered the
 * same question with the same verdict.
 *
 * De-duplicated on the claim rather than on the timestamp: two sessions
 * discovering the same `UNSAT` is one fact, and recording it twice would make
 * the record look like corroboration when it is repetition.
 */
export function recordClosed(input: RecordClosedInput): ClosedDirection | undefined {
  const sourceSide = sourceSidePremise(input);
  let sourceHash = input.sourceHash;
  if (sourceSide && !sourceHash) {
    try { sourceHash = sha256(readFileSync(resolveSource(input.functionName, input.source), "utf8")); }
    catch { /* Unknown is honest for fixtures and unprovisioned functions. */ }
  }
  let searched: ClosedDirection["searchedPremise"];
  if (input.sweepReport) {
    try {
      const text = readFileSync(resolve(ROOT, input.sweepReport), "utf8");
      const report = JSON.parse(text);
      if (report.functionName === input.functionName && searchedPremise(report, sourceHash)) {
        searched = { report: input.sweepReport, reportHash: sha256(text), sourceHash: sourceHash!, contextHash: report.contextHash,
          windows: report.windows, sites: report.sites, representations: report.representations };
      }
    } catch { /* The label is not a veto: record the claim, leave its premise open. */ }
  }
  const row: ClosedDirection = {
    schemaVersion: CLOSED_SCHEMA_VERSION,
    function: input.functionName,
    at: input.at ?? new Date().toISOString(),
    tool: input.tool,
    question: input.question,
    verdict: input.verdict,
    result: input.result,
    ...(input.evidence ? { evidence: input.evidence } : {}),
    ...(input.conditionalOn ? { conditionalOn: input.conditionalOn } : {}),
    ...(sourceSide ? { premiseClass: "source-side" as const } : {}),
    ...(sourceHash ? { sourceHash } : {}),
    ...(searched ? { searchedPremise: searched } : {}),
  };
  /* Repetition is not corroboration, so an identical claim is dropped — but a
     claim that adds the premise the record was missing is not identical. That
     amendment is the whole point of the field, and refusing it would leave the
     one row a later session most needs permanently unconditional. */
  const existing = readClosed(input.functionName).find((entry) => claimKey(entry) === claimKey(row));
  const amends = existing !== undefined && (
    row.conditionalOn !== undefined && existing.conditionalOn !== row.conditionalOn
    || row.sourceHash !== undefined && existing.sourceHash !== row.sourceHash
    || row.searchedPremise !== undefined && existing.searchedPremise?.reportHash !== row.searchedPremise.reportHash);
  if (existing && !amends) return undefined;
  const path = closedPath(input.functionName);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(row)}\n`);
  return row;
}

/** The record as a block for a turn message; empty string when there is none. */
export function renderClosed(functionName: string, rows = readClosed(functionName)): string {
  if (rows.length === 0) return "";
  const lines = [
    `CLOSED DIRECTIONS for ${functionName} — already answered, do not re-run:`,
  ];
  for (const row of rows) {
    lines.push(
      `  ${(row.verdict === "closed" && sourceSidePremise(row) && !retiredPremise(row) ? "OPEN PREMISE" : row.verdict.toUpperCase()).padEnd(12)} ${row.tool} — ${row.question}`,
      `               → ${row.result}${row.evidence ? `  (${row.evidence})` : ""}  [${row.at.slice(0, 10)}]`,
    );
    /* Under the verdict, not beside it: what the row is conditional on is the
       one part a later session is supposed to act on. Attack the premise, not
       the proof. */
    if (row.verdict === "closed" && sourceSidePremise(row) && !retiredPremise(row)) {
      lines.push(`               these counts belong to source ${row.sourceHash ?? "UNKNOWN (not recorded)"}'s pass-1 body. A source`);
      lines.push("               whose pass-1 body differs can still reach the same final loop. Attack the");
      lines.push("               counts, not the inequality.");
    }
    if (row.searchedPremise) lines.push(`               conditional on searched source ${row.searchedPremise.sourceHash}, context ${row.searchedPremise.contextHash ?? "UNKNOWN"}, window and site set, and representations in ${row.searchedPremise.report} (${row.searchedPremise.reportHash})`);
    if (row.conditionalOn) lines.push(`               conditional on: ${row.conditionalOn}`);
    else if (row.verdict === "closed" && claimsEmptiness(row.question)) {
      lines.push("               conditional on: NOT RECORDED — an impossibility is conditioned on its");
      lines.push("               inputs, and this row does not say which. Do not read it as unconditional.");
    }
  }
  return lines.join("\n");
}

function usage(message?: string): never {
  if (message) console.error(`closedDirections: ${message}`);
  console.error(
    "Usage: npx tsx tools/agent/closedDirections.ts <function> [--json]\n" +
      "       npx tsx tools/agent/closedDirections.ts <function> --tool <name> --question <text> " +
      "--verdict closed|open|inconclusive --result <text> [--evidence <text>] [--conditional-on <premise>] [--source <path>] [--sweep-report <path>]",
  );
  process.exit(1);
}

const isCLI = process.argv[1]?.endsWith("closedDirections.ts");
if (isCLI) {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const positional = args.filter((argument, index) =>
    !argument.startsWith("--") && !args[index - 1]?.startsWith("--"));
  if (positional.length !== 1) usage("name exactly one function");
  const functionName = normalizeFunctionName(positional[0]!);

  const tool = flag("tool");
  if (tool) {
    const question = flag("question");
    const verdict = flag("verdict") as ClosedVerdict | undefined;
    const result = flag("result");
    if (!question) usage("--tool needs --question");
    if (!verdict || !["closed", "open", "inconclusive"].includes(verdict)) {
      usage("--verdict must be closed, open or inconclusive");
    }
    if (!result) usage("--tool needs --result");
    const evidence = flag("evidence");
    const conditionalOn = flag("conditional-on");
    const row = recordClosed({
      functionName,
      tool,
      question,
      verdict,
      result,
      ...(evidence ? { evidence } : {}),
      ...(conditionalOn ? { conditionalOn } : {}),
      ...(flag("source") ? { source: flag("source") } : {}),
      ...(flag("sweep-report") ? { sweepReport: flag("sweep-report") } : {}),
    });
    console.log(row ? "recorded" : "already recorded — this exact claim is in the record");
    /* A nudge, never a gate: refusing the row would cost the record the fact,
       which is worse than recording it with its premise missing and saying so. */
    if (!conditionalOn && verdict === "closed" && claimsEmptiness(question)) console.log(PREMISE_REMINDER);
    console.log("");
  }

  const rows = readClosed(functionName);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ function: functionName, closed: rows }, null, 2));
  } else {
    console.log(renderClosed(functionName, rows) || `no closed directions recorded for ${functionName}`);
  }
}
