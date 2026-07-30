import type {
  LuidOrderConstraint,
  SchedulerBlockModel,
  SchedulerConflictReason,
  SchedulerConstraintEdge,
  SchedulerConstraintNode,
  SchedulerModelReplay,
  SchedulerReplayStep,
} from "./types.js";

export interface ConcreteSchedulerState {
  nodes: SchedulerConstraintNode[];
  dependencies: SchedulerConstraintEdge[];
  boosts: Record<string, boolean>;
  luids: Record<string, number>;
}

interface RuntimeState {
  unscheduled: Set<number>;
  ready: Set<number>;
  queuedUntil: Map<number, number>;
  lastUid?: number;
}

function activeEdges(state: ConcreteSchedulerState): SchedulerConstraintEdge[] {
  return state.dependencies.filter((edge) => !edge.optional);
}

function priority(model: SchedulerBlockModel, state: ConcreteSchedulerState, uid: number): number {
  const node = state.nodes.find((item) => item.uid === uid);
  if (!node) return 0;
  const boosted = state.boosts[String(uid)] ?? node.baselineBoost;
  return Math.max(node.basePriority, boosted ? model.launchPriority : 0) >>> 0;
}

function dependencyClass(edges: SchedulerConstraintEdge[], uid: number, lastUid: number | undefined): 1 | 2 | 3 {
  if (lastUid === undefined) return 3;
  const edge = edges.find((item) => item.fromUid === uid && item.toUid === lastUid);
  if (!edge || edge.cost === 1) return 3;
  return edge.kind === "true" ? 1 : 2;
}

function luid(state: ConcreteSchedulerState, uid: number): number {
  const node = state.nodes.find((item) => item.uid === uid);
  return state.luids[String(uid)] ?? node?.baselineLuid ?? -1;
}

function machineClassOf(state: ConcreteSchedulerState, uid: number | undefined): string | undefined {
  if (uid === undefined) return undefined;
  return state.nodes.find((item) => item.uid === uid)?.machineClass;
}

/**
 * Potential-hazard value used by the schedule_select re-pick inside one
 * priority group. Under the memory-unit policy every load and store carries
 * the memory unit's static blockage cost; the legacy policy recognizes only
 * boosted loads and only participates at launch priority.
 */
function machineHazard(model: SchedulerBlockModel, state: ConcreteSchedulerState, uid: number): number {
  if (model.hazardPolicy.kind === "none") return 0;
  const node = state.nodes.find((item) => item.uid === uid);
  if (model.hazardPolicy.kind === "memory-unit-potential-hazard") {
    return node?.machineClass === "load" || node?.machineClass === "store" ? 1 : 0;
  }
  const boosted = state.boosts[String(uid)] ?? node?.baselineBoost ?? false;
  return boosted && node?.machineClass === "load" ? 1 : 0;
}

/**
 * Loads in one examined priority group that the memory-unit actual hazard
 * queues for a cycle: a 2-cycle load issued directly after a 1-cycle store
 * would collide on the shared pipelined unit's result slot.
 */
function blockedLoads(
  model: SchedulerBlockModel,
  state: ConcreteSchedulerState,
  group: number[],
  lastUid: number | undefined,
): number[] {
  if (model.hazardPolicy.kind !== "memory-unit-potential-hazard") return [];
  if (machineClassOf(state, lastUid) !== "store") return [];
  return group.filter((uid) => machineClassOf(state, uid) === "load");
}

export interface SelectionOutcome {
  /** Comparator order of the full ready list (rank_for_schedule). */
  ranked: number[];
  /** The schedule_select winner, absent when every group member is queued. */
  selected?: number;
  /** Loads queued for one cycle by the memory-unit actual hazard. */
  blocked: number[];
  evidence: string[];
}

