import type { AllocatorCounterfactualAnalysis, PseudoCounterfactual } from "./types.js";

function findingLine(finding: PseudoCounterfactual): string {
  const observed = finding.observedRegister ? `$${finding.observedRegister}` : "unassigned";
  const rank = finding.rank === undefined ? "local" : `rank ${finding.rank}, priority ${finding.priority}`;
  return `    pseudo ${finding.pseudo}: ${observed} -> $${finding.desiredRegister}; ${finding.verdict} (${finding.allocationStage || "unknown"}, ${rank})`;
}

export function renderAllocatorCounterfactual(analysis: AllocatorCounterfactualAnalysis): string {
  const lines: string[] = [];
  lines.push(`Allocator counterfactual: ${analysis.function}`);
  lines.push(`source:    ${analysis.source}`);
  lines.push(`artifacts: ${analysis.outputDirectory}`);
  lines.push(`allocnos:  ${analysis.allocnos.length}; GCC priority order ${analysis.allocnoOrderVerified ? "verified" : "NOT verified"}`);
  lines.push(`formula:   ${analysis.allocnoPriorityFormula}`);
  lines.push("");
  lines.push("Target register roles:");
  if (analysis.roles.length === 0) lines.push("  none");
  for (const role of analysis.roles) {
    lines.push(`  $${role.targetRegister} <- candidate $${role.candidateRegister}; UIDs ${role.candidateUids.join(", ") || "ambiguous"}; pseudos ${role.pseudos.join(", ") || "ambiguous"} (${role.confidence})`);
    for (const finding of role.findings) {
      lines.push(findingLine(finding));
      for (const blocker of finding.explicitHardBlockers) {
        const relation = blocker.requiredRelation
          ? `; require UID ${blocker.requiredRelation.beforeUid} before UID ${blocker.requiredRelation.afterUid}`
          : "";
        lines.push(`      explicit $${blocker.register} live ${blocker.birthIndex}..${blocker.deathIndex} overlaps role ${blocker.roleBirthIndex}..${blocker.roleDeathIndex}${relation}`);
      }
      for (const blocker of finding.allocatedPseudoBlockers) {
        lines.push(`      pseudo blocker ${blocker.pseudo} occupies $${blocker.assignedRegister} at ${blocker.birthIndex}..${blocker.deathIndex} (${blocker.allocationStage || "unknown"})`);
      }
      for (const intervention of finding.priorityInterventions) {
        const refs = intervention.minimumReferences === undefined ? "n/a" : String(intervention.minimumReferences);
        const span = intervention.maximumLiveLength === undefined ? "n/a" : String(intervention.maximumLiveLength);
        lines.push(`      outrank pseudo ${intervention.blockerPseudo}: priority >= ${intervention.requiredPriority}; refs >= ${refs} or live length <= ${span}`);
      }
      if (finding.sourceMechanisms.length > 0) lines.push(`      source mechanisms: ${finding.sourceMechanisms.join(", ")}`);
    }
  }
  lines.push("");
  lines.push("Minimal requirements:");
  if (analysis.requirements.length === 0) lines.push("  none derived");
  for (const requirement of analysis.requirements) lines.push(`  - ${requirement}`);
  lines.push("");
  lines.push("Allocno order:");
  for (const allocno of analysis.allocnos) {
    lines.push(`  ${String(allocno.rank).padStart(2)} pseudo ${String(allocno.pseudo).padStart(3)} priority ${String(allocno.priority).padStart(6)} refs ${String(allocno.references).padStart(3)} live ${String(allocno.liveLength).padStart(3)} -> ${allocno.assignedRegister ? `$${allocno.assignedRegister}` : "unassigned"}`);
  }
  lines.push("");
  lines.push("Caveats:");
  for (const caveat of analysis.caveats) lines.push(`  - ${caveat}`);
  return `${lines.join("\n")}\n`;
}
