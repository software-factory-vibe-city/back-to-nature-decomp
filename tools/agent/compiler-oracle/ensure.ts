/**
 * ensure.ts — the allocator-forensics chain, produced on demand.
 *
 * Four artifacts stack here, each derived from the one before it:
 *
 *   target schedule → allocator counterfactual → compiler-oracle run
 *                   → local-allocation replay → state solver
 *
 * Every stage used to require the caller to have run the previous one, and the
 * error when they had not named a *path* (`Missing build/localAllocationOracle/
 * <fn>/analysis.json`) rather than a tool, so working out the running order
 * meant reading four files. The deepest entry point needed three prior calls in
 * the right sequence and nothing said so. The measured consequence was that the
 * axis these tools serve went unexercised on the function that most needed it,
 * while that function's own research note named the solver as the next step.
 *
 * Each `ensure` here produces its input rather than reporting its absence, and
 * stamps the result with the fingerprint of everything upstream, so a changed
 * source invalidates the whole chain rather than only its first link. A caller
 * asks for the artifact it wants and never sequences anything.
 *
 * Upstream stages are produced *lazily*. A stage's fingerprint is computable
 * from its declared inputs alone, so a downstream cache hit can be decided
 * without running anything above it — which matters because one link in this
 * chain builds an instrumented cc1.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runAllocatorCounterfactual } from "../analyzeAllocatorCounterfactual.js";
import { ROOT, resolveSource } from "../decompToolchain.js";
import {
  type EnsuredArtifact,
  type ProvenanceInputs,
  computeProvenance,
  ensureArtifact,
  projectPath,
  stamped,
  writeStableJson,
} from "../provenance.js";
import type { AllocatorCounterfactualAnalysis } from "../allocator-counterfactual/types.js";
import { replayLocalAllocation, type LocalAllocationReplay } from "./local-allocation.js";
import { parseOracleEvents, runCompilerOracle } from "./run.js";
import type { CompilerOracleReport } from "./types.js";

/** Source files whose logic decides these artifacts. */
const CHAIN_IMPLEMENTATION = [
  join(ROOT, "tools/agent/analyzeAllocatorCounterfactual.ts"),
  join(ROOT, "tools/agent/analyzeTargetSchedule.ts"),
  join(ROOT, "tools/agent/allocator-counterfactual"),
  join(ROOT, "tools/agent/compiler-oracle"),
  join(ROOT, "tools/agent/target-schedule"),
];

function stampPath(kind: string, functionName: string): string {
  return join(ROOT, "build", kind, functionName, "provenance.json");
}

/** The fingerprint of a stage, without producing it. */
function fingerprintOf(functionName: string, inputs: ProvenanceInputs): string {
  return computeProvenance(functionName, inputs).fingerprint;
}

/* ---- stage 1: allocator counterfactual ---------------------------------- */

function allocatorInputs(functionName: string): ProvenanceInputs {
  return { files: [resolveSource(functionName)], implementation: CHAIN_IMPLEMENTATION };
}

/**
 * The allocator counterfactual, which derives its own target schedule.
 *
 * `analyzeTargetSchedule` recompiles with dumps on every call, so this stage is
 * correct without a cache; the cache only keeps a repeat call cheap.
 */
export function ensureAllocatorCounterfactual(
  functionName: string,
): EnsuredArtifact<AllocatorCounterfactualAnalysis> {
  const analysisPath = join(ROOT, "build/allocatorCounterfactual", functionName, "analysis.json");

  return ensureArtifact<AllocatorCounterfactualAnalysis>({
    artifactPath: stampPath("allocatorCounterfactual", functionName),
    label: `allocator counterfactual for ${functionName}`,
    functionName,
    costHint: "compiles with -da dumps",
    inputs: allocatorInputs(functionName),
    produce: (provenance) => {
      const { analysis } = runAllocatorCounterfactual({ functionName, json: false });
      writeStableJson(
        stampPath("allocatorCounterfactual", functionName),
        stamped({ analysis: projectPath(analysisPath) }, provenance),
      );
      return analysis;
    },
    read: () => {
      if (!existsSync(analysisPath)) throw new Error("allocator analysis is missing");
      return JSON.parse(readFileSync(analysisPath, "utf8")) as AllocatorCounterfactualAnalysis;
    },
  });
}

