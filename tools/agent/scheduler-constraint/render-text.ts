import type { SchedulerConstraintInput, SchedulerConstraintResult } from "./types.js";

export function renderSchedulerConstraintResult(input: SchedulerConstraintInput, result: SchedulerConstraintResult): string {
  const lines = [
    `Scheduler-state constraint search: ${result.function}`,
    `stage/block: .${result.stage} / ${result.block}`,
    `status:      ${result.status.toUpperCase()}`,
    `artifacts:   ${result.artifacts}`,
    `baseline:    ${result.modelReplay.matchedSelections}/${result.modelReplay.totalSelections} selections${result.modelReplay.exact ? " (exact)" : " (FAILED)"}`,
    `search:      ${result.exploredAssignments} assignment(s), ${result.structuralAlternatives} structural alternative(s)`,
    "",
    "Serialized domain:",
    `  ${input.domain.variableBoostUids.length} variable boost bit(s)`,
    `  ${input.domain.luidOrderConstraints.length} LUID/realizability relation(s)`,
    `  0..${input.domain.maxPhantoms} phantom copy/copies from ${input.domain.phantomTemplates.length} template(s)`,
    `  ${input.domain.optionalEdges.length} optional justified edge(s)`,
    `  target backward order: ${input.assertion.projectedBackwardOrder.join(" ")}`,
  ];
  if (result.modelReplay.firstDivergence) lines.push("", `Baseline replay failure: ${result.modelReplay.firstDivergence}`);
  if (result.witness) {
    const changedBoosts = input.model.nodes.filter((node) => result.witness!.boosts[String(node.uid)] !== node.baselineBoost);
    lines.push("", "SAT witness:");
    lines.push(`  projected order: ${result.witness.projectedBackwardOrder.join(" ")}`);
    lines.push(`  changed boosts: ${changedBoosts.map((node) => `${node.uid}:${node.baselineBoost ? "on" : "off"}->${result.witness!.boosts[String(node.uid)] ? "on" : "off"}`).join(", ") || "none"}`);
    lines.push(`  phantoms: ${result.witness.phantoms.length}`);
    for (const phantom of result.witness.phantoms) {
      lines.push(`    ${phantom.templateId}: read UID ${phantom.producerUid}${phantom.producerPseudo === undefined ? "" : `/pseudo ${phantom.producerPseudo}`} at selection ${phantom.selectedAt}, LUID ${phantom.luid}, boost ${phantom.boost ? "on" : "off"}`);
    }
    lines.push("  required source mechanisms:");
    for (const requirement of result.witness.sourceRequirements) lines.push(`    - ${requirement.mechanism}: ${requirement.description}`);
    if (result.witness.hardRegisterConflicts.length > 0) {
      lines.push("  allocation warnings:");
      for (const warning of result.witness.hardRegisterConflicts) lines.push(`    - ${warning}`);
    }
    if (result.sourceSearchSpec) lines.push(`  source-search handoff: ${result.sourceSearchSpec}`);
  }
  if (result.unsatCertificate) {
    lines.push("", `${result.unsatCertificate.exhaustive ? "UNSAT certificate" : "Bounded incomplete search"}:`);
    for (const summary of result.unsatCertificate.domainSummary) lines.push(`  ${summary}`);
    for (const conflict of result.unsatCertificate.core.slice(0, 8)) {
      lines.push(`  - ${conflict.kind}${conflict.cycle === undefined ? "" : ` at cycle ${conflict.cycle}`}: ${conflict.message}`);
      if (conflict.evidence[0]) lines.push(`    ${conflict.evidence[0]}`);
    }
  }
  if (result.caveats.length > 0) {
    lines.push("", "Caveats:");
    for (const caveat of result.caveats) lines.push(`  - ${caveat}`);
  }
  return lines.join("\n");
}
