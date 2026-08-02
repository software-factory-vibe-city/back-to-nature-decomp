import type { LocalAllocationReplay, LocalQuantityDecision } from "./local-allocation.js";
import type { ForcedLocalAssignment } from "./types.js";

export interface PhantomQuantity {
  id: string;
  position: number;
  born: number;
  dead: number;
  assignedHardRegister?: number;
  lowerPriorityExclusive?: number;
  upperPriorityInclusive?: number;
  feasibleReferences: number[];
}

export interface LocalAllocationStateSolution {
  block: number;
  phantoms: PhantomQuantity[];
  assignments: Array<{ pseudo: number; hardRegister?: number; desiredHardRegister: number }>;
  preservedBaselineAssignments: boolean;
  evidence: string[];
}

interface ModelQuantity {
  id: string;
  position: number;
  born: number;
  dead: number;
  available: number[];
  members: number[];
  baselineHardRegister?: number;
  phantom: boolean;
  references: number;
  size: number;
}

function overlaps(left: { born: number; dead: number }, right: { born: number; dead: number }): boolean {
  return left.born < right.dead && right.born < left.dead;
}

export function localQuantityPriority(references: number, born: number, dead: number, size = 1): number {
  if (references <= 0 || dead <= born) return -1;
  return Math.trunc((Math.floor(Math.log2(references)) * references * size / (dead - born)) * 10000);
}

