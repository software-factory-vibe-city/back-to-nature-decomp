/**
 * Lifting decoded words into SSA over the CFG.
 *
 * The property this exists for: **size proportional to the graph, not to the
 * paths through it.** A function with twenty independent guards has a million
 * paths; its SSA has twenty branches and a handful of phis. Everything below
 * follows from refusing to enumerate paths — phis at dominance frontiers
 * rather than one state per path, one memory chain with phis at joins rather
 * than one memory history per path.
 *
 * Three rules the lifter holds to:
 *
 *   - **An unknown instruction does not end the function.** It defines an
 *     opaque value (and, if it might write memory, an opaque memory version),
 *     and everything around it is still recovered. A model that refuses at the
 *     first unmodelled word cannot describe a function that contains one.
 *   - **Delay slots run before the transfer.** The branch condition is read
 *     from the values *before* the slot; the slot's own effect lands in the
 *     same block, after it.
 *   - **Nothing is folded that loses a witness.** Constants fold, because the
 *     machine folded them; nothing else does. The alternatives layer needs to
 *     see the shape the compiler emitted.
 */

import {
  REGISTER_NAMES,
  isBranch,
  isLoad,
  isStore,
  isUnalignedLoad,
  isUnalignedStore,
  loadSigned,
  loadWidth,
  type DecodedInsn,
} from "../matching-reconstruction/decode.js";
import type { BinaryOp } from "../matching-reconstruction/types.js";
import type { Cfg } from "./cfg.js";
import { computeDominators, type Dominance } from "./dominance.js";
import type {
  BlockExit,
  Effect,
  EffectId,
  MachineIr,
  MemoryId,
  MemoryVersion,
  Value,
  ValueId,
  ValueOp,
} from "./ir.js";

/** hi and lo extend the architectural register file for the multiplier. */
const HI = 32;
const LO = 33;
const REGISTER_COUNT = 34;
const NAME_OF = [...REGISTER_NAMES, "hi", "lo"];

/** Registers a call may leave with anything in them. */
const CALL_CLOBBERED = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 24, 25, 31, HI, LO];

/** Where arguments five and beyond live in the caller's frame. */
const OUTGOING_ARGUMENT_BASE = 0x10;

interface Builder {
  values: Value[];
  memory: MemoryVersion[];
  effects: Effect[];
  /** Hash-consing, so one expression is one node however many times it occurs. */
  interned: Map<string, ValueId>;
  opaque: MachineIr["opaque"];
}

export interface LiftOptions {
  /** `$gp`'s value, when the container has one: makes gp-relative loads concrete. */
  gpValue?: number | undefined;
  /** Resolve a `jr` through a register to its table targets. */
  resolveDispatch?: ((instructionIndex: number) => number[] | undefined) | undefined;
}

export interface LiftResult extends MachineIr {
  cfg: Cfg;
  dominance: Dominance;
  /** Register values live on entry to each block, by register index. */
  blockIn: Int32Array;
  /** Register values live on exit from each block. */
  blockOut: Int32Array;
}

/* ---- value construction ---------------------------------------------------- */

function keyOf(op: ValueOp): string {
  switch (op.kind) {
    case "const": return `c${op.value >>> 0}`;
    case "entry": return `e${op.register}`;
    case "phi": return `p${op.block}:${op.inputs.join(",")}`;
    case "unary": return `u${op.op}:${op.operand}`;
    case "binary": return `b${op.op}:${op.left},${op.right}`;
    case "load": return `l${op.width}${op.signed ? "s" : "u"}:${op.address}:${op.memory}`;
    case "call-result": return `r${op.effect}:${op.register}`;
    /* An opaque value is identified by the instruction that produced it: two
     * unmodelled words are two unknowns even if they look alike. */
    case "opaque": return `o${op.source.vram}:${op.operands.join(",")}`;
  }
}

