#!/usr/bin/env npx tsx

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import {
  CC1_FLAGS,
  CPP_FLAGS,
  ROOT,
  assembleTarget,
  compileSourceAsync,
  configuredToolchainIdentity,
  disassembleObject,
  loadFlagOverrides,
  normalizeFunctionName,
  runToolAsync,
} from "./decompToolchain.js";
import { buildTraceReportFromArtifacts } from "./compilerTrace.js";
import { assertTargetScheduleAnalysis, type TargetScheduleAnalysis } from "./target-schedule/types.js";
import { analyzeTargetScheduleFromArtifacts } from "./target-schedule/analyze.js";
import { writeTargetScheduleArtifacts } from "./target-schedule/artifacts.js";
import { renderTargetSchedule } from "./target-schedule/render-text.js";
import { deriveScheduleMechanismProfile, traceBundleHash } from "./target-schedule/profile.js";
import { compareScheduleMechanismProfiles } from "./target-schedule/compare-profiles.js";
import { writeScheduleProfileArtifacts } from "./target-schedule/profile-artifacts.js";
import type { ScheduleMechanismProfile } from "./target-schedule/profile-types.js";
import { sha256, sha256File, stableJson, writeStableJson, projectPath } from "./variant-lab/artifacts.js";
import { classifyHypothesis } from "./variant-lab/classify-hypothesis.js";
import { compareNormalized, normalizeDisassembly, parseCc1Assembly, writeNormalizedComparison } from "./variant-lab/compile.js";
import { comparePassSnapshots, loadPassSnapshots } from "./variant-lab/pass-diff.js";
import type { NormalizedInstruction, PassSnapshot, PassStage, VariantHypothesis } from "./variant-lab/types.js";
import { cacheKey, restoreCache, storeCache } from "./source-shape-search/cache.js";
import { loadCheckpoint, validateCheckpoint, writeCheckpoint } from "./source-shape-search/checkpoint.js";
import { equivalenceClasses } from "./source-shape-search/equivalence.js";
import { evaluateAssembly, functionObjectsEqual, rankSearchResults } from "./source-shape-search/evaluator.js";
import { generateVariantBatch, type GeneratedVariant } from "./source-shape-search/generator.js";
import { renderSourceShapeSummary } from "./source-shape-search/render-text.js";
import { loadSourceShapeSpec, resolveProjectInput } from "./source-shape-search/schema.js";
import type {
  EquivalenceClass,
  SearchCheckpoint,
  SearchVariantResult,
  SourceShapeSearchSummary,
  VariantLineage,
} from "./source-shape-search/types.js";
import { runWorkerPool } from "./source-shape-search/worker-pool.js";

interface CliOptions {
  functionName: string;
  specPath: string;
  analysisPath?: string;
  jobs: number;
  resume: boolean;
  variantBudget?: number;
  json: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`searchSourceShapes: ${message}`);
  console.error("Usage: npx tsx tools/agent/searchSourceShapes.ts <function> --spec <search.json> [--analysis <analysis.json>] [--jobs <1..32>] [--max-variants <n>] [--resume] [--json]");
  process.exit(1);
}

function parseCli(args: string[]): CliOptions {
  if (args.length === 0 || args[0]!.startsWith("--")) usage("missing function name");
  const functionName = normalizeFunctionName(args[0]!);
  let specPath: string | undefined;
  let analysisPath: string | undefined;
  let jobs = 1;
  let variantBudget: number | undefined;
  let resume = false;
  let json = false;
  for (let index = 1; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--spec") specPath = args[++index];
    else if (argument === "--analysis") analysisPath = args[++index];
    else if (argument === "--jobs") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 32) usage("--jobs must be 1..32");
      jobs = Number(raw);
    } else if (argument === "--max-variants") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 100000) usage("--max-variants must be 1..100000");
      variantBudget = Number(raw);
    } else if (argument === "--resume") resume = true;
    else if (argument === "--json") json = true;
    else usage(`unknown option: ${argument}`);
  }
  if (!specPath) usage("--spec is required");
  const result: CliOptions = { functionName, specPath, jobs, resume, json };
  if (analysisPath) result.analysisPath = analysisPath;
  if (variantBudget !== undefined) result.variantBudget = variantBudget;
  return result;
}

