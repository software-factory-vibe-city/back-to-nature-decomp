/**
 * The residual objective — what a search should actually descend.
 *
 * Matching decompilation has hill-climbed on the byte score since the
 * beginning, and the byte score is a bad gradient. It is not a distance: a
 * source edit that fixes the cause of a residual rotates the register
 * assignment downstream of it and comes out *worse*, so greedy search rejects
 * the correct move and keeps the lucky one. Worse, it is global — one number
 * for the whole function — so a search cannot tell that it fixed one block
 * while disturbing another.
 *
 * This objective is derived from the waypoint comparison instead, and has the
 * three properties the byte score lacks:
 *
 *  - **decomposable.** Every term belongs to a basic block, so a search can
 *    work one block and ignore the rest of the function.
 *  - **staged.** The terms are ordered by the age of the pass that owns them,
 *    oldest first, and compared lexicographically. Control flow outranks the
 *    instruction population, which outranks the schedule, which outranks the
 *    register assignment. Allocation is last deliberately: it is downstream of
 *    the sched1 order, so a variant that removes a transposition is making
 *    progress even while the registers are still wrong, and ranking allocation
 *    higher would reward freezing a wrong schedule into a lucky assignment.
 *  - **zero exactly at a match.** Every term is zero if and only if the two
 *    programs agree at every waypoint, and the bytes agree when they do.
 *
 * What it deliberately excludes: transpositions the delay-slot inverse could
 * have produced on its own. A search that descends a number its own instrument
 * invents will chase noise.
 */

import type { ProgramComparison } from "./compare.js";
import type { MirProgram } from "./types.js";

export interface BlockResidual {
  block: number;
  vram?: number;
  /** Instructions present on one side only. */
  population: number;
  /** Instructions both sides have, in a different position. */
  schedule: number;
  /** Values both sides compute, in a different hard register. */
  allocation: number;
  /** Copies one side's allocator coalesced away and the other kept. */
  coalescing: number;
  /** Transpositions excluded as the chain's own ambiguity, for the audit trail. */
  suppressed: number;
  total: number;
  /**
   * Shape of this block's residual, independent of where it sits.
   *
   * Two blocks with the same signature are the same problem written twice —
   * cases of one switch that differ only in a constant, typically — and one
   * source fix closes both. Recognizing that is worth more than it sounds:
   * it is the difference between four experiments and two.
   */
  signature: string;
}

export interface ResidualObjective {
  functionName: string;
  /** True when the candidate object reproduces the target bytes. */
  exact: boolean;
  /**
   * Lexicographic key, worst term first:
   * `[controlFlow, population, schedule, allocation]`.
   * Lower is better; all zero means the programs agree everywhere.
   */
  key: [number, number, number, number];
  controlFlow: number;
  population: number;
  schedule: number;
  allocation: number;
  blocks: BlockResidual[];
  /**
   * Words the oracle could not decide — a relocation whose symbol has no known
   * address. They are neither matches nor differences, so a residual of zero
   * with undetermined words present is not a match, and a difference this
   * reading cannot see may be hiding behind one. The oracle has three verdicts
   * on purpose; folding the third into either of the others would make "no
   * residual" mean two different things.
   */
  undetermined: number;
  /**
   * Set when the per-block numbers cannot be trusted for comparison — the two
   * programs have different control-flow graphs, so "block 6" does not name the
   * same code on both sides. The key still orders correctly, because the
   * control-flow term dominates it, but a per-block comparison is meaningless
   * and callers are told so rather than left to discover it.
   */
  degraded: boolean;
  reason?: string;
}

/**
 * The objective for one comparison.
 *
 * Coalescing counts toward allocation, not population. The copy exists or not
 * according to the allocator, and `jump_optimize` deletes the no-op move it
 * leaves behind — filing it under population would tell a search to go change
 * the program when the program is already right.
 */