function intern(builder: Builder, op: ValueOp, block: number, vram?: number): ValueId {
  const key = keyOf(op);
  const existing = builder.interned.get(key);
  if (existing !== undefined) return existing;
  const id = builder.values.length;
  builder.values.push({ id, op, block, ...(vram !== undefined ? { vram } : {}) });
  builder.interned.set(key, id);
  return id;
}

const constantOf = (builder: Builder, value: number, block: number): ValueId =>
  intern(builder, { kind: "const", value: value >>> 0 }, block);

/** The literal a value holds, or undefined when it is not a literal. */
function literal(builder: Builder, id: ValueId): number | undefined {
  const op = builder.values[id]?.op;
  return op?.kind === "const" ? op.value >>> 0 : undefined;
}

/**
 * Build a binary node, folding only what the machine itself folded.
 *
 * Constant folding is not an optimisation here: an `addiu` of two known values
 * produced one known value in the machine, and keeping the operation would
 * make the IR claim an addition the hardware had already performed. Anything
 * involving a non-literal is left exactly as emitted, because its shape is
 * evidence about the source.
 */
function binary(builder: Builder, op: BinaryOp, left: ValueId, right: ValueId, block: number, vram: number): ValueId {
  const a = literal(builder, left);
  const b = literal(builder, right);
  if (a !== undefined && b !== undefined) {
    const folded = foldBinary(op, a, b);
    if (folded !== undefined) return constantOf(builder, folded, block);
  }
  /* `x + 0` and friends: the machine emitted the instruction, but the value is
   * the operand, and keeping a no-op node makes every later comparison of two
   * equal values fail. */
  if (b === 0 && (op === "add" || op === "sub" || op === "or" || op === "xor" || op === "sll" || op === "srl" || op === "sra")) {
    return left;
  }
  if (a === 0 && (op === "add" || op === "or" || op === "xor")) return right;
  return intern(builder, { kind: "binary", op, left, right }, block, vram);
}

function foldBinary(op: BinaryOp, a: number, b: number): number | undefined {
  switch (op) {
    case "add": return (a + b) >>> 0;
    case "sub": return (a - b) >>> 0;
    case "and": return (a & b) >>> 0;
    case "or": return (a | b) >>> 0;
    case "xor": return (a ^ b) >>> 0;
    case "nor": return (~(a | b)) >>> 0;
    case "sll": return (a << (b & 31)) >>> 0;
    case "srl": return (a >>> (b & 31)) >>> 0;
    case "sra": return ((a | 0) >> (b & 31)) >>> 0;
    case "sltS": return ((a | 0) < (b | 0) ? 1 : 0);
    case "sltU": return (a >>> 0) < (b >>> 0) ? 1 : 0;
    case "mulLo": return Math.imul(a | 0, b | 0) >>> 0;
    /* A division by zero traps; the fold has no answer and the node stays. */
    case "divS": return b === 0 ? undefined : (Math.trunc((a | 0) / (b | 0)) | 0) >>> 0;
    case "divU": return b === 0 ? undefined : Math.floor((a >>> 0) / (b >>> 0)) >>> 0;
    case "remS": return b === 0 ? undefined : ((a | 0) % (b | 0)) >>> 0;
    case "remU": return b === 0 ? undefined : ((a >>> 0) % (b >>> 0)) >>> 0;
    default: return undefined;
  }
}

/* ---- lifting ---------------------------------------------------------------- */

/**
 * Lift a decoded function into SSA.
 *
 * Phis are placed at the iterated dominance frontier of every register that is
 * assigned anywhere, then the dominator tree is walked once with a renaming
 * stack. That is the standard construction, and it is the reason the result is
 * graph-sized: no path is ever enumerated.
 */
