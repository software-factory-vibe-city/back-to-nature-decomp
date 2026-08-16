/**
 * Waypoint comparison — where the two programs stop agreeing.
 *
 * The same backward chain runs over the original bytes and over the candidate
 * object, so a difference between two waypoints cannot come from the two sides
 * having been read differently. Walking the ladder from the oldest waypoint
 * forward gives the pass that introduced the residual, which is a far smaller
 * claim than a list of differing words.
 *
 * Comparison is by structure, never by register name: instructions are matched
 * on their register-masked shape, and the register assignment is compared
 * separately, through the web correspondence the match induces. That ordering
 * matters — a pure allocation rotation must read as "same program, different
 * allocation", and a name-based diff cannot say that.
 */

import type { Web } from "./inverse-alloc.js";
import type { MirInsn, MirProgram } from "./types.js";

export interface InsnPair {
  targetIndex: number;
  candidateIndex: number;
}

export interface BlockComparison {
  block: number;
  matched: InsnPair[];
  targetOnly: number[];
  candidateOnly: number[];
  /** Matched pairs whose relative order differs between the two sides. */
  transposed: Transposition[];
}

export interface Transposition {
  /** [position within the block, index in the program] */
  target: [number, number];
  candidate: [number, number];
  detail: string;
  /**
   * The displacement is no larger than the delay-slot inverse's own fiber for
   * this instruction, so the difference may be the chain's choice rather than
   * anything the two programs disagree about.
   *
   * These are excluded from the residual objective. A search that hill-climbs
   * on a number the measuring instrument invents will chase its own noise, and
   * the noise here is systematic: every call and branch whose slot origin is
   * ambiguous contributes a spurious one- or two-position "difference".
   */
  withinFiber: boolean;
}

export interface WebCorrespondence {
  targetWeb: number;
  candidateWeb: number;
  targetRegister: string;
  candidateRegister: string;
  agrees: boolean;
  /** Instructions that witness the correspondence. */
  witnesses: number;
  defShape: string;
  symbol?: string;
  uses: number;
}

/**
 * A copy one side has and the other does not, because the other side's
 * allocator gave both ends the same register.
 *
 * `jump_optimize` deletes no-op moves, so a coalesced copy leaves no
 * instruction at all. Read naively that is an instruction-count difference —
 * "the source computes something extra" — when in fact both sides ran the same
 * program and only the allocator disagreed. Recognizing it is what keeps a
 * count delta from being misfiled as a semantics problem.
 */
export interface CoalescedCopy {
  side: "target" | "candidate";
  insnIndex: number;
  text: string;
  /** Web of the copy's source, on the side that has the copy. */
  sourceWeb: number;
  /** Web of the copy's destination, on the side that has the copy. */
  destinationWeb: number;
}

export interface ProgramComparison {
  populationParity: boolean;
  targetOnlyShapes: Map<string, number>;
  candidateOnlyShapes: Map<string, number>;
  blocks: BlockComparison[];
  webs: WebCorrespondence[];
  /** Web correspondences that could not be established one-to-one. */
  ambiguousWebs: string[];
  /** Transpositions the two programs really disagree about. */
  orderDifferences: number;
  /** Transpositions the delay-slot inverse could have produced on its own. */
  fiberArtifacts: number;
  allocationDifferences: number;
  /** Copies present on one side only because the other side coalesced them. */
  coalescedCopies: CoalescedCopy[];
}

function shapeBag(insns: MirInsn[]): Map<string, number> {
  const bag = new Map<string, number>();
  for (const insn of insns) bag.set(insn.shape, (bag.get(insn.shape) ?? 0) + 1);
  return bag;
}

function bagDifference(left: Map<string, number>, right: Map<string, number>): Map<string, number> {
  const result = new Map<string, number>();
  for (const [shape, count] of left) {
    const other = right.get(shape) ?? 0;
    if (count > other) result.set(shape, count - other);
  }
  return result;
}

