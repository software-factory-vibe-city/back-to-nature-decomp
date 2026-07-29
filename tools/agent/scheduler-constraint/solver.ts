import { solveFiniteDomain, type FiniteVariable } from "./finite-solver.js";
import { simulateScheduler, solveLuidForForcedOrder, type ConcreteSchedulerState } from "./model.js";
import {
  SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
  type LuidOrderConstraint,
  type PhantomTemplate,
  type PhantomWitness,
  type SchedulerConflictReason,
  type SchedulerConstraintEdge,
  type SchedulerConstraintInput,
  type SchedulerConstraintNode,
  type SchedulerConstraintResult,
  type SchedulerConstraintWitness,
} from "./types.js";

interface PhantomInstance {
  uid: number;
  template: PhantomTemplate;
}

interface StructuralAlternative {
  id: string;
  phantoms: PhantomInstance[];
  fullOrder: number[];
}

function combinations<T>(values: T[], count: number): T[][] {
  const result: T[][] = [];
  const visit = (start: number, selected: T[]): void => {
    if (selected.length === count) {
      result.push(selected);
      return;
    }
    for (let index = start; index < values.length; index++) visit(index + 1, [...selected, values[index]!]);
  };
  visit(0, []);
  return result;
}

function permutations<T>(values: T[]): T[][] {
  if (values.length < 2) return [values];
  const result: T[][] = [];
  values.forEach((value, index) => {
    for (const suffix of permutations(values.filter((_item, itemIndex) => itemIndex !== index))) result.push([value, ...suffix]);
  });
  return result;
}

function insertedOrders(base: number[], phantoms: PhantomInstance[]): number[][] {
  const result: number[][] = [];
  const seen = new Set<string>();
  const visit = (order: number[], remaining: PhantomInstance[]): void => {
    if (remaining.length === 0) {
      const key = order.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        result.push(order);
      }
      return;
    }
    const [phantom, ...rest] = remaining;
    const releaseIndex = order.indexOf(phantom!.template.releaseUid);
    const producerIndex = order.indexOf(phantom!.template.producerUid);
    if (releaseIndex < 0 || producerIndex < 0 || releaseIndex >= producerIndex) return;
    /* Try positions closest to the producer first: a delayed reader is the
     * smallest perturbation of the projected real-instruction order. */
    for (let position = producerIndex; position > releaseIndex; position--) {
      const next = [...order];
      next.splice(position, 0, phantom!.uid);
      visit(next, rest);
    }
  };
  for (const order of permutations(phantoms)) visit(base, order);
  return result;
}

function structuralAlternatives(input: SchedulerConstraintInput): StructuralAlternative[] {
  const result: StructuralAlternative[] = [{ id: "no-phantoms", phantoms: [], fullOrder: input.assertion.projectedBackwardOrder }];
  let nextUid = -1;
  for (let count = 1; count <= input.domain.maxPhantoms; count++) {
    for (const selected of combinations(input.domain.phantomTemplates, count)) {
      const phantoms = selected.map((template) => ({ uid: nextUid--, template }));
      const orders = insertedOrders(input.assertion.projectedBackwardOrder, phantoms);
      orders.forEach((fullOrder, index) => result.push({
        id: `${selected.map((item) => item.id).join("+")}-order-${index}`,
        phantoms,
        fullOrder,
      }));
    }
  }
  return result;
}

function phantomNode(instance: PhantomInstance): SchedulerConstraintNode {
  return {
    uid: instance.uid,
    label: `self-deleting copy reading UID ${instance.template.producerUid}`,
    basePriority: 1,
    baselineBoost: false,
    boostVariable: true,
    baselineLuid: 0,
    luidVariable: true,
    machineClass: "phantom-copy",
    ...(instance.template.producerPseudo !== undefined ? { pseudo: instance.template.producerPseudo } : {}),
    ...(instance.template.readRegister ? { assignedRegister: instance.template.readRegister } : {}),
    sourceMechanisms: [instance.template.sourceMechanism],
    evidence: instance.template.evidence,
  };
}

