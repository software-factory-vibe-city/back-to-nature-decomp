import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CPP_FLAGS, ROOT, runToolAsync, compileSourceAsync, disassembleObject } from "../decompToolchain.js";
import { evaluateRequirements, functionObjectsEqual } from "../source-shape-search/evaluator.js";
import { runWorkerPool } from "../source-shape-search/worker-pool.js";
import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import { projectPath, sha256, stableJson, writeStableJson } from "../variant-lab/artifacts.js";
import { compareNormalized, normalizeDisassembly, parseCc1Assembly } from "../variant-lab/compile.js";
import { findEmptyMemoryBarriers, findGeneratedGlobalDefinitions, validateVariantSource } from "../variant-lab/manifest.js";
import type { NormalizedInstruction } from "../variant-lab/types.js";
import { canonicalSourceHash, type CanonicalContext } from "./canonicalize.js";
import { candidateAt, shardRank, shardSize, type DomainRuntime, type ShardSpec } from "./enumerate.js";
import { renderCandidate } from "./render.js";
import type { WebView } from "./web-partitions.js";
import type { BaselineBundle, CandidateClass, EvaluatedCandidate, SemanticGraph } from "./types.js";

export interface CandidateClassRuntime extends CandidateClass {
  requirementSummary?: string;
}

export interface EvaluationState {
  classes: Map<string, CandidateClassRuntime>;
  preprocessedToAssembly: Map<string, string>;
  canonicalSeen: Map<string, string>;
  exacts: Array<{ globalRank: string; canonicalHash: string; artifacts: string }>;
  evaluatedCount: bigint;
  /** Shard-local index this run started at (non-zero for targeted campaigns). */
  startIndex: bigint;
  nextShardIndex: bigint;
  caveats: Set<string>;
}

export function freshEvaluationState(): EvaluationState {
  return {
    classes: new Map(),
    preprocessedToAssembly: new Map(),
    canonicalSeen: new Map(),
    exacts: [],
    evaluatedCount: 0n,
    startIndex: 0n,
    nextShardIndex: 0n,
    caveats: new Set(),
  };
}

export interface EvaluateRunOptions {
  functionName: string;
  runRoot: string;
  source: string;
  graph: SemanticGraph;
  view: WebView;
  domain: DomainRuntime;
  bundle: BaselineBundle;
  analysis: TargetScheduleAnalysis;
  canonical: CanonicalContext;
  targetObject?: string;
  shard: ShardSpec;
  jobs: number;
  maxCandidates?: number;
  state: EvaluationState;
  persist: (state: EvaluationState) => void;
  signal?: AbortSignal;
  canonicalCap?: number;
}

export type StopReason = "complete" | "budget" | "aborted";

function couldBecomeExactAfterAssembler(target: NormalizedInstruction[], compiled: NormalizedInstruction[]): boolean {
  const withoutNops = target.filter((instruction) => instruction.mnemonic !== "nop");
  return withoutNops.length === compiled.length &&
    withoutNops.every((instruction, index) => instruction.canonical === compiled[index]!.canonical);
}

