#!/usr/bin/env npx tsx
/**
 * The local allocator's observed quantity priorities and assignment order.
 *
 * The chain beneath this reading — allocator counterfactual, instrumented cc1
 * run, replay — is produced here when it is not already current for the source
 * on disk. Nothing has to be run first.
 *
 *   npx tsx tools/agent/analyzeLocalAllocationOracle.ts <function>
 *   npx tsx tools/agent/analyzeLocalAllocationOracle.ts <function> --report <report.json>
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import { ensureLocalAllocationAnalysis, type LocalAllocationArtifact } from "./compiler-oracle/ensure.js";
import { parseOracleEvents } from "./compiler-oracle/run.js";
import { replayLocalAllocation } from "./compiler-oracle/local-allocation.js";
import { projectPath, renderProvenance, writeStableJson } from "./provenance.js";
import type { CompilerOracleReport } from "./compiler-oracle/types.js";

function usage(): never {
  console.error("Usage: npx tsx tools/agent/analyzeLocalAllocationOracle.ts <function> [--report build/compilerOracle/.../report.json] [--force-build]");
  process.exit(1);
}

/**
 * Analyse one named report instead of the current chain.
 *
 * The escape hatch for reading a specific historical run. It is explicit
 * because the default must never silently be one: the previous version chose
 * the newest report by mtime, which analysed whichever run happened to be last
 * on disk regardless of the source it came from.
 */
function analyzeNamedReport(functionName: string, requested: string): LocalAllocationArtifact {
  const reportPath = requested.startsWith("/") ? requested : join(ROOT, requested);
  if (!existsSync(reportPath)) throw new Error(`report not found: ${requested}`);
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as CompilerOracleReport;
  if (report.function !== functionName) {
    throw new Error(`${requested} describes ${report.function}, not ${functionName}`);
  }
  const baseline = report.variants.find((variant) => variant.id === "baseline");
  const counterfactual = report.variants.find((variant) => variant.id === "local-only")
    || report.variants.find((variant) => variant.id === "combined");
  if (!baseline || !counterfactual) {
    throw new Error("compiler-oracle report lacks baseline/local counterfactual variants");
  }
  const readEvents = (artifactDirectory: string) => {
    const path = join(ROOT, artifactDirectory, "events.jsonl");
    return parseOracleEvents(existsSync(path) ? readFileSync(path, "utf8") : "");
  };
  return {
    ...replayLocalAllocation(
      readEvents(baseline.artifactDirectory),
      report.derivedInterventions.forcedLocalAssignments,
      readEvents(counterfactual.artifactDirectory),
    ),
    compilerOracleReport: projectPath(reportPath),
  };
}

function render(functionName: string, analysis: LocalAllocationArtifact): string {
  return [
    `Local-allocation oracle: ${functionName}`,
    `derived from: ${analysis.compilerOracleReport}`,
    `stock choice replay: ${analysis.replayedChoices}/${analysis.ordinaryChoices} (${analysis.replayVerified ? "verified" : "FAILED"})`,
    `quantities: ${analysis.quantities.length}`,
    "",
    ...analysis.requests.flatMap((request) => [
      `pseudo ${request.pseudo} -> $${request.registerName || request.hardRegister}: block=${request.block ?? "none"} quantity=${request.quantity ?? "none"} baseline-available=${request.baselineAvailable ? "yes" : "no"} accepted=${request.accepted ? "yes" : request.rejected ? "rejected" : "not-attempted"}`,
      ...request.evidence.map((item) => `  - ${item}`),
    ]),
    "",
    ...analysis.caveats.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

const args = process.argv.slice(2);
const name = args.find((argument) => !argument.startsWith("--"));
if (!name) usage();
const functionName = normalizeFunctionName(name);
const reportIndex = args.indexOf("--report");
const requestedReport = reportIndex >= 0 ? args[reportIndex + 1] : undefined;

try {
  const output = join(ROOT, "build/localAllocationOracle", functionName);
  let text: string;

  if (requestedReport) {
    const analysis = analyzeNamedReport(functionName, requestedReport);
    text = `${render(functionName, analysis)}\nPROVENANCE (what this reading was derived from)\n  named report: ${analysis.compilerOracleReport}`;
  } else {
    const ensured = ensureLocalAllocationAnalysis(functionName, {
      forceBuild: args.includes("--force-build"),
    });
    text = `${render(functionName, ensured.value)}\n${renderProvenance([{ label: "local-allocation replay", ensured }])}`;
  }

  writeStableJson(join(output, "summary.json"), { function: functionName, text });
  process.stdout.write(`${text}\n`);
} catch (error) {
  console.error(`analyzeLocalAllocationOracle: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
