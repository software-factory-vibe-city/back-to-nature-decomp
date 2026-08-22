import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  best,
  isUnprovenZero,
  readLedger,
  variantText,
  type LedgerEntry,
} from "../../../../tools/agent/experimentLedger.ts";
import { sha256 } from "../../../../tools/agent/provenance.ts";

/**
 * Which program a park should preserve.
 *
 * A park used to preserve whatever happened to be in `src/` when the turn
 * budget ran out, which is the last program a tier tried, not the best one it
 * found. The gap is real and large: one parked function's note reports a
 * residual of `[0,0,1,1]` above a source that reproduces `[0,4,1,1]`, and
 * another spent 166 measurements on a 22-word function and preserved a program
 * that was not among its best. The measured history knows which program was
 * best; nothing consulted it.
 *
 * The ledger is the authority because it is the only record that survives a
 * context clear, a model change and a `make clean`. Since schema 2 it also
 * preserves the source text of every row, so the best row is a file, not a
 * hash.
 */
export interface ParkAttempt {
  /** The text to preserve. */
  text: string;
  /** Where it came from, for the note. */
  origin: "on-disk" | "ledger";
  /** Set when the ledger's best differs from what is on disk. */
  supersededText?: string;
  /** One line for the note and the operator, always. */
  note: string;
}

function keyOf(entry: LedgerEntry): string {
  return `[${entry.key.join(", ")}]`;
}

function describe(entry: LedgerEntry): string {
  const verdict = entry.exact === true
    ? "EXACT"
    : isUnprovenZero(entry)
      ? "zero residual, bytes still differ"
      : keyOf(entry);
  return `${verdict} at ${entry.matchedWords}/${entry.totalWords} words, measured ${entry.at.slice(0, 19)}`;
}

/**
 * Rank two ledger rows the same way `best()` does, so "the ledger's best" and
 * "better than what is on disk" cannot disagree.
 */
function outranks(candidate: LedgerEntry, incumbent: LedgerEntry): boolean {
  return best([candidate, incumbent]) === candidate && candidate !== incumbent;
}

export function chooseParkAttempt(
  projectRoot: string,
  functionName: string,
  onDiskText: string,
): ParkAttempt {
  const entries = readLedger(functionName);
  if (entries.length === 0) {
    return { text: onDiskText, origin: "on-disk", note: "no measured history; preserved the source on disk" };
  }

  const onDiskHash = sha256(onDiskText);
  const onDiskRow = entries.find((entry) => entry.sourceHash === onDiskHash);
  const winner = best(entries);
  if (!winner) {
    return { text: onDiskText, origin: "on-disk", note: "measured history has no rankable row; preserved the source on disk" };
  }

  if (onDiskRow && !outranks(winner, onDiskRow)) {
    return {
      text: onDiskText,
      origin: "on-disk",
      note: `the source on disk is the best measured program (${describe(onDiskRow)})`,
    };
  }

  const text = winner.sourcePath
    ? readTextOrUndefined(join(projectRoot, winner.sourcePath)) ?? variantText(winner)
    : variantText(winner);

  if (text === undefined) {
    return {
      text: onDiskText,
      origin: "on-disk",
      note:
        `the best measured program is ${describe(winner)} from ${winner.source}, but its text was not ` +
        "preserved (recorded before the variant store existed); preserved the source on disk instead",
    };
  }

  if (sha256(text) === onDiskHash) {
    return {
      text: onDiskText,
      origin: "on-disk",
      note: `the source on disk is the best measured program (${describe(winner)})`,
    };
  }

  return {
    text,
    origin: "ledger",
    supersededText: onDiskText,
    note:
      `preserved the best measured program (${describe(winner)}, first scored from ${winner.source}) ` +
      `rather than the source left on disk` +
      (onDiskRow ? `, which measured ${describe(onDiskRow)}` : ", which was never measured"),
  };
}

function readTextOrUndefined(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}
