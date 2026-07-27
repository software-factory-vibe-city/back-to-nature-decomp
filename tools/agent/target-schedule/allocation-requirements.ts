import type { AllocationOrderEntry, PseudoProvenance } from "../compiler-trace/types.js";
import type {
  AbstractIntervention,
  AllocationRequirement,
  RegisterRoleMap,
  TargetScheduleRequirement,
} from "./types.js";

function roleId(role: RegisterRoleMap): string {
  return `target-$${role.targetRegister}-role`;
}

export function deriveAllocationRequirements(
  roles: RegisterRoleMap[],
  pseudos: PseudoProvenance[],
  order: AllocationOrderEntry[],
): { allocation: AllocationRequirement[]; requirements: TargetScheduleRequirement[] } {
  const nonIdentity = roles.filter((role) => role.targetRegister !== role.candidateRegister && role.pseudos.length === 1);
  const rank = new Map(order.map((entry) => [entry.pseudo, entry.rank]));
  const byPseudo = new Map(pseudos.map((pseudo) => [pseudo.pseudo, pseudo]));
  const seen = new Set<string>();
  const allocation: AllocationRequirement[] = [];
  const requirements: TargetScheduleRequirement[] = [];

  for (const left of nonIdentity) {
    const right = nonIdentity.find((candidate) =>
      candidate !== left && candidate.targetRegister === left.candidateRegister &&
      candidate.candidateRegister === left.targetRegister
    );
    if (!right) continue;
    const leftPseudo = left.pseudos[0]!;
    const rightPseudo = right.pseudos[0]!;
    const key = [leftPseudo, rightPseudo].sort((a, b) => a - b).join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    const conflict = byPseudo.get(leftPseudo)?.conflicts.some((item) => item.register === rightPseudo) ||
      byPseudo.get(rightPseudo)?.conflicts.some((item) => item.register === leftPseudo);
    if (!conflict) continue;

    const ordered = [leftPseudo, rightPseudo].sort((a, b) =>
      (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER)
    );
    const desired = [leftPseudo, rightPseudo];
    const intervention: AbstractIntervention = {
      id: `greg-order-${leftPseudo}-${rightPseudo}`,
      stage: "greg",
      kind: "allocation-order",
      uids: [],
      pseudos: [leftPseudo, rightPseudo],
      expectedEffect: `allocate pseudo ${leftPseudo} to $${left.targetRegister} and pseudo ${rightPseudo} to $${right.targetRegister}`,
      sourceMechanisms: ["fresh-vs-reused-web", "result-vs-input-reuse", "statement-birth-order", "single-vs-multi-set"],
      confidence: order.length > 0 ? "reconstructed" : "inferred",
      evidence: [
        `The .greg conflict sets prove pseudos ${leftPseudo} and ${rightPseudo} cannot share a hard register.`,
        order.length > 0
          ? `Observed allocno ranks are ${leftPseudo}:${rank.get(leftPseudo) ?? "not-listed"}, ${rightPseudo}:${rank.get(rightPseudo) ?? "not-listed"}.`
          : "The .greg allocno header was unavailable; required order is inferred from the register swap.",
      ],
    };
    const item: AllocationRequirement = {
      id: `allocation-swap-${leftPseudo}-${rightPseudo}`,
      roles: [roleId(left), roleId(right)],
      pseudos: [leftPseudo, rightPseudo],
      observedOrder: ordered,
      desiredOrder: desired,
      observedAssignments: {
        [roleId(left)]: left.candidateRegister,
        [roleId(right)]: right.candidateRegister,
      },
      desiredAssignments: {
        [roleId(left)]: left.targetRegister,
        [roleId(right)]: right.targetRegister,
      },
      requiredChanges: [intervention],
      confidence: order.length > 0 ? "reconstructed" : "inferred",
      evidence: intervention.evidence,
    };
    allocation.push(item);
    const hardAssignment: AbstractIntervention = {
      id: `greg-hard-assignment-${leftPseudo}-${rightPseudo}`,
      stage: "greg",
      kind: "hard-register-assignment",
      uids: [],
      pseudos: [leftPseudo, rightPseudo],
      expectedEffect: `counterfactually swap $${left.candidateRegister}/$${right.candidateRegister} and replay allocation-created sched2 hazards`,
      sourceMechanisms: ["fresh-vs-reused-web", "result-vs-input-reuse", "single-vs-multi-set"],
      confidence: "inferred",
      evidence: ["This is a diagnostic assignment counterfactual only; clean C must realize any final allocator change."],
    };
    requirements.push({
      id: item.id,
      stage: "greg",
      description: `${roleId(left)} and ${roleId(right)} must reverse the observed $${left.candidateRegister}/$${right.candidateRegister} assignments.`,
      targetIndexes: [...new Set([...left.targetIndexes, ...right.targetIndexes])].sort((a, b) => a - b),
      targetCanonical: [],
      candidateIndexes: [...new Set([...left.candidateIndexes, ...right.candidateIndexes])].sort((a, b) => a - b),
      candidateUids: [],
      pseudos: [leftPseudo, rightPseudo],
      hardConstraint: true,
      interventions: [intervention, hardAssignment],
      confidence: item.confidence,
      evidence: item.evidence,
    });
  }
  return { allocation, requirements };
}
