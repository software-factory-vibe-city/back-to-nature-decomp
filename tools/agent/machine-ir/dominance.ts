/**
 * Dominators, postdominators, dominance frontiers, and the loop forest.
 *
 * These are what turn a graph into a structure. Dominance frontiers place the
 * phi nodes; postdominance finds where two arms of a branch rejoin, which is
 * the boundary of an `if`; the loop forest says which back edges belong
 * together and which blocks leave.
 *
 * The dominator computation is the Cooper–Harvey–Kennedy iterative algorithm
 * over reverse postorder. It is not the asymptotically fastest, and at this
 * scale — a function is tens of blocks — it is the right trade: the whole
 * implementation is one intersection loop a reader can check, where the
 * near-linear algorithms are not.
 */

import type { BasicBlock, Cfg } from "./cfg.js";
import { reversePostorderOf } from "./cfg.js";

export interface Dominance {
  /** Immediate dominator per block; the entry's is itself. */
  idom: Int32Array;
  /** Blocks where a definition's dominance ends: where phis go. */
  frontier: Set<number>[];
  /** Blocks each block dominates, transitively — the dominator tree's children. */
  children: number[][];
  /** Depth in the dominator tree, entry = 0. */
  depth: Int32Array;
}

/** Immediate dominators over the reachable subgraph. */
export function computeDominators(cfg: Cfg): Dominance {
  const count = cfg.blocks.length;
  const order = cfg.reversePostorder;
  const position = new Int32Array(count).fill(-1);
  order.forEach((block, index) => { position[block] = index; });

  const idom = new Int32Array(count).fill(-1);
  idom[cfg.entry] = cfg.entry;

  const intersect = (left: number, right: number): number => {
    let a = left;
    let b = right;
    /* The guard is not defensive decoration: a block whose immediate
     * dominator has settled on itself would spin here forever, and an
     * unreachable predecessor can produce exactly that during the fixpoint. */
    for (let guard = 0; a !== b && guard <= count * 2 + 4; guard++) {
      /* Walk the one that is *later* in reverse postorder up the tree. */
      while (position[a]! > position[b]! && idom[a] !== a && idom[a]! >= 0) a = idom[a]!;
      while (position[b]! > position[a]! && idom[b] !== b && idom[b]! >= 0) b = idom[b]!;
      if (position[a]! === position[b]! && a !== b) return cfg.entry;
      if ((idom[a] === a && position[a]! > position[b]!) || (idom[b] === b && position[b]! > position[a]!)) return cfg.entry;
    }
    return a === b ? a : cfg.entry;
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const block of order) {
      if (block === cfg.entry) continue;
      let candidate = -1;
      for (const predecessor of cfg.blocks[block]!.predecessors) {
        if (idom[predecessor] === -1) continue;
        candidate = candidate === -1 ? predecessor : intersect(predecessor, candidate);
      }
      if (candidate !== -1 && idom[block] !== candidate) {
        idom[block] = candidate;
        changed = true;
      }
    }
  }

  /* Dominance frontiers: for every join, walk each predecessor up the
   * dominator tree until the block's own immediate dominator, adding the
   * block to each. */
  const frontier: Set<number>[] = cfg.blocks.map(() => new Set<number>());
  for (const block of cfg.blocks) {
    if (block.predecessors.length < 2) continue;
    for (const predecessor of block.predecessors) {
      if (idom[predecessor] === -1) continue;
      let runner = predecessor;
      while (runner !== idom[block.index] && runner !== -1) {
        frontier[runner]!.add(block.index);
        if (runner === idom[runner]) break;
        runner = idom[runner]!;
      }
    }
  }

  const children: number[][] = cfg.blocks.map(() => []);
  for (const block of cfg.blocks) {
    if (block.index === cfg.entry || idom[block.index] === -1) continue;
    /* A block that dominates itself and is not the entry would make the
     * dominator tree cyclic, and every walk of it non-terminating. */
    if (idom[block.index] === block.index) continue;
    children[idom[block.index]!]!.push(block.index);
  }

  const depth = new Int32Array(count).fill(0);
  for (const block of order) {
    if (block === cfg.entry) continue;
    const parent = idom[block];
    if (parent !== undefined && parent >= 0 && parent !== block) depth[block] = depth[parent]! + 1;
  }

  return { idom, frontier, children, depth };
}