function loadAnalysis(path: string | undefined, functionName: string): TargetScheduleAnalysis | undefined {
  if (!path) return undefined;
  const absolute = resolveProjectInput(path, "target-schedule analysis");
  const analysis = assertTargetScheduleAnalysis(JSON.parse(readFileSync(absolute, "utf8")));
  if (analysis.function !== functionName) throw new Error(`analysis targets ${analysis.function}, not ${functionName}`);
  return analysis;
}

function emptyResult(variant: GeneratedVariant, artifacts: string, targetCount: number): SearchVariantResult {
  const result: SearchVariantResult = {
    variantId: variant.id,
    productIndex: variant.productIndex,
    sourceHash: variant.sourceHash,
    policyPassed: variant.policyPassed,
    compiled: false,
    requirementResults: [],
    mechanismVerdicts: [],
    preservedRanges: [],
    hardConstraintsPassed: false,
    opcodeStreamExact: false,
    instructionCountExact: false,
    cc1Exact: false,
    exactInstructions: 0,
    totalInstructions: targetCount,
    fullObjectExact: false,
    promotionEligible: false,
    artifacts,
  };
  if (variant.policyError) result.compileError = variant.policyError;
  return result;
}

function cloneEquivalent(
  variant: GeneratedVariant,
  representative: SearchVariantResult,
  kind: "source" | "preprocessed" | "assembly",
): SearchVariantResult {
  const clone: SearchVariantResult = JSON.parse(JSON.stringify(representative));
  clone.variantId = variant.id;
  clone.productIndex = variant.productIndex;
  clone.sourceHash = variant.sourceHash;
  clone.artifacts = projectPath(join(variant.sourcePath, ".."));
  clone.promotionEligible = false;
  if (kind === "source") clone.sourceEquivalentTo = representative.variantId;
  else if (kind === "preprocessed") clone.preprocessedEquivalentTo = representative.variantId;
  else clone.assemblyEquivalentTo = representative.variantId;
  return clone;
}

function writeComparison(directory: string, target: NormalizedInstruction[], compiled: NormalizedInstruction[]): void {
  writeNormalizedComparison(directory, target, compiled);
}

function couldBecomeExactAfterAssembler(target: NormalizedInstruction[], compiled: NormalizedInstruction[]): boolean {
  const withoutNops = target.filter((instruction) => instruction.mnemonic !== "nop");
  return withoutNops.length === compiled.length && withoutNops.every((instruction, index) => instruction.canonical === compiled[index]!.canonical);
}

function preprocessedSemanticHash(path: string): string {
  const content = readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*#/.test(line) && line.trim().length > 0)
    .map((line) => line.trimEnd())
    .join("\n");
  return sha256(content);
}

function sourceSearchImplementationHash(): string {
  const files = [
    join(ROOT, "tools/agent/searchSourceShapes.ts"),
    join(ROOT, "tools/agent/compilerTrace.ts"),
    ...readFileNames(join(ROOT, "tools/agent/source-shape-search")),
    ...readFileNames(join(ROOT, "tools/agent/target-schedule")),
  ];
  return sha256(files.map((path) => `${relative(ROOT, path)}:${sha256File(path)}`).join("\n"));
}

function readFileNames(directory: string): string[] {
  return readdirSync(directory).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts")).sort().map((name) => join(directory, name));
}

