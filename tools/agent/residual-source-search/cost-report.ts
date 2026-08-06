import { existsSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { compileSourceAsync } from "../decompToolchain.js";
import { writeStableJson } from "../variant-lab/artifacts.js";
import { groupNameAt, type DomainRuntime } from "./enumerate.js";
import type { DerivedGrammar } from "./rewrite-catalog.js";
import { RegionOrderModel, parseMemoryToken, regionDependencies } from "./topological-orders.js";
import type { WebView } from "./web-partitions.js";
import type { CandidateClass, CostEstimate, DomainAxisReport, SemanticGraph } from "./types.js";

/** Coordinates the deterministic pilot evaluates before projecting a full run. */
export const PILOT_SAMPLE_SIZE = 64;

/** Baseline compiles whose median becomes the per-candidate cost `c`. */
export const CALIBRATION_SAMPLES = 5;

/**
 * Worker count is a machine property, not an operator choice. One core is left
 * for the orchestrator so a full run does not starve its own scheduling.
 */
export function defaultJobs(): number {
  const cores = availableParallelism();
  return Math.max(1, Math.min(32, cores - 1));
}

function bigMax(values: bigint[]): bigint {
  return values.reduce((best, value) => (value > best ? value : best), 0n);
}

function bigMin(values: bigint[]): bigint {
  return values.reduce((best, value) => (value < best ? value : best), values[0] ?? 0n);
}

/**
 * Per-axis radix breakdown, largest axis first. The domain is a sum over
 * sections of a product over regions, so the radices bound the size rather
 * than multiplying out to it exactly; each radix still says how much choice
 * that axis contributes, which is what decides whether to launch.
 */
export function domainAxes(domain: DomainRuntime): DomainAxisReport[] {
  const sections = domain.partitions;
  if (sections.length === 0) return [];

  const perSelection = new Map<string, number>();
  for (const section of sections) {
    const key = `${section.materializedSites.join("|")}//${section.administrativeCopies.join("|")}`;
    perSelection.set(key, (perSelection.get(key) ?? 0) + 1);
  }
  const partitionCounts = [...perSelection.values()];
  const selections = perSelection.size;
  const materializedSelections = new Set(sections.map((section) => section.materializedSites.join("|"))).size;
  const copySelections = new Set(sections.map((section) => section.administrativeCopies.join("|"))).size;

  const axes: DomainAxisReport[] = [{
    id: "section",
    kind: "section",
    radix: String(sections.length),
    detail: `${selections} grammar selection(s) ` +
      `(${materializedSelections} materialization, ${copySelections} administrative-copy) x ` +
      `${Math.min(...partitionCounts)}..${Math.max(...partitionCounts)} web partition(s) each`,
  }];

  const regionCount = sections[0]!.regions.length;
  for (let index = 0; index < regionCount; index++) {
    const runtimes = sections.map((section) => section.regions[index]!);
    const sizes = runtimes.map((runtime) => runtime.size);
    const largest = bigMax(sizes);
    const smallest = bigMin(sizes);
    const variants = bigMax(runtimes.map((runtime) => BigInt(runtime.variants.length)));
    const nodes = runtimes[0]!.nodeIds.length;
    axes.push({
      id: `region:${runtimes[0]!.region.id}`,
      kind: "region",
      radix: largest.toString(),
      detail: `${nodes} statement(s), up to ${variants} split/birth variant(s)` +
        (smallest === largest ? "" : `; ${smallest}..${largest} across sections`),
    });
  }

  return axes.sort((left, right) => {
    const difference = BigInt(right.radix) - BigInt(left.radix);
    return difference > 0n ? 1 : difference < 0n ? -1 : left.id.localeCompare(right.id);
  });
}

/**
 * The same per-axis breakdown for a grammar whose domain could not be
 * serialized. Region radices are the exact order counts under the baseline
 * partition, which is all that can be established without building the
 * domain — and it is enough to say which axis made the domain large.
 */
export function grammarAxes(options: {
  graph: SemanticGraph;
  view: WebView;
  derived: DerivedGrammar;
}): DomainAxisReport[] {
  const { graph, view, derived } = options;
  const sections = derived.materializations.reduce((total, item) => total + item.partitions.length, 0);
  const axes: DomainAxisReport[] = [{
    id: "section",
    kind: "section",
    radix: String(sections),
    detail: `${derived.materializations.length} grammar selection(s) x up to ` +
      `${Math.max(0, ...derived.materializations.map((item) => item.partitions.length))} web partition(s) each`,
  }];

  const baseline = derived.materializations[0]?.partitions[0];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const variableNames = new Set(graph.variables.map((variable) => variable.name));
  for (const region of derived.regions) {
    let radix = "unknown";
    if (baseline) {
      try {
        const views = region.nodeIds.map((id) => {
          const node = nodeById.get(id)!;
          const webAt = (variable: string) =>
            view.reaching.get(id)?.get(variable) ?? view.defWebs.get(id)?.get(variable);
          return {
            id,
            node,
            reads: new Set(node.reads.map((variable) => groupNameAt(view, baseline, id, variable, "read"))),
            writes: new Set(node.writes.map((variable) => groupNameAt(view, baseline, id, variable, "write"))),
            memoryReads: node.memoryReads.map((token) => parseMemoryToken(token, webAt, (name) => variableNames.has(name))),
            memoryWrites: node.memoryWrites.map((token) => parseMemoryToken(token, webAt, (name) => variableNames.has(name))),
          };
        });
        radix = RegionOrderModel.fromDependencies(region.nodeIds, regionDependencies(views)).count().toString();
      } catch {
        radix = "unknown";
      }
    }
    axes.push({
      id: `region:${region.id}`,
      kind: "region",
      radix,
      detail: `${region.nodeIds.length} statement(s), ${region.birthEligible.length} birth candidate(s), ` +
        `${region.splittable.length} splittable macro(s); baseline-partition orders`,
    });
  }

  return axes.sort((left, right) => {
    if (left.radix === "unknown" || right.radix === "unknown") return left.radix === "unknown" ? 1 : -1;
    const difference = BigInt(right.radix) - BigInt(left.radix);
    return difference > 0n ? 1 : difference < 0n ? -1 : left.id.localeCompare(right.id);
  });
}

/**
 * A deterministic stratified sample of `min(size, total)` global ranks. Even
 * spacing keeps every section and region variant reachable, and the same
 * domain always produces the same sample, so an estimate is reproducible.
 */
export function pilotRanks(total: bigint, size = PILOT_SAMPLE_SIZE): bigint[] {
  if (total <= 0n) return [];
  const count = total < BigInt(size) ? Number(total) : size;
  const ranks: bigint[] = [];
  for (let index = 0; index < count; index++) {
    ranks.push((BigInt(index) * total) / BigInt(count));
  }
  return ranks;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * Median wall time of a full baseline compile — cpp, cc1, maspsx, and the
 * assembler — which is what one candidate costs when it is not deduplicated.
 */
export async function calibrateCandidateCost(options: {
  sourcePath: string;
  functionName: string;
  workDirectory: string;
  samples?: number;
  signal?: AbortSignal;
}): Promise<number[]> {
  const samples: number[] = [];
  for (let index = 0; index < (options.samples ?? CALIBRATION_SAMPLES); index++) {
    const started = process.hrtime.bigint();
    const compileOptions: Parameters<typeof compileSourceAsync>[3] = { assemble: true };
    if (options.signal) compileOptions.signal = options.signal;
    await compileSourceAsync(options.sourcePath, options.workDirectory, options.functionName, compileOptions);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  return samples;
}

/** `T = N x (1 - d) x c / jobs`; null when N is beyond double precision. */
export function projectWallMs(
  total: bigint,
  duplicateRate: number,
  perCandidateMs: number,
  jobs: number,
): number | null {
  const size = Number(total);
  if (!Number.isFinite(size)) return null;
  return (size * (1 - duplicateRate) * perCandidateMs) / Math.max(1, jobs);
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${milliseconds.toFixed(0)} ms`;
  const seconds = milliseconds / 1000;
  if (seconds < 90) return `${seconds.toFixed(1)} s`;
  const minutes = seconds / 60;
  if (minutes < 90) return `${minutes.toFixed(1)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

/* ------------------------------------------------------------------ */
/* Persisted estimate                                                  */
/* ------------------------------------------------------------------ */

/**
 * A pilot result reused by a later full run. Coordinates are keyed by
 * canonical hash, so a full run that reaches a sampled coordinate resolves it
 * from the recorded assembly class instead of compiling it again.
 */
export interface PilotArtifact {
  runId: string;
  identityHash: string;
  estimate: CostEstimate;
  classes: CandidateClass[];
  /** canonical source hash -> assembly hash of the class it belongs to. */
  canonicalToAssembly: Array<[string, string]>;
}

export function estimatePath(runRoot: string): string {
  return join(runRoot, "estimate.json");
}

export function writeEstimate(runRoot: string, artifact: PilotArtifact): void {
  writeStableJson(estimatePath(runRoot), artifact);
}

export function loadEstimate(runRoot: string): PilotArtifact | undefined {
  const path = estimatePath(runRoot);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PilotArtifact;
  } catch {
    return undefined;
  }
}