export function liftToSsa(functionName: string, cfg: Cfg, options: LiftOptions = {}): LiftResult {
  const dominance = computeDominators(cfg);
  const builder: Builder = { values: [], memory: [], effects: [], interned: new Map(), opaque: [] };

  const blockCount = cfg.blocks.length;
  const blockIn = new Int32Array(blockCount * REGISTER_COUNT).fill(-1);
  const blockOut = new Int32Array(blockCount * REGISTER_COUNT).fill(-1);
  const memoryIn: MemoryId[] = new Array(blockCount).fill(-1);
  const memoryOut: MemoryId[] = new Array(blockCount).fill(-1);
  const blockExit: BlockExit[] = new Array(blockCount).fill(null).map(() => ({ kind: "unreachable" } as BlockExit));

  const entryMemory = pushMemory(builder, { kind: "entry" }, cfg.entry);

  /* Entry values: `$zero` is a literal, `$gp` is one when the container has a
   * value for it, everything else is the register as received. */
  const entryValues = new Int32Array(REGISTER_COUNT);
  for (let register = 0; register < REGISTER_COUNT; register++) {
    if (register === 0) entryValues[register] = constantOf(builder, 0, cfg.entry);
    else if (NAME_OF[register] === "gp" && options.gpValue) entryValues[register] = constantOf(builder, options.gpValue, cfg.entry);
    else entryValues[register] = intern(builder, { kind: "entry", register: NAME_OF[register] ?? String(register) }, cfg.entry);
  }

  /* Phi placement: a register assigned in block B needs a phi in every block
   * of B's iterated dominance frontier. */
  const assignedIn: Array<Set<number>> = cfg.blocks.map(() => new Set<number>());
  for (const block of cfg.blocks) {
    for (const index of block.instructions) {
      const written = destinationRegister(cfg.insns[index]!);
      for (const register of written) assignedIn[block.index]!.add(register);
    }
    /* A call writes every clobbered register, and memory. */
    if (block.instructions.some((index) => cfg.insns[index]!.op === "jal" || cfg.insns[index]!.op === "jalr")) {
      for (const register of CALL_CLOBBERED) assignedIn[block.index]!.add(register);
    }
  }

  const phiBlocks: Array<Map<number, ValueId>> = cfg.blocks.map(() => new Map<number, ValueId>());
  const memoryPhi: Array<MemoryId | undefined> = cfg.blocks.map(() => undefined);
  for (let register = 1; register < REGISTER_COUNT; register++) {
    const work = cfg.blocks.filter((block) => assignedIn[block.index]!.has(register)).map((block) => block.index);
    const placed = new Set<number>();
    while (work.length > 0) {
      const block = work.pop()!;
      for (const frontier of dominance.frontier[block] ?? []) {
        if (placed.has(frontier)) continue;
        placed.add(frontier);
        const inputs = new Array<ValueId>(cfg.blocks[frontier]!.predecessors.length).fill(-1);
        phiBlocks[frontier]!.set(register, pushPhi(builder, frontier, inputs));
        work.push(frontier);
      }
    }
  }
  /* Memory is assigned wherever anything stores or calls; its phis follow the
   * same frontier rule, which is what makes a join merge two versions instead
   * of duplicating two histories. */
  {
    const writers = cfg.blocks
      .filter((block) => block.instructions.some((index) => {
        const op = cfg.insns[index]!.op;
        return isStore(op) || isUnalignedStore(op) || op === "jal" || op === "jalr" || op === "unknown";
      }))
      .map((block) => block.index);
    const work = [...writers];
    const placed = new Set<number>();
    while (work.length > 0) {
      const block = work.pop()!;
      for (const frontier of dominance.frontier[block] ?? []) {
        if (placed.has(frontier)) continue;
        placed.add(frontier);
        const inputs = new Array<MemoryId>(cfg.blocks[frontier]!.predecessors.length).fill(-1);
        memoryPhi[frontier] = pushMemory(builder, { kind: "phi", block: frontier, inputs }, frontier);
        work.push(frontier);
      }
    }
  }

  /* Rename: one walk of the dominator tree, carrying the current value of each
   * register and of memory. */
  let effectOrder = 0;
  const walked = new Set<number>();
  const walk = (blockIndex: number, incoming: Int32Array, incomingMemory: MemoryId): void => {
    if (walked.has(blockIndex)) return;
    walked.add(blockIndex);
    const block = cfg.blocks[blockIndex]!;
    const registers = incoming.slice();
    let memory = incomingMemory;

    for (const [register, phi] of phiBlocks[blockIndex]!) registers[register] = phi;
    const phiMemory = memoryPhi[blockIndex];
    if (phiMemory !== undefined) memory = phiMemory;

    for (let register = 0; register < REGISTER_COUNT; register++) {
      blockIn[blockIndex * REGISTER_COUNT + register] = registers[register]!;
    }
    memoryIn[blockIndex] = memory;

    /* The transfer's condition is read before the delay slot executes. */
    const terminatorIndex = block.terminatorIndex;
    let condition: { left: ValueId; right: ValueId; insn: DecodedInsn } | undefined;
    let dispatchIndex: ValueId | undefined;

    /* A call's delay slot executes before the transfer, so its effect belongs
     * ahead of the call in the value graph. `jal`/`jalr` are not block
     * terminators — they return — so they sit in the middle of a block with
     * their slot after them in program order, and applying them in that order
     * records the call's arguments one instruction too early: the standard
     * `jal f; addiu a0, zero, 7` then reports whatever `$a0` held on entry. */
    const consumed = new Set<number>();
    for (const index of block.instructions) {
      if (consumed.has(index)) continue;
      const insn = cfg.insns[index]!;
      if (index === terminatorIndex) {
        if (isBranch(insn.op)) {
          condition = { left: registers[insn.rs]!, right: registers[insn.rt]!, insn };
        } else if (insn.op === "jr" && insn.rs !== 31) {
          dispatchIndex = registers[insn.rs]!;
        }
        continue; /* the transfer itself defines nothing */
      }
      /* jalr reads its destination before executing the delay slot. */
      const callThrough = insn.op === "jalr" ? registers[insn.rs]! : undefined;
      if (insn.op === "jal" || insn.op === "jalr") {
        const slot = index + 1;
        if (block.instructions.includes(slot) && slot !== terminatorIndex) {
          consumed.add(slot);
          memory = applyInstruction(builder, cfg.insns[slot]!, registers, memory, blockIndex, () => effectOrder++).memory;
        }
      }
      const result = applyInstruction(builder, insn, registers, memory, blockIndex, () => effectOrder++, callThrough);
      memory = result.memory;
    }

    for (let register = 0; register < REGISTER_COUNT; register++) {
      blockOut[blockIndex * REGISTER_COUNT + register] = registers[register]!;
    }
    memoryOut[blockIndex] = memory;

    /* Settle the exit. */
    if (block.terminator === "return") {
      blockExit[blockIndex] = { kind: "return", value: registers[2] ?? null };
    } else if (block.terminator === "trap") {
      const breakInsn = block.instructions.map((index) => cfg.insns[index]!).find((insn) => insn.op === "break");
      blockExit[blockIndex] = { kind: "trap", vram: breakInsn?.vram ?? block.vram };
    } else if (block.terminator === "dispatch" && dispatchIndex !== undefined) {
      blockExit[blockIndex] = { kind: "dispatch", index: dispatchIndex, targets: block.successors.slice() };
    } else if (block.terminator === "branch" && condition) {
      const test = branchCondition(builder, condition.insn, condition.left, condition.right, blockIndex);
      blockExit[blockIndex] = {
        kind: "branch",
        condition: test,
        polarity: "taken-if-true",
        onTrue: block.successors[0] ?? -1,
        onFalse: block.successors[1] ?? block.successors[0] ?? -1,
      };
    } else if (block.successors.length === 1) {
      blockExit[blockIndex] = { kind: "fall", to: block.successors[0]! };
    }

    /* Fill in each successor's phi inputs from this block's exit values. */
    for (const successor of block.successors) {
      const slot = cfg.blocks[successor]!.predecessors.indexOf(blockIndex);
      if (slot < 0) continue;
      for (const [register, phi] of phiBlocks[successor]!) {
        const op = builder.values[phi]!.op;
        if (op.kind === "phi") op.inputs[slot] = registers[register]!;
      }
      const successorMemoryPhi = memoryPhi[successor];
      if (successorMemoryPhi !== undefined) {
        const op = builder.memory[successorMemoryPhi]!.op;
        if (op.kind === "phi") op.inputs[slot] = memory;
      }
    }

    for (const child of dominance.children[blockIndex] ?? []) walk(child, registers, memory);
  };
  walk(cfg.entry, entryValues, entryMemory);

  /* A phi input the walk never filled belongs to an unreachable predecessor;
   * point it at the phi's own block-entry value so the graph stays total. */
  for (const value of builder.values) {
    if (value.op.kind !== "phi") continue;
    for (let slot = 0; slot < value.op.inputs.length; slot++) {
      if (value.op.inputs[slot] === -1) value.op.inputs[slot] = value.id;
    }
  }
  for (const version of builder.memory) {
    if (version.op.kind !== "phi") continue;
    for (let slot = 0; slot < version.op.inputs.length; slot++) {
      if (version.op.inputs[slot] === -1) version.op.inputs[slot] = version.id;
    }
  }

  return {
    functionName,
    values: builder.values,
    memory: builder.memory,
    effects: builder.effects,
    blockExit,
    memoryIn,
    memoryOut,
    opaque: builder.opaque,
    cfg,
    dominance,
    blockIn,
    blockOut,
  };
}