function saveSummary(runRoot: string, summary: SourceShapeSearchSummary): void {
  writeStableJson(join(runRoot, "summary.json"), summary);
  writeStableJson(join(runRoot, "equivalence-classes.json"), summary.equivalenceClasses);
  writeFileSync(join(runRoot, "summary.txt"), `${renderSourceShapeSummary(summary)}\n`);
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const spec = loadSourceShapeSpec(options.specPath, options.functionName);
  const analysisPath = options.analysisPath || spec.analysisPath;
  const analysis = loadAnalysis(analysisPath, options.functionName);
  const basePath = resolveProjectInput(spec.baseSourcePath, "base source");
  const baseSource = readFileSync(basePath, "utf8");
  const baseHash = sha256(baseSource);
  const toolchain = configuredToolchainIdentity();
  const toolchainHash = sha256(stableJson(toolchain));
  const specHash = sha256(stableJson(spec));
  const analysisHash = analysis ? sha256(stableJson(analysis)) : "none";
  const implementationHash = sourceSearchImplementationHash();
  const runId = sha256(stableJson({ schemaVersion: 1, function: options.functionName, specHash, analysisHash, toolchainHash, implementationHash })).slice(0, 16);
  const runRoot = join(ROOT, "build/sourceShapeSearch", options.functionName, runId);
  const checkpointPath = join(runRoot, "checkpoint.json");
  if (!options.resume) rmSync(runRoot, { recursive: true, force: true });
  mkdirSync(runRoot, { recursive: true });

  let checkpoint = options.resume ? loadCheckpoint(checkpointPath) : undefined;
  if (options.resume && !checkpoint) throw new Error(`--resume requested but checkpoint is missing: ${projectPath(checkpointPath)}`);
  if (checkpoint) validateCheckpoint(checkpoint, { functionName: options.functionName, runId, specHash, toolchainHash });
  const previousResults = checkpoint?.results || [];
  const startProductIndex = checkpoint?.nextProductIndex || 0;
  const budget = Math.min(options.variantBudget ?? spec.maxVariants, spec.maxVariants);
  const batch = generateVariantBatch({ spec, baseSource, baseHash, outputRoot: runRoot, startProductIndex, budget });
  const lineages = new Map<string, VariantLineage>(batch.variants.map((variant) => [variant.id, variant.lineage]));
  const results = new Map<string, SearchVariantResult>(previousResults.map((result) => [result.variantId, result]));
  const equivalences: EquivalenceClass[] = [...(checkpoint?.equivalenceClasses || [])];

  writeStableJson(join(runRoot, "search-manifest.json"), {
    schemaVersion: 1,
    function: options.functionName,
    runId,
    specPath: projectPath(resolveProjectInput(options.specPath, "search spec")),
    specHash,
    analysisPath: analysisPath || null,
    analysisHash,
    baseSourcePath: projectPath(basePath),
    baseSourceHash: baseHash,
    toolchain,
    toolchainHash,
    implementationHash,
    jobs: options.jobs,
    budget,
    scheduleComparison: spec.scheduleComparison,
  });

  const targetObject = assembleTarget(options.functionName, runRoot);
  const target = normalizeDisassembly(disassembleObject(targetObject));
  const cacheRoot = join(ROOT, "build/sourceShapeSearch/cache");
  const compilerFlags = [...CC1_FLAGS, ...(loadFlagOverrides().get(options.functionName) || [])];
  const abort = new AbortController();
  process.once("SIGINT", () => abort.abort());
  process.once("SIGTERM", () => abort.abort());

  const persist = (nextProductIndex = batch.nextProductIndex): void => {
    const current: SearchCheckpoint = {
      schemaVersion: 1,
      function: options.functionName,
      runId,
      specHash,
      toolchainHash,
      nextProductIndex,
      totalProducts: batch.totalProducts,
      completedVariantIds: [...results.keys()].sort(),
      results: [...results.values()].sort((a, b) => a.productIndex - b.productIndex),
      equivalenceClasses: equivalences,
    };
    writeCheckpoint(checkpointPath, current);
  };

  for (const variant of batch.variants.filter((item) => !item.policyPassed)) {
    results.set(variant.id, emptyResult(variant, projectPath(join(runRoot, "variants", variant.id)), target.length));
  }

  const priorSource = new Map(previousResults.map((result) => [result.sourceHash, result]));
  const sourceRepresentatives = new Map<string, GeneratedVariant>();
  const sourceDuplicates = new Map<string, string>();
  for (const variant of batch.variants.filter((item) => item.policyPassed)) {
    const prior = priorSource.get(variant.sourceHash);
    if (prior) {
      results.set(variant.id, cloneEquivalent(variant, prior, "source"));
      continue;
    }
    const representative = sourceRepresentatives.get(variant.sourceHash);
    if (representative) sourceDuplicates.set(variant.id, representative.id);
    else sourceRepresentatives.set(variant.sourceHash, variant);
  }

  const preprocessed = new Map<string, { variant: GeneratedVariant; hash: string }>();
  await runWorkerPool([...sourceRepresentatives.values()], options.jobs, async (variant) => {
    const directory = join(runRoot, "variants", variant.id);
    const output = join(directory, "source.i");
    try {
      await runToolAsync("mips-linux-gnu-cpp", [...CPP_FLAGS, variant.sourcePath, "-o", output], ROOT, abort.signal);
      preprocessed.set(variant.id, { variant, hash: preprocessedSemanticHash(output) });
    } catch (error) {
      const result = emptyResult(variant, projectPath(directory), target.length);
      result.compileError = `preprocess: ${error instanceof Error ? error.message : error}`;
      results.set(variant.id, result);
    }
    persist(startProductIndex);
    return undefined;
  });

  const preprocessingRepresentatives = new Map<string, GeneratedVariant>();
  const preprocessingDuplicates = new Map<string, string>();
  for (const entry of [...preprocessed.values()].sort((a, b) => a.variant.productIndex - b.variant.productIndex)) {
    const representative = preprocessingRepresentatives.get(entry.hash);
    if (representative) preprocessingDuplicates.set(entry.variant.id, representative.id);
    else preprocessingRepresentatives.set(entry.hash, entry.variant);
  }

  const compiledStreams = new Map<string, NormalizedInstruction[]>();
  await runWorkerPool([...preprocessingRepresentatives.values()], options.jobs, async (variant) => {
    const directory = join(runRoot, "variants", variant.id);
    const preprocessedHash = preprocessed.get(variant.id)!.hash;
    const key = cacheKey({
      schemaVersion: 1,
      function: options.functionName,
      sourceHash: variant.sourceHash,
      preprocessedHash,
      compilerFlags,
      compilerHash: toolchain.compiler.sha256,
      assemblerShimHash: toolchain.assemblerShim.sha256,
      trace: spec.traceAllPreprocessed,
      full: false,
    });
    try {
      let cached = restoreCache(cacheRoot, key, directory);
      if (!cached || !existsSync(join(directory, `${options.functionName}.s`))) {
        await compileSourceAsync(variant.sourcePath, directory, options.functionName, {
          dumps: spec.traceAllPreprocessed,
          signal: abort.signal,
        });
      }
      const compiled = parseCc1Assembly(join(directory, `${options.functionName}.s`));
      compiledStreams.set(variant.id, compiled);
      const result = evaluateAssembly({
        variantId: variant.id,
        productIndex: variant.productIndex,
        sourceHash: variant.sourceHash,
        artifacts: projectPath(directory),
        spec,
        ...(analysis ? { analysis } : {}),
        target,
        compiled,
      });
      result.preprocessedHash = preprocessedHash;
      result.assemblyHash = sha256(stableJson(compiled));
      results.set(variant.id, result);
      writeComparison(directory, target, compiled);
      storeCache(cacheRoot, key, directory, result);
    } catch (error) {
      const result = emptyResult(variant, projectPath(directory), target.length);
      result.preprocessedHash = preprocessedHash;
      result.compileError = error instanceof Error ? (error.message.split("\n")[0] || error.message) : String(error);
      results.set(variant.id, result);
    }
    persist(startProductIndex);
    return undefined;
  });

  for (const [duplicateId, representativeId] of preprocessingDuplicates) {
    const variant = batch.variants.find((item) => item.id === duplicateId)!;
    const representative = results.get(representativeId);
    if (representative) {
      const clone = cloneEquivalent(variant, representative, "preprocessed");
      const hash = preprocessed.get(duplicateId)?.hash || preprocessed.get(representativeId)?.hash;
      if (hash) clone.preprocessedHash = hash;
      results.set(duplicateId, clone);
    }
  }
  for (const [duplicateId, representativeId] of sourceDuplicates) {
    const variant = batch.variants.find((item) => item.id === duplicateId)!;
    const representative = results.get(representativeId);
    if (representative) results.set(duplicateId, cloneEquivalent(variant, representative, "source"));
  }

  const currentCompiled = batch.variants.map((variant) => results.get(variant.id)).filter((result): result is SearchVariantResult => Boolean(result?.compiled));
  const assemblyGroups = equivalenceClasses("assembly", currentCompiled.map((result) => ({ id: result.variantId, ...(result.assemblyHash ? { hash: result.assemblyHash } : {}) })), lineages);
  equivalences.push(...equivalenceClasses("source", batch.variants.map((variant) => ({ id: variant.id, hash: variant.sourceHash })), lineages));
  equivalences.push(...equivalenceClasses("preprocessed", currentCompiled.map((result) => ({ id: result.variantId, ...(result.preprocessedHash ? { hash: result.preprocessedHash } : {}) })), lineages));
  equivalences.push(...assemblyGroups);
  for (const group of assemblyGroups) {
    for (const member of group.members.slice(1)) {
      const result = results.get(member);
      if (result) result.assemblyEquivalentTo = group.representative;
    }
  }

  const baselineTraceDirectory = join(runRoot, "baseline-trace");
  let baselinePasses: Map<PassStage, PassSnapshot> | undefined;
  let baselineProfile: ScheduleMechanismProfile | undefined;
  const baselineExact = analysis ? compareNormalized(target, analysis.candidate).exact : -1;
  const ordinaryPromising = assemblyGroups.map((group) => results.get(group.representative)!).filter((result) =>
    result && result.compiled && (
      result.requirementResults.some((item) => item.status === "satisfied") || result.exactInstructions > baselineExact
    )
  );
  const traceVariants = spec.traceAllPreprocessed
    ? [...preprocessingRepresentatives.values()]
    : ordinaryPromising.flatMap((result) => {
      const variant = batch.variants.find((item) => item.id === result.variantId);
      return variant ? [variant] : [];
    });

  if (traceVariants.length > 0) {
    const baselineArtifacts = await compileSourceAsync(basePath, baselineTraceDirectory, options.functionName, {
      dumps: true,
      signal: abort.signal,
    });
    baselinePasses = loadPassSnapshots(baselineTraceDirectory, options.functionName);
    if (spec.scheduleComparison.enabled) {
      const baselineScheduleDirectory = join(baselineTraceDirectory, "target-schedule");
      const baselineTrace = buildTraceReportFromArtifacts({
        functionName: options.functionName,
        sourcePath: basePath,
        assemblyPath: baselineArtifacts.assembly,
        dumpDirectory: baselineTraceDirectory,
        outputDirectory: baselineScheduleDirectory,
        flags: baselineArtifacts.cc1Flags,
        reportFileName: "compiler-trace-report.json",
      });
      const baselineAssembly = parseCc1Assembly(baselineArtifacts.assembly);
      const baselineAnalysis = analyzeTargetScheduleFromArtifacts({
        functionName: options.functionName,
        trace: baselineTrace,
        target,
        candidate: baselineAssembly,
        outputDirectory: baselineScheduleDirectory,
        maxInterventions: spec.scheduleComparison.maxInterventions,
      });
      writeTargetScheduleArtifacts(
        baselineScheduleDirectory,
        baselineAnalysis,
        renderTargetSchedule(baselineAnalysis),
      );
      baselineProfile = deriveScheduleMechanismProfile({
        analysis: baselineAnalysis,
        trace: baselineTrace,
        variantId: "baseline",
        sourceHash: baseHash,
        assemblyHash: sha256(stableJson(baselineAssembly)),
      });
      writeScheduleProfileArtifacts(baselineScheduleDirectory, baselineProfile);
    }
  }

  const tracedClasses = new Map<string, { variantId: string; profile: ScheduleMechanismProfile }>();
  for (const variant of traceVariants.sort((left, right) => left.productIndex - right.productIndex)) {
    const result = results.get(variant.id);
    if (!result || !baselinePasses) continue;
    const directory = join(runRoot, "variants", variant.id);
    if (!existsSync(join(directory, `${options.functionName}.i.rtl`))) {
      await compileSourceAsync(variant.sourcePath, directory, options.functionName, {
        dumps: true,
        signal: abort.signal,
      });
    }
    const passes = loadPassSnapshots(directory, options.functionName);
    const comparison = comparePassSnapshots(baselinePasses, passes);
    result.traceArtifact = projectPath(directory);
    result.mechanismVerdicts = variant.lineage.choices.map((choice) => {
      const hypothesis: VariantHypothesis = {
        id: `${variant.id}:${choice.dimension}`,
        sourcePath: projectPath(variant.sourcePath),
        mechanism: choice.mechanism,
        expectedPass: choice.expectedPass,
        expectedEffect: choice.expectedEffect,
        invariants: variant.lineage.invariants,
      };
      return classifyHypothesis({
        hypothesis,
        status: result.exactInstructions === result.totalInstructions ? "exact" : "mismatch",
        passComparison: comparison,
        tracePasses: true,
        cc1Only: true,
        baseline: variant.sourceHash === baseHash,
      });
    });
    const dbr = passes.get("dbr");
    if (dbr) equivalences.push(...equivalenceClasses("dbr", [{ id: result.variantId, hash: dbr.hash }], lineages));

    if (spec.scheduleComparison.enabled && baselineProfile && result.assemblyHash) {
      try {
        const scheduleDirectory = join(directory, "target-schedule");
        const assemblyPath = join(directory, `${options.functionName}.s`);
        const report = buildTraceReportFromArtifacts({
          functionName: options.functionName,
          sourcePath: variant.sourcePath,
          assemblyPath,
          dumpDirectory: directory,
          outputDirectory: scheduleDirectory,
          flags: [...compilerFlags, "-da"],
          reportFileName: "compiler-trace-report.json",
        });
        const bundleHash = traceBundleHash(report, result.assemblyHash);
        result.traceBundleHash = bundleHash;
        const existing = tracedClasses.get(bundleHash);
        let profile: ScheduleMechanismProfile;
        if (existing) {
          result.traceEquivalentTo = existing.variantId;
          profile = {
            ...existing.profile,
            variantId: variant.id,
            sourceHash: variant.sourceHash,
            assemblyHash: result.assemblyHash,
          };
        } else {
          const variantAnalysis = analyzeTargetScheduleFromArtifacts({
            functionName: options.functionName,
            trace: report,
            target,
            outputDirectory: scheduleDirectory,
            maxInterventions: spec.scheduleComparison.maxInterventions,
          });
          writeTargetScheduleArtifacts(
            scheduleDirectory,
            variantAnalysis,
            renderTargetSchedule(variantAnalysis),
          );
          profile = deriveScheduleMechanismProfile({
            analysis: variantAnalysis,
            trace: report,
            variantId: variant.id,
            sourceHash: variant.sourceHash,
            assemblyHash: result.assemblyHash,
          });
          tracedClasses.set(bundleHash, { variantId: variant.id, profile });
        }
        const delta = compareScheduleMechanismProfiles(baselineProfile, profile);
        result.scheduleDelta = delta;
        result.scheduleProfileArtifact = projectPath(join(scheduleDirectory, "profile.json"));
        result.scheduleDeltaArtifact = projectPath(join(scheduleDirectory, "delta.json"));
        writeScheduleProfileArtifacts(scheduleDirectory, profile, delta);
      } catch (error) {
        result.scheduleAnalysisError = error instanceof Error ? error.message : String(error);
      }
    }
    persist(startProductIndex);
  }

  if (spec.scheduleComparison.enabled) {
    const propagateTrace = (duplicates: Map<string, string>): void => {
      for (const [duplicateId, representativeId] of duplicates) {
        const duplicate = results.get(duplicateId);
        const representative = results.get(representativeId);
        if (!duplicate || !representative?.traceBundleHash) continue;
        duplicate.traceBundleHash = representative.traceBundleHash;
        duplicate.traceEquivalentTo = representative.variantId;
        if (representative.traceArtifact) duplicate.traceArtifact = representative.traceArtifact;
        if (representative.scheduleProfileArtifact) duplicate.scheduleProfileArtifact = representative.scheduleProfileArtifact;
        if (representative.scheduleDeltaArtifact) duplicate.scheduleDeltaArtifact = representative.scheduleDeltaArtifact;
        if (representative.scheduleDelta) {
          duplicate.scheduleDelta = { ...representative.scheduleDelta, variantId: duplicate.variantId };
        }
        if (representative.scheduleAnalysisError) duplicate.scheduleAnalysisError = representative.scheduleAnalysisError;
      }
    };
    propagateTrace(preprocessingDuplicates);
    propagateTrace(sourceDuplicates);
    const traced = [...results.values()].filter((result) => result.traceBundleHash);
    equivalences.push(...equivalenceClasses("trace", traced.map((result) => ({
      id: result.variantId,
      hash: result.traceBundleHash!,
    })), lineages));
  }

  const fullGroups = assemblyGroups.filter((group) => {
    const result = results.get(group.representative)!;
    const stream = group.members.map((member) => compiledStreams.get(member)).find((item): item is NormalizedInstruction[] => Boolean(item));
    return spec.assembleUniqueDbr || (result.exactInstructions === result.totalInstructions && result.instructionCountExact) ||
      Boolean(stream && couldBecomeExactAfterAssembler(target, stream));
  });
  for (const group of fullGroups) {
    const representative = batch.variants.find((variant) => variant.id === group.representative);
    if (!representative) continue;
    const directory = join(runRoot, "variants", representative.id);
    await compileSourceAsync(representative.sourcePath, directory, options.functionName, { assemble: true, signal: abort.signal });
    const object = join(directory, `${options.functionName}.c.o`);
    const full = normalizeDisassembly(disassembleObject(object));
    const exact = compareNormalized(target, full);
    const fullExact = exact.exact === exact.total && full.length === target.length &&
      functionObjectsEqual(targetObject, object, directory);
    for (const member of group.members) {
      const result = results.get(member);
      const variant = batch.variants.find((item) => item.id === member);
      if (!result || !variant) continue;
      const fullEvaluation = evaluateAssembly({
        variantId: member,
        productIndex: result.productIndex,
        sourceHash: result.sourceHash,
        artifacts: result.artifacts,
        spec,
        ...(analysis ? { analysis } : {}),
        target,
        compiled: full,
      });
      result.requirementResults = fullEvaluation.requirementResults;
      result.preservedRanges = fullEvaluation.preservedRanges;
      result.hardConstraintsPassed = fullEvaluation.hardConstraintsPassed;
      result.opcodeStreamExact = fullEvaluation.opcodeStreamExact;
      result.instructionCountExact = fullEvaluation.instructionCountExact;
      result.exactInstructions = fullEvaluation.exactInstructions;
      result.totalInstructions = fullEvaluation.totalInstructions;
      result.fullObjectExact = fullExact;
      result.promotionEligible = fullExact && result.policyPassed && result.hardConstraintsPassed &&
        !result.requirementResults.some((item) => item.status === "regressed");
    }
    persist(startProductIndex);
  }

  if (sha256(readFileSync(basePath, "utf8")) !== baseHash) throw new Error("base source changed during search; refusing to continue");
  const allResults = [...results.values()];
  const ranked = rankSearchResults(allResults);
  const summary: SourceShapeSearchSummary = {
    schemaVersion: 1,
    function: options.functionName,
    runId,
    artifacts: projectPath(runRoot),
    productStart: startProductIndex,
    productEnd: batch.nextProductIndex,
    totalProducts: batch.totalProducts,
    unvisitedProducts: Math.max(0, batch.totalProducts - batch.nextProductIndex),
    resumed: options.resume,
    exactCc1Candidates: ranked.filter((result) => result.compiled && result.cc1Exact).map((result) => result.variantId),
    promotableCandidates: ranked.filter((result) => result.promotionEligible).map((result) => result.variantId),
    results: ranked,
    equivalenceClasses: equivalences,
    caveats: [
      "Generated variants are preserved under build/ and are never copied to src/.",
      "A cc1-only exact result is non-promotable until full configured assembly confirms the instruction/relocation stream.",
      "Mechanism and supported target-schedule deltas rank before raw exact-instruction count; exact function diff and full project verification remain external final gates.",
      "Machine-equivalent traced variants are deduplicated only after normalized compiler-trace fingerprinting; untraced variants never claim schedule equivalence.",
    ],
  };
  saveSummary(runRoot, summary);
  persist(batch.nextProductIndex);
  console.log(options.json ? JSON.stringify(summary, null, 2) : renderSourceShapeSummary(summary));
}

main().catch((error) => {
  console.error(`searchSourceShapes: ${error instanceof Error ? error.stack || error.message : error}`);
  process.exitCode = 1;
});