function phantomEdges(instance: PhantomInstance): SchedulerConstraintEdge[] {
  return [
    {
      id: `${instance.template.id}-producer`,
      fromUid: instance.template.producerUid,
      toUid: instance.uid,
      kind: "true",
      cost: 1,
      confidence: "reconstructed",
      optional: false,
      sourceMechanism: instance.template.sourceMechanism,
      justification: instance.template.justification,
      evidence: ["The phantom copy reads the producer web, so backward scheduling blocks the producer until the copy is selected."],
    },
    {
      id: `${instance.template.id}-release`,
      fromUid: instance.uid,
      toUid: instance.template.releaseUid,
      kind: "unknown",
      cost: 1,
      confidence: "reconstructed",
      optional: false,
      sourceMechanism: instance.template.sourceMechanism,
      justification: instance.template.justification,
      evidence: ["The phantom is born before the same barrier/control sink that releases the producer in the candidate block."],
    },
  ];
}

function phantomLuidConstraints(instance: PhantomInstance): LuidOrderConstraint[] {
  return [
    {
      id: `${instance.template.id}-luid-after-producer`,
      beforeUid: instance.template.producerUid,
      afterUid: instance.uid,
      source: "phantom-position",
      confidence: "reconstructed",
      evidence: ["A source-level copy must occur after the value it reads."],
    },
    {
      id: `${instance.template.id}-luid-before-release`,
      beforeUid: instance.uid,
      afterUid: instance.template.releaseUid,
      source: "phantom-position",
      confidence: "reconstructed",
      evidence: ["The phantom copy must be in the RTL chain before its releasing barrier/control sink."],
    },
  ];
}

function baselineState(input: SchedulerConstraintInput): ConcreteSchedulerState {
  return {
    nodes: input.model.nodes,
    dependencies: input.model.dependencies,
    boosts: Object.fromEntries(input.model.nodes.map((node) => [String(node.uid), node.baselineBoost])),
    luids: Object.fromEntries(input.model.nodes.map((node) => [String(node.uid), node.baselineLuid])),
  };
}

function finiteVariables(input: SchedulerConstraintInput, structure: StructuralAlternative): FiniteVariable<boolean>[] {
  const nodeByUid = new Map(input.model.nodes.map((node) => [node.uid, node]));
  const boosts: FiniteVariable<boolean>[] = input.domain.variableBoostUids.map((uid) => {
    const baseline = nodeByUid.get(uid)?.baselineBoost || false;
    return {
      id: `boost:${uid}`,
      values: [
        { value: baseline, cost: 0, label: `baseline-${baseline}` },
        { value: !baseline, cost: 1, label: `toggle-${!baseline}` },
      ],
    };
  });
  const phantomBoosts: FiniteVariable<boolean>[] = structure.phantoms.map((phantom) => ({
    id: `boost:${phantom.uid}`,
    values: [
      { value: false, cost: 0, label: "unboosted" },
      { value: true, cost: 1, label: "birth-boosted" },
    ],
  }));
  const edges: FiniteVariable<boolean>[] = input.domain.optionalEdges.map((edge) => ({
    id: `edge:${edge.id}`,
    values: [
      { value: false, cost: 0, label: "absent" },
      { value: true, cost: 1, label: "enabled" },
    ],
  }));
  return [...boosts, ...phantomBoosts, ...edges];
}

function buildState(
  input: SchedulerConstraintInput,
  structure: StructuralAlternative,
  assignment: ReadonlyMap<string, boolean>,
): Omit<ConcreteSchedulerState, "luids"> & { enabledExtraEdges: string[] } {
  const nodes = [...input.model.nodes, ...structure.phantoms.map(phantomNode)];
  const enabledOptional = input.domain.optionalEdges.filter((edge) => assignment.get(`edge:${edge.id}`) === true).map((edge) => ({ ...edge, optional: false }));
  const dependencies = [
    ...input.model.dependencies,
    ...structure.phantoms.flatMap(phantomEdges),
    ...enabledOptional,
  ];
  const boosts = Object.fromEntries(nodes.map((node) => [String(node.uid), assignment.get(`boost:${node.uid}`) ?? node.baselineBoost]));
  return { nodes, dependencies, boosts, enabledExtraEdges: enabledOptional.map((edge) => edge.id) };
}

