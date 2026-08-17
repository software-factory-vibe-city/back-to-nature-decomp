import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, configuredToolchainIdentity } from "../decompToolchain.js";
import { projectPath, sha256, stableJson, writeStableJson } from "../variant-lab/artifacts.js";
import type { NormalizedInstruction } from "../variant-lab/types.js";
import {
  computeIdentityHash,
  computeRunId,
  residualImplementationHash,
  writeDerivationArtifacts,
} from "./artifacts.js";
import { canonicalContext } from "./canonicalize.js";
import { checkpointPath, loadSearchCheckpoint, validateSearchCheckpoint, writeSearchCheckpoint } from "./checkpoint.js";
import { closureRefusal, deriveCausalClosure } from "./compiler-closure.js";
import {
  calibrateCandidateCost,
  defaultJobs,
  domainAxes,
  grammarAxes,
  loadEstimate,
  median,
  pilotRanks,
  projectWallMs,
  writeEstimate,
  type PilotArtifact,
} from "./cost-report.js";
import { coverageReport, terminalStatus } from "./coverage.js";
import { measureAxisEffects } from "./axis-effect.js";
import { compareResidualAxes } from "./residual-axes.js";
import { buildDomain, sdkCallOrderRegions, shardSize, type DomainRuntime, type ShardSpec } from "./enumerate.js";
import { evaluateDomain, freshEvaluationState, type CandidateClassRuntime, type EvaluationState } from "./evaluate.js";
import { loadMacroRegistry } from "./macro-forms.js";
import { renderResidualSummary } from "./render-text.js";
import { deriveGrammar } from "./rewrite-catalog.js";
import { buildSemanticGraph, immediateValues } from "./semantic-graph.js";
import { establishBaseline } from "./source-input.js";
import { analyzeWebs } from "./web-partitions.js";
import { discoverWitness } from "./witness.js";
import {
  RESIDUAL_GRAMMAR_SCHEMA_VERSION,
  RESIDUAL_SEARCH_SCHEMA_VERSION,
  type CostEstimate,
  type ResidualSearchSummary,
  type RunTiming,
  type SearchCheckpoint,
  type TerminalStatus,
} from "./types.js";

export interface RunResidualSearchOptions {
  functionName: string;
  sourcePath: string;
  deriveOnly?: boolean;
  /**
   * Worker count. The CLI never sets this: it is derived from the CPU count.
   * Tests pin it so their wall time and scheduling stay predictable.
   */
  jobs?: number;
  /**
   * Test-only interruption seam: stop after this many coordinates so the
   * automatic checkpoint and resume path can be exercised. This is not an
   * operator budget — a run is exhaustive by definition and the CLI exposes
   * no way to cap it.
   */
  interruptAfter?: number;
  /** Override the run directory (tests); defaults to build/residualSourceSearch/<fn>/<runId>. */
  runRootOverride?: string;
  /** Override the witness discovery root (tests); defaults to build/schedulerConstraint/<fn>. */
  witnessRootOverride?: string;
  /** Injected target stream and object (tests); default resolves project artifacts. */
  target?: NormalizedInstruction[];
  targetObjectPath?: string;
  signal?: AbortSignal;
}

/** A run always covers the whole domain, so there is exactly one shard. */
const WHOLE_DOMAIN: ShardSpec = { index: 1, count: 1 };

/** The lever that is not a knob, printed with every projection. */
/** No class table was produced at all, so nothing can be read as a ranking. */
const NO_CLASSES = { sampled: false, evaluatedCandidates: "0", totalCandidates: "0" } as const;

const RESIDUAL_LEVER =
  "The only lever on this cost is the residual itself: a smaller machine diff " +
  "produces a smaller causal closure, which produces a smaller domain.";

