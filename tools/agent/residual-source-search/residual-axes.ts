import type { NormalizedInstruction } from "../variant-lab/types.js";
import { residualKey, type ResidualComparison } from "./align.js";
import type { AxisResidual, BlockAxisResidual, ClassResidual } from "./types.js";

/**
 * Registers as either stream spells them: the target uses names, the cc1
 * output uses numbers.
 */
const REGISTER = /^(?:zero|at|v[01]|a[0-3]|t[0-9]|s[0-8]|k[01]|gp|sp|fp|s8|ra|\d{1,2})$/;

/** Mnemonics that end a basic block, so a block map can be built. */
const CONTROL = /^(?:b|beq|bne|bgez|bgtz|blez|bltz|bgezal|bltzal|beqz|bnez|j|jr|jal|jalr)(?:l)?$/;

/**
 * One instruction with its registers wildcarded.
 *
 * `lw v0,32(sp)` and `lw v1,32(sp)` share a shape and differ only in where the
 * value landed, which is an allocation difference. `lw v0,32(sp)` and
 * `lw v0,36(sp)` do not: the offset is part of what the program computes.
 */
export function shapeKey(instruction: NormalizedInstruction): string {
  const operands = instruction.operands.map((operand) => {
    const memory = operand.match(/^(-?(?:0x)?[0-9a-fA-F]+)\((\w+)\)$/);
    if (memory) return `${memory[1]}(%)`;
    return REGISTER.test(operand) ? "%" : operand;
  });
  return `${instruction.mnemonic} ${operands.join(",")}`;
}

/** Multiset difference: pairs matched on `key`, and what each side has left. */
function pairOff<T>(left: T[], right: T[], key: (item: T) => string): {
  matched: number;
  left: T[];
  right: T[];
} {
  const pool = new Map<string, T[]>();
  for (const item of right) {
    const bucket = pool.get(key(item)) ?? [];
    bucket.push(item);
    pool.set(key(item), bucket);
  }
  const leftOver: T[] = [];
  let matched = 0;
  for (const item of left) {
    const bucket = pool.get(key(item));
    if (bucket && bucket.length > 0) {
      bucket.pop();
      matched++;
      continue;
    }
    leftOver.push(item);
  }
  const rightOver = [...pool.values()].flat();
  return { matched, left: leftOver, right: rightOver };
}

/**
 * Straight-line runs of the target stream, by instruction index.
 *
 * These are *not* basic blocks, and the difference is worth stating. A run
 * ends after a control transfer and its delay slot — the slot belongs to its
 * branch, since it executes unconditionally with it. A run does not begin at a
 * branch target, because the normalized stream carries no labels and a target
 * cannot be resolved to an index without a lift this reading does not
 * otherwise need. So a run is a union of one or more basic blocks: no run ever
 * spans a control transfer, but a join point inside one is not seen.
 *
 * That is enough to localize a residual and honest about what it is. Callers
 * that need true blocks should lift.
 */
export function blockOfIndex(target: NormalizedInstruction[]): number[] {
  const leaders = new Set<number>([0]);
  target.forEach((instruction, index) => {
    if (!CONTROL.test(instruction.mnemonic)) return;
    if (index + 2 < target.length) leaders.add(index + 2);
  });
  const starts = [...leaders].filter((value) => value < target.length).sort((left, right) => left - right);
  const blocks = new Array<number>(target.length).fill(0);
  for (let position = 0; position < starts.length; position++) {
    const start = starts[position]!;
    const end = (position + 1 < starts.length ? starts[position + 1]! : target.length) - 1;
    for (let index = start; index <= end; index++) blocks[index] = position;
  }
  return blocks;
}

function empty(): AxisResidual {
  return { population: 0, schedule: 0, allocation: 0, total: 0 };
}

function add(into: AxisResidual, axis: keyof Omit<AxisResidual, "total">, count: number): void {
  into[axis] += count;
  into.total += count;
}

/**
 * What kind of difference the residual is, and where.
 *
 * A match count is not a distance: an edit that fixes the cause of a
 * difference rotates everything downstream of it, so it can match fewer words
 * while standing closer. Three axes are a direction instead. Every unpaired
 * instruction is charged to exactly one of them, worst first:
 *
 * - **population** — one side computes something the other does not. The
 *   programs differ, so nothing downstream of it is meaningful yet.
 * - **schedule** — both sides have the instruction, in different positions.
 * - **allocation** — both sides compute the value, in a different register.
 *
 * Classification is by elimination over the unpaired sets: identical keys that
 * the alignment could not pair are transpositions; of what remains, matching
 * shapes are allocation; anything still unmatched is population. Each is a
 * count of instructions on the side that has them, so a candidate that adds
 * five instructions is charged five, not zero.
 */
