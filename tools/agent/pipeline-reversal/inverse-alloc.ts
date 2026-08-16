/**
 * g_alloc — hard registers back to value webs.
 *
 * Register allocation is the one late pass whose inverse is ordinary dataflow:
 * a hard register holds a sequence of unrelated values, and reaching-definitions
 * over the control-flow graph recovers exactly which references belong to the
 * same value. Each resulting web is one pre-allocation pseudo, so this is where
 * a target's bytes stop being "registers" and start being a program again.
 *
 * Two modeling facts keep the webs honest:
 *
 *  - a call defines every caller-saved register, so no web crosses a call in
 *    one of them; a value that survives a call is in a callee-saved register by
 *    construction, which is what the allocator guaranteed;
 *  - the arms of an indirect dispatch have no edge between them, so values in
 *    different arms never fuse even when they share a register.
 *
 * The output is the pre-allocation program plus the allocation map the target
 * actually chose. Comparing that map with a candidate's is what separates
 * "the source is wrong" from "the source is right and the allocator ordered
 * two quantities the other way".
 */

import type { MirInsn, MirProgram } from "./types.js";

/** Registers whose role is fixed by the ABI, so they carry no pseudo. */
export const FIXED_REGISTERS = new Set(["zero", "at", "sp", "gp", "fp", "k0", "k1"]);

export const CALLER_SAVED = ["v0", "v1", "a0", "a1", "a2", "a3", "t0", "t1", "t2",
  "t3", "t4", "t5", "t6", "t7", "t8", "t9", "ra"];

export interface Web {
  id: number;
  register: string;
  /** Instruction ids that define this value. */
  defs: number[];
  /** Instruction ids that read it. */
  uses: number[];
  /** True when the value is live on entry to the function. */
  liveAtEntry: boolean;
  /** Shapes of the defining instructions — the value's identity. */
  defShapes: string[];
  /** Shapes of the reading instructions. */
  useShapes: string[];
  /** Symbol the value materializes, when it materializes one. */
  symbol?: string;
  /** First and last instruction index of the web, in the given program order. */
  birth: number;
  death: number;
}

export interface AllocInverseResult {
  program: MirProgram;
  webs: Web[];
  /** Instruction id and operand role to web id. */
  defWebOf: Map<string, number>;
  useWebOf: Map<string, number>;
  caveats: string[];
}

class UnionFind {
  private parent: number[] = [];
  make(): number {
    this.parent.push(this.parent.length);
    return this.parent.length - 1;
  }
  find(node: number): number {
    while (this.parent[node] !== node) {
      this.parent[node] = this.parent[this.parent[node]];
      node = this.parent[node];
    }
    return node;
  }
  union(left: number, right: number): void {
    const a = this.find(left);
    const b = this.find(right);
    if (a !== b) this.parent[b] = a;
  }
}

/** Definitions each instruction makes, including a call's implicit clobbers. */
function definitions(insn: MirInsn): string[] {
  const result = new Set(insn.defs.filter((register) => !FIXED_REGISTERS.has(register)));
  if (insn.isCall) for (const register of CALLER_SAVED) result.add(register);
  return [...result];
}

/**
 * Reads, including the argument registers a call consumes.
 *
 * Which arguments a call reads is not in its encoding, so it is derived: an
 * argument register counts as read when a definition inside the function
 * reaches the call. Without that, every argument set-up would look dead and
 * the webs that carry arguments would vanish.
 */
function references(insn: MirInsn): string[] {
  const result = new Set(insn.uses.filter((register) => !FIXED_REGISTERS.has(register)));
  for (const register of insn.callArguments ?? []) result.add(register);
  return [...result];
}

/**
 * Reaching definitions over the CFG, then union-find over each use.
 *
 * The iteration is a plain fixed point over the block-level in/out sets. The
 * function is small enough that a worklist buys nothing, and the simple form is
 * the one whose correctness is readable.
 */