function stateToCheckpoint(
  options: { functionName: string; runId: string; identityHash: string; shard: ShardSpec },
  state: EvaluationState,
): SearchCheckpoint {
  const checkpoint: SearchCheckpoint = {
    schemaVersion: RESIDUAL_SEARCH_SCHEMA_VERSION,
    function: options.functionName,
    runId: options.runId,
    identityHash: options.identityHash,
    evaluatedRanges: state.nextShardIndex > state.startIndex
      ? [[state.startIndex.toString(), (state.nextShardIndex - 1n).toString()]]
      : [],
    evaluatedCount: state.evaluatedCount.toString(),
    classes: [...state.classes.values()],
    exactCandidates: state.exacts,
  };
  if (options.shard.count > 1) checkpoint.shard = { index: options.shard.index, count: options.shard.count };
  return checkpoint;
}

/**
 * Seed the classes a pilot already established, with their member counts reset
 * so the full sweep does the counting. Class ids stay a contiguous prefix, so
 * ids minted later by the sweep cannot collide with a seeded one.
 */
function seedPilotClasses(state: EvaluationState, artifact: PilotArtifact): Map<string, string> {
  for (const item of [...artifact.classes].sort((left, right) => left.classId.localeCompare(right.classId))) {
    state.classes.set(item.hash, { ...item, members: 0 } as CandidateClassRuntime);
  }
  return new Map(artifact.canonicalToAssembly);
}

function checkpointToState(checkpoint: SearchCheckpoint): EvaluationState {
  const state = freshEvaluationState();
  state.startIndex = checkpoint.evaluatedRanges.length > 0
    ? BigInt(checkpoint.evaluatedRanges[0]![0])
    : 0n;
  state.nextShardIndex = checkpoint.evaluatedRanges.length > 0
    ? BigInt(checkpoint.evaluatedRanges[0]![1]) + 1n
    : state.startIndex;
  state.evaluatedCount = BigInt(checkpoint.evaluatedCount);
  for (const item of checkpoint.classes) {
    state.classes.set(item.hash, { ...item } as CandidateClassRuntime);
    if (item.fullObjectExact) state.exactedClasses.add(item.hash);
  }
  state.exacts = [...checkpoint.exactCandidates];
  state.caveats.add("resumed run: canonical and preprocessed dedupe caches restart empty; coverage accounting is unaffected");
  return state;
}

/**
 * Best first, by residual rather than by match count.
 *
 * A match count ranks a lucky register assignment above a fixed cause: an edit
 * that removes the reason for a difference rotates everything downstream of
 * it, matching fewer words while standing closer. The axes are ordered worst
 * kind first, so a class that trades population for allocation sorts below one
 * that does not, whatever the counts say. Count remains the last tiebreak, for
 * classes the axes cannot separate.
 */
function rankClasses(state: EvaluationState): CandidateClassRuntime[] {
  return [...state.classes.values()].sort((left, right) =>
    Number(Boolean(right.fullObjectExact)) - Number(Boolean(left.fullObjectExact)) ||
    Number(right.cc1Exact) - Number(left.cc1Exact) ||
    (left.residual && right.residual ? compareResidualAxes(left.residual, right.residual) : 0) ||
    right.exactInstructions - left.exactInstructions ||
    left.classId.localeCompare(right.classId));
}