/** Full schedule_select: rank, queue actual hazards per group, re-pick by potential hazard. */
export function selectReady(
  model: SchedulerBlockModel,
  state: ConcreteSchedulerState,
  ready: Iterable<number>,
  lastUid?: number,
): SelectionOutcome {
  const ranked = rankReady(model, state, ready, lastUid);
  if (model.hazardPolicy.kind !== "memory-unit-potential-hazard") {
    const outcome: SelectionOutcome = { ranked, blocked: [], evidence: [] };
    if (ranked.length > 0) outcome.selected = ranked[0]!;
    return outcome;
  }
  const blocked: number[] = [];
  let index = 0;
  while (index < ranked.length) {
    const groupPriority = priority(model, state, ranked[index]!);
    let end = index;
    while (end < ranked.length && priority(model, state, ranked[end]!) === groupPriority) end++;
    const group = ranked.slice(index, end);
    const queued = blockedLoads(model, state, group, lastUid);
    blocked.push(...queued);
    const remaining = group.filter((uid) => !queued.includes(uid));
    if (remaining.length > 0) {
      let selected = remaining[0]!;
      let best = machineHazard(model, state, selected);
      for (const uid of remaining.slice(1)) {
        const hazard = machineHazard(model, state, uid);
        if (hazard > best) {
          best = hazard;
          selected = uid;
        }
      }
      const evidence: string[] = [];
      if (queued.length > 0) evidence.push(`Load(s) ${queued.join(", ")} queued one cycle behind the previous store.`);
      if (selected !== remaining[0]) evidence.push(`UID ${selected} wins the greater-potential-hazard selection within its priority group.`);
      return { ranked, selected, blocked, evidence };
    }
    index = end;
  }
  return { ranked, blocked, evidence: ["Every ready instruction in every priority group is queued by the memory-unit hazard this cycle."] };
}

export function rankReady(
  model: SchedulerBlockModel,
  state: ConcreteSchedulerState,
  ready: Iterable<number>,
  lastUid?: number,
): number[] {
  const edges = activeEdges(state);
  const comparator = [...ready].sort((left, right) =>
    priority(model, state, right) - priority(model, state, left) ||
    dependencyClass(edges, right, lastUid) - dependencyClass(edges, left, lastUid) ||
    luid(state, right) - luid(state, left) ||
    left - right
  );
  /* The legacy policy shuffles the rank order directly; the memory-unit
     policy leaves ranking pure and selects through selectReady instead. */
  if (comparator.length < 2 || model.hazardPolicy.kind !== "launch-priority-load-first") return comparator;
  const bestPriority = priority(model, state, comparator[0]!);
  if (bestPriority !== model.launchPriority) return comparator;
  const equalPriority = comparator.filter((uid) => priority(model, state, uid) === bestPriority);
  const bestHazard = Math.max(...equalPriority.map((uid) => machineHazard(model, state, uid)));
  if (bestHazard <= 0) return comparator;
  const hazardWinner = equalPriority.find((uid) => machineHazard(model, state, uid) === bestHazard);
  if (hazardWinner === undefined || hazardWinner === comparator[0]) return comparator;
  return [hazardWinner, ...comparator.filter((uid) => uid !== hazardWinner)];
}

function initialRuntime(state: ConcreteSchedulerState): RuntimeState {
  const edges = activeEdges(state);
  const unscheduled = new Set(state.nodes.map((node) => node.uid));
  const ready = new Set<number>();
  for (const uid of unscheduled) {
    if (!edges.some((edge) => edge.fromUid === uid && unscheduled.has(edge.toUid))) ready.add(uid);
  }
  return { unscheduled, ready, queuedUntil: new Map() };
}

function releaseQueued(runtime: RuntimeState, cycle: number): void {
  for (const [uid, due] of runtime.queuedUntil) {
    if (due > cycle) continue;
    runtime.ready.add(uid);
    runtime.queuedUntil.delete(uid);
  }
}

function selectUid(state: ConcreteSchedulerState, runtime: RuntimeState, uid: number, cycle: number): void {
  const edges = activeEdges(state);
  runtime.ready.delete(uid);
  runtime.unscheduled.delete(uid);
  runtime.lastUid = uid;
  for (const edge of edges.filter((item) => item.toUid === uid)) {
    if (!runtime.unscheduled.has(edge.fromUid)) continue;
    const remainsBlocked = edges.some((item) => item.fromUid === edge.fromUid && runtime.unscheduled.has(item.toUid));
    if (remainsBlocked) continue;
    if (edge.cost > 1) runtime.queuedUntil.set(edge.fromUid, Math.max(runtime.queuedUntil.get(edge.fromUid) || 0, cycle + edge.cost - 1));
    else runtime.ready.add(edge.fromUid);
  }
}

