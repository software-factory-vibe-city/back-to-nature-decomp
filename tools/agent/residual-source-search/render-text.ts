import type { ResidualSearchSummary } from "./types.js";

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
  if (summary.classes.length > 0) {
    lines.push("", "Distinct assembly classes (best first):");
    for (const item of summary.classes.slice(0, 12)) {
      lines.push(`  ${item.classId} rank=${item.representativeRank} members=${item.members} ` +
        `${item.exactInstructions}/${item.totalInstructions}` +
        (item.cc1Exact ? " cc1-exact" : "") +
        (item.fullObjectExact ? " OBJECT-EXACT" : "") +
        (item.firstDivergenceStage ? ` first-divergence: ${item.firstDivergenceStage}` : ""));
    }
    if (summary.classes.length > 12) lines.push(`  ... ${summary.classes.length - 12} more class(es) in classes.json`);
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
