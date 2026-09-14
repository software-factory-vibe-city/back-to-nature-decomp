/**
 * The control-flow graph of one function's decoded words.
 *
 * Why this exists alongside the symbolic executor: the executor recovers a
 * *relation* by walking paths, which is exactly right for a small read-only
 * scan and exactly wrong for anything whose paths multiply. A function with
 * twenty independent guards has a million paths and twenty blocks, and every
 * cost in a path-shaped model is the first number while every cost in a
 * graph-shaped model is the second. The plan's requirement is stated in those
 * terms: the recovered structure must stay proportional to the CFG, not to the
 * iteration or path count.
 *
 * Two machine details the graph has to be honest about, because getting either
 * wrong silently changes which values reach which block:
 *
 *   - **Delay slots run before the transfer.** A branch decides on the values
 *     it reads, then its delay slot executes, then control moves. So the delay
 *     slot belongs to the *predecessor* of both successors, and it is placed at
 *     the end of the branch's own block rather than at the head of either
 *     target.
 *   - **A branch's fall-through is the instruction after the delay slot**, two
 *     words on, not one.
 */

import { isBranch, type DecodedInsn } from "../matching-reconstruction/decode.js";

export interface BasicBlock {
  index: number;
  /** Instruction indices in this block, in execution order. */
  instructions: number[];
  /** VRAM of the first instruction. */
  vram: number;
  successors: number[];
  predecessors: number[];
  /**
   * How the block ends. `fall` blocks flow into their single successor;
   * `branch` blocks test; `dispatch` blocks jump through a table; `return`
   * and `trap` blocks leave the function.
   */
  terminator: "fall" | "branch" | "jump" | "dispatch" | "return" | "trap";
  /** Index of the branch/jump instruction, for a block that has one. */
  terminatorIndex?: number;
  /** Index of the delay slot, which executes before the transfer. */
  delayIndex?: number;
}

export interface Cfg {
  blocks: BasicBlock[];
  /** Instruction index → owning block. */
  blockOf: Int32Array;
  entry: number;
  /** Blocks with no successors: returns and traps. */
  exits: number[];
  insns: DecodedInsn[];
  /** Reverse-postorder block indices — the order every forward pass wants. */
  reversePostorder: number[];
}

/** Instruction indices that begin a basic block. */
function leaders(insns: DecodedInsn[]): Set<number> {
  const start = insns[0]?.vram ?? 0;
  const indexOf = (vram: number): number | undefined => {
    const index = (vram - start) / 4;
    return Number.isInteger(index) && index >= 0 && index < insns.length ? index : undefined;
  };

  const marks = new Set<number>([0]);
  for (let index = 0; index < insns.length; index++) {
    const insn = insns[index]!;
    if (isBranch(insn.op) || insn.op === "j") {
      const target = insn.target === undefined ? undefined : indexOf(insn.target);
      if (target !== undefined) marks.add(target);
      /* The instruction after the delay slot starts a block: it is the
       * fall-through of a branch, or unreachable-by-fall-through after a
       * `j`, which is still a leader if anything jumps to it. */
      if (index + 2 < insns.length) marks.add(index + 2);
      index++; /* skip the delay slot; it is not a leader */
      continue;
    }
    if (insn.op === "jr" || insn.op === "jalr") {
      if (index + 2 < insns.length) marks.add(index + 2);
      index++;
      continue;
    }
    if (insn.op === "break" && index + 1 < insns.length) marks.add(index + 1);
  }
  return marks;
}

/**
 * Build the CFG.
 *
 * `resolveDispatch` supplies the targets of an indirect jump; without it a
 * `jr` through a register other than `$ra` is modelled as an exit with no
 * successors, which is honest — the graph says "control leaves here by a route
 * this model does not follow" rather than inventing edges.
 */
