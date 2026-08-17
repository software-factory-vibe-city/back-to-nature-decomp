import { formatDuration } from "./cost-report.js";
import type { ResidualSearchSummary } from "./types.js";

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

/** Per-run deltas, worst first, naming only the runs that changed. */
function movedRuns(
  baseline: NonNullable<ResidualSearchSummary["classes"][number]["residual"]>,
  residual: NonNullable<ResidualSearchSummary["classes"][number]["residual"]>,
): string[] {
  const runs = new Set([...baseline.blocks, ...residual.blocks].map((item) => item.block));
  const at = (source: typeof baseline, run: number) =>
    source.blocks.find((item) => item.block === run) ?? { population: 0, schedule: 0, allocation: 0 };
  return [...runs].sort((left, right) => left - right).flatMap((run) => {
    const from = at(baseline, run);
    const to = at(residual, run);
    const parts: string[] = [];
    if (to.population !== from.population) parts.push(`pop ${signed(to.population - from.population)}`);
    if (to.schedule !== from.schedule) parts.push(`sched ${signed(to.schedule - from.schedule)}`);
    if (to.allocation !== from.allocation) parts.push(`alloc ${signed(to.allocation - from.allocation)}`);
    return parts.length > 0 ? [`run${run}(${parts.join(", ")})`] : [];
  });
}

