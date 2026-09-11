/**
 * finalizeEngineMatches.ts — automated, reproducible finalization of the
 * reconstruction engine's byte-exact matches into the source tree.
 *
 * The reconstruction engine (benchmarkReconstruction.ts --census) statically
 * transpiles unmatched functions to C and, for the ones it reproduces exactly,
 * writes a `winner.c` under build/matchingReconstruction/<fn>/. This tool takes
 * those winners and integrates each into its container's source file, with no
 * LLM engagement:
 *
 *   1. Replace the winner's standalone typedef block with `#include "common.h"`.
 *   2. Drop the winner's `extern` lines for globals the project's generated
 *      headers already declare (keeping them would conflict); a global neither
 *      the project nor the winner declares makes the candidate fail to compile
 *      and the function is skipped for manual handling.
 *   3. Compile with the container's real flags + overrides and confirm the
 *      byte oracle still reports a match. Only oracle-confirmed matches are
 *      written.
 *
 * The byte oracle is the only judge: a transform that is subtly wrong simply
 * fails to match and the function is left as a stub, never silently written.
 *
 * Usage:
 *   npx tsx tools/agent/finalizeEngineMatches.ts            # dry run, all matches
 *   npx tsx tools/agent/finalizeEngineMatches.ts --write    # apply to src/
 *   npx tsx tools/agent/finalizeEngineMatches.ts <fn> ...    # specific functions
 *
 * Reproducible and project-agnostic: paths come from the container model and
 * declared globals from the generated header table, so it runs against any
 * binary the engine does.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, compileSource } from "./decompToolchain.js";
import { requireFunctionLocation } from "../lib/symbolIndex.js";
import { compareFunction } from "../lib/functionOracle.js";
import { loadContainers, containerOfSymbol, EXE_CONTAINER_ID } from "../lib/container.js";

const RECON_DIR = "build/matchingReconstruction";
const BASE_TYPEDEF = /^typedef (signed|unsigned) (char|short|int) [su](8|16|32);$/;
const EXTERN_GLOBAL = /^extern\b.*\bD_[0-9A-Fa-f]{8}\b/;

interface FinalizeOutcome {
  functionName: string;
  status: "integrated" | "no-winner" | "no-src" | "not-a-match" | "compile-error";
  detail?: string;
}

/** Winner source -> integrated source: `common.h` for the base typedefs, and
 *  (when `dropGlobalExterns`) drop the winner's `extern D_XXXX;` lines so the
 *  project's generated headers provide those globals with their real types.
 *  The two variants are tried in turn and judged by the oracle — no knowledge
 *  of the project's headers is needed. */
function integrate(winnerSource: string, dropGlobalExterns: boolean): string {
  const kept = winnerSource.split("\n").filter((line) => {
    const t = line.trim();
    if (BASE_TYPEDEF.test(t)) return false;
    if (dropGlobalExterns && EXTERN_GLOBAL.test(t)) return false;
    return true;
  });
  return `#include "common.h"\n${kept.join("\n").replace(/^\n+/, "")}`;
}

function srcPathFor(functionName: string): string | null {
  const containers = loadContainers();
  /* Overlay symbols carry their container id as a prefix; a bare name is the
   * executable's — containerOfSymbol returns null for it, so fall back to the
   * exe container, the same resolution m2cFunc uses. */
  const container = containerOfSymbol(functionName, containers)
    ?? containers.find((c) => c.id === EXE_CONTAINER_ID);
  if (!container) return null;
  return join(ROOT, container.paths.srcDir, `${functionName}.c`);
}

/** All functions the engine matched exactly. Prefer the authoritative census
 *  (the current run's exact-candidate set); fall back to scanning persisted
 *  results when no census is present. */
