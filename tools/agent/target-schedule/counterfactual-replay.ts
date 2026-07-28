import type { SchedulerStage } from "../compiler-trace/types.js";
import type {
  AbstractIntervention,
  BaselineReplayResult,
  InstructionCorrespondence,
  MachineInstructionRef,
  SchedulerInterventionSet,
  TargetOrderConstraint,
  TargetOrderReplay,
} from "./types.js";

interface ReplayAnalysis {
  constraints: TargetOrderConstraint[];
  replays: TargetOrderReplay[];
  interventionSets: SchedulerInterventionSet[];
}

function mismatchWindows(target: MachineInstructionRef[], candidate: MachineInstructionRef[]): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  let start: number | undefined;
  const count = Math.max(target.length, candidate.length);
  for (let index = 0; index <= count; index++) {
    const mismatch = index < count && target[index]?.canonical !== candidate[index]?.canonical;
    if (mismatch && start === undefined) start = index;
    if (!mismatch && start !== undefined) {
      result.push([start, index - 1]);
      start = undefined;
    }
  }
  return result;
}

function inversionPairs(targetUids: number[], candidateUids: number[]): Array<[number, number]> {
  const targetPosition = new Map(targetUids.map((uid, index) => [uid, index]));
  const result: Array<[number, number]> = [];
  for (let left = 0; left < candidateUids.length; left++) {
    for (let right = left + 1; right < candidateUids.length; right++) {
      const a = candidateUids[left]!;
      const b = candidateUids[right]!;
      if ((targetPosition.get(a) ?? left) > (targetPosition.get(b) ?? right)) result.push([a, b]);
    }
  }
  return result;
}

function sourceMechanisms(kind: AbstractIntervention["kind"]): AbstractIntervention["sourceMechanisms"] {
  if (kind === "luid-order") return ["statement-birth-order", "constant-birth-site", "fresh-vs-reused-web"];
  if (kind === "priority-relation") return ["single-vs-multi-set", "fresh-vs-reused-web"];
  if (kind === "dependency-add" || kind === "dependency-remove") return ["alias-dependency", "result-vs-input-reuse"];
  return ["custom"];
}