export function simulateScheduler(
  model: SchedulerBlockModel,
  state: ConcreteSchedulerState,
  expectedOrder?: number[],
): SchedulerModelReplay {
  const runtime = initialRuntime(state);
  const steps: SchedulerReplayStep[] = [];
  let matchedSelections = 0;
  let selections = 0;
  const total = state.nodes.length;
  for (let cycle = 1; selections < total && cycle <= total * 2; cycle++) {
    releaseQueued(runtime, cycle);
    const readyUids = [...runtime.ready];
    if (readyUids.length === 0) {
      steps.push({ cycle, readyUids, rankedUids: [], status: "queue-stalled", evidence: ["No instruction was ready and no represented queue entry matured at this cycle."] });
      break;
    }
    const outcome = selectReady(model, state, readyUids, runtime.lastUid);
    for (const uid of outcome.blocked) {
      runtime.ready.delete(uid);
      runtime.queuedUntil.set(uid, Math.max(runtime.queuedUntil.get(uid) || 0, cycle + 1));
    }
    const selectedUid = outcome.selected;
    if (selectedUid === undefined) {
      /* Every group member is queued; the clock advances without a pick. */
      steps.push({ cycle, readyUids, rankedUids: outcome.ranked, status: "queue-stalled", evidence: outcome.evidence });
      continue;
    }
    const expectedUid = expectedOrder?.[selections];
    selections++;
    const matched = expectedUid === undefined || selectedUid === expectedUid;
    if (matched) matchedSelections++;
    steps.push({
      cycle,
      selectedUid,
      ...(expectedUid !== undefined ? { expectedUid } : {}),
      readyUids,
      rankedUids: outcome.ranked,
      status: matched ? "matched" : "wrong-selection",
      evidence: matched
        ? [`UID ${selectedUid} is the modeled legacy-scheduler winner.`, ...outcome.evidence]
        : [`Modeled UID ${selectedUid} wins, but the observed/asserted order requires UID ${expectedUid}.`, ...outcome.evidence],
    });
    selectUid(state, runtime, selectedUid, cycle);
  }
  const exact = selections === total && expectedOrder !== undefined && expectedOrder.length === total && matchedSelections === total;
  const first = steps.find((step) => step.status !== "matched");
  return {
    exact,
    matchedSelections,
    totalSelections: expectedOrder?.length ?? total,
    steps,
    ...(first ? { firstDivergence: `cycle ${first.cycle}: ${first.evidence[0]}` } : {}),
    evidence: [
      `${matchedSelections}/${expectedOrder?.length ?? total} selections matched.`,
      "Backward readiness was recomputed from active dependency successors after every selection.",
    ],
  };
}

export interface ForcedOrderResult {
  satisfiable: boolean;
  luidConstraints: LuidOrderConstraint[];
  luids?: Record<string, number>;
  conflict?: SchedulerConflictReason;
  replay?: SchedulerModelReplay;
}

function topologicalLuids(
  nodes: SchedulerConstraintNode[],
  constraints: LuidOrderConstraint[],
  preferredOrder: number[],
): { luids?: Record<string, number>; cycle?: number[] } {
  const nodeIds = new Set(nodes.map((node) => node.uid));
  const outgoing = new Map<number, Set<number>>(nodes.map((node) => [node.uid, new Set()]));
  const indegree = new Map<number, number>(nodes.map((node) => [node.uid, 0]));
  for (const constraint of constraints) {
    if (!nodeIds.has(constraint.beforeUid) || !nodeIds.has(constraint.afterUid) || constraint.beforeUid === constraint.afterUid) continue;
    const values = outgoing.get(constraint.beforeUid)!;
    if (values.has(constraint.afterUid)) continue;
    values.add(constraint.afterUid);
    indegree.set(constraint.afterUid, (indegree.get(constraint.afterUid) || 0) + 1);
  }
  const preference = new Map(preferredOrder.map((uid, index) => [uid, index]));
  const ready = nodes.filter((node) => indegree.get(node.uid) === 0).map((node) => node.uid);
  const order: number[] = [];
  while (ready.length > 0) {
    ready.sort((left, right) =>
      (preference.get(left) ?? Number.MAX_SAFE_INTEGER) - (preference.get(right) ?? Number.MAX_SAFE_INTEGER) || left - right
    );
    const uid = ready.shift()!;
    order.push(uid);
    for (const next of outgoing.get(uid) || []) {
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) ready.push(next);
    }
  }
  if (order.length !== nodes.length) return { cycle: nodes.filter((node) => (indegree.get(node.uid) || 0) > 0).map((node) => node.uid) };
  return { luids: Object.fromEntries(order.map((uid, index) => [String(uid), index])) };
}

