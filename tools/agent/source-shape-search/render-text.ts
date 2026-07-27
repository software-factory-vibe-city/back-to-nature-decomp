import type { SourceShapeSearchSummary } from "./types.js";

export function renderSourceShapeSummary(summary: SourceShapeSearchSummary): string {
  const lines = [
    `Source-shape search: ${summary.function}`,
    `run:       ${summary.runId}${summary.resumed ? " (resumed)" : ""}`,
    `artifacts: ${summary.artifacts}`,
    `products:  ${summary.productStart}..${Math.max(summary.productStart, summary.productEnd - 1)} of ${summary.totalProducts}; ${summary.unvisitedProducts} unvisited`,
    "",
    `${"variant".padEnd(42)} ${"policy".padEnd(7)} ${"hard".padEnd(5)} ${"requirements".padEnd(14)} ${"mechanism".padEnd(10)} score`,
  ];
  for (const result of summary.results.slice(0, 30)) {
    const requirements = result.requirementResults.reduce((counts, item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    const requirementText = `+${requirements.satisfied || 0}/-${requirements.regressed || 0}`;
    const verdict = result.mechanismVerdicts[0]?.verdict || (result.traceArtifact ? "traced" : "untraced");
    lines.push(`${result.variantId.slice(0, 41).padEnd(42)} ${(result.policyPassed ? "pass" : "fail").padEnd(7)} ${(result.hardConstraintsPassed ? "pass" : "fail").padEnd(5)} ${requirementText.padEnd(14)} ${verdict.padEnd(10)} ${result.exactInstructions}/${result.totalInstructions}${result.fullObjectExact ? " OBJECT-EXACT" : ""}`);
  }
  if (summary.results.length > 30) lines.push(`... ${summary.results.length - 30} more results are preserved in summary.json`);
  lines.push("", `cc1 exact:  ${summary.exactCc1Candidates.join(", ") || "none"}`);
  lines.push(`promotable: ${summary.promotableCandidates.join(", ") || "none"}`);
  for (const id of summary.promotableCandidates) {
    const result = summary.results.find((item) => item.variantId === id);
    if (result) lines.push(`  preserved source: ${result.artifacts}/source.c`);
  }
  if (summary.promotableCandidates.length > 0) {
    lines.push(`After manual review/promotion: npx tsx tools/agent/diffFunc.ts ${summary.function} && make check`);
  }
  lines.push("Ranking is lexicographic: policy, hard preservation, requirements, mechanism, opcode/count, exact score, object identity.");
  if (summary.unvisitedProducts > 0) lines.push("Re-run with --resume to visit the next deterministic product suffix.");
  return lines.join("\n");
}