function simulateTargetPermutation(
  scheduler: SchedulerStage,
  block: number,
  targetUids: number[],
): { steps: TargetOrderReplay["steps"]; interventions: AbstractIntervention[]; complete: boolean; caveats: string[] } {
  const decisions = scheduler.decisions.filter((item) => item.block === block);
  const observed = decisions.flatMap((item) => item.selectedUid === undefined ? [] : [item.selectedUid]);
  const participants = new Set(targetUids);
  const desiredBackward = [...targetUids].reverse();
  let desiredOffset = 0;
  const desiredSequence = observed.map((uid) => participants.has(uid) ? desiredBackward[desiredOffset++]! : uid);
  if (desiredOffset !== targetUids.length) {
    return { steps: [], interventions: [], complete: false, caveats: ["Not every target UID occurs in the observed scheduler selection sequence."] };
  }
  const unscheduled = new Set(observed);
  const ready = new Set(decisions[0]?.ready.map((entry) => entry.uid) || []);
  const queuedUntil = new Map<number, number>();
  const steps: TargetOrderReplay["steps"] = [];
  const interventions: AbstractIntervention[] = [];
  const caveats: string[] = [];
  let complete = true;
  const priority = (uid: number): number => {
    let value = scheduler.instructionPriorities[String(uid)]?.priority ?? 0;
    for (const decision of decisions) {
      const entry = decision.ready.find((item) => item.uid === uid);
      if (entry) value = Math.max(value >>> 0, entry.displayedPriority >>> 0);
    }
    return value >>> 0;
  };
  const luid = (uid: number): number => scheduler.luidByUid[String(uid)] ?? -1;

  let lastSelectedUid: number | undefined;
  const dependencyClass = (uid: number): 1 | 2 | 3 => {
    if (lastSelectedUid === undefined) return 3;
    const edge = scheduler.dependencies.find((item) => item.fromUid === uid && item.toUid === lastSelectedUid);
    if (!edge || edge.cost === 1) return 3;
    return edge.kind === "true" ? 1 : 2;
  };
  const outranks = (left: number, right: number): boolean => {
    if (priority(left) !== priority(right)) return priority(left) > priority(right);
    if (dependencyClass(left) !== dependencyClass(right)) return dependencyClass(left) > dependencyClass(right);
    return luid(left) > luid(right);
  };

  let pathDiverged = false;
  for (let index = 0; index < desiredSequence.length; index++) {
    const desiredUid = desiredSequence[index]!;
    const decision = decisions[index];
    const cycle = decision?.cycle ?? index + 1;
    const originalObservedUid = observed[index]!;
    for (const [uid, due] of queuedUntil) {
      if (due <= cycle) {
        ready.add(uid);
        queuedUntil.delete(uid);
      }
    }
    if (!ready.has(desiredUid)) {
      const blockers = scheduler.dependencies.filter((edge) => edge.fromUid === desiredUid && unscheduled.has(edge.toUid)).map((edge) => edge.toUid);
      if (participants.has(desiredUid)) {
        steps.push({
          cycle: decision?.cycle ?? index + 1,
          observedUid: originalObservedUid,
          desiredUid,
          desiredReady: false,
          outcome: queuedUntil.has(desiredUid) ? "latency-blocked" : "dependency-blocked",
          blockers,
          evidence: queuedUntil.has(desiredUid)
            ? [`UID ${desiredUid} is queued until cycle ${queuedUntil.get(desiredUid)} by a represented dependency cost.`]
            : blockers.length > 0
              ? [`UID ${desiredUid} still has unscheduled successor dependencies ${blockers.join(", ")}.`]
              : [`UID ${desiredUid} was not reconstructed in the counterfactual ready set.`],
        });
      }
      complete = false;
      break;
    }
    const counterfactualWinner = [...ready].sort((left, right) => outranks(left, right) ? -1 : outranks(right, left) ? 1 : left - right)[0];
    const observedResourceChoice = !pathDiverged && desiredUid === originalObservedUid && Boolean(decision?.events.length);
    if (counterfactualWinner !== undefined && desiredUid !== counterfactualWinner && !observedResourceChoice) {
      const higher = [...ready].filter((uid) => uid !== desiredUid && outranks(uid, desiredUid));
      const desiredPriority = priority(desiredUid);
      const higherPriority = higher.filter((uid) => priority(uid) > desiredPriority);
      const higherClass = higher.filter((uid) => priority(uid) === desiredPriority && dependencyClass(uid) > dependencyClass(desiredUid));
      const kind: AbstractIntervention["kind"] = higherPriority.length > 0
        ? "priority-relation"
        : higherClass.length > 0 ? "dependency-add" : "luid-order";
      const evidence = kind === "priority-relation"
        ? [`UID ${desiredUid} is ready at priority 0x${desiredPriority.toString(16)} but must outrank higher-priority ready UIDs ${higherPriority.join(", ")}.`]
        : kind === "dependency-add"
          ? [`UID ${desiredUid} is ready but must outrank dependency-class competitors ${higherClass.join(", ")} relative to UID ${lastSelectedUid ?? "none"}.`]
          : [`UID ${desiredUid} must be later in block-local LUID order than every currently outranking equal-priority/class UID: ${higher.join(", ")}.`];
      const resourceAffected = Boolean(decision?.events.length);
      steps.push({
        cycle: decision?.cycle ?? index + 1,
        observedUid: counterfactualWinner,
        desiredUid,
        desiredReady: true,
        outcome: resourceAffected ? "resource-blocked" : "tie-lost",
        decidingCriterion: resourceAffected ? "functional-unit-hazard" : kind === "priority-relation" ? "priority" : kind === "dependency-add" ? "dependency-class" : "luid",
        blockers: [],
        evidence: resourceAffected ? [...evidence, ...decision!.events] : evidence,
      });
      if (resourceAffected) {
        complete = false;
        caveats.push(`Cycle ${decision!.cycle} contains a backend resource event whose altered-path effect is not modeled.`);
      } else {
        interventions.push({
          id: `target-replay-b${block}-c${decision?.cycle ?? index + 1}-${desiredUid}-${counterfactualWinner}`,
          stage: scheduler.stage,
          kind,
          uids: [desiredUid, ...higher],
          pseudos: [],
          expectedEffect: kind === "priority-relation"
            ? `make UID ${desiredUid} outrank all higher-priority ready competitors ${higherPriority.join(", ")}`
            : kind === "dependency-add"
              ? `change the natural dependency class so UID ${desiredUid} outranks ${higherClass.join(", ")}`
              : `make UID ${desiredUid} later in block-local LUID order than ${higher.join(", ")}`,
          sourceMechanisms: sourceMechanisms(kind),
          confidence: "reconstructed",
          evidence,
        });
      }
    }
    ready.delete(desiredUid);
    unscheduled.delete(desiredUid);
    lastSelectedUid = desiredUid;
    if (desiredUid !== originalObservedUid) pathDiverged = true;
    for (const edge of scheduler.dependencies.filter((item) => item.toUid === desiredUid)) {
      if (!unscheduled.has(edge.fromUid)) continue;
      const blocked = scheduler.dependencies.some((item) => item.fromUid === edge.fromUid && unscheduled.has(item.toUid));
      if (!blocked) {
        const cost = edge.cost ?? 1;
        if (cost > 1) queuedUntil.set(edge.fromUid, Math.max(queuedUntil.get(edge.fromUid) ?? 0, cycle + cost));
        else ready.add(edge.fromUid);
      }
    }
  }
  return { steps, interventions, complete, caveats };
}