function exactCandidates(): string[] {
  const censusPath = join(ROOT, RECON_DIR, "census.json");
  if (existsSync(censusPath)) {
    try {
      const census = JSON.parse(readFileSync(censusPath, "utf-8"));
      return census.functions
        .filter((f: { state: string }) => f.state === "exact-candidate")
        .map((f: { functionName: string }) => f.functionName)
        .filter((fn: string) => existsSync(join(ROOT, RECON_DIR, fn, "winner.c")))
        .sort();
    } catch { /* fall through to a directory scan */ }
  }
  const base = join(ROOT, RECON_DIR);
  if (!existsSync(base)) return [];
  const names: string[] = [];
  for (const dir of readdirSync(base)) {
    const resultPath = join(base, dir, "result.json");
    if (!existsSync(resultPath)) continue;
    try {
      const result = JSON.parse(readFileSync(resultPath, "utf-8"));
      if (result.state === "exact-candidate" && existsSync(join(base, dir, "winner.c"))) names.push(dir);
    } catch { /* skip unreadable */ }
  }
  return names.sort();
}

/** Compile one integrated form with the container's real flags and ask the byte
 *  oracle whether it still matches. Returns the verdict, or an error string. */
function oracleVerdict(functionName: string, integrated: string, tag: string): { verdict: string } | { error: string } {
  try {
    const location = requireFunctionLocation(functionName);
    const dir = join(ROOT, "build/finalizeEngineMatches", functionName, tag);
    mkdirSync(dir, { recursive: true });
    const staged = join(dir, `${functionName}.c`);
    writeFileSync(staged, integrated);
    const artifacts = compileSource(staged, join(dir, "compiled"), functionName, {
      assemble: true, useOverrides: true, containerKind: location.container.kind,
    });
    if (!artifacts.object) return { error: "no object" };
    return { verdict: compareFunction(functionName, { objectPath: artifacts.object, container: location.container }).verdict };
  } catch (error) {
    return { error: (error instanceof Error ? error.message : String(error)).slice(0, 120) };
  }
}

export function finalizeMatch(functionName: string, write: boolean): FinalizeOutcome {
  const winnerPath = join(ROOT, RECON_DIR, functionName, "winner.c");
  if (!existsSync(winnerPath)) return { functionName, status: "no-winner" };
  const srcPath = srcPathFor(functionName);
  if (!srcPath || !existsSync(srcPath)) return { functionName, status: "no-src" };

  const winner = readFileSync(winnerPath, "utf-8");
  /* Two candidate forms: globals from the project headers (drop the winner's
   * externs) or globals from the winner itself. The oracle picks; if neither
   * matches, the function is left as a stub for manual handling. */
  let compiledButMismatched = false;
  let lastError = "";
  for (const dropGlobalExterns of [true, false]) {
    const integrated = integrate(winner, dropGlobalExterns);
    const result = oracleVerdict(functionName, integrated, dropGlobalExterns ? "shared" : "own");
    if ("error" in result) { lastError = result.error; continue; }
    if (result.verdict === "match") {
      if (write) writeFileSync(srcPath, integrated);
      return { functionName, status: "integrated" };
    }
    compiledButMismatched = true;
    lastError = result.verdict;
  }
  return compiledButMismatched
    ? { functionName, status: "not-a-match", detail: lastError }
    : { functionName, status: "compile-error", detail: lastError };
}

function main(): void {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const requested = args.filter((a) => !a.startsWith("--"));
  const targets = requested.length > 0 ? requested : exactCandidates();

  const outcomes = targets.map((fn) => finalizeMatch(fn, write));
  const by = (s: FinalizeOutcome["status"]) => outcomes.filter((o) => o.status === s);

  const integrated = by("integrated");
  console.log(`${write ? "WROTE" : "DRY RUN"} — ${targets.length} engine match(es) evaluated`);
  console.log(`  integrated (byte-oracle confirmed): ${integrated.length}`);
  for (const status of ["not-a-match", "compile-error", "no-winner", "no-src"] as const) {
    const group = by(status);
    if (group.length === 0) continue;
    console.log(`  ${status}: ${group.length}`);
    for (const o of group.slice(0, 6)) console.log(`      ${o.functionName}${o.detail ? ` (${o.detail})` : ""}`);
    if (group.length > 6) console.log(`      … and ${group.length - 6} more`);
  }
  if (!write && integrated.length > 0) console.log(`\nRe-run with --write to apply, then verify with 'make check' / 'make check-<overlay>'.`);
}

if (process.argv[1] && (process.argv[1].endsWith("/finalizeEngineMatches.ts") || process.argv[1].endsWith("\\finalizeEngineMatches.ts"))) {
  main();
}
