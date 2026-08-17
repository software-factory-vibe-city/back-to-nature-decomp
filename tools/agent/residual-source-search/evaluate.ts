import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CPP_FLAGS, ROOT, runToolAsync, compileSourceAsync, disassembleObject } from "../decompToolchain.js";
import { evaluateRequirements, functionObjectsEqual } from "../source-shape-search/evaluator.js";
import { runWorkerPool } from "../source-shape-search/worker-pool.js";
import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import { projectPath, sha256, stableJson, writeStableJson } from "../variant-lab/artifacts.js";
import { normalizeDisassembly, parseCc1Assembly } from "../variant-lab/compile.js";
import { compareResidual, residualIsExact } from "./align.js";
import { residualAxes } from "./residual-axes.js";
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
  /** Assembly hashes whose one exact candidate has already been recorded. */
  exactedClasses: Set<string>;
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
    exactedClasses: new Set(),
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
  /**
   * Evaluate exactly these global ranks instead of sweeping the shard. Used by
   * the cost-report pilot, whose sample is stratified rather than contiguous.
   */
  ranks?: bigint[];
  /** Per-coordinate record file inside the run root; defaults to evaluated.jsonl. */
  jsonlName?: string;
  /**
   * Canonical source hash -> assembly hash recorded by an earlier pilot over
   * this same domain. A hit resolves the coordinate from the seeded class
   * instead of compiling it again.
   */
  warmByCanonical?: Map<string, string>;
}

export type StopReason = "complete" | "budget" | "aborted";

/**
 * True when the cc1 stream accounts for every target instruction the assembler
 * did not add. The two streams sit at different stages, so they are aligned
 * and stage-normalized before the question is asked.
 */