export async function runResidualSourceSearch(options: RunResidualSearchOptions): Promise<ResidualSearchSummary> {
  const functionName = options.functionName;
  const source = readFileSync(options.sourcePath, "utf8");
  const sourceHash = sha256(source);
  const toolchainHash = sha256(stableJson(configuredToolchainIdentity()));
  const implementationHash = residualImplementationHash();
  const runId = computeRunId({ functionName, sourceHash, toolchainHash, implementationHash });
  const runRoot = options.runRootOverride ?? join(ROOT, "build/residualSourceSearch", functionName, runId);
  mkdirSync(runRoot, { recursive: true });
  const shard = WHOLE_DOMAIN;
  const jobs = options.jobs ?? defaultJobs();
  const startedAt = process.hrtime.bigint();

  const summaryBase = {
    schemaVersion: RESIDUAL_SEARCH_SCHEMA_VERSION,
    function: functionName,
    runId,
    artifacts: projectPath(runRoot),
  } as const;
  const finish = (summary: ResidualSearchSummary): ResidualSearchSummary => {
    writeStableJson(join(runRoot, "summary.json"), summary);
    writeFileSync(join(runRoot, "summary.txt"), `${renderResidualSummary(summary)}\n`);
    return summary;
  };
  const refusalSummary = (status: TerminalStatus, detail: string, caveats: string[] = []): ResidualSearchSummary =>
    finish({ ...summaryBase, status, statusDetail: detail, classes: [], classesSource: NO_CLASSES, exactCandidates: [], caveats });

  /* Deliverable 1: eligibility and immutable baseline bundle. */
  const baselineOptions: Parameters<typeof establishBaseline>[0] = {
    functionName,
    sourcePath: options.sourcePath,
    runRoot,
  };
  if (options.target) baselineOptions.target = options.target;
  if (options.targetObjectPath) baselineOptions.targetObjectPath = options.targetObjectPath;
  const baseline = establishBaseline(baselineOptions);
  if (baseline.refusal && baseline.refusal.status !== "exact") {
    return refusalSummary(baseline.refusal.status, baseline.refusal.reason, baseline.refusal.evidence);
  }
  const bundle = baseline.bundle!;
  const baselineSummary = {
    exactInstructions: bundle.exactInstructions,
    totalInstructions: bundle.totalInstructions,
    category: bundle.category,
  };
  if (baseline.refusal) {
    return finish({
      ...summaryBase,
      status: "exact",
      statusDetail: baseline.refusal.reason,
      baseline: baselineSummary,
      classes: [],
      classesSource: NO_CLASSES,
      exactCandidates: [],
      caveats: baseline.refusal.evidence,
    });
  }

  /* Deliverables 2-3: semantic graph and diff-seeded causal closure. */
  const registry = loadMacroRegistry();
  const graph = buildSemanticGraph(functionName, projectPath(options.sourcePath), source, registry);
  const view = analyzeWebs(graph);
  const closure = deriveCausalClosure({
    graph,
    view,
    bundle,
    trace: baseline.trace!,
    analysis: baseline.analysis!,
    registry,
    dumpDirectory: baseline.lineNoteDirectory ?? join(runRoot, "baseline"),
    sourceFileName: options.sourcePath,
  });
  const closureBlock = {
    nodes: closure.nodeIds.length,
    webs: closure.webIds.length,
    uids: closure.uids.length,
    pseudos: closure.pseudos.length,
    wholeFunction: closure.wholeFunction,
  };
  const refusedByClosure = closureRefusal(closure, graph);
  if (refusedByClosure) {
    return finish({
      ...summaryBase,
      status: refusedByClosure.status,
      statusDetail: refusedByClosure.reason,
      baseline: baselineSummary,
      closure: closureBlock,
      classes: [],
      classesSource: NO_CLASSES,
      exactCandidates: [],
      caveats: refusedByClosure.evidence,
    });
  }

  /* Deliverables 4-5: automatic grammar and exact domain counting. */
  const mismatchImmediates = [...new Set(bundle.mismatchedTargetIndexes
    .flatMap((index) => immediateValues(bundle.target[index]?.canonical ?? "")))];
  const deriveOptions: Parameters<typeof deriveGrammar>[0] = { graph, view, closure, source, registry, mismatchImmediates };
  const witness = discoverWitness(functionName, options.witnessRootOverride);
  if (witness) deriveOptions.witness = witness;
  if (options.partitionCap !== undefined) deriveOptions.partitionCap = options.partitionCap;
  const derived = deriveGrammar(deriveOptions);

  /* SDK-call-order accounting rides on the statement-order coordinates the
   * grammar already produces; it is recorded before either artifact write so
   * a domain-too-large run still names the regions it recognized. */
  const sdkRegions = sdkCallOrderRegions({ graph, view, derived });
  if (sdkRegions.length > 0) {
    derived.grammar.sdkCallOrderRegions = sdkRegions;
    if (sdkRegions.some((region) => region.admittedOrders !== "0")) {
      derived.grammar.activeRules = [...derived.grammar.activeRules, "sdk-call-order"];
    }
    for (const region of sdkRegions.filter((entry) => entry.admittedOrders === "0")) {
      derived.grammar.suppressedRules.push({
        rule: "sdk-call-order",
        reason: region.suppressionReasons.join("; "),
        evidence: region.calls.map((call) => `${call.nodeId} ${call.macro} at line ${call.span.lineStart}`),
      });
    }
  }

  /* A grammar that is already beyond the enumerable bound gets its per-axis
   * breakdown and nothing else: the breakdown names the axis responsible,
   * which is what an operator needs, and building a domain that cannot be
   * serialized would only trade that answer for an exhausted process. */
  const tooLarge = (detail: string): ResidualSearchSummary => {
    writeDerivationArtifacts(runRoot, { bundle, graph, closure, grammar: derived.grammar });
    return finish({
      ...summaryBase,
      status: "domain-too-large",
      statusDetail: detail,
      baseline: baselineSummary,
      closure: closureBlock,
      estimate: {
        totalCandidates: "unknown",
        axes: grammarAxes({ graph, view, derived }),
        perCandidateMs: 0,
        calibrationSamplesMs: [],
        duplicateRate: 0,
        pilot: { size: 0, ranks: [], wallMs: 0, duplicates: 0, compiled: 0, observedPerCandidateMs: 0 },
        jobs,
        projectedMs: null,
      },
      classes: [],
      classesSource: NO_CLASSES,
      exactCandidates: [],
      caveats: [...bundle.caveats, ...graph.caveats, ...closure.caveats, ...derived.grammar.caveats, RESIDUAL_LEVER],
    });
  };

  if (derived.tooLarge) return tooLarge(derived.tooLarge);
  let domain: DomainRuntime;
  try {
    domain = buildDomain({ graph, view, derived });
  } catch (error) {
    return tooLarge(`exact domain construction failed: ${error instanceof Error ? error.message : error}`);
  }
  const hashes = writeDerivationArtifacts(runRoot, {
    bundle,
    graph,
    closure,
    grammar: derived.grammar,
    domain: domain.domain,
  });
  const identityHash = computeIdentityHash({
    runId,
    bundleHash: hashes.bundleHash,
    grammarHash: hashes.grammarHash,
    domainTotal: domain.total.toString(),
  });
  const domainBlock = {
    partitions: domain.partitions.length,
    regions: derived.regions.length,
    totalCandidates: domain.total.toString(),
  };
  /* Before anything is priced or evaluated: does each counted digit move the
   * program? An inert axis inflates the total and the projection, and reads
   * afterwards as an axis that was searched. */
  const axisEffects = measureAxisEffects({ source, graph, view, domain });
  writeStableJson(join(runRoot, "axis-effect.json"), { function: functionName, runId, axes: axisEffects.axes });

  const derivationCaveats = [
    ...bundle.caveats,
    ...graph.caveats,
    ...closure.caveats,
    ...derived.grammar.caveats,
    ...domain.caveats,
    ...axisEffects.caveats,
  ];

  /* Baseline drift gate before any compilation, estimate included. */
  if (sha256(readFileSync(options.sourcePath, "utf8")) !== sourceHash) {
    return refusalSummary("baseline-drift", "the input source changed while the run was being derived");
  }

  const targetObject = baseline.targetObject ?? options.targetObjectPath;
  const evaluationBase = {
    functionName,
    runRoot,
    source,
    graph,
    view,
    domain,
    bundle,
    analysis: baseline.analysis!,
    canonical: canonicalContext(graph, source),
    shard,
    jobs,
    ...(targetObject !== undefined ? { targetObject } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  } as const;

  /* Phase 1: the cost report. The domain size is exact already; the pilot
   * supplies the duplicate rate and the calibration supplies the per-candidate
   * cost, so the price of a full run is known before it is launched. */
  if (options.deriveOnly) {
    const ranks = pilotRanks(domain.total);
    const calibrationSamplesMs = await calibrateCandidateCost({
      sourcePath: options.sourcePath,
      functionName,
      workDirectory: join(runRoot, "calibration"),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    const perCandidateMs = median(calibrationSamplesMs);

    const pilotState = freshEvaluationState();
    rmSync(pilotJsonlPath(runRoot), { force: true });
    const pilotStarted = process.hrtime.bigint();
    if (ranks.length > 0) {
      await evaluateDomain({
        ...evaluationBase,
        state: pilotState,
        persist: () => undefined,
        ranks,
        jsonlName: "pilot.jsonl",
      });
    }
    const pilotWallMs = Number(process.hrtime.bigint() - pilotStarted) / 1e6;
    const { duplicates, canonicalToAssembly } = readPilotRecords(runRoot);
    const compiled = ranks.length - duplicates;
    const duplicateRate = ranks.length > 0 ? duplicates / ranks.length : 0;

    const estimate: CostEstimate = {
      totalCandidates: domain.total.toString(),
      axes: domainAxes(domain),
      perCandidateMs,
      calibrationSamplesMs,
      duplicateRate,
      pilot: {
        size: ranks.length,
        ranks: ranks.map((rank) => rank.toString()),
        wallMs: pilotWallMs,
        duplicates,
        compiled,
        /* Only as many workers as there were coordinates can have been busy. */
        observedPerCandidateMs: compiled > 0 ? (pilotWallMs * Math.min(jobs, compiled)) / compiled : 0,
      },
      jobs,
      projectedMs: projectWallMs(domain.total, duplicateRate, perCandidateMs, jobs),
    };
    writeEstimate(runRoot, {
      runId,
      identityHash,
      estimate,
      classes: [...pilotState.classes.values()],
      canonicalToAssembly,
    });

    return finish({
      ...summaryBase,
      status: pilotState.exacts.length > 0 ? "exact-candidate-found" : "derived",
      statusDetail: pilotState.exacts.length > 0
        ? `the ${ranks.length}-coordinate pilot already produced a byte-identical configured object`
        : `derived a finite domain of ${domain.total} candidate(s); ` +
          `${ranks.length} coordinate(s) were sampled to measure the cost of exhausting it.`,
      baseline: baselineSummary,
      closure: closureBlock,
      domain: domainBlock,
      estimate,
      axisEffects: axisEffects.axes,
      classes: rankClasses(pilotState),
      classesSource: {
        sampled: true,
        evaluatedCandidates: ranks.length.toString(),
        totalCandidates: domain.total.toString(),
      },
      exactCandidates: pilotState.exacts,
      caveats: [...derivationCaveats, ...pilotState.caveats, RESIDUAL_LEVER],
    });
  }

  /* Deliverables 6-7: deterministic lazy evaluation. Checkpointing and resume
   * are automatic, so an interrupted run is always safe to restart. */
  const ownCheckpointPath = checkpointPath(runRoot, shard);
  let state = freshEvaluationState();
  const existing = loadSearchCheckpoint(ownCheckpointPath);
  if (existing) {
    validateSearchCheckpoint(existing, { functionName, runId, identityHash });
    state = checkpointToState(existing);
  }
  const persist = (current: EvaluationState): void => {
    writeSearchCheckpoint(ownCheckpointPath, stateToCheckpoint({ functionName, runId, identityHash, shard }, current));
  };
  persist(state);

  /* A pilot over this exact domain already compiled part of it. */
  const priorEstimate = loadEstimate(runRoot);
  const reusable = priorEstimate?.identityHash === identityHash && !existing ? priorEstimate : undefined;
  const warmByCanonical = reusable ? seedPilotClasses(state, reusable) : undefined;

  const evaluateOptions: Parameters<typeof evaluateDomain>[0] = {
    ...evaluationBase,
    state,
    persist,
    ...(warmByCanonical ? { warmByCanonical } : {}),
  };
  if (options.interruptAfter !== undefined) evaluateOptions.maxCandidates = options.interruptAfter;
  const evaluationStarted = process.hrtime.bigint();
  const stop = await evaluateDomain(evaluateOptions);
  const evaluationMs = Number(process.hrtime.bigint() - evaluationStarted) / 1e6;
  persist(state);

  const outcome = terminalStatus({ runRoot, total: domain.total, shard, state, stop });
  const timing: RunTiming = {
    actualMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
    evaluationMs,
  };
  if (priorEstimate?.identityHash === identityHash && priorEstimate.estimate.projectedMs !== null) {
    timing.projectedMs = priorEstimate.estimate.projectedMs;
    timing.ratio = evaluationMs / Math.max(1, priorEstimate.estimate.projectedMs);
    timing.projectionFrom = priorEstimate.runId;
  }
  const coverage = coverageReport(domain.total, shard, state);
  const summary: ResidualSearchSummary = {
    ...summaryBase,
    status: outcome.status,
    statusDetail: outcome.detail,
    baseline: baselineSummary,
    closure: closureBlock,
    domain: domainBlock,
    coverage,
    timing,
    axisEffects: axisEffects.axes,
    classes: rankClasses(state),
    classesSource: {
      sampled: !coverage.complete,
      evaluatedCandidates: coverage.evaluatedCandidates,
      totalCandidates: coverage.totalCandidates,
    },
    exactCandidates: state.exacts,
    caveats: [
      ...derivationCaveats,
      ...state.caveats,
      ...(reusable ? [`reused ${reusable.classes.length} assembly class(es) measured by the --derive-only pilot of run ${reusable.runId}`] : []),
      "Generated candidates stay under build/ and are never promoted automatically; exact candidates still require the normal export and finalization workflow.",
      `An exhausted-no-exact result is a claim about grammar schema ${RESIDUAL_GRAMMAR_SCHEMA_VERSION} and its recorded assumptions, never about all clean C.`,
    ],
  };
  if (priorEstimate?.identityHash === identityHash) summary.estimate = priorEstimate.estimate;
  return finish(summary);
}

function pilotJsonlPath(runRoot: string): string {
  return join(runRoot, "pilot.jsonl");
}

/**
 * The pilot's own per-coordinate records: the canonical-duplicate count that
 * becomes `d`, and the canonical-hash-to-assembly-class map a later full run
 * resolves sampled coordinates through instead of compiling them again.
 */
function readPilotRecords(runRoot: string): {
  duplicates: number;
  canonicalToAssembly: Array<[string, string]>;
} {
  const path = pilotJsonlPath(runRoot);
  if (!existsSync(path)) return { duplicates: 0, canonicalToAssembly: [] };
  const pairs = new Map<string, string>();
  let duplicates = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.trim().length === 0) continue;
    const record = JSON.parse(line) as { stage?: string; canonicalHash?: string; assemblyHash?: string };
    if (record.stage === "canonical-duplicate") duplicates++;
    if (record.canonicalHash && record.assemblyHash) pairs.set(record.canonicalHash, record.assemblyHash);
  }
  return {
    duplicates,
    canonicalToAssembly: [...pairs].sort((left, right) => left[0].localeCompare(right[0])),
  };
}

export function defaultRunRoot(functionName: string, runId: string): string {
  return join(ROOT, "build/residualSourceSearch", functionName, runId);
}

export function shardSizeFor(domain: DomainRuntime, shard: ShardSpec): bigint {
  return shardSize(domain.total, shard);
}

export function ensureProjectRelative(path: string, context: string): string {
  const absolute = path.startsWith("/") ? path : join(ROOT, path);
  if (!existsSync(absolute)) throw new Error(`${context} not found: ${path}`);
  return absolute;
}
