#!/usr/bin/env npx tsx
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import { parseOracleEvents } from "./compiler-oracle/run.js";
import { replayLocalAllocation } from "./compiler-oracle/local-allocation.js";
import type { CompilerOracleReport } from "./compiler-oracle/types.js";

function usage(): never {
  console.error("Usage: npx tsx tools/agent/analyzeLocalAllocationOracle.ts <function> [--report build/compilerOracle/.../report.json]");
  process.exit(1);
}

function latestReport(functionName: string): string {
  const root = join(ROOT, "build/compilerOracle/runs", functionName);
  if (!existsSync(root)) throw new Error(`No compiler-oracle runs found for ${functionName}`);
  const reports = readdirSync(root).map((entry) => join(root, entry, "report.json")).filter(existsSync);
  if (reports.length === 0) throw new Error(`No compiler-oracle report.json found for ${functionName}`);
  return reports.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0]!;
}

const args = process.argv.slice(2);
const name = args.find((arg) => !arg.startsWith("--"));
if (!name) usage();
const functionName = normalizeFunctionName(name);
const reportIndex = args.indexOf("--report");
const requestedReport = reportIndex >= 0 ? args[reportIndex + 1] : undefined;
const reportPath = requestedReport
  ? (requestedReport.startsWith("/") ? requestedReport : join(ROOT, requestedReport))
  : latestReport(functionName);
const report = JSON.parse(readFileSync(reportPath, "utf8")) as CompilerOracleReport;
const baseline = report.variants.find((variant) => variant.id === "baseline");
const counterfactual = report.variants.find((variant) => variant.id === "local-only")
  || report.variants.find((variant) => variant.id === "combined");
if (!baseline || !counterfactual) throw new Error("Compiler-oracle report lacks baseline/local counterfactual variants");
const readEvents = (artifactDirectory: string) => {
  const path = join(ROOT, artifactDirectory, "events.jsonl");
  return parseOracleEvents(existsSync(path) ? readFileSync(path, "utf8") : "");
};
const analysis = replayLocalAllocation(
  readEvents(baseline.artifactDirectory),
  report.derivedInterventions.forcedLocalAssignments,
  readEvents(counterfactual.artifactDirectory),
);
const output = join(ROOT, "build/localAllocationOracle", functionName);
mkdirSync(output, { recursive: true });
writeFileSync(join(output, "analysis.json"), JSON.stringify({
  schemaVersion: 1,
  function: functionName,
  compilerOracleReport: relative(ROOT, reportPath).replaceAll("\\", "/"),
  ...analysis,
}, null, 2) + "\n");
const lines = [
  `Local-allocation oracle: ${functionName}`,
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
];
writeFileSync(join(output, "summary.txt"), lines.join("\n"));
process.stdout.write(lines.join("\n"));
