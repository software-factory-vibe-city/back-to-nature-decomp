#!/usr/bin/env npx tsx

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { analyzeTargetSchedule } from "./analyzeTargetSchedule.js";
import {
  ROOT,
  configuredToolchainIdentity,
  normalizeFunctionName,
  resolveSource,
} from "./decompToolchain.js";
import { buildSourceModel } from "./source-shape-synthesis/source-model.js";
import { deriveSynthesisPlan, sourceShapeSpec } from "./source-shape-synthesis/planner.js";
import type { SynthesisSummary } from "./source-shape-synthesis/types.js";
import { resolveProjectInput, validateSourceShapeSpec } from "./source-shape-search/schema.js";
import { assertTargetScheduleAnalysis, type TargetScheduleAnalysis } from "./target-schedule/types.js";
import { findEmptyMemoryBarriers } from "./variant-lab/manifest.js";
import { projectPath, sha256, sha256File, stableJson, writeStableJson } from "./variant-lab/artifacts.js";

interface CliOptions {
  functionName: string;
  analysisPath?: string;
  deriveOnly: boolean;
  maxVariants: number;
  maxDepth: number;
  jobs: number;
  resume: boolean;
  json: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`synthesizeSourceShapes: ${message}`);
  console.error("Usage: npx tsx tools/agent/synthesizeSourceShapes.ts <function> [--analysis <analysis.json>] [--derive-only] [--max-variants <1..5000>] [--max-depth <1..3>] [--jobs <1..16>] [--resume] [--json]");
  process.exit(1);
}

function parseCli(args: string[]): CliOptions {
  if (args.length === 0 || args[0]!.startsWith("--")) usage("missing function name");
  const functionName = normalizeFunctionName(args[0]!);
  let analysisPath: string | undefined;
  let deriveOnly = false;
  let maxVariants = 500;
  let maxDepth = 3;
  let jobs = 1;
  let resume = false;
  let json = false;
  for (let index = 1; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--analysis") analysisPath = args[++index];
    else if (argument === "--derive-only") deriveOnly = true;
    else if (argument === "--max-variants") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 5000) usage("--max-variants must be 1..5000");
      maxVariants = Number(raw);
    } else if (argument === "--max-depth") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 3) usage("--max-depth must be 1..3");
      maxDepth = Number(raw);
    } else if (argument === "--jobs") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 16) usage("--jobs must be 1..16");
      jobs = Number(raw);
    } else if (argument === "--resume") resume = true;
    else if (argument === "--json") json = true;
    else usage(`unknown option: ${argument}`);
  }
  const result: CliOptions = { functionName, deriveOnly, maxVariants, maxDepth, jobs, resume, json };
  if (analysisPath) result.analysisPath = analysisPath;
  return result;
}

function loadAnalysis(options: CliOptions): { analysis: TargetScheduleAnalysis; path: string } {
  if (options.analysisPath) {
    const absolute = resolveProjectInput(options.analysisPath, "target-schedule analysis");
    const analysis = assertTargetScheduleAnalysis(JSON.parse(readFileSync(absolute, "utf8")));
    if (analysis.function !== options.functionName) throw new Error(`analysis targets ${analysis.function}, not ${options.functionName}`);
    return { analysis, path: projectPath(absolute) };
  }
  const analysis = analyzeTargetSchedule({
    functionName: options.functionName,
    maxInterventions: 8,
    json: false,
  });
  return { analysis, path: projectPath(join(ROOT, "build/targetSchedule", options.functionName, "analysis.json")) };
}

function implementationHash(): string {
  const files = [
    join(ROOT, "tools/agent/synthesizeSourceShapes.ts"),
    ...readdirSync(join(ROOT, "tools/agent/source-shape-synthesis"))
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .sort()
      .map((name) => join(ROOT, "tools/agent/source-shape-synthesis", name)),
  ];
  return sha256(files.map((path) => `${relative(ROOT, path)}:${sha256File(path)}`).join("\n"));
}

/**
 * The search run for *this* source and toolchain, not merely for this spec.
 *
 * Matching on the spec path alone returned whichever run sorted last among
 * every run that had ever used that spec, and its candidate lists then fed the
 * synthesis as though they described the current source. The manifest records
 * the base source and toolchain it was produced from; both must agree.
 */
function findSearchSummary(functionName: string, specPath: string, baseSourcePath: string): string | undefined {
  const root = join(ROOT, "build/sourceShapeSearch", functionName);
  if (!existsSync(root)) return undefined;
  const expectedSpec = projectPath(specPath);
  const expectedSource = sha256File(baseSourcePath);
  const expectedToolchain = sha256(stableJson(configuredToolchainIdentity()));
  for (const name of readdirSync(root).sort().reverse()) {
    const manifestPath = join(root, name, "search-manifest.json");
    const summaryPath = join(root, name, "summary.json");
    if (!existsSync(manifestPath) || !existsSync(summaryPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        specPath?: string;
        baseSourceHash?: string;
        toolchainHash?: string;
      };
      if (manifest.specPath !== expectedSpec) continue;
      if (manifest.baseSourceHash !== expectedSource) continue;
      if (manifest.toolchainHash !== expectedToolchain) continue;
      return summaryPath;
    } catch {
      continue;
    }
  }
  return undefined;
}