function preprocessedSemanticHashText(content: string): string {
  return sha256(content
    .split("\n")
    .filter((line) => !/^\s*#/.test(line) && line.trim().length > 0)
    .map((line) => line.trimEnd())
    .join("\n"));
}

interface PendingCandidate {
  record: EvaluatedCandidate;
  sourceText: string;
}

export async function evaluateDomain(options: EvaluateRunOptions): Promise<StopReason> {
  const { domain, shard, state } = options;
  const total = shardSize(domain.total, shard);
  const canonicalCap = options.canonicalCap ?? 2_000_000;
  const batchSize = Math.max(16, options.jobs * 8);
  const jsonlPath = join(options.runRoot, "evaluated.jsonl");
  const baselineBarriers = findEmptyMemoryBarriers(options.source);
  const target = options.bundle.target;
  let evaluatedThisRun = 0;

  const barrierPreserved = (candidate: string): boolean => {
    const barriers = findEmptyMemoryBarriers(candidate);
    return barriers.length === baselineBarriers.length &&
      barriers.every((barrier, index) => barrier.normalized === baselineBarriers[index]!.normalized);
  };

  /* A TU-owned generated-global definition is part of the baseline mechanism:
   * dropping one changes how the assembler addresses the symbol, which would
   * move instructions outside the residual under test. */
  const inheritedGeneratedGlobals = findGeneratedGlobalDefinitions(options.source).map((definition) => definition.symbol);
  const generatedGlobalsPreserved = (candidate: string): boolean => {
    const present = findGeneratedGlobalDefinitions(candidate).map((definition) => definition.symbol).sort();
    const expected = [...inheritedGeneratedGlobals].sort();
    return present.length === expected.length && present.every((symbol, index) => symbol === expected[index]);
  };

  const retainClass = (classId: string, sourceText: string, workDirectory: string, full: boolean): string => {
    const directory = join(options.runRoot, "classes", classId);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "source.c"), sourceText);
    if (full) {
      const artifacts: Array<[string, string]> = [
        ["source.i", "preprocessed.i"],
        [`${options.functionName}.s`, "compiler.s"],
        [`${options.functionName}.c.o`, "object.o"],
      ];
      for (const [from, to] of artifacts) {
        const path = join(workDirectory, from);
        if (existsSync(path)) copyFileSync(path, join(directory, to));
      }
    }
    return projectPath(directory);
  };

  /* Exclusive per-worker scratch directories. */
  const freeSlots: number[] = Array.from({ length: options.jobs }, (_unused, index) => index);

  while (state.nextShardIndex < total) {
    if (options.signal?.aborted) return "aborted";
    if (options.maxCandidates !== undefined && evaluatedThisRun >= options.maxCandidates) return "budget";

    const batchBudget = options.maxCandidates !== undefined
      ? Math.min(batchSize, options.maxCandidates - evaluatedThisRun)
      : batchSize;
    const batchCount = Number(total - state.nextShardIndex < BigInt(batchBudget)
      ? total - state.nextShardIndex
      : BigInt(batchBudget));

    const records: EvaluatedCandidate[] = [];
    const pending: PendingCandidate[] = [];
    for (let offset = 0; offset < batchCount; offset++) {
      const shardLocal = state.nextShardIndex + BigInt(offset);
      const globalRank = shardRank(shard, shardLocal);
      const plan = candidateAt(domain, globalRank);
      const sourceText = renderCandidate(options.source, options.graph, options.view, plan);
      const canonicalHash = canonicalSourceHash(sourceText, options.canonical);
      const record: EvaluatedCandidate = {
        globalRank: globalRank.toString(),
        coordinate: plan.coordinate,
        canonicalHash,
        stage: "compared",
      };
      const seen = state.canonicalSeen.get(canonicalHash);
      if (seen !== undefined) {
        record.stage = "canonical-duplicate";
        record.equivalentTo = seen;
        records.push(record);
        continue;
      }
      if (state.canonicalSeen.size < canonicalCap) state.canonicalSeen.set(canonicalHash, record.globalRank);
      else state.caveats.add(`canonical-duplicate detection stopped after ${canonicalCap} entries; later duplicates recompile without affecting coverage`);

      const findings = validateVariantSource(sourceText, {
        allowEmptyMemoryBarriers: baselineBarriers.length > 0,
        inheritedGeneratedGlobals,
      });
      if (findings.length > 0 || !barrierPreserved(sourceText) || !generatedGlobalsPreserved(sourceText)) {
        record.stage = "policy-failed";
        record.policyError = findings.length > 0
          ? `line ${findings[0]!.line}: ${findings[0]!.message}`
          : !barrierPreserved(sourceText)
            ? "candidate did not preserve the inherited empty memory barriers exactly and in order"
            : "candidate did not preserve the inherited translation-unit-owned generated-global definitions";
        records.push(record);
        continue;
      }
      record.sourceHash = sha256(sourceText);
      records.push(record);
      pending.push({ record, sourceText });
    }

    await runWorkerPool(pending, options.jobs, async (candidate) => {
      const slot = freeSlots.pop();
      if (slot === undefined) throw new Error("internal: worker slot pool exhausted");
      try {
        return await evaluateOne(candidate, slot);
      } finally {
        freeSlots.push(slot);
      }
    });

    async function evaluateOne(candidate: PendingCandidate, slot: number): Promise<undefined> {
      const workDirectory = join(options.runRoot, "work", `w${slot}`);
      mkdirSync(workDirectory, { recursive: true });
      const sourcePath = join(workDirectory, "source.c");
      const preprocessedPath = join(workDirectory, "source.i");
      writeFileSync(sourcePath, candidate.sourceText);
      try {
        await runToolAsync("mips-linux-gnu-cpp", [...CPP_FLAGS, sourcePath, "-o", preprocessedPath], ROOT, options.signal);
      } catch (error) {
        candidate.record.stage = "preprocess-failed";
        candidate.record.compileError = error instanceof Error ? (error.message.split("\n")[0] || error.message) : String(error);
        return undefined;
      }
      const preprocessedHash = preprocessedSemanticHashText(readFileSync(preprocessedPath, "utf8"));
      candidate.record.preprocessedHash = preprocessedHash;
      const knownAssembly = state.preprocessedToAssembly.get(preprocessedHash);
      if (knownAssembly !== undefined) {
        const existing = state.classes.get(knownAssembly)!;
        existing.members++;
        candidate.record.assemblyHash = knownAssembly;
        candidate.record.equivalentTo = existing.representativeRank;
        candidate.record.exactInstructions = existing.exactInstructions;
        candidate.record.totalInstructions = existing.totalInstructions;
        candidate.record.cc1Exact = existing.cc1Exact;
        if (existing.fullObjectExact !== undefined) candidate.record.fullObjectExact = existing.fullObjectExact;
        return undefined;
      }
      try {
        await compileSourceAsync(sourcePath, workDirectory, options.functionName, { signal: options.signal });
      } catch (error) {
        candidate.record.stage = "compile-failed";
        candidate.record.compileError = error instanceof Error ? (error.message.split("\n")[0] || error.message) : String(error);
        return undefined;
      }
      const compiled = parseCc1Assembly(join(workDirectory, `${options.functionName}.s`));
      const assemblyHash = sha256(stableJson(compiled));
      candidate.record.assemblyHash = assemblyHash;
      if (state.preprocessedToAssembly.size < canonicalCap) state.preprocessedToAssembly.set(preprocessedHash, assemblyHash);

      const existing = state.classes.get(assemblyHash);
      if (existing) {
        existing.members++;
        candidate.record.equivalentTo = existing.representativeRank;
        candidate.record.exactInstructions = existing.exactInstructions;
        candidate.record.totalInstructions = existing.totalInstructions;
        candidate.record.cc1Exact = existing.cc1Exact;
        if (existing.fullObjectExact !== undefined) candidate.record.fullObjectExact = existing.fullObjectExact;
        return undefined;
      }

      const comparison = compareNormalized(target, compiled);
      const cc1Exact = comparison.exact === comparison.total && compiled.length === target.length;
      const classId = `c${String(state.classes.size).padStart(5, "0")}`;
      const requirementResults = evaluateRequirements(options.analysis, target, compiled)
        .map((item) => ({ requirementId: item.requirementId, status: item.status }));
      const classRecord: CandidateClassRuntime = {
        classId,
        stage: "assembly",
        hash: assemblyHash,
        representativeRank: candidate.record.globalRank,
        members: 1,
        exactInstructions: comparison.exact,
        totalInstructions: comparison.total,
        cc1Exact,
        requirementResults,
      };
      if (comparison.firstDivergence) classRecord.firstDivergenceStage = comparison.firstDivergence;
      candidate.record.exactInstructions = comparison.exact;
      candidate.record.totalInstructions = comparison.total;
      candidate.record.cc1Exact = cc1Exact;

      if (cc1Exact || couldBecomeExactAfterAssembler(target, compiled)) {
        try {
          await compileSourceAsync(sourcePath, workDirectory, options.functionName, { assemble: true, signal: options.signal });
          const objectPath = join(workDirectory, `${options.functionName}.c.o`);
          const full = normalizeDisassembly(disassembleObject(objectPath));
          const fullComparison = compareNormalized(target, full);
          const fullExact = fullComparison.exact === fullComparison.total && full.length === target.length &&
            options.targetObject !== undefined && functionObjectsEqual(options.targetObject, objectPath, workDirectory);
          classRecord.fullObjectExact = fullExact;
          candidate.record.fullObjectExact = fullExact;
          const artifacts = retainClass(classId, candidate.sourceText, workDirectory, true);
          classRecord.artifacts = artifacts;
          writeStableJson(join(options.runRoot, "classes", classId, "comparison.json"), { target, compiled: full });
          if (fullExact) {
            candidate.record.stage = "confirmed-exact";
            state.exacts.push({
              globalRank: candidate.record.globalRank,
              canonicalHash: candidate.record.canonicalHash,
              artifacts,
            });
          } else if (options.targetObject === undefined) {
            state.caveats.add("no target object was supplied; cc1-exact classes could not be confirmed against relocations");
          }
        } catch (error) {
          candidate.record.compileError = `assemble: ${error instanceof Error ? (error.message.split("\n")[0] || error.message) : error}`;
        }
      } else {
        const artifacts = retainClass(classId, candidate.sourceText, workDirectory, false);
        classRecord.artifacts = artifacts;
        writeStableJson(join(options.runRoot, "classes", classId, "comparison.json"), { target, compiled });
      }
      state.classes.set(assemblyHash, classRecord);
      return undefined;
    }

    appendFileSync(jsonlPath, records.map((record) => `${JSON.stringify(record)}\n`).join(""));
    state.nextShardIndex += BigInt(batchCount);
    state.evaluatedCount += BigInt(batchCount);
    evaluatedThisRun += batchCount;
    options.persist(state);
  }
  return "complete";
}
