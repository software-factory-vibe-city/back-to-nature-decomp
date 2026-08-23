/**
 * ledger.ts — the running record of what the loop threshold can still be.
 *
 * Each function's decisions constrain the same compilation-wide unknown, so
 * the bracket tightens as functions are traced and the record is worth more
 * than any single run. Two rules keep it honest:
 *
 * - Constraints are keyed by function and *replaced* on re-trace, never
 *   appended. A changed source produces different decisions, and keeping both
 *   sets would intersect a program with its own earlier self.
 * - The whole record is scoped to a toolchain identity. `n_non_fixed_regs`
 *   depends on the target's fixed-register set, so a different compiler or a
 *   different `-msoft-float` decision is a different constant; the record is
 *   dropped rather than mixed.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { sha256, writeStableJson } from "../provenance.js";
import type { Constraint } from "./threshold.js";

export const LEDGER_PATH = join(ROOT, "build/loopTrace/threshold.json");
const SCHEMA_VERSION = 1;

interface LedgerDocument {
  schemaVersion: number;
  toolchainHash: string;
  functions: Record<string, { sourceHash: string; constraints: Constraint[] }>;
}

function empty(toolchainHash: string): LedgerDocument {
  return { schemaVersion: SCHEMA_VERSION, toolchainHash, functions: {} };
}

export function readThresholdLedger(toolchainHash: string, path = LEDGER_PATH): LedgerDocument {
  if (!existsSync(path)) return empty(toolchainHash);
  try {
    const document = JSON.parse(readFileSync(path, "utf8")) as LedgerDocument;
    if (document.schemaVersion !== SCHEMA_VERSION) return empty(toolchainHash);
    if (document.toolchainHash !== toolchainHash) return empty(toolchainHash);
    return document;
  } catch {
    return empty(toolchainHash);
  }
}

/** Record one function's constraints and return every constraint on file. */
export function recordConstraints(
  options: {
    functionName: string;
    sourceHash: string;
    constraints: Constraint[];
    toolchainHash: string;
    path?: string;
  },
): { all: Constraint[]; functions: string[] } {
  const path = options.path ?? LEDGER_PATH;
  const document = readThresholdLedger(options.toolchainHash, path);
  document.functions[options.functionName] = {
    sourceHash: options.sourceHash,
    constraints: options.constraints,
  };
  writeStableJson(path, document);
  const names = Object.keys(document.functions).sort();
  return {
    all: names.flatMap((name) => document.functions[name]!.constraints),
    functions: names,
  };
}

export function hashSource(text: string): string {
  return sha256(text);
}
