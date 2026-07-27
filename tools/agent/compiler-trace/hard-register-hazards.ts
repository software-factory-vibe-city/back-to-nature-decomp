import type {
  FeedbackFinding,
  PseudoProvenance,
  RtlInstruction,
  SchedulerStage,
} from "./types.js";
import { FIRST_PSEUDO_REGISTER, hardRegisterName, registerAccess } from "./rtl-parser.js";

function intersects(left: Set<number>, right: Set<number>): number[] {
  return [...left].filter((value) => right.has(value));
}

function rangeOverlap(left: PseudoProvenance, right: PseudoProvenance): boolean {
  return left.lifetimes.some((a) => right.lifetimes.some((b) =>
    a.block === b.block && a.birthIndex <= b.deathIndex && b.birthIndex <= a.deathIndex
  ));
}

function sameHardDisjointPseudos(
  hard: number,
  pseudos: PseudoProvenance[],
): Array<[PseudoProvenance, PseudoProvenance]> {
  const assigned = pseudos.filter((pseudo) =>
    pseudo.assignedHardReg === hard && pseudo.lifetimes.length > 0
  );
  const result: Array<[PseudoProvenance, PseudoProvenance]> = [];
  for (let left = 0; left < assigned.length; left++) {
    for (let right = left + 1; right < assigned.length; right++) {
      const a = assigned[left];
      const b = assigned[right];
      if (a && b && !rangeOverlap(a, b)) result.push([a, b]);
    }
  }
  return result;
}

function edgeKey(fromUid: number, toUid: number): string {
  return `${fromUid}:${toUid}`;
}

function specificPseudoPairs(
  predecessor: RtlInstruction,
  current: RtlInstruction,
  kind: string,
  hard: number,
  pseudoByNumber: Map<number, PseudoProvenance>,
): Array<[PseudoProvenance, PseudoProvenance]> {
  const assigned = (references: RtlInstruction["sets"]): PseudoProvenance[] => references
    .map((reference) => pseudoByNumber.get(reference.register))
    .filter((pseudo): pseudo is PseudoProvenance => pseudo?.assignedHardReg === hard);
  const left = assigned(kind === "WAR" ? predecessor.uses : predecessor.sets);
  const right = assigned(kind === "RAW" ? current.uses : current.sets);
  const result: Array<[PseudoProvenance, PseudoProvenance]> = [];
  const seen = new Set<string>();
  for (const first of left) {
    for (const second of right) {
      const key = `${first.pseudo}:${second.pseudo}`;
      if (seen.has(key) || first.pseudo === second.pseudo || rangeOverlap(first, second)) continue;
      seen.add(key);
      result.push([first, second]);
    }
  }
  return result;
}

function hardHazards(predecessor: RtlInstruction, current: RtlInstruction): Array<{ kind: string; register: number }> {
  const before = registerAccess(predecessor);
  const after = registerAccess(current);
  const result: Array<{ kind: string; register: number }> = [];
  for (const register of intersects(before.sets, after.uses)) {
    if (register < FIRST_PSEUDO_REGISTER) result.push({ kind: "RAW", register });
  }
  for (const register of intersects(before.uses, after.sets)) {
    if (register < FIRST_PSEUDO_REGISTER) result.push({ kind: "WAR", register });
  }
  for (const register of intersects(before.sets, after.sets)) {
    if (register < FIRST_PSEUDO_REGISTER) result.push({ kind: "WAW", register });
  }
  return result;
}

function movementFindings(
  source: SchedulerStage,
  result: SchedulerStage,
  category: "sched1-reordered" | "sched2-fixed",
  limit: number,
): FeedbackFinding[] {
  const before = new Map(source.forwardOrder.map((uid, index) => [uid, index]));
  const after = new Map(result.forwardOrder.map((uid, index) => [uid, index]));
  const findings: FeedbackFinding[] = [];
  for (const [uid, afterIndex] of after) {
    const beforeIndex = before.get(uid);
    if (beforeIndex === undefined || afterIndex >= beforeIndex) continue;
    const crossed = source.forwardOrder.slice(afterIndex, beforeIndex).filter((other) => {
      const newIndex = after.get(other);
      return newIndex !== undefined && newIndex > afterIndex;
    });
    if (crossed.length === 0) continue;
    findings.push({
      category,
      confidence: "exact",
      message: category === "sched2-fixed"
        ? `sched2 moved UID ${uid} forward from position ${beforeIndex} to ${afterIndex}.`
        : `sched1 moved UID ${uid} forward from source position ${beforeIndex} to ${afterIndex}.`,
      evidence: [`Crossed UIDs: ${crossed.slice(0, 12).join(", ")}${crossed.length > 12 ? ", …" : ""}.`],
      uids: [uid, ...crossed.slice(0, 12)],
      registers: [],
      pseudos: [],
    });
    if (findings.length >= limit) break;
  }
  return findings;
}

