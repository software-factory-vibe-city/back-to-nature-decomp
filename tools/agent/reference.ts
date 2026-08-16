#!/usr/bin/env npx tsx
/**
 * reference.ts — serve one mechanism sheet, chosen by the pass that owns the
 * residual.
 *
 * The C style guide was 67 KB and mandatory reading, and the skill was another
 * 30 KB on top of it. An agent therefore spent a large share of its context on
 * doctrine for passes that did not own its residual, before it had measured
 * anything — and the material that did apply was diluted by the material that
 * did not.
 *
 * The sheets are the same doctrine, split by owning pass, so a caller loads the
 * one the evidence points at. `psx_reverse_pipeline` names the pass; this
 * serves the sheet. Listing without a topic is cheap and prints only titles.
 *
 *   npx tsx tools/agent/reference.ts            # list the sheets
 *   npx tsx tools/agent/reference.ts schedule   # load one
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./decompToolchain.js";

const DIRECTORY = join(ROOT, "prompts/reference");

/** Which sheet answers which residual owner, in the reversal's own vocabulary. */
export const OWNER_TO_SHEET: Record<string, string> = {
  expand: "population",
  cse: "population",
  gcse: "population",
  loop: "population",
  combine: "population",
  sched: "schedule",
  sched1: "schedule",
  sched2: "schedule",
  lreg: "allocation",
  greg: "allocation",
  "local-alloc": "allocation",
  "global-alloc": "allocation",
};

export function availableSheets(): string[] {
  if (!existsSync(DIRECTORY)) return [];
  return readdirSync(DIRECTORY).filter((name) => name.endsWith(".md")).map((name) => name.replace(/\.md$/, "")).sort();
}

function titleOf(sheet: string): string {
  const first = readFileSync(join(DIRECTORY, `${sheet}.md`), "utf8").split("\n")[0] ?? "";
  return first.replace(/^#\s*/, "");
}

export function resolveSheet(topic: string): string | undefined {
  const key = topic.toLowerCase().replace(/\.md$/, "");
  const direct = availableSheets().find((sheet) => sheet === key);
  if (direct) return direct;
  const mapped = OWNER_TO_SHEET[key];
  return mapped && availableSheets().includes(mapped) ? mapped : undefined;
}

export function renderIndex(): string {
  const sheets = availableSheets();
  if (sheets.length === 0) return "no reference sheets found under prompts/reference/";
  return [
    "reference sheets — load the one the pipeline reversal points at, not all of them",
    "",
    ...sheets.map((sheet) => `  ${sheet.padEnd(14)} ${titleOf(sheet)}`),
    "",
    "  a residual owner also resolves: " +
      [...new Set(Object.keys(OWNER_TO_SHEET))].join(", "),
  ].join("\n");
}

const isCLI = process.argv[1]?.endsWith("reference.ts");
if (isCLI) {
  const topic = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  if (!topic) {
    console.log(renderIndex());
  } else {
    const sheet = resolveSheet(topic);
    if (!sheet) {
      console.error(`reference: no sheet for "${topic}"\n`);
      console.error(renderIndex());
      process.exitCode = 1;
    } else {
      process.stdout.write(readFileSync(join(DIRECTORY, `${sheet}.md`), "utf8"));
    }
  }
}