/* ---- stage 2: instrumented compiler-oracle run --------------------------- */

function oracleInputs(functionName: string, forceBuild: boolean): ProvenanceInputs {
  return {
    files: [resolveSource(functionName)],
    /* The upstream fingerprint is an input, so a change anywhere earlier in the
     * chain invalidates this stage too — without running the upstream stage. */
    values: {
      allocatorCounterfactual: fingerprintOf(functionName, allocatorInputs(functionName)),
      forceBuild,
    },
    implementation: CHAIN_IMPLEMENTATION,
  };
}

/**
 * An instrumented-compiler run, producing its allocator counterfactual first
 * when one is actually needed. Building the diagnostic cc1 is the expensive
 * step, which is why the cost is announced before it starts.
 */
export function ensureCompilerOracleReport(
  functionName: string,
  options: { forceBuild?: boolean } = {},
): EnsuredArtifact<{ report: CompilerOracleReport; reportPath: string }> {
  const forceBuild = options.forceBuild ?? false;

  return ensureArtifact<{ report: CompilerOracleReport; reportPath: string }>({
    artifactPath: stampPath("compilerOracle", functionName),
    label: `instrumented compiler-oracle run for ${functionName}`,
    costHint: "builds an instrumented cc1 on first use; several minutes",
    functionName,
    inputs: oracleInputs(functionName, forceBuild),
    produce: (provenance) => {
      const upstream = ensureAllocatorCounterfactual(functionName);
      const report = runCompilerOracle(functionName, { forceBuild, analysis: upstream.value });
      const reportPath = join(ROOT, report.runDirectory, "report.json");
      writeStableJson(
        stampPath("compilerOracle", functionName),
        stamped({ report: projectPath(reportPath) }, provenance),
      );
      return { report, reportPath };
    },
    read: (stored) => {
      const value = stored as { report?: string };
      if (!value.report) throw new Error("compiler-oracle stamp has no report path");
      const reportPath = join(ROOT, value.report);
      if (!existsSync(reportPath)) throw new Error("compiler-oracle report is missing");
      return { report: JSON.parse(readFileSync(reportPath, "utf8")) as CompilerOracleReport, reportPath };
    },
  });
}

/* ---- stage 3: local-allocation replay ------------------------------------ */

export interface LocalAllocationArtifact extends LocalAllocationReplay {
  compilerOracleReport: string;
}

/**
 * The local-allocation replay: the oracle's own record of which quantity won
 * each register, and why a requested assignment was refused.
 *
 * The previous implementation picked the newest `report.json` under the run
 * directory by mtime. A run from an older source outranked nothing, and was
 * silently analysed as if it described the current one.
 */
export function ensureLocalAllocationAnalysis(
  functionName: string,
  options: { forceBuild?: boolean } = {},
): EnsuredArtifact<LocalAllocationArtifact> {
  const forceBuild = options.forceBuild ?? false;
  const analysisPath = join(ROOT, "build/localAllocationOracle", functionName, "analysis.json");

  return ensureArtifact<LocalAllocationArtifact>({
    artifactPath: analysisPath,
    label: `local-allocation replay for ${functionName}`,
    functionName,
    inputs: {
      files: [resolveSource(functionName)],
      values: { compilerOracle: fingerprintOf(functionName, oracleInputs(functionName, forceBuild)) },
      implementation: CHAIN_IMPLEMENTATION,
    },
    produce: (provenance) => {
      const { report, reportPath } = ensureCompilerOracleReport(functionName, { forceBuild }).value;
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
      const replay = replayLocalAllocation(
        readEvents(baseline.artifactDirectory),
        report.derivedInterventions.forcedLocalAssignments,
        readEvents(counterfactual.artifactDirectory),
      );
      const artifact: LocalAllocationArtifact = { ...replay, compilerOracleReport: projectPath(reportPath) };
      writeStableJson(
        analysisPath,
        stamped({ schemaVersion: 1, function: functionName, ...artifact }, provenance),
      );
      return artifact;
    },
    read: (stored) => stored as LocalAllocationArtifact,
  });
}
