/**
 * The fixed-point campaign — solve what can be solved, requeue only what the
 * solving changed, and prepare a bundle for the rest.
 *
 * The shape of the loop is the point. A campaign that re-runs everything after
 * every success does quadratic work; one that re-runs nothing never benefits
 * from what it learned. This does neither: a function that becomes matched
 * requeues exactly its dependents — its callers, its family, the functions
 * that share a global with it — and nothing else. The evidence graph decides
 * that, and its edges are target-side facts that exist before any of these
 * functions has C.
 *
 * Two routes are tried per function, cheapest first:
 *
 *   1. **family transfer** — a member of the same shape already has clean C,
 *      so the work is a substitution and one compile decides it;
 *   2. **reconstruction** — recover the relation and construct from it.
 *
 * Both are judged by the same relocated-byte oracle, and neither writes to
 * `src/`. A campaign produces candidates under `build/` and bundles for what
 * it could not finish; promoting anything is a separately authorized step.
 *
 * A budget stop is a normal outcome and keeps everything it has: the plan's
 * rule is that budget stops must return their best useful work, and a campaign
 * that discarded its partial results on the way out would be the worst version
 * of that failure.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { loadContainers, type Container } from "../../lib/container.js";
import { loadFunctionSpans } from "../../lib/symbolIndex.js";
import { buildFamilyIndex, donorsFor, type FamilyIndex } from "../family-transfer/family-index.js";
import { transferFromDonor } from "../family-transfer/transfer.js";
import { reconstructFunction } from "../matching-reconstruction/engine.js";
import { buildEvidenceGraph, dependentsOf, describeGraph, type EvidenceGraph } from "./evidence-graph.js";
import { describeOverlay, overlayRevision, publishRecovered } from "./artifact-overlay.js";
import { bundlePath, prepareBundle, renderBundle, type PreparedBundle } from "./bundle.js";

export interface CampaignOutcome {
  functionName: string;
  containerId: string;
  sizeBytes: number;
  /** Which route settled it, when one did. */
  route?: "family-transfer" | "reconstruction";
  verdict: "exact" | "draft" | "refused" | "error";
  detail: string;
  /** Path to the candidate C, when there is one. */
  sourcePath?: string;
  /** Round it was settled in. */
  round: number;
}

export interface CampaignReport {
  rounds: number;
  /** Functions considered, in the order they entered the queue. */
  considered: string[];
  outcomes: CampaignOutcome[];
  exact: string[];
  drafts: string[];
  /** Requeues the evidence graph caused, by round. */
  requeues: Array<{ round: number; cause: string; requeued: string[] }>;
  /**
   * What each success published, and what the publication changed.
   *
   * A requeue without this is a re-run of the same experiment: the dependent is
   * asked again under exactly the evidence that failed it the first time. The
   * publication is the part that makes the second attempt a different question.
   */
  published: Array<{ round: number; functionName: string; revision: string }>;
  /** Publications that were refused, with the reason. Never silent. */
  publicationRefusals: string[];
  overlaySummary: string[];
  /** Functions the budget stopped before reaching. */
  unreached: string[];
  bundles: string[];
  graphSummary: string[];
  notes: string[];
}

export interface CampaignOptions {
  /** Restrict to these functions; every unmatched function otherwise. */
  functions?: string[];
  containers?: Container[];
  /** Stop after this many function attempts. A stop keeps everything so far. */
  maxAttempts?: number;
  /** Stop after this many rounds even if the queue is not empty. */
  maxRounds?: number;
  /** Write a prepared bundle for every function left unfinished. */
  writeBundles?: boolean;
  familyIndex?: FamilyIndex;
  graph?: EvidenceGraph;
  notify?: ((line: string) => void) | undefined;
}

/**
 * Every function whose source is absent or still hands the body to the
 * assembler.
 *
 * Read from the spans and the source tree rather than from the family index:
 * the index covers only functions long enough to have a meaningful shape, and
 * using it as the denominator would silently drop every short stub from the
 * campaign's own accounting.
 */
