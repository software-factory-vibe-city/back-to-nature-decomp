import type { CompilerTraceReport, PseudoProvenance, SchedulerStage } from "../compiler-trace/types.js";
import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import {
  DEFAULT_LAUNCH_PRIORITY,
  SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
  type LuidOrderConstraint,
  type PhantomTemplate,
  type SchedulerBlockModel,
  type SchedulerConstraintDomain,
  type SchedulerConstraintEdge,
  type SchedulerConstraintInput,
  type SchedulerConstraintNode,
  type SchedulerMachineClass,
  type SchedulerTargetAssertion,
} from "./types.js";

export interface DeriveSchedulerConstraintOptions {
  functionName: string;
  stage: "sched" | "sched2";
  block: number;
  maxPhantoms: number;
  maxAssignments: number;
}

function machineClass(mnemonic: string | undefined, zeroWidth: boolean): SchedulerMachineClass {
  if (zeroWidth) return "zero-width";
  if (!mnemonic) return "ordinary";
  if (/^(?:lb|lbu|lh|lhu|lw|lwl|lwr)$/.test(mnemonic)) return "load";
  if (/^(?:sb|sh|sw|swl|swr)$/.test(mnemonic)) return "store";
  if (/^(?:b|beq|beqz|bne|bnez|j|jal|jalr|jr)$/.test(mnemonic)) return "control";
  return "ordinary";
}

function pseudoForUid(pseudos: PseudoProvenance[], stage: string, uid: number): PseudoProvenance | undefined {
  const values = pseudos.filter((pseudo) => pseudo.stages.some((presence) => presence.stage === stage && presence.setUids.includes(uid)));
  return values.length === 1 ? values[0] : undefined;
}

function sourceMechanisms(nodeClass: SchedulerMachineClass): SchedulerConstraintNode["sourceMechanisms"] {
  if (nodeClass === "store" || nodeClass === "control" || nodeClass === "zero-width") return [];
  return ["single-vs-multi-set", "fresh-vs-reused-web", "statement-birth-order"];
}

function stageFor(trace: CompilerTraceReport, stage: "sched" | "sched2"): SchedulerStage {
  const result = trace.schedulers.find((item) => item.stage === stage);
  if (!result) throw new Error(`compiler trace has no .${stage} scheduler stage`);
  return result;
}

function blockParticipants(scheduler: SchedulerStage, block: number): number[] {
  const decisions = scheduler.decisions.filter((decision) => decision.block === block);
  if (decisions.length === 0) throw new Error(`.${scheduler.stage} has no decisions for block ${block}`);
  const selected = decisions.flatMap((decision) => decision.selectedUid === undefined ? [] : [decision.selectedUid]);
  if (selected.length !== decisions.length || new Set(selected).size !== selected.length) {
    throw new Error(`.${scheduler.stage} block ${block} does not have one unique selected UID per decision`);
  }
  return selected;
}

