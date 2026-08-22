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
import { dirname, join } from "node:path";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";

export const CLOSED_SCHEMA_VERSION = 1;

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
}

function closedPath(functionName: string): string {
  return join(ROOT, "build/experimentLedger/closed", `${functionName}.jsonl`);
}

export function readClosed(functionName: string): ClosedDirection[] {
  const path = closedPath(functionName);
  if (!existsSync(path)) return [];
  const rows: ClosedDirection[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line) as ClosedDirection);
    } catch {
      /* A torn append is one lost row, not a broken record. */
    }
  }
  return rows;
}

export interface RecordClosedInput {
  functionName: string;
  tool: string;
  question: string;
  verdict: ClosedVerdict;
  result: string;
  evidence?: string;
  at?: string;
}

/**
 * Append one answered question, unless the same tool has already answered the
 * same question with the same verdict.
 *
 * De-duplicated on the claim rather than on the timestamp: two sessions
 * discovering the same `UNSAT` is one fact, and recording it twice would make
 * the record look like corroboration when it is repetition.
 */
export function recordClosed(input: RecordClosedInput): ClosedDirection | undefined {
  const row: ClosedDirection = {
    schemaVersion: CLOSED_SCHEMA_VERSION,
    function: input.functionName,
    at: input.at ?? new Date().toISOString(),
    tool: input.tool,
    question: input.question,
    verdict: input.verdict,
    result: input.result,
    ...(input.evidence ? { evidence: input.evidence } : {}),
  };
  const already = readClosed(input.functionName).some(
    (entry) => entry.tool === row.tool && entry.question === row.question && entry.verdict === row.verdict,
  );
  if (already) return undefined;
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
      `  ${row.verdict.toUpperCase().padEnd(12)} ${row.tool} — ${row.question}`,
      `               → ${row.result}${row.evidence ? `  (${row.evidence})` : ""}  [${row.at.slice(0, 10)}]`,
    );
  }
  return lines.join("\n");
}

function usage(message?: string): never {
  if (message) console.error(`closedDirections: ${message}`);
  console.error(
    "Usage: npx tsx tools/agent/closedDirections.ts <function> [--json]\n" +
      "       npx tsx tools/agent/closedDirections.ts <function> --tool <name> --question <text> " +
      "--verdict closed|open|inconclusive --result <text> [--evidence <text>]",
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
    const row = recordClosed({
      functionName,
      tool,
      question,
      verdict,
      result,
      ...(evidence ? { evidence } : {}),
    });
    console.log(row ? "recorded" : "already recorded — this exact claim is in the record");
    console.log("");
  }

  const rows = readClosed(functionName);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ function: functionName, closed: rows }, null, 2));
  } else {
    console.log(renderClosed(functionName, rows) || `no closed directions recorded for ${functionName}`);
  }
}