function sourceRequirements(
  input: SchedulerConstraintInput,
  state: ReturnType<typeof buildState>,
  structure: StructuralAlternative,
): SchedulerConstraintWitness["sourceRequirements"] {
  const result: SchedulerConstraintWitness["sourceRequirements"] = [];
  for (const node of input.model.nodes) {
    const value = state.boosts[String(node.uid)]!;
    if (value === node.baselineBoost) continue;
    result.push({
      id: `web-boost-${node.uid}`,
      mechanism: "single-vs-multi-set",
      description: value
        ? `Make UID ${node.uid}'s destination a single-set web live at ready time.`
        : `Remove UID ${node.uid}'s birthing boost through a realizable multi-set or not-live-at-ready web.`,
      uids: [node.uid],
      pseudos: node.pseudo === undefined ? [] : [node.pseudo],
      evidence: [`Baseline boost ${node.baselineBoost}; witness boost ${value}.`, ...node.evidence],
    });
  }
  for (const phantom of structure.phantoms) {
    result.push({
      id: `phantom-${phantom.template.id}`,
      mechanism: phantom.template.sourceMechanism,
      description: `Create a coalescible typed copy reading UID ${phantom.template.producerUid}'s web between its producer and release sink.`,
      uids: [phantom.template.producerUid, phantom.template.releaseUid],
      pseudos: phantom.template.producerPseudo === undefined ? [] : [phantom.template.producerPseudo],
      evidence: [phantom.template.justification, ...phantom.template.evidence],
    });
  }
  for (const edgeId of state.enabledExtraEdges) {
    const edge = input.domain.optionalEdges.find((item) => item.id === edgeId)!;
    result.push({
      id: `extra-edge-${edge.id}`,
      mechanism: edge.sourceMechanism!,
      description: `Realize dependency ${edge.fromUid}->${edge.toUid}: ${edge.justification}`,
      uids: [edge.fromUid, edge.toUid],
      pseudos: [],
      evidence: edge.evidence,
    });
  }
  return result;
}

function hardRegisterConflicts(input: SchedulerConstraintInput, requirements: SchedulerConstraintWitness["sourceRequirements"]): string[] {
  const nodeByUid = new Map(input.model.nodes.map((node) => [node.uid, node]));
  return requirements.flatMap((requirement) => requirement.uids.flatMap((uid) => {
    const node = nodeByUid.get(uid);
    return node?.assignedRegister
      ? [`${requirement.id} changes web structure around UID ${uid}, currently colored $${node.assignedRegister}; full-pipeline allocation confirmation is required.`]
      : [];
  }));
}

function conflictCore(conflicts: Map<string, { conflict: SchedulerConflictReason; count: number }>): SchedulerConflictReason[] {
  return [...conflicts.values()]
    .sort((left, right) => right.count - left.count || left.conflict.id.localeCompare(right.conflict.id))
    .map(({ conflict, count }) => ({ ...conflict, evidence: [...conflict.evidence, `This first-failure conflict rejected ${count} explored complete assignment(s).`] }));
}