function deriveModel(
  options: DeriveSchedulerConstraintOptions,
  trace: CompilerTraceReport,
  analysis: TargetScheduleAnalysis,
): SchedulerBlockModel {
  const scheduler = stageFor(trace, options.stage);
  const decisions = scheduler.decisions.filter((decision) => decision.block === options.block);
  const baselineBackwardOrder = blockParticipants(scheduler, options.block);
  const participants = new Set(baselineBackwardOrder);
  const zeroWidth = new Set(analysis.emissionAlignment.filter((item) => item.kind === "zero-width" && item.rtlUid !== undefined).map((item) => item.rtlUid!));
  const candidateByUid = new Map(analysis.candidate.filter((item) => item.uid !== undefined).map((item) => [item.uid!, item]));
  const nodes: SchedulerConstraintNode[] = baselineBackwardOrder.map((uid) => {
    const candidate = candidateByUid.get(uid);
    const kind = machineClass(candidate?.mnemonic, zeroWidth.has(uid));
    const pseudo = pseudoForUid(trace.pseudos, options.stage, uid);
    const basePriority = scheduler.instructionPriorities[String(uid)]?.priority ?? 1;
    const baselineBoost = decisions.some((decision) => decision.ready.some((entry) => entry.uid === uid && entry.displayedPriority === DEFAULT_LAUNCH_PRIORITY)) && basePriority < DEFAULT_LAUNCH_PRIORITY;
    const luid = scheduler.luidByUid[String(uid)];
    if (luid === undefined) throw new Error(`.${options.stage} block ${options.block} UID ${uid} has no reconstructed LUID`);
    const abiEntryCopy = kind === "ordinary" && candidate?.mnemonic === "move" && luid <= 3 && /^(?:a[0-3]|sp)$/.test(candidate.operands[1] || "");
    /* ABI-promoted stack loads are born before top-level statements and are
     * recognized here by their observed launch boost. An explicit source
     * assignment load (for example a multi-set local) remains movable. */
    const promotedEntryLoad = kind === "load" && baselineBoost;
    const luidVariable = !["control", "zero-width"].includes(kind) && !abiEntryCopy && !promotedEntryLoad;
    const boostVariable = options.stage === "sched" && Boolean(pseudo) && !["store", "control", "zero-width"].includes(kind) && !promotedEntryLoad;
    return {
      uid,
      label: candidate?.canonical || `zero-width UID ${uid}`,
      basePriority,
      baselineBoost,
      boostVariable,
      baselineLuid: luid,
      luidVariable,
      machineClass: kind,
      ...(pseudo ? { pseudo: pseudo.pseudo } : {}),
      ...(pseudo?.assignedRegister ? { assignedRegister: pseudo.assignedRegister } : {}),
      sourceMechanisms: sourceMechanisms(kind),
      evidence: [
        candidate ? `Final machine instruction: ${candidate.canonical}.` : "UID is retained as an explicit non-emitting scheduler node.",
        pseudo ? `UID sets traced pseudo ${pseudo.pseudo}${pseudo.sets === undefined ? "" : ` with ${pseudo.sets} total SET(s)`}.` : "No unique SET pseudo was attributed to this UID.",
        abiEntryCopy ? "The ABI entry copy has a fixed pre-statement chain position." : luidVariable ? "The instruction is in the statement-order-realizable LUID domain." : "The instruction's LUID relation is fixed by ABI, load promotion, control, or zero-width placement.",
      ],
    };
  });
  const dependencies: SchedulerConstraintEdge[] = scheduler.dependencies
    .filter((edge) => participants.has(edge.fromUid) && participants.has(edge.toUid))
    .map((edge, index) => ({
      id: `candidate-edge-${index}-${edge.fromUid}-${edge.toUid}`,
      fromUid: edge.fromUid,
      toUid: edge.toUid,
      kind: edge.kind,
      cost: Math.max(1, edge.cost || 1),
      confidence: edge.confidence,
      optional: false,
      justification: "Observed candidate scheduler dependency",
      evidence: edge.evidence,
    }));
  const eventSelections = decisions.filter((decision) => decision.events.some((event) => event.includes("greater potential hazard")));
  const eventWinnersAreBoostedLoads = eventSelections.every((decision) => {
    const node = nodes.find((item) => item.uid === decision.selectedUid);
    return node?.machineClass === "load" && node.baselineBoost;
  });
  return {
    schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
    function: options.functionName,
    stage: options.stage,
    block: options.block,
    launchPriority: DEFAULT_LAUNCH_PRIORITY,
    nodes,
    dependencies,
    baselineBackwardOrder,
    baselineForwardOrder: scheduler.forwardOrder.filter((uid) => participants.has(uid)),
    baselineReadySets: decisions.map((decision) => ({ cycle: decision.cycle, uids: decision.ready.map((entry) => entry.uid) })),
    hazardPolicy: eventSelections.length > 0 && eventWinnersAreBoostedLoads
      ? { kind: "launch-priority-load-first", evidence: [`${eventSelections.length} observed greater-potential-hazard selections all chose boosted loads from the launch-priority group.`] }
      : { kind: "none", evidence: eventSelections.length === 0 ? ["No backend hazard winner participates in this block."] : ["Observed hazard events do not fit the supported boosted-load model; baseline replay must fail closed if they affect selection."] },
    caveats: [
      "The model covers one legacy-scheduler block and uses candidate dependencies as the machine-semantic DAG.",
      "A target assertion is meaningful only after exact baseline replay with the observed boosts and LUIDs.",
    ],
  };
}