function render(summary: SynthesisSummary): string {
  const lines = [
    `${summary.function}: ${summary.status}`,
    `Generated alternatives: ${summary.generatedAlternatives}`,
    `Requirements with source-role coverage: ${summary.requirementsCovered}/${summary.requirementsTotal}`,
    `Artifacts: ${summary.artifacts}`,
    `Plan: ${summary.plan}`,
  ];
  if (summary.searchSpec) lines.push(`Search spec: ${summary.searchSpec}`);
  if (summary.searchSummary) lines.push(`Search summary: ${summary.searchSummary}`);
  if (summary.exactCandidates.length > 0) lines.push(`Exact cc1 candidates: ${summary.exactCandidates.join(", ")}`);
  if (summary.promotableCandidates.length > 0) lines.push(`Full object-exact candidates: ${summary.promotableCandidates.join(", ")}`);
  if (summary.caveats.length > 0) lines.push("", "Caveats:", ...summary.caveats.map((item) => `  - ${item}`));
  return lines.join("\n");
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const sourcePath = resolveSource(options.functionName);
  const source = readFileSync(sourcePath, "utf8");
  const loaded = loadAnalysis(options);
  const model = buildSourceModel(options.functionName, projectPath(sourcePath), source);
  const plan = deriveSynthesisPlan({
    functionName: options.functionName,
    sourcePath: projectPath(sourcePath),
    source,
    analysisPath: loaded.path,
    analysis: loaded.analysis,
    maxVariants: options.maxVariants,
    maxDepth: options.maxDepth,
  }, model);
  const runId = sha256(stableJson({
    schemaVersion: 1,
    function: options.functionName,
    sourceHash: model.sourceHash,
    analysisHash: plan.analysisHash,
    implementationHash: implementationHash(),
    maxVariants: options.maxVariants,
    maxDepth: options.maxDepth,
  })).slice(0, 16);
  const runRoot = join(ROOT, "build/sourceShapeSynthesis", options.functionName, runId);
  mkdirSync(runRoot, { recursive: true });
  const sourceModelPath = join(runRoot, "source-model.json");
  const planPath = join(runRoot, "synthesis-plan.json");
  const specPath = join(runRoot, "search-spec.json");
  writeStableJson(sourceModelPath, model);
  writeStableJson(planPath, plan);

  const coveredRequirements = new Set(plan.roles.flatMap((role) => loaded.analysis.requirements
    .filter((requirement) => requirement.targetIndexes.some((index) => role.targetIndexes.includes(index)))
    .map((requirement) => requirement.id)));
  let status: SynthesisSummary["status"] = plan.alternatives.length > 0 ? "derived" : "no-safe-recipe-for-requirement";
  let searchSummaryPath: string | undefined;
  let exactCandidates: string[] = [];
  let promotableCandidates: string[] = [];

  if (plan.alternatives.length > 0) {
    const spec = sourceShapeSpec(plan, findEmptyMemoryBarriers(source).length > 0);
    validateSourceShapeSpec(spec, options.functionName);
    writeStableJson(specPath, spec);
    if (!options.deriveOnly) {
      const args = [
        "tsx",
        "tools/agent/searchSourceShapes.ts",
        options.functionName,
        "--spec",
        projectPath(specPath),
        "--analysis",
        loaded.path,
        "--max-variants",
        String(Math.min(options.maxVariants, plan.alternatives.length + 1)),
        "--jobs",
        String(options.jobs),
      ];
      if (options.resume) args.push("--resume");
      const result = spawnSync("npx", args, {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 50 * 1024 * 1024,
        timeout: 30 * 60 * 1000,
      });
      writeFileSync(join(runRoot, "search-output.txt"), `${result.stdout || ""}${result.stderr || ""}`);
      if (result.error || result.status !== 0) {
        status = "search-failed";
      } else {
        const found = findSearchSummary(options.functionName, specPath, sourcePath);
        if (found) {
          searchSummaryPath = found;
          const search = JSON.parse(readFileSync(found, "utf8")) as {
            exactCc1Candidates?: string[];
            promotableCandidates?: string[];
          };
          exactCandidates = search.exactCc1Candidates || [];
          promotableCandidates = search.promotableCandidates || [];
          status = promotableCandidates.length > 0 ? "exact-candidate-found" : "search-complete";
        } else status = "search-failed";
      }
    }
  }

  const summary: SynthesisSummary = {
    schemaVersion: 1,
    function: options.functionName,
    runId,
    status,
    artifacts: projectPath(runRoot),
    sourceModel: projectPath(sourceModelPath),
    plan: projectPath(planPath),
    ...(plan.alternatives.length > 0 ? { searchSpec: projectPath(specPath) } : {}),
    ...(searchSummaryPath ? { searchSummary: projectPath(searchSummaryPath) } : {}),
    generatedAlternatives: plan.alternatives.length,
    requirementsCovered: coveredRequirements.size,
    requirementsTotal: loaded.analysis.requirements.length,
    exactCandidates,
    promotableCandidates,
    caveats: [
      ...plan.caveats,
      ...(status === "search-failed" ? [`Search command failed; inspect ${projectPath(join(runRoot, "search-output.txt"))}.`] : []),
      "This synthesis MVP targets a conservative top-level prologue subset; finite exhaustion does not prove that no matching clean C exists.",
      "Generated candidates remain under build/ and are never copied to src/.",
    ],
  };
  writeStableJson(join(runRoot, "summary.json"), summary);
  writeFileSync(join(runRoot, "summary.txt"), `${render(summary)}\n`);
  console.log(options.json ? JSON.stringify(summary, null, 2) : render(summary));
}

main().catch((error) => {
  console.error(`synthesizeSourceShapes: ${error instanceof Error ? error.stack || error.message : error}`);
  process.exitCode = 1;
});