export function residualObjective(
  functionName: string,
  comparison: ProgramComparison,
  target: MirProgram,
  candidate: MirProgram,
  exact: boolean,
  undetermined = 0,
): ResidualObjective {
  const controlFlow = Math.abs(target.blocks.length - candidate.blocks.length);
  const targetByIndex = new Map(target.insns.map((insn) => [insn.index, insn]));
  const coalescingByBlock = new Map<number, number>();
  for (const copy of comparison.coalescedCopies) {
    const owner = copy.side === "target" ? target : candidate;
    const insn = owner.insns.find((entry) => entry.index === copy.insnIndex);
    const block = insn?.block ?? -1;
    coalescingByBlock.set(block, (coalescingByBlock.get(block) ?? 0) + 1);
  }

  /* Allocation differences belong to the block that defines the value. */
  const allocationByBlock = new Map<number, number>();
  for (const web of comparison.webs) {
    if (web.agrees) continue;
    const definition = target.insns.find((insn) => (insn.defWebs ?? []).includes(web.targetWeb));
    const block = definition?.block ?? -1;
    allocationByBlock.set(block, (allocationByBlock.get(block) ?? 0) + 1);
  }

  const blocks: BlockResidual[] = comparison.blocks.map((block) => {
    const moves = block.transposed.filter((move) => !move.withinFiber);
    const signature = [
      ...moves.map((move) => `${targetByIndex.get(move.target[1])?.shape ?? "?"}@${move.target[0] - move.candidate[0]}`),
    ].sort().join("|");
    const schedule = moves.length;
    const suppressed = block.transposed.length - schedule;
    const population = block.targetOnly.length + block.candidateOnly.length -
      (coalescingByBlock.get(block.block) ?? 0);
    const allocation = allocationByBlock.get(block.block) ?? 0;
    const coalescing = coalescingByBlock.get(block.block) ?? 0;
    const entry: BlockResidual = {
      block: block.block,
      population: Math.max(0, population),
      schedule,
      allocation,
      coalescing,
      suppressed,
      total: Math.max(0, population) + schedule + allocation + coalescing,
      signature,
    };
    const vram = targetByIndex.get(block.matched[0]?.targetIndex ?? -1)?.vram ??
      target.blocks[block.block]?.vram;
    if (vram !== undefined) entry.vram = vram;
    return entry;
  });

  /* Blocks past the shorter graph have no counterpart at all; count their
   * instructions so a variant that grows a block is not scored as an
   * improvement. */
  const unpairedTarget = target.blocks.slice(comparison.blocks.length)
    .reduce((total, block) => total + block.insns.length, 0);
  const unpairedCandidate = candidate.blocks.slice(comparison.blocks.length)
    .reduce((total, block) => total + block.insns.length, 0);

  const population = blocks.reduce((total, block) => total + block.population, 0) +
    unpairedTarget + unpairedCandidate;
  const schedule = blocks.reduce((total, block) => total + block.schedule, 0);
  const allocation = blocks.reduce((total, block) => total + block.allocation + block.coalescing, 0);

  const objective: ResidualObjective = {
    functionName,
    exact,
    key: [controlFlow, population, schedule, allocation],
    controlFlow,
    population,
    schedule,
    allocation,
    blocks,
    undetermined,
    degraded: controlFlow > 0,
  };
  if (controlFlow > 0) {
    objective.reason = `target has ${target.blocks.length} basic blocks, candidate has ${candidate.blocks.length}; per-block numbers do not name the same code`;
  }
  return objective;
}

/** The per-block key, in the same staged order as the whole-function key. */
export function blockKey(objective: ResidualObjective, block: number): [number, number, number] {
  const entry = objective.blocks.find((item) => item.block === block);
  if (!entry) return [0, 0, 0];
  return [entry.population, entry.schedule, entry.allocation + entry.coalescing];
}