export function renderResidualSummary(summary: ResidualSearchSummary): string {
  const lines: string[] = [];
  lines.push(`${summary.function}: ${summary.status}`);
  lines.push(summary.statusDetail);
  lines.push(`Artifacts: ${summary.artifacts}`);
  if (summary.baseline) {
    lines.push(`Baseline: ${summary.baseline.exactInstructions}/${summary.baseline.totalInstructions} exact (${summary.baseline.category})`);
  }
  if (summary.closure) {
    lines.push(`Closure: ${summary.closure.nodes} statements, ${summary.closure.webs} value webs, ` +
      `${summary.closure.uids} candidate uids, ${summary.closure.pseudos} pseudos` +
      (summary.closure.wholeFunction ? " (whole function)" : ""));
  }
  if (summary.domain) {
    lines.push(`Domain: ${summary.domain.totalCandidates} candidates over ${summary.domain.partitions} web partition(s) and ${summary.domain.regions} order region(s)`);
  }
  if (summary.coverage) {
    const shard = summary.coverage.shard
      ? ` (shard ${summary.coverage.shard.index}/${summary.coverage.shard.count}: ${summary.coverage.shardCandidates} candidates)`
      : "";
    lines.push(`Coverage: ${summary.coverage.evaluatedCandidates} evaluated of ${summary.coverage.totalCandidates}${shard}` +
      (summary.coverage.complete ? " [complete]" : " [incomplete]"));
  }
  if (summary.estimate) {
    const estimate = summary.estimate;
    lines.push("", `Cost of exhausting ${estimate.totalCandidates} candidate(s):`);
    if (estimate.pilot.size > 0) {
      lines.push(`  projected wall time: ${estimate.projectedMs === null
        ? "beyond double precision"
        : formatDuration(estimate.projectedMs)} at ${estimate.jobs} job(s)`);
      lines.push(`  c = ${estimate.perCandidateMs.toFixed(1)} ms per candidate ` +
        `(median of ${estimate.calibrationSamplesMs.length} baseline compiles; ` +
        `pilot observed ${estimate.pilot.observedPerCandidateMs.toFixed(1)} ms)`);
      lines.push(`  d = ${(estimate.duplicateRate * 100).toFixed(1)}% canonical duplicates ` +
        `(${estimate.pilot.duplicates} of ${estimate.pilot.size} sampled coordinates)`);
    }
    lines.push("  Axes, largest first:");
    for (const axis of estimate.axes) {
      lines.push(`    ${axis.id}: ${axis.radix} — ${axis.detail}`);
    }
  }
  if (summary.timing) {
    const timing = summary.timing;
    lines.push(`Wall time: ${formatDuration(timing.actualMs)} total, ` +
      `${formatDuration(timing.evaluationMs)} evaluating coordinates` +
      (timing.projectedMs !== undefined
        ? ` against a projection of ${formatDuration(timing.projectedMs)} (${timing.ratio!.toFixed(2)}x)`
        : " (no --derive-only projection exists for this domain)"));
  }
  if (summary.axisEffects && summary.axisEffects.length > 0) {
    lines.push("", "Axis effect — does moving each counted digit move the program:");
    for (const axis of summary.axisEffects) {
      const scope = BigInt(axis.sampled) >= BigInt(axis.radix) ? "all" : `${axis.sampled} of`;
      lines.push(`  ${axis.id}: ${axis.distinct} distinct source(s) across ${scope} ${axis.radix} value(s)` +
        (axis.inert ? "  <- INERT, counted but changes nothing" : ""));
    }
  }
  if (summary.classes.length > 0) {
    /* A sampled table and an exhaustive one used to print identically, and a
     * ranked leaderboard reads as "these are the outcomes" whatever the prose
     * above it says. So the heading carries its own coverage, and a sample
     * never claims an ordering it has not earned. */
    const source = summary.classesSource;
    if (source?.sampled) {
      const percent = Number(source.totalCandidates) > 0
        ? (100 * Number(source.evaluatedCandidates)) / Number(source.totalCandidates)
        : 0;
      lines.push("",
        `Assembly classes seen in a SAMPLE of ${source.evaluatedCandidates} of ` +
        `${source.totalCandidates} candidate(s) (${percent < 0.01 ? "<0.01" : percent.toFixed(2)}%) — ` +
        "not a ranking over the domain:");
    } else {
      lines.push("", "Distinct assembly classes (best first):");
    }
    const baseline = summary.classes.find((item) => item.representativeRank === "0")?.residual;
    for (const item of summary.classes.slice(0, 12)) {
      const residual = item.residual;
      const axes = residual
        ? ` [pop ${residual.population}, sched ${residual.schedule}, alloc ${residual.allocation}]`
        : "";
      /* Against the baseline, per axis: the direction, not the score. */
      const delta = residual && baseline && item.representativeRank !== "0"
        ? ` ${signed(residual.population - baseline.population)}pop ` +
          `${signed(residual.schedule - baseline.schedule)}sched ` +
          `${signed(residual.allocation - baseline.allocation)}alloc`
        : "";
      lines.push(`  ${item.classId} rank=${item.representativeRank} members=${item.members}` +
        `${axes}${delta}` +
        (item.cc1Exact ? " cc1-exact" : "") +
        (item.fullObjectExact ? " OBJECT-EXACT" : "") +
        (item.firstDivergenceStage ? ` first-divergence: ${item.firstDivergenceStage}` : ""));
      /* Only the runs this class actually moved, so the direction is readable. */
      if (residual && baseline && item.representativeRank !== "0") {
        const moved = movedRuns(baseline, residual);
        if (moved.length > 0) lines.push(`      moved: ${moved.join("  ")}`);
      }
    }
    if (summary.classes.length > 12) lines.push(`  ... ${summary.classes.length - 12} more class(es) in classes.json`);
    if (summary.classesSource?.sampled) {
      lines.push(
        "  These are the classes this sample happened to land on. The domain has not been searched, and",
        "  nothing here supports a statement about what it does or does not contain. Run without",
        "  --derive-only to exhaust it.",
      );
    }
  }
  if (summary.exactCandidates.length > 0) {
    lines.push("", "Exact candidates:");
    for (const exact of summary.exactCandidates) {
      lines.push(`  rank ${exact.globalRank} -> ${exact.artifacts}`);
    }
  }
  if (summary.caveats.length > 0) {
    lines.push("", "Caveats:");
    for (const caveat of summary.caveats) lines.push(`  - ${caveat}`);
  }
  return lines.join("\n");
}