/**
 * Postdominators: which block every path from here must reach.
 *
 * Computed as dominators of the reversed graph from a virtual exit. A function
 * with several exits gets one virtual sink; without it, two returns would have
 * no common postdominator and every `if` would look unstructured.
 */
export function computePostDominators(cfg: Cfg): Int32Array {
  const count = cfg.blocks.length;
  const sink = count; /* the virtual exit */
  const reversed: BasicBlock[] = [];
  for (let index = 0; index <= count; index++) {
    reversed.push({
      index,
      instructions: [],
      vram: 0,
      successors: [],
      predecessors: [],
      terminator: "fall",
    });
  }
  for (const block of cfg.blocks) {
    for (const successor of block.successors) reversed[successor]!.successors.push(block.index);
  }
  for (const exit of cfg.exits) reversed[exit]!.successors.push(sink);
  /* `sink` is the reversed graph's entry: reverse its own edges in. */
  reversed[sink]!.successors = cfg.exits.slice();
  for (const block of reversed) {
    for (const successor of block.successors) reversed[successor]!.predecessors.push(block.index);
  }

  const order = reversePostorderOf(reversed, sink);
  const position = new Int32Array(count + 1).fill(-1);
  order.forEach((block, index) => { position[block] = index; });
  const ipdom = new Int32Array(count + 1).fill(-1);
  ipdom[sink] = sink;

  const intersect = (left: number, right: number): number => {
    let a = left;
    let b = right;
    while (a !== b) {
      while (position[a]! > position[b]!) a = ipdom[a]!;
      while (position[b]! > position[a]!) b = ipdom[b]!;
    }
    return a;
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const block of order) {
      if (block === sink) continue;
      let candidate = -1;
      for (const predecessor of reversed[block]!.predecessors) {
        if (ipdom[predecessor] === -1) continue;
        candidate = candidate === -1 ? predecessor : intersect(predecessor, candidate);
      }
      if (candidate !== -1 && ipdom[block] !== candidate) {
        ipdom[block] = candidate;
        changed = true;
      }
    }
  }
  return ipdom.slice(0, count);
}

/* ---- loops ----------------------------------------------------------------- */

export interface NaturalLoop {
  header: number;
  /** Blocks whose successor is the header and which the header dominates. */
  latches: number[];
  /** Every block in the loop, header included. */
  body: Set<number>;
  /** Edges leaving the loop: (from, to) with `to` outside the body. */
  exits: Array<{ from: number; to: number }>;
  /** Index of the enclosing loop in the returned list, or -1. */
  parent: number;
  depth: number;
}

/**
 * Natural loops, innermost first.
 *
 * A back edge is one whose target dominates its source; its natural loop is
 * everything that reaches the latch without leaving through the header. Two
 * back edges to one header make one loop with two latches, which is the right
 * answer — they are one `while` with a `continue`.
 *
 * An irreducible region — a cycle with two entries — produces no natural loop
 * at all. That is reported rather than approximated: there is no `while` whose
 * body it is, and a constructor that pretended otherwise would be wrong in a
 * way the byte oracle could not diagnose.
 */