export function buildCfg(
  insns: DecodedInsn[],
  options: { resolveDispatch?: ((instructionIndex: number) => number[] | undefined) | undefined } = {},
): Cfg {
  const start = insns[0]?.vram ?? 0;
  const indexOf = (vram: number): number | undefined => {
    const index = (vram - start) / 4;
    return Number.isInteger(index) && index >= 0 && index < insns.length ? index : undefined;
  };

  const marks = [...leaders(insns)].filter((index) => index < insns.length).sort((a, b) => a - b);
  const blockOf = new Int32Array(insns.length).fill(-1);
  const blocks: BasicBlock[] = [];

  for (let position = 0; position < marks.length; position++) {
    const from = marks[position]!;
    const to = position + 1 < marks.length ? marks[position + 1]! : insns.length;
    const instructions: number[] = [];
    for (let index = from; index < to; index++) {
      instructions.push(index);
      blockOf[index] = blocks.length;
    }
    blocks.push({
      index: blocks.length,
      instructions,
      vram: insns[from]?.vram ?? start + from * 4,
      successors: [],
      predecessors: [],
      terminator: "fall",
    });
  }

  for (const block of blocks) {
    const last = block.instructions[block.instructions.length - 1]!;
    /* The transfer is the second-to-last instruction when the block ends with
     * a delay slot; scan back over at most one slot to find it. */
    let transferIndex = -1;
    for (const candidate of [last - 1, last]) {
      if (candidate < block.instructions[0]!) continue;
      const insn = insns[candidate];
      if (!insn) continue;
      if (isBranch(insn.op) || insn.op === "j" || insn.op === "jr") { transferIndex = candidate; break; }
    }
    const trap = block.instructions.some((index) => insns[index]!.op === "break");

    if (transferIndex < 0) {
      if (trap) { block.terminator = "trap"; continue; }
      if (last + 1 < insns.length) block.successors.push(blockOf[last + 1]!);
      continue;
    }

    const transfer = insns[transferIndex]!;
    block.terminatorIndex = transferIndex;
    if (transferIndex + 1 <= last) block.delayIndex = transferIndex + 1;

    if (transfer.op === "jr") {
      if (transfer.rs === 31) { block.terminator = "return"; continue; }
      const targets = options.resolveDispatch?.(transferIndex);
      if (!targets || targets.length === 0) { block.terminator = "return"; continue; }
      block.terminator = "dispatch";
      for (const target of targets) {
        const index = indexOf(target);
        if (index !== undefined) block.successors.push(blockOf[index]!);
      }
      continue;
    }

    if (transfer.op === "j") {
      block.terminator = "jump";
      const target = transfer.target === undefined ? undefined : indexOf(transfer.target);
      if (target !== undefined) block.successors.push(blockOf[target]!);
      continue;
    }

    block.terminator = "branch";
    const taken = transfer.target === undefined ? undefined : indexOf(transfer.target);
    /* Taken edge first, then fall-through: every consumer reads
     * `successors[0]` as the true arm. */
    if (taken !== undefined) block.successors.push(blockOf[taken]!);
    const fall = transferIndex + 2;
    if (fall < insns.length) block.successors.push(blockOf[fall]!);
  }

  /* Deduplicate — both arms of a branch can land in one block — and wire the
   * reverse edges. A self-loop is kept; it is a real edge. */
  for (const block of blocks) {
    block.successors = [...new Set(block.successors)];
    for (const successor of block.successors) blocks[successor]!.predecessors.push(block.index);
  }
  for (const block of blocks) block.predecessors = [...new Set(block.predecessors)];

  const exits = blocks.filter((block) => block.successors.length === 0).map((block) => block.index);

  return {
    blocks,
    blockOf,
    entry: 0,
    exits,
    insns,
    reversePostorder: reversePostorderOf(blocks, 0),
  };
}

/**
 * Reverse postorder from the entry.
 *
 * Every forward dataflow pass converges fastest in this order, and the
 * dominator computation below assumes it. Unreachable blocks are simply
 * absent, which is the right answer: a block nothing reaches contributes
 * nothing to any value.
 */
export function reversePostorderOf(blocks: BasicBlock[], entry: number): number[] {
  const order: number[] = [];
  const seen = new Set<number>();
  const stack: Array<{ block: number; next: number }> = [{ block: entry, next: 0 }];
  seen.add(entry);
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    const block = blocks[frame.block]!;
    if (frame.next < block.successors.length) {
      const successor = block.successors[frame.next++]!;
      if (!seen.has(successor)) {
        seen.add(successor);
        stack.push({ block: successor, next: 0 });
      }
      continue;
    }
    order.push(frame.block);
    stack.pop();
  }
  return order.reverse();
}

/** One line per block, for a report a reader can check against a listing. */
export function renderCfg(cfg: Cfg): string[] {
  return cfg.blocks.map((block) => {
    const first = cfg.insns[block.instructions[0]!]!;
    const last = cfg.insns[block.instructions[block.instructions.length - 1]!]!;
    return (
      `B${block.index} 0x${first.vram.toString(16)}–0x${last.vram.toString(16)} ` +
      `(${block.instructions.length} insn, ${block.terminator}) ` +
      `→ ${block.successors.length === 0 ? "exit" : block.successors.map((s) => `B${s}`).join(", ")}`
    );
  });
}
