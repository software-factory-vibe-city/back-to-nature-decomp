#!/usr/bin/env npx tsx
/**
 * residualSignatures.ts — the same problem, written twice, in two functions.
 *
 * A block's residual signature is the shape of its difference independent of
 * where it sits: which instruction shapes moved, and by how far. The objective
 * already computes it, and `rankBlocks` already groups by it so that one source
 * fix can be credited with closing several blocks at once — but only within a
 * single function, and only for the length of one process.
 *
 * The payoff is across functions. `ovl_10_func_800BADA4` block 41 and
 * `ovl_10_func_800BB264` block 41 carried the byte-identical signature
 *
 *     addiu <reg>,<reg>,-17844@4|addiu <reg>,<reg>,1@4
 *
 * They were worked thirty minutes apart, by the same loop, for fifty-two and
 * thirty-four minutes, and closed by the same one-line edit: index the global
 * array directly instead of walking a hoisted base pointer. Nothing carried the
 * first answer to the second function.
 *
 * This index is that carry. It reads every experiment ledger, groups the
 * recorded signatures, and — where a function later reached an exact program —
 * shows the diff between the best source that carried the signature and the
 * source that closed it. That diff is the answer, in the author's own C.
 *
 * Signatures are recorded from schema 2 onward, so the index fills as the loop
 * runs rather than describing history it never saw. It says so rather than
 * presenting an empty index as an absence of shared shapes.
 *
 * Usage:
 *   npx tsx tools/agent/residualSignatures.ts                       # the whole index
 *   npx tsx tools/agent/residualSignatures.ts --signature '<sig>'   # one shape
 *   npx tsx tools/agent/residualSignatures.ts --function <name>     # this function's shapes
 *   npx tsx tools/agent/residualSignatures.ts --write               # cache to build/
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import {
  best,
  readLedger,
  variantText,
  type LedgerEntry,
} from "./experimentLedger.js";

const LEDGER_DIR = join(ROOT, "build/experimentLedger");
export const INDEX_PATH = join(ROOT, "build/residualSignatures.json");

export interface SignatureCarrier {
  function: string;
  at: string;
  key: number[];
  matchedWords: number;
  totalWords: number;
  /** Preserved text of the measurement that carried the signature, if any. */
  sourcePath?: string;
}

export interface SignatureClosure {
  function: string;
  /** The best measurement that still carried the signature. */
  before: SignatureCarrier;
  /** The exact measurement that no longer does. */
  afterPath?: string;
  /** Unified diff, before → after. Empty when either text is missing. */
  diff: string;
}

export interface SignatureRecord {
  signature: string;
  carriers: SignatureCarrier[];
  /** Functions in which this shape was closed, with the edit that closed it. */
  closures: SignatureClosure[];
}

export interface SignatureIndex {
  generatedAt: string;
  /** Ledgers scanned, and how many of them recorded any signature at all. */
  ledgers: number;
  ledgersWithSignatures: number;
  records: SignatureRecord[];
}

/** Line-oriented unified diff, no external process. */
export function unifiedDiff(before: string, after: string, context = 2): string {
  const left = before.split("\n");
  const right = after.split("\n");
  /* Longest common subsequence over lines — the texts are one function each,
     so the quadratic table is a few hundred cells. */
  const table: number[][] = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      table[i]![j] = left[i] === right[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  type Row = { mark: " " | "-" | "+"; text: string };
  const rows: Row[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      rows.push({ mark: " ", text: left[i]! });
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      rows.push({ mark: "-", text: left[i++]! });
    } else {
      rows.push({ mark: "+", text: right[j++]! });
    }
  }
  while (i < left.length) rows.push({ mark: "-", text: left[i++]! });
  while (j < right.length) rows.push({ mark: "+", text: right[j++]! });

  /* Keep only the changed regions plus a little context; a whole function of
     unchanged lines buries the edit that is the point of the record. */
  const keep = new Array(rows.length).fill(false);
  rows.forEach((row, index) => {
    if (row.mark === " ") return;
    for (let k = Math.max(0, index - context); k <= Math.min(rows.length - 1, index + context); k++) keep[k] = true;
  });
  const out: string[] = [];
  let gap = false;
  rows.forEach((row, index) => {
    if (!keep[index]) {
      gap = true;
      return;
    }
    if (gap) out.push("  ...");
    gap = false;
    out.push(`${row.mark} ${row.text}`);
  });
  return out.join("\n");
}

function carrierOf(entry: LedgerEntry): SignatureCarrier {
  return {
    function: entry.function,
    at: entry.at,
    key: entry.key,
    matchedWords: entry.matchedWords,
    totalWords: entry.totalWords,
    ...(entry.sourcePath ? { sourcePath: entry.sourcePath } : {}),
  };
}