export function findNaturalLoops(cfg: Cfg, dominance: Dominance): NaturalLoop[] {
  const dominates = (ancestor: number, block: number): boolean => {
    let current = block;
    for (let guard = 0; guard <= cfg.blocks.length; guard++) {
      if (current === ancestor) return true;
      const parent = dominance.idom[current];
      if (parent === undefined || parent === -1 || parent === current) return false;
      current = parent;
    }
    return false;
  };

  const byHeader = new Map<number, number[]>();
  for (const block of cfg.blocks) {
    for (const successor of block.successors) {
      if (dominates(successor, block.index)) {
        byHeader.set(successor, [...(byHeader.get(successor) ?? []), block.index]);
      }
    }
  }

  const loops: NaturalLoop[] = [];
  for (const [header, latches] of byHeader) {
    const body = new Set<number>([header]);
    const stack = [...latches];
    for (const latch of latches) body.add(latch);
    while (stack.length > 0) {
      const block = stack.pop()!;
      for (const predecessor of cfg.blocks[block]!.predecessors) {
        if (body.has(predecessor)) continue;
        body.add(predecessor);
        stack.push(predecessor);
      }
    }
    const exits: NaturalLoop["exits"] = [];
    for (const block of body) {
      for (const successor of cfg.blocks[block]!.successors) {
        if (!body.has(successor)) exits.push({ from: block, to: successor });
      }
      /* A block that leaves the function is an exit from the loop too. */
      if (cfg.blocks[block]!.successors.length === 0) exits.push({ from: block, to: -1 });
    }
    loops.push({ header, latches, body, exits, parent: -1, depth: 0 });
  }

  /* Nesting: a loop whose body is a strict subset of another's sits inside it.
   * Sorted smallest-first so the first containing loop found is the closest. */
  loops.sort((left, right) => left.body.size - right.body.size);
  for (let index = 0; index < loops.length; index++) {
    for (let outer = index + 1; outer < loops.length; outer++) {
      if (loops[outer]!.body.has(loops[index]!.header) && loops[outer]!.body.size > loops[index]!.body.size) {
        loops[index]!.parent = outer;
        break;
      }
    }
  }
  for (let index = loops.length - 1; index >= 0; index--) {
    const loop = loops[index]!;
    loop.depth = loop.parent === -1 ? 0 : loops[loop.parent]!.depth + 1;
  }
  return loops;
}

/**
 * Cycles the loop analysis could not name.
 *
 * Every block that participates in a cycle but belongs to no natural loop is
 * in an irreducible region. Naming them is what keeps the structure honest:
 * a constructor is told there is control flow here it has no `while` for,
 * instead of being handed a body that silently omits an entry.
 */
export function irreducibleBlocks(cfg: Cfg, loops: NaturalLoop[]): number[] {
  const inLoop = new Set<number>();
  for (const loop of loops) for (const block of loop.body) inLoop.add(block);

  /* Tarjan's strongly connected components, iteratively. */
  const index = new Int32Array(cfg.blocks.length).fill(-1);
  const low = new Int32Array(cfg.blocks.length).fill(0);
  const onStack = new Uint8Array(cfg.blocks.length);
  const stack: number[] = [];
  let counter = 0;
  const cyclic = new Set<number>();

  for (const root of cfg.reversePostorder) {
    if (index[root] !== -1) continue;
    const work: Array<{ block: number; next: number }> = [{ block: root, next: 0 }];
    index[root] = low[root] = counter++;
    stack.push(root);
    onStack[root] = 1;
    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const block = cfg.blocks[frame.block]!;
      if (frame.next < block.successors.length) {
        const successor = block.successors[frame.next++]!;
        if (index[successor] === -1) {
          index[successor] = low[successor] = counter++;
          stack.push(successor);
          onStack[successor] = 1;
          work.push({ block: successor, next: 0 });
        } else if (onStack[successor]) {
          low[frame.block] = Math.min(low[frame.block]!, index[successor]!);
        }
        continue;
      }
      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1]!.block;
        low[parent] = Math.min(low[parent]!, low[frame.block]!);
      }
      if (low[frame.block] === index[frame.block]) {
        const component: number[] = [];
        for (;;) {
          const member = stack.pop()!;
          onStack[member] = 0;
          component.push(member);
          if (member === frame.block) break;
        }
        const selfLoop = component.length === 1 && cfg.blocks[component[0]!]!.successors.includes(component[0]!);
        if (component.length > 1 || selfLoop) for (const member of component) cyclic.add(member);
      }
    }
  }

  return [...cyclic].filter((block) => !inLoop.has(block)).sort((a, b) => a - b);
}