export function analyzeTargetOrderReplay(options: {
  target: MachineInstructionRef[];
  candidate: MachineInstructionRef[];
  correspondence: InstructionCorrespondence[];
  scheduler: SchedulerStage | undefined;
  baseline: BaselineReplayResult[];
  maxInterventions: number;
}): ReplayAnalysis {
  const constraints: TargetOrderConstraint[] = [];
  const replays: TargetOrderReplay[] = [];
  const interventionSets: SchedulerInterventionSet[] = [];
  if (!options.scheduler) return { constraints, replays, interventionSets };

  for (const [start, end] of mismatchWindows(options.target, options.candidate)) {
    const mapped = options.correspondence.filter((item) =>
      item.targetIndex >= start && item.targetIndex <= end &&
      item.candidateIndex !== undefined && item.candidateUid !== undefined
    ).sort((left, right) => left.targetIndex - right.targetIndex);
    const expectedCount = end - start + 1;
    if (mapped.length !== expectedCount || new Set(mapped.map((item) => item.candidateUid)).size !== mapped.length) {
      replays.push({
        stage: options.scheduler.stage,
        block: -1,
        targetUids: mapped.flatMap((item) => item.candidateUid === undefined ? [] : [item.candidateUid]),
        legality: "ambiguous-correspondence",
        status: "unsupported",
        steps: [],
        confidence: "inferred",
        caveats: [`Mismatch window ${start}:${end} lacks a unique UID for every target instruction.`],
      });
      continue;
    }
    const targetUids = mapped.map((item) => item.candidateUid!);
    const blocks = new Set(mapped.map((item) => options.candidate[item.candidateIndex!]?.block).filter((block): block is number => block !== undefined));
    if (blocks.size !== 1) {
      replays.push({
        stage: options.scheduler.stage,
        block: blocks.size === 1 ? [...blocks][0]! : -1,
        targetUids,
        legality: "cross-block",
        status: "unsupported",
        steps: [],
        confidence: "inferred",
        caveats: [`Target window ${start}:${end} maps across ${blocks.size} scheduler blocks.`],
      });
      continue;
    }
    const block = [...blocks][0]!;
    for (let index = 0; index + 1 < targetUids.length; index++) {
      constraints.push({
        beforeUid: targetUids[index]!,
        afterUid: targetUids[index + 1]!,
        source: "target-machine-order",
        confidence: "reconstructed",
        evidence: [`Target machine indexes ${start + index} and ${start + index + 1} map uniquely to candidate UIDs.`],
      });
    }
    const position = new Map(targetUids.map((uid, index) => [uid, index]));
    const violating = options.scheduler.dependencies.filter((edge) =>
      position.has(edge.fromUid) && position.has(edge.toUid) && position.get(edge.fromUid)! > position.get(edge.toUid)!
    );
    if (violating.length > 0) {
      for (const edge of violating) {
        constraints.push({
          beforeUid: edge.fromUid,
          afterUid: edge.toUid,
          source: "candidate-dependency",
          confidence: edge.confidence,
          evidence: [`Candidate ${edge.kind} dependency forbids the corresponding target order.`],
        });
      }
      replays.push({
        stage: options.scheduler.stage,
        block,
        targetUids,
        legality: "violates-candidate-dependency",
        status: "impossible-under-current-dag",
        steps: violating.map((edge) => ({
          cycle: -1,
          desiredUid: edge.toUid,
          desiredReady: false,
          outcome: "dependency-blocked",
          blockers: [edge.fromUid],
          evidence: [`${edge.kind} edge ${edge.fromUid}->${edge.toUid} conflicts with target order.`],
        })),
        confidence: violating.every((edge) => edge.confidence === "exact") ? "exact" : "reconstructed",
        caveats: ["Legality uses the candidate DAG only; target RTL dependencies are unavailable."],
      });
      continue;
    }

    const simulation = simulateTargetPermutation(options.scheduler, block, targetUids);
    const baseline = options.baseline.find((item) => item.stage === options.scheduler!.stage && item.block === block);
    const status = baseline?.status !== "exact"
      ? "baseline-not-exact" as const
      : simulation.steps.length === 0 && simulation.complete ? "reproduced-with-current-state" as const
      : simulation.complete ? "reproducible-with-interventions" as const : "unsupported" as const;
    replays.push({
      stage: options.scheduler.stage,
      block,
      targetUids,
      legality: "legal-under-candidate-dag",
      status,
      steps: simulation.steps,
      confidence: status === "reproducible-with-interventions" ? "reconstructed" : status === "reproduced-with-current-state" ? "exact" : "inferred",
      caveats: [
        "Target legality is checked against the candidate DAG; no target RTL graph is inferred.",
        "The bounded replay replaces only the participating UID subsequence, then recomputes dependency readiness after every forced selection.",
        ...simulation.caveats,
      ],
    });
    if (simulation.interventions.length > 0) {
      const unique = [...new Map(simulation.interventions.map((item) => [`${item.kind}:${item.uids.join(":")}`, item])).values()];
      interventionSets.push({
        interventions: unique.slice(0, options.maxInterventions),
        block,
        stage: options.scheduler.stage,
        changedSteps: [...new Set(simulation.steps.filter((item) => item.outcome === "tie-lost").map((item) => item.cycle))].sort((left, right) => left - right),
        preservesObservedConstraints: ["preserve current hard-register assignments", `preserve target machine ranges outside ${start}:${end}`],
        minimalWithinBound: unique.length <= options.maxInterventions,
        confidence: "reconstructed",
        evidence: [`${unique.length} unique comparator relation(s) reproduce the target participant order within the bounded dependency model for window ${start}:${end}.`],
      });
    }
  }
  return { constraints, replays, interventionSets };
}
