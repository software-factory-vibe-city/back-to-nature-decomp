#!/usr/bin/env npx tsx
/**
 * migrateLedger.ts — bring the experiment ledgers up to schema 2, on evidence.
 *
 * Schema 1 recorded a residual key and no verdict, so three different states
 * wrote the same row:
 *
 *   1. a program that reproduced the target bytes — a real match;
 *   2. a program whose reversal found no residual while a word still differed;
 *   3. an `INCLUDE_ASM` stub, whose object *is* the extracted assembly.
 *
 * The third is the one that does damage. `best()` reads it as an unbeatable
 * ceiling, so every later measurement is "no improvement", and `stallLine`
 * tells the next session it has been stuck since its fourth measurement — on a
 * function nobody has yet written a line of C for.
 *
 * The three are separated here by the only evidence the ledger carries: the
 * source text's hash.
 *
 *   - text == the function's current source, and that source is compiled C
 *     → the row measured a program that reproduced the bytes. `exact: true`.
 *   - text == the function's current source, and that source is a stub
 *     → the row measured the assembly against itself. Retired.
 *   - text is neither, and the function is a stub today
 *     → no source has ever matched this function, because the loop finalizes
 *       on a match. A full-word zero row here cannot be a compiled program.
 *       Retired.
 *   - text is neither, and the function is compiled C today
 *     → the row is an earlier spelling that also reached the target words.
 *       `exact: true`.
 *
 * Rows that are not full-word zeros are left alone apart from the schema
 * stamp: their key already says what they are.
 *
 * Usage:
 *   npx tsx tools/agent/migrateLedger.ts            # report
 *   npx tsx tools/agent/migrateLedger.ts --write    # apply
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ROOT } from "./decompToolchain.js";
import { sha256 } from "./provenance.js";
import { handsSymbolToAssembler } from "./cSourceGuard.js";
import { LEDGER_SCHEMA_VERSION, readLedger, type LedgerEntry } from "./experimentLedger.js";
import { loadContainers } from "../lib/container.js";

const LEDGER_DIR = join(ROOT, "build/experimentLedger");

/** Where a function's source lives today, across every container. */
function sourceOf(functionName: string): string | null {
  for (const container of loadContainers()) {
    const path = join(ROOT, container.paths.srcDir, `${functionName}.c`);
    if (existsSync(path)) return path;
  }
  return null;
}

type Fate = "exact" | "retire" | "unchanged";

interface Decision {
  fate: Fate;
  why: string;
}

function decide(entry: LedgerEntry, currentText: string | null, currentIsStub: boolean): Decision {
  if (entry.exact !== undefined) return { fate: "unchanged", why: "already carries a verdict" };
  const zero = entry.key.every((term) => term === 0);
  if (!zero) return { fate: "unchanged", why: "non-zero key states its own verdict" };
  if (entry.matchedWords !== entry.totalWords) {
    return { fate: "unchanged", why: "zero key with unmatched words — neither a match nor a stub" };
  }
  if (currentText !== null && entry.sourceHash === sha256(currentText)) {
    return currentIsStub
      ? { fate: "retire", why: "source text is the current file, which hands the function to the assembler" }
      : { fate: "exact", why: "source text is the current file, which is compiled C" };
  }
  return currentIsStub
    ? { fate: "retire", why: "function is a stub today, so no source has ever reproduced its bytes" }
    : { fate: "exact", why: "function is compiled C today and this row reached the target words" };
}

function main(): void {
  const write = process.argv.includes("--write");
  if (!existsSync(LEDGER_DIR)) {
    console.log("no ledgers to migrate");
    return;
  }

  let files = 0;
  let marked = 0;
  let retired = 0;
  const retiredRows: string[] = [];

  for (const file of readdirSync(LEDGER_DIR).filter((name) => name.endsWith(".jsonl")).sort()) {
    const functionName = basename(file, ".jsonl");
    const entries = readLedger(functionName);
    if (entries.length === 0) continue;

    const path = sourceOf(functionName);
    const text = path ? readFileSync(path, "utf8") : null;
    const isStub = text !== null && handsSymbolToAssembler(text, functionName);

    const kept: LedgerEntry[] = [];
    let changed = false;
    for (const entry of entries) {
      const decision = decide(entry, text, isStub);
      if (decision.fate === "retire") {
        retired++;
        changed = true;
        retiredRows.push(`  ${functionName}  ${entry.at.slice(0, 19)}  ${entry.matchedWords}/${entry.totalWords}  ${decision.why}`);
        continue;
      }
      const next: LedgerEntry = { ...entry, schemaVersion: LEDGER_SCHEMA_VERSION };
      if (decision.fate === "exact") {
        next.exact = true;
        marked++;
        changed = true;
      } else if (entry.exact === undefined) {
        /* Everything left is provably not exact: a non-zero key, or a zero key
           with words that did not all match. Saying so costs nothing and
           removes the `undefined` that `best()` has to interpret. */
        next.exact = false;
        changed = true;
      }
      if (next.schemaVersion !== entry.schemaVersion || next.exact !== entry.exact) changed = true;
      kept.push(next);
    }

    if (!changed) continue;
    files++;
    if (write) {
      writeFileSync(join(LEDGER_DIR, file), kept.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
    }
  }

  console.log(`experiment ledgers: ${files} file(s) would change` + (write ? " — written" : ""));
  console.log(`  ${marked} zero row(s) marked exact`);
  console.log(`  ${retired} row(s) retired as measurements of the extracted assembly`);
  for (const line of retiredRows) console.log(line);
  if (!write && files > 0) console.log("\nrun with --write to apply");
}

main();