function compareKeys(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export interface CompareOptions {
  /**
   * Rank for one block. The whole-function key still breaks ties, so a variant
   * that fixes the block by wrecking the rest of the function loses to one that
   * fixes it cleanly — but a variant that fixes the block and disturbs another
   * still wins, which is the point of working a block at a time.
   */
  block?: number;
}

/**
 * Order two objectives, better first. Negative means `left` is better.
 *
 * An exact candidate wins outright: it is the terminal state, and no derived
 * number should be able to outrank it.
 */
export function compareObjectives(
  left: ResidualObjective,
  right: ResidualObjective,
  options: CompareOptions = {},
): number {
  if (left.exact !== right.exact) return left.exact ? -1 : 1;
  /* A degraded reading is not comparable per block; fall back to the key, which
   * the control-flow term dominates. */
  if (options.block !== undefined && !left.degraded && !right.degraded) {
    const byBlock = compareKeys(blockKey(left, options.block), blockKey(right, options.block));
    if (byBlock !== 0) return byBlock;
  }
  return compareKeys(left.key, right.key);
}

export function objectiveTotal(objective: ResidualObjective): number {
  return objective.key.reduce((total, term) => total + term, 0);
}

export interface BlockWorkItem {
  block: BlockResidual;
  /** Other blocks whose residual has the same shape. */
  duplicates: number[];
  reason: string;
}

/**
 * The order to work the blocks in.
 *
 * Population first, because nothing below it can be read while the two programs
 * contain different instructions.
 *
 * Then by payoff over difficulty. Difficulty is the block's own residual — a
 * block with five transpositions is five interacting scheduling decisions, not
 * five independent ones. Payoff is the residual of every block that shares its
 * signature, because those are the same problem written twice and one source
 * fix closes them all. A small block whose fix generalizes therefore outranks a
 * slightly smaller block that stands alone, which is the right advice: the
 * cheap block also teaches which lever this shape responds to, and that is what
 * the expensive block needs.
 */
export function rankBlocks(objective: ResidualObjective): BlockWorkItem[] {
  const open = objective.blocks.filter((block) => block.total > 0);
  const bySignature = new Map<string, number[]>();
  for (const block of open) {
    if (!block.signature) continue;
    const list = bySignature.get(block.signature) ?? [];
    list.push(block.block);
    bySignature.set(block.signature, list);
  }
  const totalOf = new Map(open.map((block) => [block.block, block.total]));
  const payoff = (block: BlockResidual): number => {
    const group = block.signature ? (bySignature.get(block.signature) ?? [block.block]) : [block.block];
    const units = group.reduce((sum, index) => sum + (totalOf.get(index) ?? 0), 0);
    return units / Math.max(1, block.total);
  };
  const seen = new Set<number>();
  const items: BlockWorkItem[] = [];
  for (const block of [...open].sort((left, right) =>
    Number(right.population > 0) - Number(left.population > 0) ||
    payoff(right) - payoff(left) ||
    left.total - right.total ||
    left.block - right.block)) {
    if (seen.has(block.block)) continue;
    const duplicates = (bySignature.get(block.signature) ?? []).filter((index) => index !== block.block);
    for (const index of [block.block, ...duplicates]) seen.add(index);
    items.push({
      block,
      duplicates,
      reason: block.population > 0
        ? "the instruction populations differ here; nothing below can be read until they agree"
        : duplicates.length > 0
          ? `same residual shape as block ${duplicates.join(", ")} — one source fix should close all of them`
          : "smallest open residual",
    });
  }
  return items;
}

/** One line, for a table. */
export function summarizeObjective(objective: ResidualObjective): string {
  const undetermined = objective.undetermined > 0 ? ` +${objective.undetermined} undetermined` : "";
  if (objective.exact) return `exact${undetermined}`;
  const terms: string[] = [];
  if (objective.controlFlow > 0) terms.push(`cfg ${objective.controlFlow}`);
  if (objective.population > 0) terms.push(`pop ${objective.population}`);
  if (objective.schedule > 0) terms.push(`sched ${objective.schedule}`);
  if (objective.allocation > 0) terms.push(`alloc ${objective.allocation}`);
  const body = terms.length > 0 ? terms.join(" ") : "no residual, bytes still differ";
  return `${body}${undetermined}`;
}