/**
 * Assert a concrete backward selection sequence while solving only the LUID
 * relations needed for equal-priority/equal-class choices. Readiness,
 * priorities, hazards and dependency classes remain fixed model facts.
 */
export function solveLuidForForcedOrder(
  model: SchedulerBlockModel,
  state: Omit<ConcreteSchedulerState, "luids">,
  forcedOrder: number[],
  domainConstraints: LuidOrderConstraint[],
): ForcedOrderResult {
  const concrete: ConcreteSchedulerState = { ...state, luids: {} };
  const runtime = initialRuntime(concrete);
  const constraints = [...domainConstraints];
  const edges = activeEdges(concrete);

  for (let index = 0; index < forcedOrder.length; index++) {
    const cycle = index + 1;
    const desiredUid = forcedOrder[index]!;
    releaseQueued(runtime, cycle);
    const ready = [...runtime.ready];
    if (!runtime.ready.has(desiredUid)) {
      const blockers = edges.filter((edge) => edge.fromUid === desiredUid && runtime.unscheduled.has(edge.toUid)).map((edge) => edge.toUid);
      return {
        satisfiable: false,
        luidConstraints: constraints,
        conflict: {
          id: `cycle-${cycle}-readiness-${desiredUid}`,
          kind: "readiness",
          cycle,
          desiredUid,
          competingUids: blockers,
          requirementIds: [`target-cycle-${cycle}`],
          message: `UID ${desiredUid} is not ready at target cycle ${cycle}.`,
          evidence: blockers.length > 0
            ? [`Unscheduled successor dependencies: ${blockers.join(", ")}.`]
            : ["The UID is absent from the reconstructed ready set or remains queued."],
        },
      };
    }
    const desiredPriority = priority(model, concrete, desiredUid);
    const higherPriority = ready.filter((uid) => priority(model, concrete, uid) > desiredPriority);
    if (higherPriority.length > 0) {
      return {
        satisfiable: false,
        luidConstraints: constraints,
        conflict: {
          id: `cycle-${cycle}-priority-${desiredUid}`,
          kind: "priority",
          cycle,
          desiredUid,
          competingUids: higherPriority,
          requirementIds: [`target-cycle-${cycle}`],
          message: `UID ${desiredUid} cannot outrank higher-priority ready UIDs at target cycle ${cycle}.`,
          evidence: [`Desired priority 0x${desiredPriority.toString(16)}; competitors ${higherPriority.map((uid) => `${uid}=0x${priority(model, concrete, uid).toString(16)}`).join(", ")}.`],
        },
      };
    }
    const topPriority = ready.filter((uid) => priority(model, concrete, uid) === desiredPriority);
    let group = topPriority;
    if (model.hazardPolicy.kind === "memory-unit-potential-hazard") {
      const queued = blockedLoads(model, concrete, topPriority, runtime.lastUid);
      if (queued.includes(desiredUid)) {
        return {
          satisfiable: false,
          luidConstraints: constraints,
          conflict: {
            id: `cycle-${cycle}-hazard-${desiredUid}`,
            kind: "hazard",
            cycle,
            desiredUid,
            competingUids: [runtime.lastUid!],
            requirementIds: [`target-cycle-${cycle}`],
            message: `UID ${desiredUid} is queued by the memory-unit actual hazard at target cycle ${cycle}.`,
            evidence: [`A load cannot issue directly after store UID ${runtime.lastUid}; the memory unit blocks it for one cycle.`],
          },
        };
      }
      group = topPriority.filter((uid) => !queued.includes(uid));
      const desiredHazard = machineHazard(model, concrete, desiredUid);
      const higherHazard = group.filter((uid) => machineHazard(model, concrete, uid) > desiredHazard);
      if (higherHazard.length > 0) {
        return {
          satisfiable: false,
          luidConstraints: constraints,
          conflict: {
            id: `cycle-${cycle}-hazard-${desiredUid}`,
            kind: "hazard",
            cycle,
            desiredUid,
            competingUids: higherHazard,
            requirementIds: [`target-cycle-${cycle}`],
            message: `UID ${desiredUid} loses the memory-unit potential-hazard selection at target cycle ${cycle}.`,
            evidence: ["Memory-unit instructions win the greater-potential-hazard re-pick within their priority group."],
          },
        };
      }
    } else if (desiredPriority === model.launchPriority && model.hazardPolicy.kind !== "none") {
      const desiredHazard = machineHazard(model, concrete, desiredUid);
      const higherHazard = topPriority.filter((uid) => machineHazard(model, concrete, uid) > desiredHazard);
      if (higherHazard.length > 0) {
        return {
          satisfiable: false,
          luidConstraints: constraints,
          conflict: {
            id: `cycle-${cycle}-hazard-${desiredUid}`,
            kind: "hazard",
            cycle,
            desiredUid,
            competingUids: higherHazard,
            requirementIds: [`target-cycle-${cycle}`],
            message: `UID ${desiredUid} loses the represented launch-priority hazard selection.`,
            evidence: ["The validated model selects boosted loads before equal launch-priority ordinary instructions."],
          },
        };
      }
    }
    const desiredClass = dependencyClass(edges, desiredUid, runtime.lastUid);
    const relevant = group.filter((uid) => machineHazard(model, concrete, uid) === machineHazard(model, concrete, desiredUid));
    const higherClass = relevant.filter((uid) => dependencyClass(edges, uid, runtime.lastUid) > desiredClass);
    if (higherClass.length > 0) {
      return {
        satisfiable: false,
        luidConstraints: constraints,
        conflict: {
          id: `cycle-${cycle}-dependency-class-${desiredUid}`,
          kind: "dependency-class",
          cycle,
          desiredUid,
          competingUids: higherClass,
          requirementIds: [`target-cycle-${cycle}`],
          message: `UID ${desiredUid} loses the legacy dependency-class comparison.`,
          evidence: [`Desired class ${desiredClass}; higher-class competitors ${higherClass.join(", ")}.`],
        },
      };
    }
    for (const competitor of relevant) {
      if (competitor === desiredUid || dependencyClass(edges, competitor, runtime.lastUid) !== desiredClass) continue;
      constraints.push({
        id: `target-cycle-${cycle}-luid-${competitor}-before-${desiredUid}`,
        beforeUid: competitor,
        afterUid: desiredUid,
        source: "target-selection",
        confidence: "reconstructed",
        evidence: [`At cycle ${cycle}, equal priority, hazard class and dependency class require UID ${desiredUid} to have the greater LUID than UID ${competitor}.`],
      });
    }
    selectUid(concrete, runtime, desiredUid, cycle);
  }

  if (runtime.unscheduled.size > 0) {
    return {
      satisfiable: false,
      luidConstraints: constraints,
      conflict: {
        id: "target-order-incomplete",
        kind: "domain",
        competingUids: [...runtime.unscheduled],
        requirementIds: ["target-order-complete"],
        message: "The forced target sequence does not select every modeled scheduler node.",
        evidence: [`Unscheduled UIDs: ${[...runtime.unscheduled].join(", ")}.`],
      },
    };
  }

  const solved = topologicalLuids(concrete.nodes, constraints, [...forcedOrder].reverse());
  if (!solved.luids) {
    const cycle = solved.cycle || [];
    return {
      satisfiable: false,
      luidConstraints: constraints,
      conflict: {
        id: `luid-cycle-${cycle.join("-")}`,
        kind: "luid-cycle",
        competingUids: cycle,
        requirementIds: constraints.filter((item) => cycle.includes(item.beforeUid) && cycle.includes(item.afterUid)).map((item) => item.id),
        message: "Target comparator requirements contradict the realizable LUID order domain.",
        evidence: [`The strict LUID relation graph contains a cycle over UIDs ${cycle.join(", ")}.`],
      },
    };
  }
  const replay = simulateScheduler(model, { ...concrete, luids: solved.luids }, forcedOrder);
  if (!replay.exact) {
    return {
      satisfiable: false,
      luidConstraints: constraints,
      conflict: {
        id: "luid-confirmation-failed",
        kind: "domain",
        competingUids: [],
        requirementIds: ["concrete-replay"],
        message: "The solved LUID relation assignment did not survive concrete scheduler replay.",
        evidence: [replay.firstDivergence || "Concrete replay diverged without a rendered first mismatch."],
      },
    };
  }
  return { satisfiable: true, luidConstraints: constraints, luids: solved.luids, replay };
}