function pushPhi(builder: Builder, block: number, inputs: ValueId[]): ValueId {
  const id = builder.values.length;
  builder.values.push({ id, op: { kind: "phi", block, inputs }, block });
  return id;
}

function pushMemory(builder: Builder, op: MemoryVersion["op"], block: number): MemoryId {
  const id = builder.memory.length;
  builder.memory.push({ id, op, block });
  return id;
}

function pushEffect(builder: Builder, op: Effect["op"], block: number, vram: number, order: number): EffectId {
  const id = builder.effects.length;
  builder.effects.push({ id, op, block, vram, order });
  return id;
}

/** Registers one instruction defines. */
function destinationRegister(insn: DecodedInsn): number[] {
  switch (insn.op) {
    case "addu": case "subu": case "and": case "or": case "xor": case "nor":
    case "slt": case "sltu": case "sll": case "srl": case "sra":
    case "sllv": case "srlv": case "srav": case "mfhi": case "mflo":
      return insn.rd === 0 ? [] : [insn.rd];
    case "addiu": case "addi": case "slti": case "sltiu":
    case "andi": case "ori": case "xori": case "lui":
    case "lb": case "lbu": case "lh": case "lhu": case "lw":
    case "lwl": case "lwr":
      return insn.rt === 0 ? [] : [insn.rt];
    case "mult": case "multu": case "div": case "divu":
      return [HI, LO];
    case "jal": case "jalr":
      return CALL_CLOBBERED;
    case "unknown":
      /* An unmodelled word may define its `rt` or its `rd`; both are marked so
       * a phi exists wherever either could reach a join. */
      return [insn.rt, insn.rd].filter((register) => register !== 0);
    default:
      return [];
  }
}

