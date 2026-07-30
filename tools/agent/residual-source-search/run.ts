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
import { coverageReport, terminalStatus } from "./coverage.js";
import { buildDomain, shardSize, type DomainRuntime, type ShardSpec } from "./enumerate.js";
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
  type ResidualSearchSummary,
  type SearchCheckpoint,
  type TerminalStatus,
} from "./types.js";

export interface RunResidualSearchOptions {
  functionName: string;
  sourcePath: string;
  deriveOnly?: boolean;
  jobs?: number;
  shard?: ShardSpec;
  resume?: boolean;
  maxCandidates?: number;
  partitionCap?: number;
  /** Begin evaluation at this shard-local index; coverage is reported honestly as a partial range. */
  startRank?: bigint;
  /** Override the run directory (tests); defaults to build/residualSourceSearch/<fn>/<runId>. */
  runRootOverride?: string;
  /** Override the witness discovery root (tests); defaults to build/schedulerConstraint/<fn>. */
  witnessRootOverride?: string;
  /** Injected target stream and object (tests); default resolves project artifacts. */
  target?: NormalizedInstruction[];
  targetObjectPath?: string;
  signal?: AbortSignal;
}

const DOMAIN_LOCAL_RECOMMENDATION = 200_000n;

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

function checkpointToState(checkpoint: SearchCheckpoint): EvaluationState {
  const state = freshEvaluationState();
  state.startIndex = checkpoint.evaluatedRanges.length > 0
    ? BigInt(checkpoint.evaluatedRanges[0]![0])
    : 0n;
  state.nextShardIndex = checkpoint.evaluatedRanges.length > 0
    ? BigInt(checkpoint.evaluatedRanges[0]![1]) + 1n
    : state.startIndex;
  state.evaluatedCount = BigInt(checkpoint.evaluatedCount);
  for (const item of checkpoint.classes) state.classes.set(item.hash, { ...item } as CandidateClassRuntime);
  state.exacts = [...checkpoint.exactCandidates];
  state.caveats.add("resumed run: canonical and preprocessed dedupe caches restart empty; coverage accounting is unaffected");
  return state;
}

function rankClasses(state: EvaluationState): CandidateClassRuntime[] {
  return [...state.classes.values()].sort((left, right) =>
    Number(Boolean(right.fullObjectExact)) - Number(Boolean(left.fullObjectExact)) ||
    Number(right.cc1Exact) - Number(left.cc1Exact) ||
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
  const shard: ShardSpec = options.shard ?? { index: 1, count: 1 };
  const jobs = options.jobs ?? 1;

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
    finish({ ...summaryBase, status, statusDetail: detail, classes: [], exactCandidates: [], caveats });

  if (!options.resume) {
    rmSync(join(runRoot, "evaluated.jsonl"), { force: true });
    rmSync(join(runRoot, "classes"), { recursive: true, force: true });
    rmSync(join(runRoot, "work"), { recursive: true, force: true });
    rmSync(checkpointPath(runRoot, shard), { force: true });
  }

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
  let domain: DomainRuntime;
  try {
    domain = buildDomain({ graph, view, derived });
  } catch (error) {
    return refusalSummary("domain-too-large",
      `exact domain construction failed: ${error instanceof Error ? error.message : error}`,
      derived.grammar.caveats);
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
  const derivationCaveats = [
    ...bundle.caveats,
    ...graph.caveats,
    ...closure.caveats,
    ...derived.grammar.caveats,
    ...domain.caveats,
  ];

  if (derived.tooLarge && !options.deriveOnly) {
    return finish({
      ...summaryBase,
      status: "domain-too-large",
      statusDetail: derived.tooLarge,
      baseline: baselineSummary,
      closure: closureBlock,
      domain: domainBlock,
      classes: [],
      exactCandidates: [],
      caveats: derivationCaveats,
    });
  }

  if (options.deriveOnly) {
    const recommendation = domain.total > DOMAIN_LOCAL_RECOMMENDATION
      ? ` The domain exceeds ${DOMAIN_LOCAL_RECOMMENDATION} candidates; plan an explicit budget or deterministic --shard runs before searching.`
      : "";
    return finish({
      ...summaryBase,
      status: derived.tooLarge ? "domain-too-large" : "derived",
      statusDetail: derived.tooLarge ??
        `derived a finite domain of ${domain.total} candidate(s); no variants were compiled.${recommendation}`,
      baseline: baselineSummary,
      closure: closureBlock,
      domain: domainBlock,
      classes: [],
      exactCandidates: [],
      caveats: derivationCaveats,
    });
  }

  /* Baseline drift gate before any evaluation. */
  if (sha256(readFileSync(options.sourcePath, "utf8")) !== sourceHash) {
    return refusalSummary("baseline-drift", "the input source changed while the run was being derived");
  }

  /* Deliverables 6-7: deterministic lazy evaluation with checkpoints. */
  const ownCheckpointPath = checkpointPath(runRoot, shard);
  let state = freshEvaluationState();
  if (options.startRank !== undefined) {
    state.startIndex = options.startRank;
    state.nextShardIndex = options.startRank;
  }
  if (options.resume) {
    const existing = loadSearchCheckpoint(ownCheckpointPath);
    if (existing) {
      validateSearchCheckpoint(existing, { functionName, runId, identityHash });
      state = checkpointToState(existing);
    }
  }
  const persist = (current: EvaluationState): void => {
    writeSearchCheckpoint(ownCheckpointPath, stateToCheckpoint({ functionName, runId, identityHash, shard }, current));
  };
  persist(state);

  const evaluateOptions: Parameters<typeof evaluateDomain>[0] = {
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
    state,
    persist,
  };
  if (baseline.targetObject) evaluateOptions.targetObject = baseline.targetObject;
  else if (options.targetObjectPath) evaluateOptions.targetObject = options.targetObjectPath;
  if (options.maxCandidates !== undefined) evaluateOptions.maxCandidates = options.maxCandidates;
  if (options.signal) evaluateOptions.signal = options.signal;
  const stop = await evaluateDomain(evaluateOptions);
  persist(state);

  const outcome = terminalStatus({ runRoot, total: domain.total, shard, state, stop });
  const summary: ResidualSearchSummary = {
    ...summaryBase,
    status: outcome.status,
    statusDetail: outcome.detail,
    baseline: baselineSummary,
    closure: closureBlock,
    domain: domainBlock,
    coverage: coverageReport(domain.total, shard, state),
    classes: rankClasses(state),
    exactCandidates: state.exacts,
    caveats: [
      ...derivationCaveats,
      ...state.caveats,
      "Generated candidates stay under build/ and are never promoted automatically; exact candidates still require the normal export and finalization workflow.",
      `An exhausted-no-exact result is a claim about grammar schema ${RESIDUAL_GRAMMAR_SCHEMA_VERSION} and its recorded assumptions, never about all clean C.`,
    ],
  };
  return finish(summary);
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
