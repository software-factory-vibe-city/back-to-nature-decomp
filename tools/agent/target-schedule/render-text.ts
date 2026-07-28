import type { TargetScheduleAnalysis } from "./types.js";

export function renderTargetSchedule(analysis: TargetScheduleAnalysis): string {
  const lines = [
    `Target schedule analysis: ${analysis.function}`,
    `source:    ${analysis.source}`,
    `artifacts: ${analysis.outputDirectory}`,
    `stream:    ${analysis.target.length} target / ${analysis.candidate.length} candidate instructions`,
  ];
  const zeroWidth = analysis.emissionAlignment.filter((item) => item.kind === "zero-width");
  const uniqueLinks = analysis.machineUidLinks.filter((item) => item.uid !== undefined);
  const ambiguousLinks = analysis.machineUidLinks.filter((item) => item.uid === undefined);
  lines.push("", "Emission alignment:");
  lines.push(`  ${uniqueLinks.length}/${analysis.candidate.length} machine instructions have unique final UIDs; ${zeroWidth.length} proven zero-width RTL node(s); ${ambiguousLinks.length} ambiguous link(s)`);
  for (const item of zeroWidth.slice(0, 6)) lines.push(`  zero-width UID ${item.rtlUid ?? "unknown"}: ${item.evidence[0] ?? "recognized"}`);
  if (analysis.firstDivergence) {
    lines.push("", `First divergence [${analysis.firstDivergence.targetIndex}] (${analysis.firstDivergence.stage}): ${analysis.firstDivergence.description}`);
  }
  lines.push("", "Scheduler replay:");
  for (const replay of analysis.baselineReplay) {
    lines.push(`  .${replay.stage} block ${replay.block}: ${replay.status} comparator ${replay.matchedReadySets}/${replay.totalSelections}; selections ${replay.matchedSelections}/${replay.totalSelections}`);
    if (replay.firstDivergence) lines.push(`    ${replay.firstDivergence}`);
    if (replay.unsupportedFeatures.length > 0) lines.push(`    observed resource caveats: ${replay.unsupportedFeatures.length}`);
  }
  const relevantSelections = analysis.schedulerSelections.filter((selection) =>
    selection.comparisons.some((comparison) => comparison.criterion === "luid" || comparison.criterion === "dependency-class")
  );
  if (relevantSelections.length > 0) {
    lines.push("", "Scheduler tie provenance:");
    for (const selection of relevantSelections.slice(0, 12)) {
      const comparison = selection.comparisons[0];
      lines.push(`  .${selection.stage} block ${selection.block} cycle ${selection.cycle}: UID ${selection.selectedUid ?? "unknown"}; ${comparison?.criterion ?? "unresolved"} (${selection.confidence})`);
      if (comparison?.evidence[0]) lines.push(`    ${comparison.evidence[0]}`);
    }
  }
  if (analysis.targetOrderReplays.length > 0) {
    lines.push("", "Target-order replay:");
    for (const replay of analysis.targetOrderReplays.slice(0, 8)) {
      lines.push(`  .${replay.stage} block ${replay.block}: ${replay.legality}; ${replay.status}`);
      lines.push(`    target UIDs: ${replay.targetUids.join(" -> ") || "ambiguous"}`);
      for (const step of replay.steps.slice(0, 6)) {
        lines.push(`    cycle ${step.cycle}: desired UID ${step.desiredUid ?? "unknown"} ${step.outcome}${step.decidingCriterion ? ` (${step.decidingCriterion})` : ""}`);
      }
    }
  }
  if (analysis.interventionSets.length > 0) {
    lines.push("", "Minimal target-order intervention sets:");
    for (const set of analysis.interventionSets.slice(0, 6)) {
      lines.push(`  .${set.stage} block ${set.block}: ${set.interventions.length} relation(s)${set.minimalWithinBound ? "" : " (truncated by bound)"}`);
      for (const intervention of set.interventions.slice(0, 6)) lines.push(`    - ${intervention.kind}: ${intervention.expectedEffect}`);
    }
  }
  if (analysis.delaySlots.length > 0) {
    lines.push("", "Delay slots:");
    for (const delay of analysis.delaySlots) {
      lines.push(`  branch target [${delay.branchTargetIndex}] / candidate UID ${delay.branchUid ?? "unknown"}`);
      lines.push(`    candidate first eligible: UID ${delay.candidateDelayUid ?? "unknown"}`);
      lines.push(`    desired candidate: UID ${delay.desiredCandidateUid ?? "ambiguous"}`);
      if (delay.requirement) lines.push(`    requirement: ${delay.requirement}`);
    }
  }
  if (analysis.allocationRequirements.length > 0) {
    lines.push("", "Allocation requirements:");
    for (const requirement of analysis.allocationRequirements) {
      lines.push(`  ${requirement.roles.join(" vs ")}: pseudos ${requirement.pseudos.join("/")}`);
      lines.push(`    observed order: ${requirement.observedOrder.join(" -> ") || "unavailable"}`);
      if (requirement.desiredOrder) lines.push(`    desired order:  ${requirement.desiredOrder.join(" -> ")}`);
      lines.push(`    assignments: ${Object.entries(requirement.observedAssignments).map(([role, register]) => `${role}=$${register}`).join(", ")}`);
    }
  }
  lines.push("", "Prioritized requirements:");
  for (const requirement of analysis.requirements.slice(0, 20)) {
    lines.push(`  ${requirement.hardConstraint ? "HARD" : "soft"} ${requirement.id} [.${requirement.stage}] ${requirement.description}`);
    for (const intervention of requirement.interventions.slice(0, 3)) {
      lines.push(`    - ${intervention.kind}: ${intervention.expectedEffect}`);
      lines.push(`      source mechanisms: ${intervention.sourceMechanisms.join(", ")}`);
    }
  }
  if (analysis.requirements.length > 20) lines.push(`  ... ${analysis.requirements.length - 20} more requirements are preserved in analysis.json`);
  lines.push("", `Preserved exact ranges: ${analysis.preservationRanges.map((range) => `${range.start}:${range.end}`).join(", ") || "none"}`);
  if (analysis.caveats.length > 0) {
    lines.push("", "Caveats:");
    for (const caveat of analysis.caveats.slice(0, 12)) lines.push(`  - ${caveat}`);
  }
  return lines.join("\n");
}