function oneDecisionPerQuantity(replay: LocalAllocationReplay, block: number): LocalQuantityDecision[] {
  const result: LocalQuantityDecision[] = [];
  const seen = new Set<string>();
  for (const decision of replay.decisions) {
    if (decision.block !== block || decision.chosen === undefined || decision.forced) continue;
    const key = `${decision.block}:${decision.qty}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(decision);
  }
  return result;
}

function staticCandidates(decisions: LocalQuantityDecision[], index: number): number[] {
  const decision = decisions[index]!;
  const candidates = new Set(decision.available);
  for (let priorIndex = 0; priorIndex < index; priorIndex++) {
    const prior = decisions[priorIndex]!;
    if (prior.chosen !== undefined && overlaps(prior, decision)) candidates.add(prior.chosen);
  }
  return [...candidates].sort((left, right) => left - right);
}

function simulate(quantities: ModelQuantity[]): Map<string, number | undefined> {
  const assigned = new Map<string, number | undefined>();
  const active: Array<{ quantity: ModelQuantity; hardRegister: number }> = [];
  for (const quantity of quantities) {
    const occupied = new Set(active.filter((item) => overlaps(item.quantity, quantity)).map((item) => item.hardRegister));
    const hardRegister = quantity.available.find((candidate) => !occupied.has(candidate));
    assigned.set(quantity.id, hardRegister);
    if (hardRegister !== undefined) active.push({ quantity, hardRegister });
  }
  return assigned;
}

function insertPhantoms(existing: ModelQuantity[], phantoms: PhantomQuantity[]): ModelQuantity[] {
  const byPosition = new Map<number, PhantomQuantity[]>();
  for (const phantom of phantoms) {
    const values = byPosition.get(phantom.position) || [];
    values.push(phantom);
    byPosition.set(phantom.position, values);
  }
  const result: ModelQuantity[] = [];
  for (let position = 0; position <= existing.length; position++) {
    for (const phantom of byPosition.get(position) || []) {
      result.push({
        id: phantom.id,
        position,
        born: phantom.born,
        dead: phantom.dead,
        available: Array.from({ length: 24 }, (_unused, index) => index + 2),
        members: [],
        phantom: true,
        references: 1,
        size: 1,
      });
    }
    if (position < existing.length) result.push(existing[position]!);
  }
  return result;
}

function* nondecreasingPositions(count: number, max: number, prefix: number[] = []): Generator<number[]> {
  if (prefix.length === count) {
    yield prefix;
    return;
  }
  const start = prefix.length === 0 ? 0 : prefix[prefix.length - 1]!;
  for (let value = start; value <= max; value++) yield* nondecreasingPositions(count, max, [...prefix, value]);
}

function priorityBounds(sequence: ModelQuantity[], phantomIndex: number): { lower?: number; upper?: number } {
  let upper: number | undefined;
  let lower: number | undefined;
  for (let index = phantomIndex - 1; index >= 0; index--) {
    const quantity = sequence[index]!;
    if (quantity.phantom) continue;
    upper = localQuantityPriority(quantity.references, quantity.born, quantity.dead, quantity.size);
    break;
  }
  for (let index = phantomIndex + 1; index < sequence.length; index++) {
    const quantity = sequence[index]!;
    if (quantity.phantom) continue;
    lower = localQuantityPriority(quantity.references, quantity.born, quantity.dead, quantity.size);
    break;
  }
  return { lower, upper };
}

function feasibleReferences(phantom: PhantomQuantity, lower?: number, upper?: number): number[] {
  const result: number[] = [];
  for (let references = 1; references <= 64; references++) {
    const priority = localQuantityPriority(references, phantom.born, phantom.dead);
    if ((lower === undefined || priority > lower) && (upper === undefined || priority <= upper)) result.push(references);
  }
  return result;
}

export function solveLocalAllocationState(
  replay: LocalAllocationReplay,
  requests: ForcedLocalAssignment[],
  options: { maxPhantoms?: number; maxSolutions?: number } = {},
): LocalAllocationStateSolution[] {
  const maxPhantoms = options.maxPhantoms ?? 3;
  const maxSolutions = options.maxSolutions ?? 16;
  const requestedByPseudo = new Map(requests.map((request) => [request.pseudo, request.hardRegister]));
  const targetBlocks = new Set(replay.quantities.filter((quantity) => quantity.members.some((pseudo) => requestedByPseudo.has(pseudo))).map((quantity) => quantity.block));
  const solutions: LocalAllocationStateSolution[] = [];

  for (const block of targetBlocks) {
    const decisions = oneDecisionPerQuantity(replay, block);
    const existing: ModelQuantity[] = decisions.map((decision, index) => ({
      id: `q${decision.qty}`,
      position: index,
      born: decision.born,
      dead: decision.dead,
      available: staticCandidates(decisions, index),
      members: decision.members,
      baselineHardRegister: decision.chosen,
      phantom: false,
      references: decision.references || 1,
      size: decision.size || 1,
    }));
    const requestedInBlock = requests.filter((request) => existing.some((quantity) => quantity.members.includes(request.pseudo)));
    const endpoints = [...new Set(existing.flatMap((quantity) => [quantity.born, quantity.dead]))].sort((left, right) => left - right);
    const intervals = endpoints.flatMap((born) => endpoints.filter((dead) => dead > born).map((dead) => ({ born, dead })));

    for (let count = 0; count <= maxPhantoms; count++) {
      const countStart = solutions.length;
      for (const positions of nondecreasingPositions(count, existing.length)) {
        const chooseIntervals = (index: number, chosen: Array<{ born: number; dead: number }>): void => {
          if (index < count) {
            for (const interval of intervals) chooseIntervals(index + 1, [...chosen, interval]);
            return;
          }
          const phantoms: PhantomQuantity[] = chosen.map((interval, phantomIndex) => ({
            id: `p${phantomIndex}`,
            position: positions[phantomIndex]!,
            ...interval,
            feasibleReferences: [],
          }));
          const sequence = insertPhantoms(existing, phantoms);
          const assigned = simulate(sequence);
          const assignments = requestedInBlock.map((request) => {
            const quantity = existing.find((item) => item.members.includes(request.pseudo))!;
            return { pseudo: request.pseudo, hardRegister: assigned.get(quantity.id), desiredHardRegister: request.hardRegister };
          });
          if (!assignments.every((item) => item.hardRegister === item.desiredHardRegister)) return;
          const preservedBaselineAssignments = existing.filter((quantity) => !quantity.members.some((pseudo) => requestedByPseudo.has(pseudo)))
            .every((quantity) => assigned.get(quantity.id) === quantity.baselineHardRegister);
          if (!preservedBaselineAssignments) return;
          for (const phantom of phantoms) {
            phantom.assignedHardRegister = assigned.get(phantom.id);
            const sequenceIndex = sequence.findIndex((item) => item.id === phantom.id);
            const bounds = priorityBounds(sequence, sequenceIndex);
            phantom.lowerPriorityExclusive = bounds.lower;
            phantom.upperPriorityInclusive = bounds.upper;
            phantom.feasibleReferences = feasibleReferences(phantom, bounds.lower, bounds.upper);
          }
          if (phantoms.some((phantom) => phantom.feasibleReferences.length === 0)) return;
          solutions.push({
            block,
            phantoms,
            assignments,
            preservedBaselineAssignments,
            evidence: phantoms.map((phantom) =>
              `${phantom.id} at allocation slot ${phantom.position} spans ${phantom.born}..${phantom.dead}, takes hard register ${phantom.assignedHardRegister}, and fits references {${phantom.feasibleReferences.slice(0, 8).join(",")}${phantom.feasibleReferences.length > 8 ? ",..." : ""}}.`
            ),
          });
        };
        chooseIntervals(0, []);
      }
      if (solutions.length > countStart) break;
    }
  }
  return solutions.sort((left, right) =>
    left.phantoms.length - right.phantoms.length
    || left.phantoms.reduce((sum, phantom) => sum + phantom.dead - phantom.born, 0)
      - right.phantoms.reduce((sum, phantom) => sum + phantom.dead - phantom.born, 0)
  ).slice(0, maxSolutions);
}