function deriveAssertion(
  options: DeriveSchedulerConstraintOptions,
  model: SchedulerBlockModel,
  analysis: TargetScheduleAnalysis,
): SchedulerTargetAssertion {
  const participants = new Set(model.baselineBackwardOrder);
  const controlIndexes = analysis.candidate.filter((instruction) =>
    instruction.uid !== undefined && participants.has(instruction.uid) && model.nodes.find((node) => node.uid === instruction.uid)?.machineClass === "control"
  ).map((instruction) => instruction.index);
  const firstControlIndex = controlIndexes.length > 0 ? Math.min(...controlIndexes) : Number.MAX_SAFE_INTEGER;
  const prefixUids = new Set(analysis.candidate.filter((instruction) =>
    instruction.uid !== undefined && participants.has(instruction.uid) && instruction.index < firstControlIndex
  ).map((instruction) => instruction.uid!));
  const targetMapped = analysis.correspondence.filter((item) => item.candidateUid !== undefined && prefixUids.has(item.candidateUid))
    .sort((left, right) => left.targetIndex - right.targetIndex);
  const uniqueMapped = new Set(targetMapped.map((item) => item.candidateUid));
  if (prefixUids.size > 0 && targetMapped.length === prefixUids.size && uniqueMapped.size === prefixUids.size) {
    const desiredParticipants = targetMapped.map((item) => item.candidateUid!).reverse();
    let offset = 0;
    const projectedBackwardOrder = model.baselineBackwardOrder.map((uid) => prefixUids.has(uid) ? desiredParticipants[offset++]! : uid);
    return {
      schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
      function: options.functionName,
      stage: options.stage,
      block: options.block,
      projectedBackwardOrder,
      participantUids: [...prefixUids].sort((left, right) => left - right),
      fixedUids: model.baselineBackwardOrder.filter((uid) => !prefixUids.has(uid)),
      derivation: "target-machine-prefix",
      confidence: targetMapped.every((item) => item.confidence === "exact") ? "exact" : "reconstructed",
      evidence: [
        `Mapped all ${prefixUids.size} emitted pre-control block participant(s) uniquely from target machine order.`,
        "Post-control and zero-width scheduler nodes retain their observed relative slots so delayed-branch movement is not attributed to sched1.",
      ],
    };
  }

  const replay = analysis.targetOrderReplays.find((item) => item.stage === options.stage && item.block === options.block && item.targetUids.length > 0);
  if (!replay) throw new Error(`cannot derive a unique target-order assertion for .${options.stage} block ${options.block}`);
  const replayParticipants = new Set(replay.targetUids);
  const desired = [...replay.targetUids].reverse();
  let offset = 0;
  return {
    schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
    function: options.functionName,
    stage: options.stage,
    block: options.block,
    projectedBackwardOrder: model.baselineBackwardOrder.map((uid) => replayParticipants.has(uid) ? desired[offset++]! : uid),
    participantUids: [...replayParticipants],
    fixedUids: model.baselineBackwardOrder.filter((uid) => !replayParticipants.has(uid)),
    derivation: "target-replay-window",
    confidence: replay.confidence,
    evidence: ["Used the uniquely mapped target-order replay window because a complete pre-control block mapping was unavailable."],
  };
}

function fixedAndSemanticLuidConstraints(model: SchedulerBlockModel): LuidOrderConstraint[] {
  const result: LuidOrderConstraint[] = [];
  for (let left = 0; left < model.nodes.length; left++) {
    for (let right = left + 1; right < model.nodes.length; right++) {
      const a = model.nodes[left]!;
      const b = model.nodes[right]!;
      if (a.luidVariable && b.luidVariable) continue;
      const [before, after] = a.baselineLuid < b.baselineLuid ? [a, b] : [b, a];
      result.push({
        id: `fixed-chain-${before.uid}-before-${after.uid}`,
        beforeUid: before.uid,
        afterUid: after.uid,
        source: "fixed-chain",
        confidence: "reconstructed",
        evidence: ["At least one endpoint has a non-source-permutable ABI, promoted-load, control, or zero-width LUID position."],
      });
    }
  }
  for (const edge of model.dependencies) {
    result.push({
      id: `semantic-order-${edge.fromUid}-before-${edge.toUid}`,
      beforeUid: edge.fromUid,
      afterUid: edge.toUid,
      source: "semantic-dependency",
      confidence: edge.confidence,
      evidence: [`The candidate ${edge.kind} dependency requires the producer/access UID to precede its dependent in the pre-scheduler chain domain.`],
    });
  }
  return result;
}

