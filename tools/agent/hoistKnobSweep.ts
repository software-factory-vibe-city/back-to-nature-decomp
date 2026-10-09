#!/usr/bin/env npx tsx
/** Measure bounded access-route and independently witnessed record-view products. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT, normalizeFunctionName, resolveSource, runTool, preprocessOnly } from "./decompToolchain.js";
import { sha256, toolchainHash, projectPath, writeStableJson } from "./provenance.js";
import { scoreTargetLoopEmission, symbolMaps } from "./analyzeTargetLoopEmission.js";
import { classifyCandidate, checkRequirement, groupIdentity } from "./loop-emission/compare.js";
import { assessHoists, hoistWindows, renderDesirability, type HoistAssessment } from "./loop-emission/desirability.js";
import { EmissionClass } from "./loop-emission/types.js";
import { loopTrace } from "./loopTrace.js";
import { readThresholdLedger } from "./loop-trace/ledger.js";
import { solveThreshold } from "./loop-trace/threshold.js";
import { enumerateHoistSites, invariantGlobals, invariantAddressLocals, hoistMasks, hoistVariant, type HoistSite } from "./hoist-knob-sites.js";
import { discoverRecordViews, measureViewExpressions, normalizeRecordViews, type RecordNormalization } from "./hoist-record-views.js";
import { C_FRONTEND_IDENTITY } from "./residual-source-search/tree-sitter-c.js";
import type { ResidualObjective } from "./pipeline-reversal/objective.js";

export interface SweepVariant {
  id: string;
  representation: string;
  mask: string;
  source: string;
  decisions: HoistAssessment[];
  goalsMet: number;
  premiseMet: boolean;
  objective?: ResidualObjective;
  error?: string;
}
interface Representation {
  id: string;
  source: string;
  sourcePath: string;
  sites: HoistSite[];
  windows: ReturnType<typeof hoistWindows>;
  normalization?: Omit<RecordNormalization, "source">;
}
function sitesFor(source: string, preprocessed: string, fn: string, windows: ReturnType<typeof hoistWindows>): HoistSite[] {
  const arrays = invariantGlobals(preprocessed), objects = invariantGlobals(preprocessed, true);
  return enumerateHoistSites(source, fn, windows, arrays, objects, invariantAddressLocals(preprocessed, fn, arrays, objects));
}
export function hoistKnobSweep(functionName: string, sourceOverride?: string, max = 64) {
  hoistMasks(0, max); /* Validate direct library calls as well as CLI budgets. */
  const sourcePath = resolveSource(functionName, sourceOverride), source = readFileSync(sourcePath, "utf8");
  const sourceHash = sha256(source), baseline = scoreTargetLoopEmission(functionName, sourcePath);
  const windows = hoistWindows(baseline.assessments);
  if (windows.length === 0) throw new Error("no attributable pass-1-decline goal/window; cascade and pass-2-only invariance routes are outside this sweep");
  /* Fresh cpp is mandatory: a header's type/layout is part of this proof. */
  const contextDirectory = join(ROOT, "build/hoistKnobSweep", functionName, "contexts", sourceHash.slice(0, 24));
  const preprocessed = readFileSync(preprocessOnly(sourcePath, contextDirectory, "context"), "utf8"), contextHash = sha256(preprocessed);
  const sites = sitesFor(source, preprocessed, functionName, windows);
  const implementation = sha256(["hoistKnobSweep.ts", "hoist-knob-sites.ts", "hoist-record-views.ts", "loop-emission/compare.ts", "loop-emission/desirability.ts", "loop-emission/derive.ts", "loop-trace/threshold.ts", "loop-trace/values.ts", "loopTrace.ts"].map(path => readFileSync(join(ROOT, "tools/agent", path), "utf8")).join("\n"));
  const identity = sha256(JSON.stringify({ sourceHash, contextHash, implementation, frontend: C_FRONTEND_IDENTITY, toolchain: toolchainHash(), target: baseline.requirement, max })).slice(0, 24);
  const directory = join(ROOT, "build/hoistKnobSweep", functionName, identity), candidates = join(directory, "candidates");
  mkdirSync(candidates, { recursive: true });
  const representations: Representation[] = [{ id: "raw", source, sourcePath: projectPath(sourcePath), sites, windows }];
  const preparationErrors: string[] = [];
  let measurements: Record<string, number> = {};
  try {
    const discovery = discoverRecordViews(preprocessed, source, functionName);
    if (discovery.views.length && sites.length) {
      const measured = measureViewExpressions(functionName, preprocessed, discovery.expressions, join(directory, "layout-measurements"));
      measurements = Object.fromEntries(measured);
      const normalizations = normalizeRecordViews(source, preprocessed, functionName, sites, discovery, measured);
      for (const [i, normalization] of normalizations.entries()) {
        const id = `view${String(i + 1).padStart(2, "0")}`, path = join(directory, "prepared", `${id}.c`);
        mkdirSync(join(directory, "prepared"), { recursive: true }); writeFileSync(path, normalization.source);
        try {
          const scored = scoreTargetLoopEmission(functionName, path), preparedWindows = hoistWindows(scored.assessments);
          const cpp = readFileSync(preprocessOnly(path, join(directory, "prepared"), id), "utf8");
          const preparedSites = sitesFor(normalization.source, cpp, functionName, preparedWindows);
          if (preparedSites.length !== sites.length || !preparedWindows.length) throw new Error("normalized source lost its attributable window/read sites");
          const { source: normalizedSource, ...proof } = normalization;
          representations.push({ id, source: normalizedSource, sourcePath: projectPath(path), sites: preparedSites, windows: preparedWindows, normalization: proof });
        } catch (error) { preparationErrors.push(`${id}: ${String(error)}`); }
      }
    }
  } catch (error) { preparationErrors.push(`record-view preparation: ${String(error)}`); }
  const totals = representations.map(rep => 1n << BigInt(rep.sites.length)), total = totals.reduce((a, b) => a + b, 0n);
  const count = Number(total < BigInt(max) ? total : BigInt(max)), exhaustive = BigInt(count) === total;
  const positions = Array.from({ length: count }, (_, i) => exhaustive ? BigInt(i) : count === 1 ? 0n : BigInt(i) * (total - 1n) / BigInt(count - 1));
  const ledger = readThresholdLedger(toolchainHash());
  const otherConstraints = Object.entries(ledger.functions).filter(([name]) => name !== functionName).flatMap(([, entry]) => entry.constraints);
  const givPremises = baseline.verdicts.flatMap(verdict => verdict.groups.filter(group => group.actual === EmissionClass.Pass1GivInit || group.actual === EmissionClass.Pass2GivInit)
    .map(group => ({ block: verdict.preheader.block, identity: groupIdentity(group.group), actual: group.actual })));
  const variants: SweepVariant[] = [];
  for (let position of positions) {
    let repIndex = 0; while (position >= totals[repIndex]!) { position -= totals[repIndex]!; repIndex++; }
    const rep = representations[repIndex]!;
    const maskId = `m${position.toString().padStart(2, "0")}`;
    const id = representations.length === 1 || representations.length === 2 && rep.normalization ? maskId : `${rep.id}-${maskId}`;
    const path = join(candidates, `${id}.c`); writeFileSync(path, hoistVariant(rep.source, rep.sites, position));
    const row: SweepVariant = { id, representation: rep.id, mask: position.toString(), source: projectPath(path), decisions: [], goalsMet: 0, premiseMet: false };
    try {
      const traced = loopTrace(functionName, path, `hoist-${identity}-${id}`).result;
      const solution = solveThreshold([...otherConstraints, ...traced.constraints]);
      const classing = classifyCandidate(traced.trace, symbolMaps(functionName).addressOf), verdicts = checkRequirement(baseline.requirement.preheaders, classing);
      row.decisions = assessHoists(baseline.goals, verdicts, traced.trace, solution.candidates.length === 1 ? solution.candidates[0] : undefined, solution.brackets);
      row.premiseMet = givPremises.every(premise => verdicts.find(entry => entry.preheader.block === premise.block)?.groups
        .some(group => groupIdentity(group.group) === premise.identity && group.outcome !== "undetermined" && group.actual === premise.actual));
      row.goalsMet = row.decisions.filter(entry => entry.outcome === "met").length;
    } catch (error) { row.error = String(error); }
    variants.push(row);
  }
  const successful = variants.filter(row => !row.error);
  if (successful.length > 0) {
    const argv = ["tsx", join(ROOT, "tools/agent/residualObjective.ts"), functionName,
      ...(successful.length === variants.length ? ["--dir", candidates] : successful.flatMap(row => ["--source", resolve(ROOT, row.source)])), "--json"];
    const output = runTool("npx", argv); writeFileSync(join(directory, "residual.json"), output);
    const residual = JSON.parse(output) as { entries: Array<{ source?: string; objective: ResidualObjective }> };
    for (const row of successful) {
      const objective = residual.entries.find(entry => entry.source && resolve(ROOT, entry.source) === resolve(ROOT, row.source))?.objective;
      if (objective) row.objective = objective; else row.error = "residualObjective returned no row for this source";
    }
  }
  const inputStable = sha256(readFileSync(sourcePath, "utf8")) === sourceHash
    && sha256(readFileSync(preprocessOnly(sourcePath, contextDirectory, "input-check"), "utf8")) === contextHash;
  variants.sort((a, b) => Number(b.premiseMet) - Number(a.premiseMet) || b.goalsMet - a.goalsMet || compareKeys(a.objective?.key, b.objective?.key) || a.id.localeCompare(b.id));
  const goalMeeting = variants.filter(row => row.premiseMet && row.goalsMet === baseline.goals.length && !row.error).length;
  const families = representations.map((rep, i) => ({ id: rep.id, source: rep.sourcePath, sourceHash: sha256(rep.source), sites: rep.sites, windows: rep.windows,
    ...(rep.normalization ? { normalization: rep.normalization } : {}),
    coverage: { evaluated: variants.filter(row => row.representation === rep.id).length, total: totals[i]!.toString(), exhaustive: BigInt(variants.filter(row => row.representation === rep.id).length) === totals[i] } }));
  const report = {
    schemaVersion: 1, functionName, source: projectPath(sourcePath), sourceHash, contextHash, implementation, frontend: C_FRONTEND_IDENTITY, toolchainHash: toolchainHash(), inputStable,
    directory: projectPath(directory), windows, sites, goals: baseline.goals, representations: families, measurements, preparationErrors,
    coverage: { evaluated: variants.length, total: total.toString(), exhaustive }, goalMeeting,
    exact: inputStable ? variants.filter(row => row.objective?.exact).map(row => row.id) : [], variants,
    closure: inputStable && exhaustive && preparationErrors.length === 0 && sites.length > 0 && goalMeeting === 0
      && variants.every(row => !row.error && row.objective && row.decisions.every(entry => entry.outcome !== "undetermined"))
      ? { sourceHash, windows, sites, representations: families, contextHash, result: "exhausted-no-goal-meeting-variant" } : null,
  };
  writeStableJson(join(directory, "report.json"), report);
  if (!inputStable) throw new Error(`input/header drift; measurements preserved at ${report.directory}/report.json, no result is promotion-eligible`);
  return { report, baseline: baseline.assessments };
}
function compareKeys(a: number[] | undefined, b: number[] | undefined): number {
  if (!a) return b ? 1 : 0; if (!b) return -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
}
function main(): void {
  const args = process.argv.slice(2); let fn: string | undefined; let source: string | undefined; let max = 64; let json = false;
  try {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!;
      if (arg === "--source") { source = args[++i]; if (!source) throw new Error("--source needs a path"); }
      else if (arg === "--max") { max = Number(args[++i]); if (!Number.isSafeInteger(max) || max < 1) throw new Error("--max needs a positive safe integer"); }
      else if (arg === "--json") json = true;
      else if (arg.startsWith("--") || fn) throw new Error(`unexpected argument ${arg}`); else fn = normalizeFunctionName(arg);
    }
    if (!fn) throw new Error("name one function");
    const { report, baseline } = hoistKnobSweep(fn, source, max);
    if (json) { console.log(JSON.stringify(report, null, 2)); return; }
    console.log(`hoist knob sweep ${fn} — ${report.sites.length} reads, ${report.representations.length} source representations`);
    console.log(renderDesirability(baseline).join("\n"));
    console.log(`COVERAGE: ${report.coverage.evaluated}/${report.coverage.total} ${report.coverage.exhaustive ? "EXHAUSTIVE" : "SAMPLED — not exhaustive"}`);
    for (const rep of report.representations) {
      console.log(`  ${rep.id}: ${rep.coverage.evaluated}/${rep.coverage.total} — ${rep.source}`);
      if (rep.normalization) console.log(`    MEASURED VIEW ${rep.normalization.view.type}.${rep.normalization.view.array}[].${rep.normalization.view.member}; ${rep.normalization.reads.length} byte-affine equalities, ${rep.normalization.equalStores} guarded store indices`);
    }
    for (const error of report.preparationErrors) console.log(`  PREPARATION UNDETERMINED: ${error} — no closure certificate`);
    for (const row of report.variants) {
      const vector = row.decisions.map(entry => `${entry.goal.name}:${entry.actual === 1 ? "p1" : entry.actual === 3 ? "p2" : "?"}${entry.outcome === "met" ? "" : ` (${entry.outcome.toUpperCase().replace("-", " ")})`}`).join(" ");
      const comparisons = row.decisions.map(entry => entry.margin ? `${entry.goal.name}:N=${entry.margin.insnCount},T=${entry.margin.effectiveThreshold}` : `${entry.goal.name}:unmeasured`).join(" ");
      console.log(`  ${row.id}: ${vector}; ${comparisons}; goals ${row.goalsMet}/${report.goals.length}${row.premiseMet ? "" : "; giv premise NOT MET"}; residual ${row.objective?.key.join("/") ?? "?"}${row.objective?.exact ? " EXACT" : ""}${row.error ? ` ERROR ${row.error}` : ""}`);
    }
    console.log(`REPORT: ${report.directory}/report.json`);
    console.log("Candidates stay under build/; EXACT is byte-oracle evidence, not integration or finalization.");
  } catch (error) {
    console.error(`hoistKnobSweep: ${(error as Error).message}\nUsage: npx tsx tools/agent/hoistKnobSweep.ts <fn> [--source path] [--max 64] [--json]`); process.exitCode = 1;
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
