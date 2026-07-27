import type { TargetScheduleAnalysis } from "./types.js";

export function renderTargetSchedule(analysis: TargetScheduleAnalysis): string {
  const lines = [
    `Target schedule analysis: ${analysis.function}`,
    `source:    ${analysis.source}`,
    `artifacts: ${analysis.outputDirectory}`,
    `stream:    ${analysis.target.length} target / ${analysis.candidate.length} candidate instructions`,
  ];
  if (analysis.firstDivergence) {
    lines.push("", `First divergence [${analysis.firstDivergence.targetIndex}] (${analysis.firstDivergence.stage}): ${analysis.firstDivergence.description}`);
  }
  lines.push("", "Scheduler replay:");
  for (const replay of analysis.schedulerReplay) {
    lines.push(`  .${replay.stage} block ${replay.block}: ${replay.reproduced ? "reproduced" : "not reproduced"} ${replay.matchedCycles}/${replay.totalCycles}` +
      `${replay.counterfactualEligible ? "; counterfactual-eligible" : "; observational-only"}`);
    if (replay.firstMismatch) lines.push(`    ${replay.firstMismatch}`);
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