function phantomTemplates(model: SchedulerBlockModel, trace: CompilerTraceReport, assertion: SchedulerTargetAssertion): PhantomTemplate[] {
  const targetPosition = new Map(assertion.projectedBackwardOrder.map((uid, index) => [uid, index]));
  const decisionsByReadyUid = new Map<number, number>();
  for (const ready of model.baselineReadySets) for (const uid of ready.uids) if (!decisionsByReadyUid.has(uid)) decisionsByReadyUid.set(uid, ready.cycle);
  const templates: PhantomTemplate[] = [];
  for (const node of model.nodes) {
    if (node.pseudo === undefined || !node.assignedRegister || node.machineClass !== "ordinary") continue;
    const firstReady = decisionsByReadyUid.get(node.uid);
    if (firstReady === undefined || firstReady <= 1) continue;
    const releaseUid = model.baselineBackwardOrder[firstReady - 2];
    if (releaseUid === undefined || (targetPosition.get(releaseUid) ?? Number.MAX_SAFE_INTEGER) >= (targetPosition.get(node.uid) ?? -1)) continue;
    const pseudo = trace.pseudos.find((item) => item.pseudo === node.pseudo);
    templates.push({
      id: `phantom-read-web-${node.pseudo}-uid-${node.uid}`,
      producerUid: node.uid,
      producerPseudo: node.pseudo,
      releaseUid,
      readRegister: node.assignedRegister,
      sourceMechanism: "fresh-vs-reused-web",
      coalescible: true,
      justification: `A typed reg-reg copy may read pseudo ${node.pseudo}, coalesce onto $${node.assignedRegister}, and disappear after allocation while remaining visible to sched1.`,
      evidence: [
        `Producer UID ${node.uid} first becomes ready after UID ${releaseUid}; a pre-barrier reader would delay that readiness until the phantom is selected.`,
        `Pseudo ${node.pseudo} is assigned to $${node.assignedRegister}${pseudo?.sourceExpression ? ` and is associated with ${pseudo.sourceExpression}` : ""}.`,
      ],
    });
  }
  return templates.sort((left, right) => {
    const leftNode = model.nodes.find((node) => node.uid === left.producerUid)!;
    const rightNode = model.nodes.find((node) => node.uid === right.producerUid)!;
    return Number(rightNode.baselineBoost) - Number(leftNode.baselineBoost) || leftNode.baselineLuid - rightNode.baselineLuid || left.id.localeCompare(right.id);
  }).slice(0, 8);
}

function deriveDomain(
  options: DeriveSchedulerConstraintOptions,
  model: SchedulerBlockModel,
  trace: CompilerTraceReport,
  assertion: SchedulerTargetAssertion,
): SchedulerConstraintDomain {
  const variableBoostUids = model.nodes.filter((node) => node.boostVariable).map((node) => node.uid).sort((left, right) => left - right);
  const templates = options.stage === "sched" ? phantomTemplates(model, trace, assertion) : [];
  return {
    schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION,
    function: options.functionName,
    stage: options.stage,
    block: options.block,
    variableBoostUids,
    luidOrderConstraints: fixedAndSemanticLuidConstraints(model),
    phantomTemplates: templates,
    maxPhantoms: Math.min(options.maxPhantoms, templates.length),
    optionalEdges: [],
    maxAssignments: options.maxAssignments,
    sourceMechanisms: [
      ...variableBoostUids.map((uid) => ({ variable: `boost:${uid}`, mechanism: "single-vs-multi-set" as const, description: `Toggle UID ${uid}'s birthing eligibility through a realizable SET-count/live-at-ready web change.` })),
      ...templates.map((template) => ({ variable: `phantom:${template.id}`, mechanism: template.sourceMechanism, description: template.justification })),
    ],
    caveats: [
      "Automatically derived extra dependency edges are empty: an edge is admitted only when a caller supplies a serialized domain entry with a named semantic justification.",
      "Phantom templates are bounded coalescible reg-reg copy hypotheses; their existence in the model is not proof that a clean C source realizes them.",
    ],
  };
}

export function deriveSchedulerConstraintInput(
  options: DeriveSchedulerConstraintOptions,
  trace: CompilerTraceReport,
  analysis: TargetScheduleAnalysis,
): SchedulerConstraintInput {
  if (options.maxPhantoms < 0 || options.maxPhantoms > 3) throw new Error("maxPhantoms must be 0..3");
  if (!Number.isInteger(options.maxAssignments) || options.maxAssignments < 1) throw new Error("maxAssignments must be a positive integer");
  if (trace.function !== options.functionName || analysis.function !== options.functionName) throw new Error("trace/analysis function does not match the scheduler constraint target");
  const model = deriveModel(options, trace, analysis);
  const assertion = deriveAssertion(options, model, analysis);
  const domain = deriveDomain(options, model, trace, assertion);
  return { schemaVersion: SCHEDULER_CONSTRAINT_SCHEMA_VERSION, model, domain, assertion };
}