/** Longest common subsequence over shapes, returned as index pairs. */
function alignShapes(left: string[], right: string[]): Array<[number, number]> {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const table: Uint32Array[] = Array.from({ length: rows }, () => new Uint32Array(columns));
  for (let row = left.length - 1; row >= 0; row--) {
    for (let column = right.length - 1; column >= 0; column--) {
      table[row][column] = left[row] === right[column]
        ? table[row + 1][column + 1] + 1
        : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let row = 0;
  let column = 0;
  while (row < left.length && column < right.length) {
    if (left[row] === right[column]) pairs.push([row++, column++]);
    else if (table[row + 1][column] >= table[row][column + 1]) row++;
    else column++;
  }
  return pairs;
}

/**
 * Pair the instructions of two programs, block by block.
 *
 * Blocks are compared by index. Both sides come from the same control-flow
 * skeleton whenever the source semantics agree, so a block-count difference is
 * itself a finding and is reported rather than papered over by a global
 * alignment that would then mis-pair everything after it.
 */
export function compareBlocks(target: MirProgram, candidate: MirProgram): BlockComparison[] {
  const result: BlockComparison[] = [];
  const blockCount = Math.min(target.blocks.length, candidate.blocks.length);
  const targetPosition = new Map(target.insns.map((insn, index) => [insn.id, index]));
  const candidatePosition = new Map(candidate.insns.map((insn, index) => [insn.id, index]));

  for (let index = 0; index < blockCount; index++) {
    const targetMembers = target.blocks[index].insns
      .map((id) => target.insns[targetPosition.get(id)!]).filter(Boolean);
    const candidateMembers = candidate.blocks[index].insns
      .map((id) => candidate.insns[candidatePosition.get(id)!]).filter(Boolean);
    const pairs = alignShapes(targetMembers.map((insn) => insn.shape), candidateMembers.map((insn) => insn.shape));
    const matchedTarget = new Set(pairs.map(([left]) => left));
    const matchedCandidate = new Set(pairs.map(([, right]) => right));

    /* Instructions the alignment dropped on both sides with the same shape are
     * not missing — they are the two ends of a transposition. */
    const targetLeft = targetMembers.map((_, position) => position).filter((position) => !matchedTarget.has(position));
    const candidateLeft = candidateMembers.map((_, position) => position).filter((position) => !matchedCandidate.has(position));
    const transposed: BlockComparison["transposed"] = [];
    const targetOnly: number[] = [];
    const candidateLeftPool = [...candidateLeft];
    for (const position of targetLeft) {
      const shape = targetMembers[position].shape;
      const partner = candidateLeftPool.findIndex((other) => candidateMembers[other].shape === shape);
      if (partner < 0) {
        targetOnly.push(targetMembers[position].index);
        continue;
      }
      const other = candidateLeftPool.splice(partner, 1)[0];
      const fiber = Math.max(targetMembers[position].slotFiber ?? 1, candidateMembers[other].slotFiber ?? 1);
      transposed.push({
        target: [position, targetMembers[position].index],
        candidate: [other, candidateMembers[other].index],
        detail: `${targetMembers[position].text} sits at block position ${position} in the target and ${other} in the candidate`,
        withinFiber: fiber > 1 && Math.abs(position - other) <= fiber,
      });
    }

    result.push({
      block: index,
      matched: pairs.map(([left, right]) => ({
        targetIndex: targetMembers[left].index,
        candidateIndex: candidateMembers[right].index,
      })),
      targetOnly,
      candidateOnly: candidateLeftPool.map((position) => candidateMembers[position].index),
      transposed,
    });
  }
  return result;
}

/**
 * Web correspondence induced by the instruction pairing.
 *
 * A target web and a candidate web correspond when the instructions that define
 * and read them are paired. Disagreement about the hard register is then a
 * statement about the allocator, not about the program.
 */
export function correspondWebs(
  target: MirProgram,
  candidate: MirProgram,
  targetWebs: Web[],
  candidateWebs: Web[],
  blocks: BlockComparison[],
): { webs: WebCorrespondence[]; ambiguous: string[] } {
  const votes = new Map<string, number>();
  const targetByIndex = new Map(target.insns.map((insn) => [insn.index, insn]));
  const candidateByIndex = new Map(candidate.insns.map((insn) => [insn.index, insn]));

  const record = (left: number | undefined, right: number | undefined) => {
    if (left === undefined || right === undefined) return;
    const key = `${left}|${right}`;
    votes.set(key, (votes.get(key) ?? 0) + 1);
  };

  for (const block of blocks) {
    for (const pair of block.matched) {
      const left = targetByIndex.get(pair.targetIndex);
      const right = candidateByIndex.get(pair.candidateIndex);
      if (!left || !right) continue;
      const leftDefs = left.defWebs ?? [];
      const rightDefs = right.defWebs ?? [];
      for (let position = 0; position < Math.min(leftDefs.length, rightDefs.length); position++) {
        record(leftDefs[position], rightDefs[position]);
      }
      const leftUses = left.useWebs ?? [];
      const rightUses = right.useWebs ?? [];
      for (let position = 0; position < Math.min(leftUses.length, rightUses.length); position++) {
        record(leftUses[position], rightUses[position]);
      }
    }
  }

  /* Greedy one-to-one assignment on vote count: the strongest witness wins,
   * and the losers are reported rather than silently re-paired. */
  const ranked = [...votes.entries()]
    .map(([key, count]) => {
      const [left, right] = key.split("|").map(Number);
      return { left, right, count };
    })
    .sort((first, second) => second.count - first.count || first.left - second.left);
  const usedTarget = new Set<number>();
  const usedCandidate = new Set<number>();
  const result: WebCorrespondence[] = [];
  const ambiguous: string[] = [];

  for (const entry of ranked) {
    if (usedTarget.has(entry.left) || usedCandidate.has(entry.right)) {
      if (entry.count > 1) {
        ambiguous.push(`target web ${entry.left} also votes for candidate web ${entry.right} (${entry.count} witnesses)`);
      }
      continue;
    }
    usedTarget.add(entry.left);
    usedCandidate.add(entry.right);
    const left = targetWebs[entry.left];
    const right = candidateWebs[entry.right];
    if (!left || !right) continue;
    const correspondence: WebCorrespondence = {
      targetWeb: entry.left,
      candidateWeb: entry.right,
      targetRegister: left.register,
      candidateRegister: right.register,
      agrees: left.register === right.register,
      witnesses: entry.count,
      defShape: left.defShapes[0] ?? "entry",
      uses: left.uses.length,
    };
    if (left.symbol) correspondence.symbol = left.symbol;
    result.push(correspondence);
  }

  return { webs: result.sort((first, second) => first.targetWeb - second.targetWeb), ambiguous };
}

/** A register-to-register copy, in either spelling the assembler produces. */
function copyOperands(insn: MirInsn): { destination: number; source: number } | null {
  const isCopy = insn.mnemonic === "move" ||
    ((insn.mnemonic === "addu" || insn.mnemonic === "or") && insn.operands[2] === "zero");
  if (!isCopy) return null;
  const destination = insn.defWebs?.[0];
  const source = insn.useWebs?.[0];
  if (destination === undefined || source === undefined) return null;
  return { destination, source };
}

/**
 * Unmatched copies, read as coalescing decisions rather than as extra work.
 *
 * A copy the other side does not have means the other side's allocator put both
 * of its ends in one register. The two webs it joins are therefore one web over
 * there, and merging them before the correspondence is what stops the
 * mis-pairing from cascading through every later web.
 */
function findCoalescedCopies(
  target: MirProgram,
  candidate: MirProgram,
  blocks: BlockComparison[],
): CoalescedCopy[] {
  const result: CoalescedCopy[] = [];
  const byIndex = (program: MirProgram) => new Map(program.insns.map((insn) => [insn.index, insn]));
  const targetIndex = byIndex(target);
  const candidateIndex = byIndex(candidate);
  for (const block of blocks) {
    for (const index of block.targetOnly) {
      const insn = targetIndex.get(index);
      const copy = insn ? copyOperands(insn) : null;
      if (insn && copy) {
        result.push({ side: "target", insnIndex: index, text: insn.text, sourceWeb: copy.source, destinationWeb: copy.destination });
      }
    }
    for (const index of block.candidateOnly) {
      const insn = candidateIndex.get(index);
      const copy = insn ? copyOperands(insn) : null;
      if (insn && copy) {
        result.push({ side: "candidate", insnIndex: index, text: insn.text, sourceWeb: copy.source, destinationWeb: copy.destination });
      }
    }
  }
  return result;
}

/** Merge the web ids a coalesced copy joins, so both sides count one value. */
function mergeWebs(webs: Web[], copies: CoalescedCopy[], side: "target" | "candidate"): Map<number, number> {
  const representative = new Map<number, number>();
  for (const web of webs) representative.set(web.id, web.id);
  const find = (id: number): number => {
    let current = id;
    while (representative.get(current) !== current) current = representative.get(current)!;
    return current;
  };
  for (const copy of copies) {
    if (copy.side !== side) continue;
    const left = find(copy.sourceWeb);
    const right = find(copy.destinationWeb);
    if (left !== right) representative.set(right, left);
  }
  const result = new Map<number, number>();
  for (const web of webs) result.set(web.id, find(web.id));
  return result;
}

export function compareProgramsAtWaypoint(
  target: MirProgram,
  candidate: MirProgram,
  targetWebs: Web[],
  candidateWebs: Web[],
): ProgramComparison {
  const blocks = compareBlocks(target, candidate);
  const coalescedCopies = findCoalescedCopies(target, candidate, blocks);
  const coalescedTargetIndexes = new Set(coalescedCopies.filter((copy) => copy.side === "target").map((copy) => copy.insnIndex));
  const coalescedCandidateIndexes = new Set(coalescedCopies.filter((copy) => copy.side === "candidate").map((copy) => copy.insnIndex));

  /* Population parity is asked of the program without the coalesced copies:
   * those exist or not according to the allocator, not the source. */
  const targetBag = shapeBag(target.insns.filter((insn) => !coalescedTargetIndexes.has(insn.index)));
  const candidateBag = shapeBag(candidate.insns.filter((insn) => !coalescedCandidateIndexes.has(insn.index)));
  const targetOnlyShapes = bagDifference(targetBag, candidateBag);
  const candidateOnlyShapes = bagDifference(candidateBag, targetBag);

  const targetMerge = mergeWebs(targetWebs, coalescedCopies, "target");
  const candidateMerge = mergeWebs(candidateWebs, coalescedCopies, "candidate");
  const remapped = (program: MirProgram, mapping: Map<number, number>): MirProgram => ({
    ...program,
    insns: program.insns.map((insn) => ({
      ...insn,
      defWebs: insn.defWebs?.map((web) => mapping.get(web) ?? web),
      useWebs: insn.useWebs?.map((web) => mapping.get(web) ?? web),
    })),
  });
  const { webs, ambiguous } = correspondWebs(
    remapped(target, targetMerge),
    remapped(candidate, candidateMerge),
    targetWebs,
    candidateWebs,
    blocks,
  );

  return {
    populationParity: targetOnlyShapes.size === 0 && candidateOnlyShapes.size === 0,
    targetOnlyShapes,
    candidateOnlyShapes,
    blocks,
    webs,
    ambiguousWebs: ambiguous,
    orderDifferences: blocks.reduce((total, block) =>
      total + block.transposed.filter((move) => !move.withinFiber).length, 0),
    fiberArtifacts: blocks.reduce((total, block) =>
      total + block.transposed.filter((move) => move.withinFiber).length, 0),
    allocationDifferences: webs.filter((web) => !web.agrees).length,
    coalescedCopies,
  };
}