export function buildIndex(): SignatureIndex {
  const records = new Map<string, SignatureRecord>();
  let ledgers = 0;
  let ledgersWithSignatures = 0;

  if (existsSync(LEDGER_DIR)) {
    for (const file of readdirSync(LEDGER_DIR).filter((name) => name.endsWith(".jsonl")).sort()) {
      const functionName = basename(file, ".jsonl");
      const entries = readLedger(functionName);
      if (entries.length === 0) continue;
      ledgers++;

      const carrying = entries.filter((entry) => (entry.signatures ?? []).length > 0);
      if (carrying.length === 0) continue;
      ledgersWithSignatures++;

      const exact = entries.filter((entry) => entry.exact === true);
      const closer = exact.length > 0 ? exact[exact.length - 1] : undefined;

      const perSignature = new Map<string, LedgerEntry[]>();
      for (const entry of carrying) {
        for (const signature of entry.signatures!) {
          perSignature.set(signature, [...(perSignature.get(signature) ?? []), entry]);
        }
      }

      for (const [signature, rows] of perSignature) {
        const record = records.get(signature) ?? { signature, carriers: [], closures: [] };
        for (const row of rows) record.carriers.push(carrierOf(row));

        /* The shape was closed here iff the function later reached an exact
           program. The edit that closed it is the diff from the best source
           that still carried the shape to the one that did not. */
        if (closer) {
          const bestCarrier = best(rows);
          const beforeText = bestCarrier ? variantText(bestCarrier) : undefined;
          const afterText = variantText(closer);
          if (bestCarrier && beforeText !== undefined && afterText !== undefined) {
            record.closures.push({
              function: functionName,
              before: carrierOf(bestCarrier),
              ...(closer.sourcePath ? { afterPath: closer.sourcePath } : {}),
              diff: unifiedDiff(beforeText, afterText),
            });
          }
        }
        records.set(signature, record);
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    ledgers,
    ledgersWithSignatures,
    records: [...records.values()].sort((left, right) => right.carriers.length - left.carriers.length),
  };
}

/**
 * What is known about one residual shape, as a block for a turn message.
 *
 * Empty when the shape has never been seen elsewhere — a line saying "no
 * precedent" on every block would be noise, and the absence of a precedent is
 * not a finding.
 */
export function lookupSignature(
  signature: string,
  excludeFunction?: string,
  index = buildIndex(),
): string {
  if (!signature) return "";
  const record = index.records.find((item) => item.signature === signature);
  if (!record) return "";
  const closures = record.closures.filter((closure) => closure.function !== excludeFunction);
  const carriers = record.carriers.filter((carrier) => carrier.function !== excludeFunction);
  if (closures.length === 0 && carriers.length === 0) return "";

  const lines = [`This block's residual shape \`${signature}\` is not new.`];
  if (closures.length > 0) {
    const closure = closures[0]!;
    lines.push(
      `It was closed in ${closure.function}, which carried it at [${closure.before.key.join(", ")}] ` +
      `(${closure.before.matchedWords}/${closure.before.totalWords} words). The edit that closed it:`,
      "",
      closure.diff,
      "",
      "That is a proven answer for this shape in this codebase. Try it before modelling the compiler.",
    );
    if (closures.length > 1) {
      lines.push(`Also closed in ${closures.slice(1).map((item) => item.function).join(", ")}.`);
    }
  } else {
    const functions = [...new Set(carriers.map((carrier) => carrier.function))];
    lines.push(
      `${functions.join(", ")} carried it too and ${functions.length === 1 ? "has" : "have"} not closed it. ` +
      "Whatever answers it here answers it there; record what you find.",
    );
  }
  return lines.join("\n");
}

function render(index: SignatureIndex, filter?: { signature?: string; functionName?: string }): string {
  const lines: string[] = [
    `residual signature index — ${index.records.length} distinct shape(s) across ` +
    `${index.ledgersWithSignatures} of ${index.ledgers} ledger(s)`,
  ];
  if (index.ledgersWithSignatures < index.ledgers) {
    lines.push(
      `  ${index.ledgers - index.ledgersWithSignatures} ledger(s) predate signature recording (schema 2) and`,
      "  carry none. The index describes what has been measured since, not the whole history.",
    );
  }
  const shown = index.records.filter((record) =>
    (!filter?.signature || record.signature === filter.signature) &&
    (!filter?.functionName || record.carriers.some((carrier) => carrier.function === filter.functionName)));
  if (shown.length === 0) {
    lines.push("", "  no shape matches that filter");
    return lines.join("\n");
  }
  for (const record of shown) {
    const functions = [...new Set(record.carriers.map((carrier) => carrier.function))];
    lines.push("", `  ${record.signature}`, `    carried by: ${functions.join(", ")}`);
    for (const closure of record.closures) {
      lines.push(`    CLOSED in ${closure.function} — edit:`);
      for (const line of closure.diff.split("\n")) lines.push(`      ${line}`);
    }
  }
  return lines.join("\n");
}

const isCLI = process.argv[1]?.endsWith("residualSignatures.ts");
if (isCLI) {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const index = buildIndex();
  if (args.includes("--write")) {
    mkdirSync(dirname(INDEX_PATH), { recursive: true });
    writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);
    console.log(`wrote ${INDEX_PATH.slice(ROOT.length + 1)}`);
  }
  const functionArgument = flag("function");
  const filter = {
    ...(flag("signature") ? { signature: flag("signature")! } : {}),
    ...(functionArgument ? { functionName: normalizeFunctionName(functionArgument) } : {}),
  };
  if (args.includes("--json")) {
    console.log(JSON.stringify(index, null, 2));
  } else {
    console.log(render(index, filter));
  }
}
