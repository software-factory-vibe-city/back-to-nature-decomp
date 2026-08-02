import type { CompilerOracleEvent, ForcedLocalAssignment } from "./types.js";

export interface LocalQuantityDecision {
  block: number;
  qty: number;
  members: number[];
  born: number;
  dead: number;
  references?: number;
  size?: number;
  minClass?: number;
  alternateClass?: number;
  callsCrossed?: number;
  suggested: boolean;
  available: number[];
  chosen?: number;
  forced: boolean;
  replayed: boolean;
}

export interface LocalQuantitySummary {
  block: number;
  qty: number;
  members: number[];
  born: number;
  dead: number;
  references?: number;
  size?: number;
  minClass?: number;
  alternateClass?: number;
  callsCrossed?: number;
  assignedHardRegister?: number;
}

export interface ForcedAssignmentAssessment extends ForcedLocalAssignment {
  block?: number;
  quantity?: number;
  baselineAvailable: boolean;
  accepted: boolean;
  rejected: boolean;
  attemptedWindows: Array<{ born: number; dead: number; suggested: boolean; available: number[] }>;
  evidence: string[];
}

export interface LocalAllocationReplay {
  quantities: LocalQuantitySummary[];
  decisions: LocalQuantityDecision[];
  ordinaryChoices: number;
  replayedChoices: number;
  replayVerified: boolean;
  requests: ForcedAssignmentAssessment[];
  caveats: string[];
}

function sameDecision(left: CompilerOracleEvent, right: CompilerOracleEvent): boolean {
  return left.block === right.block && left.qty === right.qty && left.born === right.born && left.dead === right.dead;
}

function membersForQuantity(events: CompilerOracleEvent[], block: number, qty: number): number[] {
  const final = [...events].reverse().find((event) => event.stage === "local" && event.event === "final" && event.block === block && event.qty === qty);
  if (final?.members) return final.members;
  const latest = [...events].reverse().find((event) => event.stage === "local" && event.block === block && event.qty === qty && event.members);
  return latest?.members || [];
}

export function replayLocalAllocation(
  baselineEvents: CompilerOracleEvent[],
  requested: ForcedLocalAssignment[],
  counterfactualEvents: CompilerOracleEvent[] = [],
): LocalAllocationReplay {
  const local = baselineEvents.filter((event) => event.stage === "local");
  const decisions: LocalQuantityDecision[] = [];
  const pending: Array<{ event: CompilerOracleEvent; decision: LocalQuantityDecision }> = [];
  for (const event of local) {
    if (event.event === "find") {
      const decision: LocalQuantityDecision = {
        block: event.block!,
        qty: event.qty!,
        members: membersForQuantity(local, event.block!, event.qty!),
        born: event.born!,
        dead: event.dead!,
        references: event.references,
        size: event.size,
        minClass: event.minClass,
        alternateClass: event.alternateClass,
        callsCrossed: event.callsCrossed,
        suggested: event.suggested === 1,
        available: event.available || [],
        forced: false,
        replayed: false,
      };
      decisions.push(decision);
      pending.push({ event, decision });
    } else if (event.event === "choose" || event.event === "force_accept") {
      for (let index = pending.length - 1; index >= 0; index--) {
        const candidate = pending[index]!;
        if (!sameDecision(candidate.event, event)) continue;
        candidate.decision.chosen = event.hardRegister;
        candidate.decision.forced = event.event === "force_accept";
        candidate.decision.replayed = candidate.decision.forced
          || candidate.decision.available[0] === event.hardRegister;
        pending.splice(index, 1);
        break;
      }
    }
  }

  const finalEvents = local.filter((event) => event.event === "final");
  const quantities = finalEvents.map((event): LocalQuantitySummary => ({
    block: event.block!,
    qty: event.qty!,
    members: event.members || [],
    born: event.born!,
    dead: event.dead!,
    references: event.references,
    size: event.size,
    minClass: event.minClass,
    alternateClass: event.alternateClass,
    callsCrossed: event.callsCrossed,
    assignedHardRegister: event.hardRegister !== undefined && event.hardRegister >= 0 ? event.hardRegister : undefined,
  }));
  const ordinary = decisions.filter((decision) => decision.chosen !== undefined && !decision.forced);
  const acceptedEvents = counterfactualEvents.filter((event) => event.stage === "local" && event.event === "force_accept");
  const rejectedEvents = counterfactualEvents.filter((event) => event.stage === "local" && event.event === "force_reject");
  const requests = requested.map((request): ForcedAssignmentAssessment => {
    const quantity = quantities.find((item) => item.members.includes(request.pseudo));
    const attempts = decisions.filter((decision) => decision.members.includes(request.pseudo)).map((decision) => ({
      born: decision.born,
      dead: decision.dead,
      suggested: decision.suggested,
      available: decision.available,
    }));
    const accepted = acceptedEvents.some((event) => event.hardRegister === request.hardRegister && (event.members || []).includes(request.pseudo));
    const rejected = rejectedEvents.some((event) => event.hardRegister === request.hardRegister && (event.members || []).includes(request.pseudo));
    const baselineAvailable = attempts.some((attempt) => attempt.available.includes(request.hardRegister));
    const evidence = [
      quantity
        ? `Pseudo ${request.pseudo} belongs to exact block ${quantity.block} local quantity ${quantity.qty} with members ${quantity.members.join(", ")}.`
        : `Pseudo ${request.pseudo} was not present in a final local quantity.`,
      baselineAvailable
        ? `Hard register ${request.hardRegister} appears in at least one stock find_free_reg candidate list.`
        : `Hard register ${request.hardRegister} is excluded from every stock find_free_reg candidate list for this quantity.`,
      accepted
        ? "The diagnostic compiler accepted the requested hard register using the stock exclusion set."
        : rejected
          ? "The diagnostic compiler rejected the requested hard register using the stock exclusion set."
          : "The counterfactual trace did not attempt this request.",
    ];
    return { ...request, block: quantity?.block, quantity: quantity?.qty, baselineAvailable, accepted, rejected, attemptedWindows: attempts, evidence };
  });

  return {
    quantities,
    decisions,
    ordinaryChoices: ordinary.length,
    replayedChoices: ordinary.filter((decision) => decision.replayed).length,
    replayVerified: ordinary.length > 0 && ordinary.every((decision) => decision.replayed),
    requests,
    caveats: [
      "Candidate lists are emitted by the instrumented stock find_free_reg after fixed, call-clobber, lifetime, class, frame-pointer, and size exclusions.",
      "A choice is replayed when the emitted hard register is the first candidate in the compiler's target-specific REG_ALLOC_ORDER.",
      "The diagnostic force hook accepts only candidates legal under that same exclusion state; it does not erase conflicts.",
    ],
  };
}