function couldBecomeExactAfterAssembler(target: NormalizedInstruction[], compiled: NormalizedInstruction[]): boolean {
  return residualIsExact(compareResidual(target, compiled));
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

/**
 * Where a class keeps its artifacts before the batch finishes. Worker
 * completion order is not the domain's order, so the class only earns its
 * `cNNNNN` identity once every coordinate in the batch has been seen.
 */
function pendingClassDirectory(runRoot: string, assemblyHash: string): string {
  return join(runRoot, "classes", `.pending-${assemblyHash.slice(0, 16)}`);
}

function byGlobalRank(left: { globalRank: string }, right: { globalRank: string }): number {
  const difference = BigInt(left.globalRank) - BigInt(right.globalRank);
  return difference > 0n ? 1 : difference < 0n ? -1 : 0;
}

/** Attach a coordinate to a class that already exists, without renaming it. */
function joinClass(item: CandidateClassRuntime, record: EvaluatedCandidate): void {
  item.members++;
  record.assemblyHash = item.hash;
  record.exactInstructions = item.exactInstructions;
  record.totalInstructions = item.totalInstructions;
  record.cc1Exact = item.cc1Exact;
  if (item.fullObjectExact !== undefined) record.fullObjectExact = item.fullObjectExact;
}

/**
 * Give this batch's new classes their deterministic identity. Ids and
 * representatives follow the domain's own rank order, so the same domain
 * always produces the same class report no matter how many workers ran.
 */
function finalizeBatchClasses(
  state: EvaluationState,
  runRoot: string,
  records: EvaluatedCandidate[],
  renderedByRank: Map<string, string>,
): void {
  const lowestRank = new Map<string, EvaluatedCandidate>();
  for (const record of records) {
    if (!record.assemblyHash) continue;
    const best = lowestRank.get(record.assemblyHash);
    if (!best || byGlobalRank(record, best) < 0) lowestRank.set(record.assemblyHash, record);
  }

  const fresh = [...state.classes.values()].filter((item) => item.classId.length === 0);
  for (const item of fresh) {
    const representative = lowestRank.get(item.hash);
    if (representative) item.representativeRank = representative.globalRank;
  }
  let next = state.classes.size - fresh.length;
  for (const item of fresh.sort((left, right) => byGlobalRank(
    { globalRank: left.representativeRank }, { globalRank: right.representativeRank }))) {
    item.classId = `c${String(next++).padStart(5, "0")}`;
    const from = pendingClassDirectory(runRoot, item.hash);
    const to = join(runRoot, "classes", item.classId);
    if (existsSync(from)) {
      rmSync(to, { recursive: true, force: true });
      renameSync(from, to);
      item.artifacts = projectPath(to);
      /* The class was created by whichever worker finished first; the source
       * it keeps is the one its reported rank actually renders. */
      const source = renderedByRank.get(item.representativeRank);
      if (source !== undefined) writeFileSync(join(to, "source.c"), source);
    }
  }

  for (const record of [...records].sort(byGlobalRank)) {
    const item = record.assemblyHash ? state.classes.get(record.assemblyHash) : undefined;
    if (!item) continue;
    if (record.globalRank !== item.representativeRank) record.equivalentTo = item.representativeRank;
    else delete record.equivalentTo;
    if (item.fullObjectExact && !state.exactedClasses.has(item.hash)) {
      state.exactedClasses.add(item.hash);
      record.stage = "confirmed-exact";
      state.exacts.push({
        globalRank: record.globalRank,
        canonicalHash: record.canonicalHash,
        artifacts: item.artifacts ?? projectPath(join(runRoot, "classes", item.classId)),
      });
    }
  }
}

export async function evaluateDomain(options: EvaluateRunOptions): Promise<StopReason> {
  const { domain, shard, state } = options;
  const explicitRanks = options.ranks;
  const total = explicitRanks ? BigInt(explicitRanks.length) : shardSize(domain.total, shard);
  const rankAt = (localIndex: bigint): bigint =>
    explicitRanks ? explicitRanks[Number(localIndex)]! : shardRank(shard, localIndex);
  const canonicalCap = options.canonicalCap ?? 2_000_000;
  const batchSize = Math.max(16, options.jobs * 8);
  const jsonlPath = join(options.runRoot, options.jsonlName ?? "evaluated.jsonl");
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

  /**
   * Retain the artifacts that belong to the class rather than to one member.
   * `source.c` is rewritten with the representative's text once the batch has
   * settled, so it always matches the rank the class reports.
   */
  const retainClass = (directory: string, sourceText: string, workDirectory: string, full: boolean): void => {
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "source.c"), sourceText);
    if (full) {
      const artifacts: Array<[string, string]> = [
        [`${options.functionName}.s`, "compiler.s"],
        [`${options.functionName}.c.o`, "object.o"],
      ];
      for (const [from, to] of artifacts) {
        const path = join(workDirectory, from);
        if (existsSync(path)) copyFileSync(path, join(directory, to));
      }
    }
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
    const renderedByRank = new Map<string, string>();
    for (let offset = 0; offset < batchCount; offset++) {
      const shardLocal = state.nextShardIndex + BigInt(offset);
      const globalRank = rankAt(shardLocal);
      const plan = candidateAt(domain, globalRank);
      const sourceText = renderCandidate(options.source, options.graph, options.view, plan);
      const canonicalHash = canonicalSourceHash(sourceText, options.canonical);
      renderedByRank.set(globalRank.toString(), sourceText);
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

      /* A pilot over this same domain already compiled this exact source. */
      const warmAssembly = options.warmByCanonical?.get(canonicalHash);
      const warmClass = warmAssembly !== undefined ? state.classes.get(warmAssembly) : undefined;
      if (warmClass) {
        joinClass(warmClass, record);
        records.push(record);
        continue;
      }

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
      const knownClass = knownAssembly !== undefined ? state.classes.get(knownAssembly) : undefined;
      if (knownClass) {
        joinClass(knownClass, candidate.record);
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
        joinClass(existing, candidate.record);
        return undefined;
      }

      const comparison = compareResidual(target, compiled);
      const cc1Exact = residualIsExact(comparison);
      const requirementResults = evaluateRequirements(options.analysis, target, compiled)
        .map((item) => ({ requirementId: item.requirementId, status: item.status }));
      const classRecord: CandidateClassRuntime = {
        classId: "",
        stage: "assembly",
        hash: assemblyHash,
        representativeRank: candidate.record.globalRank,
        members: 1,
        exactInstructions: comparison.exact,
        totalInstructions: comparison.total,
        cc1Exact,
        residual: residualAxes({ target, candidate: compiled, comparison }),
        requirementResults,
      };
      if (comparison.firstDivergence) classRecord.firstDivergenceStage = comparison.firstDivergence;
      /* Claim the class before the next await: two coordinates that compile to
       * the same assembly concurrently must not both create it. */
      state.classes.set(assemblyHash, classRecord);
      candidate.record.exactInstructions = comparison.exact;
      candidate.record.totalInstructions = comparison.total;
      candidate.record.cc1Exact = cc1Exact;

      const directory = pendingClassDirectory(options.runRoot, assemblyHash);
      if (cc1Exact || couldBecomeExactAfterAssembler(target, compiled)) {
        try {
          await compileSourceAsync(sourcePath, workDirectory, options.functionName, { assemble: true, signal: options.signal });
          const objectPath = join(workDirectory, `${options.functionName}.c.o`);
          const full = normalizeDisassembly(disassembleObject(objectPath));
          const fullComparison = compareResidual(target, full);
          const fullExact = residualIsExact(fullComparison) &&
            options.targetObject !== undefined && functionObjectsEqual(options.targetObject, objectPath, workDirectory);
          classRecord.fullObjectExact = fullExact;
          candidate.record.fullObjectExact = fullExact;
          retainClass(directory, candidate.sourceText, workDirectory, true);
          writeStableJson(join(directory, "comparison.json"), { target, compiled: full });
          if (!fullExact && options.targetObject === undefined) {
            state.caveats.add("no target object was supplied; cc1-exact classes could not be confirmed against relocations");
          }
        } catch (error) {
          candidate.record.compileError = `assemble: ${error instanceof Error ? (error.message.split("\n")[0] || error.message) : error}`;
        }
      } else {
        retainClass(directory, candidate.sourceText, workDirectory, false);
        writeStableJson(join(directory, "comparison.json"), { target, compiled });
      }
      return undefined;
    }

    finalizeBatchClasses(state, options.runRoot, records, renderedByRank);
    appendFileSync(jsonlPath, records.map((record) => `${JSON.stringify(record)}\n`).join(""));
    state.nextShardIndex += BigInt(batchCount);
    state.evaluatedCount += BigInt(batchCount);
    evaluatedThisRun += batchCount;
    options.persist(state);
  }
  return "complete";
}