export function solveSchedulerConstraints(input: SchedulerConstraintInput, artifacts: string): SchedulerConstraintResult {
  const modelReplay = simulateScheduler(input.model, baselineState(input), input.model.baselineBackwardOrder);
  if (!modelReplay.exact) {
    return {
      schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
      function: input.model.function,
      stage: input.model.stage,
      block: input.model.block,
      status: "model-replay-failed",
      modelReplay,
      exploredAssignments: 0,
      structuralAlternatives: 0,
      artifacts,
      caveats: [
        "The candidate replay validation gate failed; no target assertion or impossibility claim was evaluated.",
        ...input.model.caveats,
      ],
    };
  }

  const structures = structuralAlternatives(input);
  const conflicts = new Map<string, { conflict: SchedulerConflictReason; count: number }>();
  let exploredAssignments = 0;
  let structuralCount = 0;
  let truncated = false;

  for (const structure of structures) {
    if (exploredAssignments >= input.domain.maxAssignments) {
      truncated = true;
      break;
    }
    structuralCount++;
    let solved: ReturnType<typeof solveLuidForForcedOrder> | undefined;
    let solvedState: ReturnType<typeof buildState> | undefined;
    const finite = solveFiniteDomain<boolean>({
      variables: finiteVariables(input, structure),
      maxAssignments: input.domain.maxAssignments - exploredAssignments,
      evaluateComplete: (assignment) => {
        const state = buildState(input, structure, assignment);
        const luidConstraints = [
          ...input.domain.luidOrderConstraints,
          ...structure.phantoms.flatMap(phantomLuidConstraints),
        ];
        const result = solveLuidForForcedOrder(input.model, state, structure.fullOrder, luidConstraints);
        if (result.satisfiable) {
          solved = result;
          solvedState = state;
          return true;
        }
        if (result.conflict) {
          const existing = conflicts.get(result.conflict.id);
          conflicts.set(result.conflict.id, { conflict: result.conflict, count: (existing?.count || 0) + 1 });
        }
        return false;
      },
    });
    exploredAssignments += finite.exploredAssignments;
    if (finite.status === "sat" && finite.assignment && solved?.luids && solvedState) {
      const requirements = sourceRequirements(input, solvedState, structure);
      const phantoms: PhantomWitness[] = structure.phantoms.map((phantom) => ({
        uid: phantom.uid,
        templateId: phantom.template.id,
        producerUid: phantom.template.producerUid,
        releaseUid: phantom.template.releaseUid,
        selectedAt: structure.fullOrder.indexOf(phantom.uid) + 1,
        boost: solvedState!.boosts[String(phantom.uid)] || false,
        luid: solved!.luids![String(phantom.uid)]!,
        ...(phantom.template.readRegister ? { readRegister: phantom.template.readRegister } : {}),
        ...(phantom.template.producerPseudo !== undefined ? { producerPseudo: phantom.template.producerPseudo } : {}),
        sourceMechanism: phantom.template.sourceMechanism,
        evidence: [phantom.template.justification, ...phantom.template.evidence],
      }));
      const witness: SchedulerConstraintWitness = {
        boosts: solvedState.boosts,
        luids: solved.luids,
        enabledExtraEdges: solvedState.enabledExtraEdges,
        phantoms,
        fullBackwardOrder: structure.fullOrder,
        projectedBackwardOrder: structure.fullOrder.filter((uid) => uid >= 0),
        sourceRequirements: requirements,
        hardRegisterConflicts: hardRegisterConflicts(input, requirements),
        evidence: [
          `Concrete legacy-scheduler replay selected all ${structure.fullOrder.length} modeled nodes in the asserted order.`,
          `The witness uses ${phantoms.length} bounded phantom copy/copies and ${requirements.length} named source-mechanism requirement(s).`,
        ],
      };
      return {
        schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
        function: input.model.function,
        stage: input.model.stage,
        block: input.model.block,
        status: "sat",
        modelReplay,
        exploredAssignments,
        structuralAlternatives: structuralCount,
        witness,
        artifacts,
        caveats: [
          "SAT proves reachability only in the serialized scheduler-state domain; it is not a matching C source.",
          "Phantom coalescing and hard-register coloring remain full-pipeline obligations.",
          input.model.stage === "sched" ? "The witness assumes sched2 inherits sched1 emission order with no birthing boost; only the configured full pipeline can validate that boundary." : "This witness is scoped to post-allocation sched2 state.",
          ...input.domain.caveats,
        ],
      };
    }
    if (finite.status === "inconclusive") {
      truncated = true;
      break;
    }
  }

  const status = truncated ? "inconclusive" as const : "unsat" as const;
  return {
    schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
    function: input.model.function,
    stage: input.model.stage,
    block: input.model.block,
    status,
    modelReplay,
    exploredAssignments,
    structuralAlternatives: structuralCount,
    unsatCertificate: {
      bounded: true,
      exhaustive: !truncated,
      exploredAssignments,
      structuralAlternatives: structuralCount,
      domainSummary: [
        `${input.domain.variableBoostUids.length} boost variable(s).`,
        `${input.domain.luidOrderConstraints.length} realizability/LUID constraint(s).`,
        `0..${input.domain.maxPhantoms} phantom(s) from ${input.domain.phantomTemplates.length} template(s).`,
        `${input.domain.optionalEdges.length} optional justified dependency edge(s).`,
      ],
      core: conflictCore(conflicts),
      caveats: [
        truncated
          ? "The assignment bound was reached. This is INCONCLUSIVE, not an impossibility certificate."
          : "UNSAT is exhaustive only for the serialized finite domain, target assertion, scheduler model, phantom templates, and optional-edge catalog.",
        "The certificate retains the complete deterministic first-failure conflict partition for all explored assignments; it is reproducible from input.json, but is not an externally checkable resolution proof or a guaranteed minimum-cardinality core.",
      ],
    },
    artifacts,
    caveats: [
      status === "unsat" ? "No assignment in the serialized finite domain reproduces the asserted projected target order." : "The configured assignment bound ended search before the finite domain was exhausted.",
      ...input.domain.caveats,
    ],
  };
}