export function inverseAlloc(program: MirProgram): AllocInverseResult {
  const caveats: string[] = [];
  const insns = program.insns;
  const positionOf = new Map<number, number>();
  insns.forEach((insn, index) => positionOf.set(insn.id, index));

  /* Definition sites: one node per (instruction, register) pair, plus one
   * per register for the live-at-entry value. */
  const merge = new UnionFind();
  const nodeOfDefinition = new Map<string, number>();
  const entryNode = new Map<string, number>();
  const definitionSites: Array<{ node: number; register: string; insnId: number | null }> = [];

  const registersSeen = new Set<string>();
  for (const insn of insns) {
    for (const register of [...definitions(insn), ...references(insn)]) registersSeen.add(register);
  }
  for (const register of registersSeen) {
    const node = merge.make();
    entryNode.set(register, node);
    definitionSites.push({ node, register, insnId: null });
  }
  for (const insn of insns) {
    for (const register of definitions(insn)) {
      const node = merge.make();
      nodeOfDefinition.set(`${insn.id}|${register}`, node);
      definitionSites.push({ node, register, insnId: insn.id });
    }
  }

  /* Block-level reaching definitions. `state` maps a register to the set of
   * definition nodes that reach a program point. */
  type State = Map<string, Set<number>>;
  const cloneState = (state: State): State => new Map([...state].map(([key, value]) => [key, new Set(value)]));
  const unionInto = (into: State, from: State): boolean => {
    let changed = false;
    for (const [register, nodes] of from) {
      const existing = into.get(register) ?? new Set<number>();
      const before = existing.size;
      for (const node of nodes) existing.add(node);
      if (existing.size !== before || !into.has(register)) changed = true;
      into.set(register, existing);
    }
    return changed;
  };

  const blockIn: State[] = program.blocks.map(() => new Map());
  const blockOut: State[] = program.blocks.map(() => new Map());
  const entryState: State = new Map();
  for (const [register, node] of entryNode) entryState.set(register, new Set([node]));

  const transfer = (blockIndex: number, incoming: State): State => {
    const state = cloneState(incoming);
    for (const id of program.blocks[blockIndex].insns) {
      const insn = insns[positionOf.get(id)!];
      if (!insn) continue;
      for (const register of definitions(insn)) {
        state.set(register, new Set([nodeOfDefinition.get(`${insn.id}|${register}`)!]));
      }
    }
    return state;
  };

  for (let iteration = 0; iteration < program.blocks.length + 2; iteration++) {
    let changed = false;
    program.blocks.forEach((block, index) => {
      const incoming: State = new Map();
      if (index === 0) unionInto(incoming, entryState);
      for (const predecessor of block.predecessors) unionInto(incoming, blockOut[predecessor]);
      /* An arm reached only by the indirect dispatch inherits the state at the
       * dispatch, which is block 0's output. */
      if (block.dispatchTarget) unionInto(incoming, blockOut[0]);
      if (unionInto(blockIn[index], incoming)) changed = true;
      const outgoing = transfer(index, blockIn[index]);
      if (unionInto(blockOut[index], outgoing)) changed = true;
    });
    if (!changed) break;
  }

  /* Walk each block once more, this time joining uses to their reaching
   * definitions. */
  const useWebOf = new Map<string, number>();
  const defWebOf = new Map<string, number>();
  for (const [index, block] of program.blocks.entries()) {
    const state = cloneState(blockIn[index]);
    for (const id of block.insns) {
      const insn = insns[positionOf.get(id)!];
      if (!insn) continue;
      if (insn.isCall) {
        insn.callArguments = ["a0", "a1", "a2", "a3"].filter((register) => {
          const reaching = state.get(register);
          if (!reaching || reaching.size === 0) return false;
          return [...reaching].some((node) => node !== entryNode.get(register));
        });
      }
      for (const register of references(insn)) {
        const reaching = state.get(register);
        if (!reaching || reaching.size === 0) {
          const node = entryNode.get(register)!;
          useWebOf.set(`${insn.id}|${register}`, node);
          continue;
        }
        const nodes = [...reaching];
        for (let position = 1; position < nodes.length; position++) merge.union(nodes[0], nodes[position]);
        useWebOf.set(`${insn.id}|${register}`, nodes[0]);
      }
      for (const register of definitions(insn)) {
        const node = nodeOfDefinition.get(`${insn.id}|${register}`)!;
        defWebOf.set(`${insn.id}|${register}`, node);
        state.set(register, new Set([node]));
      }
    }
  }

  /* Collect the webs. */
  const webByRoot = new Map<number, Web>();
  let nextId = 0;
  const webFor = (node: number, register: string): Web => {
    const root = merge.find(node);
    let web = webByRoot.get(root);
    if (!web) {
      web = {
        id: nextId++,
        register,
        defs: [],
        uses: [],
        liveAtEntry: false,
        defShapes: [],
        useShapes: [],
        birth: Number.POSITIVE_INFINITY,
        death: -1,
      };
      webByRoot.set(root, web);
    }
    return web;
  };

  for (const site of definitionSites) {
    const web = webFor(site.node, site.register);
    if (site.insnId === null) {
      /* An entry node with no use attached is not a real value. */
      continue;
    }
    const insn = insns[positionOf.get(site.insnId)!];
    web.defs.push(site.insnId);
    web.defShapes.push(insn.shape);
    if (insn.symbol && !web.symbol) web.symbol = insn.symbol;
    web.birth = Math.min(web.birth, insn.index);
    web.death = Math.max(web.death, insn.index);
  }
  for (const [key, node] of useWebOf) {
    const [rawId, register] = key.split("|");
    const insn = insns[positionOf.get(Number(rawId))!];
    const web = webFor(node, register);
    web.uses.push(Number(rawId));
    web.useShapes.push(insn.shape);
    web.birth = Math.min(web.birth, insn.index);
    web.death = Math.max(web.death, insn.index);
    if (web.defs.length === 0) web.liveAtEntry = true;
  }

  /* A call defines every caller-saved register so that no web crosses it, but
   * a definition nothing reads is not a value — it is the kill itself. Keeping
   * those would put seventeen phantom webs behind every call. */
  const webs = [...webByRoot.values()]
    .filter((web) => web.uses.length > 0)
    .sort((left, right) => left.birth - right.birth || left.register.localeCompare(right.register));
  webs.forEach((web, index) => { web.id = index; });

  /* Re-key the maps to the final web ids and stamp the instructions. */
  const finalDefWeb = new Map<string, number>();
  const finalUseWeb = new Map<string, number>();
  /* Only surviving webs get an identity. The ids are re-assigned by position
   * after the dead call-clobber webs are dropped, so a dropped web's stale id
   * would alias a live one and silently mis-attribute every reference to it. */
  const surviving = new Set(webs);
  const idOfRoot = new Map<number, number>();
  for (const [root, web] of webByRoot) if (surviving.has(web)) idOfRoot.set(root, web.id);
  for (const [key, node] of defWebOf) finalDefWeb.set(key, idOfRoot.get(merge.find(node))!);
  for (const [key, node] of useWebOf) finalUseWeb.set(key, idOfRoot.get(merge.find(node))!);

  for (const insn of insns) {
    insn.defWebs = definitions(insn)
      .map((register) => finalDefWeb.get(`${insn.id}|${register}`))
      .filter((value): value is number => value !== undefined);
    insn.useWebs = references(insn)
      .map((register) => finalUseWeb.get(`${insn.id}|${register}`))
      .filter((value): value is number => value !== undefined);
  }

  if (program.blocks.some((block) => block.dispatchTarget)) {
    caveats.push("indirect dispatch: arm blocks inherit the dispatch block's state, so a value the dispatcher set is shared by every arm");
  }

  return {
    program: { ...program, waypoint: "greg", insns, blocks: program.blocks, caveats: [...program.caveats, ...caveats] },
    webs,
    defWebOf: finalDefWeb,
    useWebOf: finalUseWeb,
    caveats,
  };
}