export function detectAllocationFeedback(
  sched1: SchedulerStage | undefined,
  sched2: SchedulerStage | undefined,
  sched1Input: RtlInstruction[],
  sched1Output: RtlInstruction[],
  sched2Output: RtlInstruction[],
  pseudos: PseudoProvenance[],
): FeedbackFinding[] {
  const findings: FeedbackFinding[] = [];
  if (sched1) {
    const syntheticInput: SchedulerStage = { ...sched1, forwardOrder: sched1Input.map((instruction) => instruction.uid) };
    findings.push(...movementFindings(syntheticInput, sched1, "sched1-reordered", 6));
  }
  if (sched1 && sched2) findings.push(...movementFindings(sched1, sched2, "sched2-fixed", 8));
  if (!sched2) return findings;

  const sched1Edges = new Set((sched1?.dependencies || []).map((edge) => edgeKey(edge.fromUid, edge.toUid)));
  const sched2ByUid = new Map(sched2Output.map((instruction) => [instruction.uid, instruction]));
  const preAllocationByUid = new Map(sched1Output.map((instruction) => [instruction.uid, instruction]));
  const pseudoByNumber = new Map(pseudos.map((pseudo) => [pseudo.pseudo, pseudo]));
  const seenAllocation = new Set<string>();
  const allocationFindings: FeedbackFinding[] = [];

  for (const edge of sched2.dependencies) {
    const key = edgeKey(edge.fromUid, edge.toUid);
    if (sched1Edges.has(key)) continue;
    const predecessor = sched2ByUid.get(edge.fromUid);
    const current = sched2ByUid.get(edge.toUid);
    if (!predecessor || !current) continue;
    const hazards = hardHazards(predecessor, current);
    for (const hazard of hazards) {
      const register = hardRegisterName(hazard.register);
      const preAllocationPredecessor = preAllocationByUid.get(edge.fromUid);
      const preAllocationCurrent = preAllocationByUid.get(edge.toUid);
      if (!preAllocationPredecessor || !preAllocationCurrent) continue;
      const pairs = specificPseudoPairs(
        preAllocationPredecessor,
        preAllocationCurrent,
        hazard.kind,
        hazard.register,
        pseudoByNumber,
      );
      if (pairs.length === 0) continue;
      const findingKey = `${key}:${hazard.kind}:${hazard.register}`;
      if (seenAllocation.has(findingKey)) continue;
      seenAllocation.add(findingKey);
      const involved = [...new Set(pairs.flatMap(([left, right]) => [left.pseudo, right.pseudo]))];
      allocationFindings.push({
        category: "allocation-blocked",
        confidence: edge.confidence === "exact" ? "reconstructed" : "inferred",
        message: `Allocation introduced a hard $${register} ${hazard.kind} dependency from UID ${edge.fromUid} to UID ${edge.toUid}; sched2 cannot cross this edge.`,
        evidence: [
          `The equivalent edge is absent from sched1's pseudo-register DAG.`,
          `The specific pre-allocation operands are disjoint pseudos ${pairs.map(([a, b]) => `${a.pseudo}/${b.pseudo}`).join(", ")}, both assigned $${register}.`,
        ],
        uids: [edge.fromUid, edge.toUid],
        registers: [register],
        pseudos: involved,
      });
    }
  }

  allocationFindings.sort((left, right) => {
    const leftWar = left.message.includes(" WAR ") ? 0 : 1;
    const rightWar = right.message.includes(" WAR ") ? 0 : 1;
    const leftBlock = sched2ByUid.get(left.uids[0] || -1)?.block ?? -1;
    const rightBlock = sched2ByUid.get(right.uids[0] || -1)?.block ?? -1;
    return leftWar - rightWar || rightBlock - leftBlock || left.uids[0]! - right.uids[0]!;
  });
  findings.push(...allocationFindings);

  const durable = sched2.dependencies.filter((edge) =>
    sched1Edges.has(edgeKey(edge.fromUid, edge.toUid)) &&
    (edge.kind === "memory/alias" || edge.kind === "control")
  );
  if (durable.length > 0) {
    findings.push({
      category: "memory-or-control",
      confidence: "reconstructed",
      message: `${durable.length} memory/control dependencies survive from sched1 into sched2 and cannot be removed by hard-register reassignment.`,
      evidence: durable.slice(0, 12).map((edge) =>
        `${edge.kind}: UID ${edge.fromUid} -> ${edge.toUid}`
      ),
      uids: durable.slice(0, 12).flatMap((edge) => [edge.fromUid, edge.toUid]),
      registers: [],
      pseudos: [],
    });
  }

  const assignedByHard = new Map<number, PseudoProvenance[]>();
  for (const pseudo of pseudos) {
    if (pseudo.assignedHardReg === undefined) continue;
    const list = assignedByHard.get(pseudo.assignedHardReg) || [];
    list.push(pseudo);
    assignedByHard.set(pseudo.assignedHardReg, list);
  }
  for (const [hard, assigned] of assignedByHard) {
    const pairs = sameHardDisjointPseudos(hard, assigned);
    if (pairs.length === 0) continue;
    findings.push({
      category: "allocation-observation",
      confidence: "reconstructed",
      message: `$${hardRegisterName(hard)} is shared by non-overlapping pseudo lifetimes.`,
      evidence: pairs.slice(0, 10).map(([left, right]) => `pseudos ${left.pseudo} and ${right.pseudo}`),
      uids: [],
      registers: [hardRegisterName(hard)],
      pseudos: [...new Set(pairs.flatMap(([left, right]) => [left.pseudo, right.pseudo]))],
    });
  }
  return findings;
}
