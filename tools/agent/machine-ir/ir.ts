/**
 * The machine IR's vocabulary: values, memory versions, and effects.
 *
 * Three deliberate choices, each a response to something the path-shaped model
 * could not do:
 *
 *   1. **Values are nodes in a graph, not trees.** A value used twice is one
 *      node referenced twice, so a diamond of guards costs two nodes rather
 *      than doubling an expression.
 *   2. **Memory is a versioned token.** A store produces a new version; a load
 *      reads one; a join merges versions with a phi. That is what lets two
 *      arms of a branch *merge* instead of each carrying its own complete
 *      history of everything that has been written.
 *   3. **Effects keep their order without keeping their paths.** Stores and
 *      calls are ordered within a block and by the memory chain across
 *      blocks, which is exactly the ordering C has to preserve — and no more.
 *
 * Nothing here decides a source spelling. This is what the machine does; the
 * alternatives for how to write it live one layer up.
 */

import type { BinaryOp, UnaryOp } from "../matching-reconstruction/types.js";

export type ValueId = number;

/** An unknown instruction's effect on a value: preserved, never invented. */
export interface OpaqueSource {
  /** VRAM of the instruction this value came out of. */
  vram: number;
  /** The mnemonic, so a reader knows what was not modelled. */
  op: string;
}

export type ValueOp =
  /** A literal the instruction stream materialised. */
  | { kind: "const"; value: number }
  /** A register's value on entry to the function: a parameter or a callee-saved. */
  | { kind: "entry"; register: string }
  /** A join: one input per predecessor of `block`, in the block's own order. */
  | { kind: "phi"; block: number; inputs: ValueId[] }
  | { kind: "unary"; op: UnaryOp; operand: ValueId }
  | { kind: "binary"; op: BinaryOp; left: ValueId; right: ValueId }
  /** A read of `memory` at `address`. */
  | { kind: "load"; address: ValueId; width: 1 | 2 | 4; signed: boolean; memory: MemoryId }
  /** What a call left in a register. */
  | { kind: "call-result"; effect: EffectId; register: string }
  /**
   * A value an unmodelled instruction produced.
   *
   * This is the difference between a graph that stops at the first unknown
   * word and one that keeps going: an unknown value is still a value, it
   * blocks proofs that depend on it, and the rest of the function is still
   * recovered around it.
   */
  | { kind: "opaque"; source: OpaqueSource; operands: ValueId[] };

export interface Value {
  id: ValueId;
  op: ValueOp;
  /** VRAM of the instruction that defined it, when one did. */
  vram?: number;
  /** Block the definition lives in. */
  block: number;
}

export type MemoryId = number;

export type MemoryOp =
  /** Memory as the function received it. */
  | { kind: "entry" }
  /** The version a store produced. */
  | { kind: "store"; effect: EffectId; from: MemoryId }
  /** The version a call produced — a call may write anything. */
  | { kind: "call"; effect: EffectId; from: MemoryId }
  /** A join of the versions reaching `block`, one per predecessor. */
  | { kind: "phi"; block: number; inputs: MemoryId[] }
  /** The version an unmodelled instruction produced. */
  | { kind: "opaque"; source: OpaqueSource; from: MemoryId };

export interface MemoryVersion {
  id: MemoryId;
  op: MemoryOp;
  block: number;
}

export type EffectId = number;

export type EffectOp =
  | { kind: "store"; address: ValueId; value: ValueId; width: 1 | 2 | 4 }
  | {
      kind: "call";
      /** Resolved target address for a direct call. */
      target?: number;
      /** The value jumped through, for an indirect call. */
      through?: ValueId;
      /** Argument registers a0..a3, then any outgoing-area slots written. */
      args: Array<ValueId | null>;
    }
  | { kind: "opaque"; source: OpaqueSource; operands: ValueId[] };

export interface Effect {
  id: EffectId;
  op: EffectOp;
  block: number;
  vram: number;
  /** Position in the function's effect order. */
  order: number;
}

/** How a block leaves: what the structure recovery reads. */
export type BlockExit =
  | { kind: "fall"; to: number }
  | { kind: "branch"; condition: ValueId; polarity: "taken-if-true"; onTrue: number; onFalse: number }
  | { kind: "dispatch"; index: ValueId; targets: number[] }
  | { kind: "return"; value: ValueId | null }
  | { kind: "trap"; vram: number }
  | { kind: "unreachable" };

export interface MachineIr {
  functionName: string;
  values: Value[];
  memory: MemoryVersion[];
  effects: Effect[];
  /** Register name → value on entry to each block, after phis. */
  blockExit: BlockExit[];
  /** Memory version live on entry to each block. */
  memoryIn: MemoryId[];
  /** Memory version live on exit from each block. */
  memoryOut: MemoryId[];
  /** Instructions the lifter could not model, with what it did instead. */
  opaque: Array<{ vram: number; op: string; note: string }>;
}

/* ---- printing --------------------------------------------------------------- */

const REGISTER_OF = (op: ValueOp): string => (op.kind === "entry" ? op.register : "");

export function renderValue(ir: MachineIr, id: ValueId): string {
  const value = ir.values[id];
  if (!value) return `v${id}?`;
  const op = value.op;
  switch (op.kind) {
    case "const": return `#${op.value >>> 0}`;
    case "entry": return `@${REGISTER_OF(op)}`;
    case "phi": return `phi(B${op.block}; ${op.inputs.map((input) => `v${input}`).join(", ")})`;
    case "unary": return `${op.op}(v${op.operand})`;
    case "binary": return `${op.op}(v${op.left}, v${op.right})`;
    case "load": return `load${op.width}${op.signed ? "s" : "u"}(v${op.address}, m${op.memory})`;
    case "call-result": return `result(e${op.effect}, $${op.register})`;
    case "opaque": return `opaque:${op.source.op}@0x${op.source.vram.toString(16)}(${op.operands.map((o) => `v${o}`).join(", ")})`;
  }
}

export function renderIr(ir: MachineIr): string[] {
  const lines: string[] = [];
  lines.push(`${ir.functionName}: ${ir.values.length} value(s), ${ir.memory.length} memory version(s), ${ir.effects.length} effect(s)`);
  for (const value of ir.values) {
    lines.push(`  v${value.id} = ${renderValue(ir, value.id)}${value.vram !== undefined ? `   ; 0x${value.vram.toString(16)}` : ""}`);
  }
  for (const effect of ir.effects) {
    const op = effect.op;
    const text = op.kind === "store"
      ? `store${op.width}(v${op.address}) = v${op.value}`
      : op.kind === "call"
        ? `call ${op.target !== undefined ? `0x${op.target.toString(16)}` : `*v${op.through}`}(${op.args.map((arg) => (arg === null ? "-" : `v${arg}`)).join(", ")})`
        : `opaque:${op.source.op}`;
    lines.push(`  e${effect.id} @B${effect.block} 0x${effect.vram.toString(16)}: ${text}`);
  }
  for (const note of ir.opaque) {
    lines.push(`  opaque 0x${note.vram.toString(16)} ${note.op}: ${note.note}`);
  }
  return lines;
}