/** The value a branch tests, as a one-bit condition. */
function branchCondition(builder: Builder, insn: DecodedInsn, left: ValueId, right: ValueId, block: number): ValueId {
  const zero = constantOf(builder, 0, block);
  switch (insn.op) {
    case "beq": return binary(builder, "sltU", binary(builder, "xor", left, right, block, insn.vram), constantOf(builder, 1, block), block, insn.vram);
    case "bne": return binary(builder, "sltU", zero, binary(builder, "xor", left, right, block, insn.vram), block, insn.vram);
    case "bltz": return binary(builder, "sltS", left, zero, block, insn.vram);
    case "bgez": return binary(builder, "sltU", binary(builder, "sltS", left, zero, block, insn.vram), constantOf(builder, 1, block), block, insn.vram);
    case "blez": return binary(builder, "sltU", binary(builder, "sltS", zero, left, block, insn.vram), constantOf(builder, 1, block), block, insn.vram);
    case "bgtz": return binary(builder, "sltS", zero, left, block, insn.vram);
    default: return zero;
  }
}

/**
 * Apply one instruction to the register file, producing values and effects.
 *
 * Everything the decoder models is modelled; everything else becomes an opaque
 * value over its operands, plus an opaque memory version when the instruction
 * might write. That is what keeps a function containing one unknown word from
 * disappearing entirely.
 */