export function residualAxes(options: {
  target: NormalizedInstruction[];
  candidate: NormalizedInstruction[];
  comparison: ResidualComparison;
}): ClassResidual {
  const { target, candidate, comparison } = options;
  const blocks = blockOfIndex(target);
  const overall = empty();
  const byBlock = new Map<number, AxisResidual>();
  let unattributed = 0;

  /* An unpaired candidate instruction has no block of its own; the nearest
   * aligned neighbour names one. Where no pair exists on either side, the
   * difference is counted and reported as unattributed rather than placed. */
  const candidateToTarget = new Map<number, number>();
  for (const [targetIndex, candidateIndex] of comparison.correspondence) {
    candidateToTarget.set(candidateIndex, targetIndex);
  }
  const alignedCandidates = [...candidateToTarget.keys()].sort((left, right) => left - right);
  const blockOfCandidate = (index: number): number | undefined => {
    let nearest: number | undefined;
    let best = Infinity;
    for (const aligned of alignedCandidates) {
      const distance = Math.abs(aligned - index);
      if (distance < best) {
        best = distance;
        nearest = aligned;
      }
    }
    return nearest === undefined ? undefined : blocks[candidateToTarget.get(nearest)!];
  };

  const charge = (axis: keyof Omit<AxisResidual, "total">, block: number | undefined, count = 1): void => {
    add(overall, axis, count);
    if (block === undefined) {
      unattributed += count;
      return;
    }
    const entry = byBlock.get(block) ?? empty();
    add(entry, axis, count);
    byBlock.set(block, entry);
  };

  const targetSide = comparison.unpairedTargetIndexes.map((index) => ({ index, insn: target[index]! }));
  const candidateSide = comparison.unpairedCandidateIndexes.map((index) => ({ index, insn: candidate[index]! }));

  /* 1. Same instruction, different place. */
  const transposed = pairOff(targetSide, candidateSide, (item) => residualKey(item.insn));
  for (const item of targetSide) {
    if (transposed.left.includes(item)) continue;
    charge("schedule", blocks[item.index]);
  }

  /* 2. Same operation, different register. */
  const reallocated = pairOff(transposed.left, transposed.right, (item) => shapeKey(item.insn));
  for (const item of transposed.left) {
    if (reallocated.left.includes(item)) continue;
    charge("allocation", blocks[item.index]);
  }

  /* 3. Whatever neither side can account for. */
  for (const item of reallocated.left) charge("population", blocks[item.index]);
  for (const item of reallocated.right) charge("population", blockOfCandidate(item.index));

  const blockList: BlockAxisResidual[] = [...byBlock]
    .sort((left, right) => left[0] - right[0])
    .map(([block, axes]) => ({ block, ...axes }));

  return {
    key: [overall.population, overall.schedule, overall.allocation],
    ...overall,
    blocks: blockList,
    unattributed,
  };
}

/** Lexicographic order over the axes: worst kind of difference first. */
export function compareResidualAxes(left: ClassResidual, right: ClassResidual): number {
  return left.population - right.population ||
    left.schedule - right.schedule ||
    left.allocation - right.allocation;
}

/**
 * The direction from one residual to another, per axis and per block.
 *
 * This is the part a search owes an agent when it finds no exact candidate:
 * not "no", but which axis moved and in which block. A negative number is an
 * improvement.
 */
export function residualDelta(from: ClassResidual, to: ClassResidual): {
  population: number;
  schedule: number;
  allocation: number;
  blocks: Array<{ block: number; population: number; schedule: number; allocation: number }>;
} {
  const blocks = new Set([...from.blocks.map((item) => item.block), ...to.blocks.map((item) => item.block)]);
  const at = (residual: ClassResidual, block: number): AxisResidual =>
    residual.blocks.find((item) => item.block === block) ?? empty();
  return {
    population: to.population - from.population,
    schedule: to.schedule - from.schedule,
    allocation: to.allocation - from.allocation,
    blocks: [...blocks].sort((left, right) => left - right).map((block) => ({
      block,
      population: at(to, block).population - at(from, block).population,
      schedule: at(to, block).schedule - at(from, block).schedule,
      allocation: at(to, block).allocation - at(from, block).allocation,
    })).filter((item) => item.population !== 0 || item.schedule !== 0 || item.allocation !== 0),
  };
}