function unmatchedFunctions(containers: Container[]): string[] {
  const names: string[] = [];
  for (const container of containers) {
    for (const span of loadFunctionSpans(container)) {
      const sourcePath = join(ROOT, container.paths.srcDir, `${span.name}.c`);
      if (!existsSync(sourcePath)) {
        names.push(span.name);
        continue;
      }
      const text = readFileSync(sourcePath, "utf-8");
      if (text.includes("INCLUDE_ASM(") && text.includes(span.name)) names.push(span.name);
    }
  }
  return names;
}

/**
 * Run the campaign to a fixed point.
 *
 * The queue is seeded with every candidate; each success requeues only its
 * dependents. A function is attempted at most twice — once on its first
 * arrival and once if new evidence requeues it — because a third attempt under
 * unchanged evidence is the same experiment.
 */
export function runCampaign(options: CampaignOptions = {}): CampaignReport {
  const notify = options.notify ?? (() => {});
  const containers = options.containers ?? loadContainers();
  const familyIndex = options.familyIndex ?? buildFamilyIndex({ tier: "flexible", containers });
  const graph = options.graph ?? buildEvidenceGraph({ containers, familyIndex });
  const maxAttempts = options.maxAttempts ?? Number.POSITIVE_INFINITY;
  const maxRounds = options.maxRounds ?? 8;

  const seeds = options.functions ?? unmatchedFunctions(containers);
  const spanOf = new Map<string, { containerId: string; sizeBytes: number }>();
  for (const container of containers) {
    for (const span of loadFunctionSpans(container)) {
      spanOf.set(span.name, { containerId: container.id, sizeBytes: span.size });
    }
  }

  const outcomes: CampaignOutcome[] = [];
  const settled = new Map<string, CampaignOutcome>();
  const attempts = new Map<string, number>();
  const requeues: CampaignReport["requeues"] = [];
  const published: CampaignReport["published"] = [];
  const publicationRefusals: string[] = [];
  const notes: string[] = [];
  const considered: string[] = [];

  /* The indexes are rebuilt when the overlay moves, not once at the start. Both
   * are memoized on a key that includes the overlay revision, so asking again
   * after a publication returns a fresh index and asking again after a round
   * that published nothing costs nothing. */
  let liveFamilyIndex = familyIndex;
  let liveGraph = graph;
  let indexedRevision = overlayRevision();
  const refreshIndexes = (): void => {
    const revision = overlayRevision();
    if (revision === indexedRevision) return;
    indexedRevision = revision;
    liveFamilyIndex = options.familyIndex ?? buildFamilyIndex({ tier: "flexible", containers });
    liveGraph = options.graph ?? buildEvidenceGraph({ containers, familyIndex: liveFamilyIndex });
    notify(`  overlay revision ${revision}: donor index and evidence graph refreshed`);
  };

  let queue = seeds.filter((name) => spanOf.has(name));
  let round = 0;
  let attemptCount = 0;
  let stopped = false;

  while (queue.length > 0 && round < maxRounds && !stopped) {
    round++;
    const next: string[] = [];
    notify(`round ${round}: ${queue.length} function(s) queued`);

    for (const functionName of queue) {
      if (attemptCount >= maxAttempts) {
        stopped = true;
        notes.push(`the attempt budget (${maxAttempts}) stopped the campaign in round ${round}; everything settled so far is kept`);
        break;
      }
      const already = attempts.get(functionName) ?? 0;
      if (already >= 2) continue;
      if (settled.get(functionName)?.verdict === "exact") continue;
      attempts.set(functionName, already + 1);
      attemptCount++;
      if (already === 0) considered.push(functionName);

      const outcome = attempt(functionName, spanOf.get(functionName)!, liveFamilyIndex, round, notify);
      const previous = settled.get(functionName);
      /* Keep the better of the two: a draft does not replace an exact result,
       * and a refusal does not replace a draft. */
      if (!previous || rank(outcome.verdict) < rank(previous.verdict)) {
        settled.set(functionName, outcome);
      }

      if (outcome.verdict === "exact") {
        /* Publish before requeueing. The dependents are being asked again
         * *because* this function was recovered, so the recovery has to be
         * visible to them by the time they are asked — otherwise the second
         * attempt runs under the evidence that failed the first. */
        if (outcome.sourcePath && existsSync(outcome.sourcePath)) {
          const result = publishRecovered(functionName, readFileSync(outcome.sourcePath, "utf-8"), outcome.route ?? "external");
          if ("refused" in result) publicationRefusals.push(result.refused);
          else published.push({ round, functionName, revision: result.revision });
        }
        refreshIndexes();

        const dependents = [...dependentsOf(liveGraph, functionName)]
          .filter((dependent) => (attempts.get(dependent) ?? 0) < 2)
          .filter((dependent) => settled.get(dependent)?.verdict !== "exact")
          .filter((dependent) => spanOf.has(dependent));
        if (dependents.length > 0) {
          requeues.push({ round, cause: functionName, requeued: dependents });
          next.push(...dependents);
        }
        notify(`  ${functionName}: EXACT via ${outcome.route} — requeued ${dependents.length} dependent(s)`);
      }
    }
    queue = [...new Set(next)];
  }

  if (round >= maxRounds && queue.length > 0) {
    notes.push(`the round budget (${maxRounds}) stopped the campaign with ${queue.length} requeued function(s) unvisited`);
  }

  outcomes.push(...settled.values());
  outcomes.sort((left, right) => left.functionName.localeCompare(right.functionName));

  const exact = outcomes.filter((outcome) => outcome.verdict === "exact").map((outcome) => outcome.functionName);
  const drafts = outcomes.filter((outcome) => outcome.verdict === "draft").map((outcome) => outcome.functionName);
  const unreached = seeds.filter((name) => !settled.has(name));

  const bundles: string[] = [];
  if (options.writeBundles) {
    mkdirSync(join(ROOT, "build/preparedBundles"), { recursive: true });
    for (const outcome of outcomes) {
      if (outcome.verdict === "exact") continue;
      try {
        const bundle = prepareBundle(outcome.functionName);
        writeBundle(bundle);
        bundles.push(outcome.functionName);
      } catch (error) {
        notes.push(`${outcome.functionName}: bundle preparation failed — ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return {
    rounds: round,
    considered,
    outcomes,
    exact,
    drafts,
    requeues,
    published,
    publicationRefusals,
    overlaySummary: describeOverlay(),
    unreached,
    bundles,
    graphSummary: describeGraph(liveGraph),
    notes,
  };
}

const rank = (verdict: CampaignOutcome["verdict"]): number =>
  verdict === "exact" ? 0 : verdict === "draft" ? 1 : verdict === "refused" ? 2 : 3;

/**
 * Try one function, cheapest route first.
 *
 * Transfer before reconstruction: a family donor turns the work into a
 * substitution decided by one compile, where reconstruction has to recover the
 * whole relation. Both end at the same oracle.
 */
function attempt(
  functionName: string,
  span: { containerId: string; sizeBytes: number },
  familyIndex: FamilyIndex,
  round: number,
  notify: (line: string) => void,
): CampaignOutcome {
  const base = { functionName, containerId: span.containerId, sizeBytes: span.sizeBytes, round };

  const donors = donorsFor(familyIndex, functionName).slice(0, 2);
  for (const donor of donors) {
    try {
      const transfer = transferFromDonor(functionName, donor.functionName, { tier: "flexible", limit: 12 });
      if (transfer.winner) {
        return {
          ...base,
          route: "family-transfer",
          verdict: "exact",
          detail: `transferred from ${donor.functionName}`,
          sourcePath: transfer.winner.sourcePath,
        };
      }
      const closest = transfer.candidates.find((candidate) => candidate.verdict === "mismatch");
      if (closest) {
        notify(`  ${functionName}: transfer from ${donor.functionName} differs in ${closest.differingCount} word(s)`);
      }
    } catch (error) {
      notify(`  ${functionName}: transfer from ${donor.functionName} errored — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const result = reconstructFunction({ functionName, notify: () => {} });
    if (result.state === "exact-candidate") {
      return {
        ...base,
        route: "reconstruction",
        verdict: "exact",
        detail: `reconstructed (${result.winner!.id})`,
        sourcePath: join(ROOT, "build/matchingReconstruction", functionName, "winner.c"),
      };
    }
    if (result.bestEffort) {
      return {
        ...base,
        route: "reconstruction",
        verdict: "draft",
        detail: result.bestEffort.diffSummary,
        sourcePath: join(ROOT, "build/matchingReconstruction", functionName, "best-effort.c"),
      };
    }
    return {
      ...base,
      route: "reconstruction",
      verdict: "refused",
      detail: `${result.unresolved?.category ?? result.state}: ${(result.unresolved?.detail ?? "").slice(0, 120)}`,
    };
  } catch (error) {
    return { ...base, verdict: "error", detail: (error instanceof Error ? error.message : String(error)).slice(0, 160) };
  }
}

function writeBundle(bundle: PreparedBundle): void {
  const markdown = bundlePath(bundle.functionName, "md");
  mkdirSync(join(ROOT, "build/preparedBundles"), { recursive: true });
  writeFileSync(markdown, `${renderBundle(bundle).join("\n")}\n`);
  writeFileSync(bundlePath(bundle.functionName, "json"), JSON.stringify(bundle, null, 1));
}

/** A readable campaign report. */
export function renderCampaign(report: CampaignReport): string[] {
  const lines: string[] = [];
  lines.push(`campaign: ${report.rounds} round(s), ${report.considered.length} function(s) considered`);
  lines.push(`  exact:   ${report.exact.length}`);
  lines.push(`  drafts:  ${report.drafts.length}`);
  lines.push(`  refused: ${report.outcomes.filter((outcome) => outcome.verdict === "refused").length}`);
  lines.push(`  errors:  ${report.outcomes.filter((outcome) => outcome.verdict === "error").length}`);
  if (report.unreached.length > 0) lines.push(`  unreached: ${report.unreached.length}`);
  lines.push("");
  lines.push("evidence graph:");
  for (const line of report.graphSummary) lines.push(`  ${line}`);
  lines.push("");
  if (report.overlaySummary.length > 0) {
    for (const line of report.overlaySummary) lines.push(line);
    lines.push("");
  }
  if (report.published.length > 0) {
    lines.push("publications (each one is what makes the next round a different question):");
    for (const entry of report.published.slice(0, 12)) {
      lines.push(`  round ${entry.round}: ${entry.functionName} → overlay revision ${entry.revision}`);
    }
    if (report.published.length > 12) lines.push(`  … and ${report.published.length - 12} more`);
    lines.push("");
  }
  for (const refusal of report.publicationRefusals) lines.push(`publication refused: ${refusal}`);
  if (report.publicationRefusals.length > 0) lines.push("");
  if (report.requeues.length > 0) {
    lines.push("requeues (a recovered function changes its dependents, and nothing else):");
    for (const requeue of report.requeues.slice(0, 12)) {
      lines.push(`  round ${requeue.round}: ${requeue.cause} → ${requeue.requeued.length} dependent(s)`);
    }
    if (report.requeues.length > 12) lines.push(`  … and ${report.requeues.length - 12} more`);
    lines.push("");
  }
  if (report.exact.length > 0) {
    lines.push("byte-exact candidates (NOT integrated):");
    for (const name of report.exact) {
      const outcome = report.outcomes.find((candidate) => candidate.functionName === name)!;
      lines.push(`  ${name.padEnd(28)} ${outcome.route} — ${outcome.detail}`);
    }
    lines.push("");
  }
  if (report.bundles.length > 0) {
    lines.push(`prepared bundles for ${report.bundles.length} unfinished function(s) under build/preparedBundles/`);
    lines.push("");
  }
  for (const note of report.notes) lines.push(`note: ${note}`);
  return lines;
}