function applyInstruction(
  builder: Builder,
  insn: DecodedInsn,
  registers: Int32Array,
  memory: MemoryId,
  block: number,
  nextOrder: () => number,
  callThrough?: ValueId,
): { memory: MemoryId } {
  const set = (register: number, value: ValueId): void => {
    if (register !== 0) registers[register] = value;
  };
  const rs = registers[insn.rs]!;
  const rt = registers[insn.rt]!;
  const constant = (value: number): ValueId => constantOf(builder, value, block);
  const bin = (op: BinaryOp, left: ValueId, right: ValueId): ValueId => binary(builder, op, left, right, block, insn.vram);

  switch (insn.op) {
    case "nop": return { memory };
    case "addu": set(insn.rd, bin("add", rs, rt)); return { memory };
    case "subu": set(insn.rd, bin("sub", rs, rt)); return { memory };
    case "and": set(insn.rd, bin("and", rs, rt)); return { memory };
    case "or": set(insn.rd, bin("or", rs, rt)); return { memory };
    case "xor": set(insn.rd, bin("xor", rs, rt)); return { memory };
    case "nor": set(insn.rd, bin("nor", rs, rt)); return { memory };
    case "slt": set(insn.rd, bin("sltS", rs, rt)); return { memory };
    case "sltu": set(insn.rd, bin("sltU", rs, rt)); return { memory };
    case "sll": set(insn.rd, bin("sll", rt, constant(insn.shamt))); return { memory };
    case "srl": set(insn.rd, bin("srl", rt, constant(insn.shamt))); return { memory };
    case "sra": set(insn.rd, bin("sra", rt, constant(insn.shamt))); return { memory };
    case "sllv": set(insn.rd, bin("sll", rt, bin("and", rs, constant(31)))); return { memory };
    case "srlv": set(insn.rd, bin("srl", rt, bin("and", rs, constant(31)))); return { memory };
    case "srav": set(insn.rd, bin("sra", rt, bin("and", rs, constant(31)))); return { memory };
    case "addiu": case "addi": set(insn.rt, bin("add", rs, constant(insn.simm))); return { memory };
    case "slti": set(insn.rt, bin("sltS", rs, constant(insn.simm))); return { memory };
    case "sltiu": set(insn.rt, bin("sltU", rs, constant(insn.simm))); return { memory };
    case "andi": set(insn.rt, bin("and", rs, constant(insn.uimm))); return { memory };
    case "ori": set(insn.rt, bin("or", rs, constant(insn.uimm))); return { memory };
    case "xori": set(insn.rt, bin("xor", rs, constant(insn.uimm))); return { memory };
    case "lui": set(insn.rt, constant((insn.uimm << 16) >>> 0)); return { memory };
    case "mult": case "multu": {
      registers[LO] = bin("mulLo", rs, rt);
      registers[HI] = bin(insn.op === "mult" ? "mulHiS" : "mulHiU", rs, rt);
      return { memory };
    }
    case "div": case "divu": {
      registers[LO] = bin(insn.op === "div" ? "divS" : "divU", rs, rt);
      registers[HI] = bin(insn.op === "div" ? "remS" : "remU", rs, rt);
      return { memory };
    }
    case "mfhi": set(insn.rd, registers[HI]!); return { memory };
    case "mflo": set(insn.rd, registers[LO]!); return { memory };
    case "lb": case "lbu": case "lh": case "lhu": case "lw": {
      const address = bin("add", rs, constant(insn.simm));
      set(insn.rt, intern(builder, {
        kind: "load", address, width: loadWidth(insn.op), signed: loadSigned(insn.op), memory,
      }, block, insn.vram));
      return { memory };
    }
    case "sb": case "sh": case "sw": {
      const address = bin("add", rs, constant(insn.simm));
      const width: 1 | 2 | 4 = insn.op === "sw" ? 4 : insn.op === "sh" ? 2 : 1;
      const effect = pushEffect(builder, { kind: "store", address, value: rt, width }, block, insn.vram, nextOrder());
      return { memory: pushMemory(builder, { kind: "store", effect, from: memory }, block) };
    }
    case "lwl": case "lwr": {
      /* Half of an unaligned word access. The value it produces depends on the
       * register's previous contents as well as memory, so both are operands —
       * which is exactly what makes it opaque rather than a load. */
      const address = bin("add", rs, constant(insn.simm));
      const source = { vram: insn.vram, op: insn.op };
      set(insn.rt, intern(builder, { kind: "opaque", source, operands: [address, rt] }, block, insn.vram));
      builder.opaque.push({ vram: insn.vram, op: insn.op, note: "half of an unaligned word load; the pair moves one word" });
      return { memory };
    }
    case "swl": case "swr": {
      const address = bin("add", rs, constant(insn.simm));
      const source = { vram: insn.vram, op: insn.op };
      const effect = pushEffect(builder, { kind: "opaque", source, operands: [address, rt] }, block, insn.vram, nextOrder());
      builder.opaque.push({ vram: insn.vram, op: insn.op, note: "half of an unaligned word store; the pair moves one word" });
      void effect;
      return { memory: pushMemory(builder, { kind: "opaque", source, from: memory }, block) };
    }
    case "jal": case "jalr": {
      const args: Array<ValueId | null> = [registers[4]!, registers[5]!, registers[6]!, registers[7]!];
      /* Outgoing-argument slots are memory the caller wrote; the IR records
       * the addresses it would read rather than resolving them here, so the
       * call effect stays a pure description of the transfer. */
      const op: Effect["op"] = insn.op === "jal" && insn.target !== undefined
        ? { kind: "call", target: insn.target >>> 0, args, memory }
        : { kind: "call", through: callThrough ?? registers[insn.rs]!, args, memory };
      const effect = pushEffect(builder, op, block, insn.vram, nextOrder());
      for (const register of CALL_CLOBBERED) {
        registers[register] = intern(builder, { kind: "call-result", effect, register: NAME_OF[register] ?? String(register) }, block, insn.vram);
      }
      return { memory: pushMemory(builder, { kind: "call", effect, from: memory }, block) };
    }
    case "break":
      /* The block's exit carries the trap; the instruction itself defines
       * nothing and writes nothing. */
      return { memory };
    default: {
      const source = { vram: insn.vram, op: insn.op === "unknown" ? `word:0x${(insn.word >>> 0).toString(16)}` : insn.op };
      const operands = [rs, rt].filter((value) => value >= 0);
      const value = intern(builder, { kind: "opaque", source, operands }, block, insn.vram);
      if (insn.rt !== 0) set(insn.rt, value);
      if (insn.rd !== 0) set(insn.rd, value);
      builder.opaque.push({ vram: insn.vram, op: source.op, note: "outside the modelled instruction set; its value and any write are opaque" });
      return { memory: pushMemory(builder, { kind: "opaque", source, from: memory }, block) };
    }
  }
}

/** Where the outgoing argument area starts, for a consumer resolving call arguments. */
export { OUTGOING_ARGUMENT_BASE, REGISTER_COUNT, NAME_OF };