export function validateSchedulerConstraintInput(value: unknown): SchedulerConstraintInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("scheduler constraint input must be an object");
  const raw = value as Partial<SchedulerConstraintInput>;
  if (raw.schemaVersion !== SCHEDULER_CONSTRAINT_SCHEMA_VERSION) throw new Error(`unsupported scheduler constraint schema: ${raw.schemaVersion}`);
  if (!raw.model || !raw.domain || !raw.assertion) throw new Error("scheduler constraint input requires model, domain, and assertion");
  if (raw.model.function !== raw.domain.function || raw.model.function !== raw.assertion.function) throw new Error("scheduler constraint input function fields disagree");
  if (raw.model.stage !== raw.domain.stage || raw.model.stage !== raw.assertion.stage || raw.model.block !== raw.domain.block || raw.model.block !== raw.assertion.block) {
    throw new Error("scheduler constraint input stage/block fields disagree");
  }
  if (!Array.isArray(raw.model.nodes) || !Array.isArray(raw.model.dependencies) || !Array.isArray(raw.model.baselineBackwardOrder)) {
    throw new Error("scheduler constraint model is missing node, dependency, or baseline-order arrays");
  }
  if (!Array.isArray(raw.domain.variableBoostUids) || !Array.isArray(raw.domain.luidOrderConstraints) || !Array.isArray(raw.domain.phantomTemplates) || !Array.isArray(raw.domain.optionalEdges)) {
    throw new Error("scheduler constraint domain is missing finite variable arrays");
  }
  const nodeUids = new Set(raw.model.nodes.map((node) => node.uid));
  if (nodeUids.size !== raw.model.nodes.length) throw new Error("scheduler constraint model contains duplicate node UIDs");
  if (raw.model.baselineBackwardOrder.length !== nodeUids.size || new Set(raw.model.baselineBackwardOrder).size !== nodeUids.size || raw.model.baselineBackwardOrder.some((uid) => !nodeUids.has(uid))) {
    throw new Error("baseline backward order must contain every model UID exactly once");
  }
  if (!Array.isArray(raw.assertion.projectedBackwardOrder) || raw.assertion.projectedBackwardOrder.length !== nodeUids.size || new Set(raw.assertion.projectedBackwardOrder).size !== nodeUids.size || raw.assertion.projectedBackwardOrder.some((uid) => !nodeUids.has(uid))) {
    throw new Error("target projected backward order must contain every real model UID exactly once");
  }
  for (const edge of raw.model.dependencies) {
    if (!nodeUids.has(edge.fromUid) || !nodeUids.has(edge.toUid)) throw new Error(`edge ${edge.id} references an unknown UID`);
    if (edge.optional) throw new Error(`candidate edge ${edge.id} cannot be optional`);
  }
  for (const edge of raw.domain.optionalEdges) {
    if (!nodeUids.has(edge.fromUid) || !nodeUids.has(edge.toUid)) throw new Error(`optional edge ${edge.id} references an unknown real UID`);
    if (!edge.optional || !edge.justification.trim() || !edge.sourceMechanism) throw new Error(`optional edge ${edge.id} lacks optional:true, a named source mechanism, or justification`);
  }
  for (const uid of raw.domain.variableBoostUids) {
    const node = raw.model.nodes.find((item) => item.uid === uid);
    if (!node?.boostVariable) throw new Error(`boost domain UID ${uid} is not marked source-variable in the model`);
  }
  for (const relation of raw.domain.luidOrderConstraints) {
    if (!nodeUids.has(relation.beforeUid) || !nodeUids.has(relation.afterUid) || relation.beforeUid === relation.afterUid) throw new Error(`LUID relation ${relation.id} has invalid endpoints`);
  }
  for (const template of raw.domain.phantomTemplates) {
    if (!nodeUids.has(template.producerUid) || !nodeUids.has(template.releaseUid)) throw new Error(`phantom template ${template.id} references an unknown real UID`);
    if (!template.coalescible || !template.justification.trim()) throw new Error(`phantom template ${template.id} lacks a coalescing proof sketch`);
  }
  if (!Number.isInteger(raw.domain.maxPhantoms) || raw.domain.maxPhantoms < 0 || raw.domain.maxPhantoms > 3 || raw.domain.maxPhantoms > raw.domain.phantomTemplates.length) {
    throw new Error("scheduler constraint domain maxPhantoms must be 0..3 and no greater than its template count");
  }
  if (!Number.isInteger(raw.domain.maxAssignments) || raw.domain.maxAssignments < 1 || raw.domain.maxAssignments > 10_000_000) throw new Error("scheduler constraint maxAssignments must be 1..10000000");
  return raw as SchedulerConstraintInput;
}
