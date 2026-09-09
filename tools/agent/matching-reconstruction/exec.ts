/**
 * Bounded symbolic execution of one decoded function, producing a decision DAG
 * over load atoms and entry registers.
 *
 * Why execution rather than CFG pattern-matching: the plan's regression case
 * (§2) is a scan whose loop the compiler rotated, peeled, and gave compensated
 * pointer updates. A structural matcher would need one rule per such shape;
 * executing the machine words recovers the *relation* those shapes compute,
 * which is invariant across all of them. Every path is accounted for by
 * construction — anything the model cannot express throws `UnsupportedTarget`
 * with the instruction that caused it, never a guess (plan §6 C1).
 *
 * Exploration merges states at control-transfer targets keyed on the *live*
 * registers only (a dead register's stale value must not block a merge, or a
 * two-field scan of N records explodes into 3^N paths). Liveness comes from a
 * standard backward fixpoint over an instruction-level CFG that models delay
 * slots in execution order.
 */

import {
  REGISTER_NAMES,
  type DecodedInsn,
  decodeWord,
  isBranch,
  isStore,
  loadSigned,
  loadWidth,
} from "./decode.js";
import type { BinaryOp, DagNode, DagRef, Predicate, StoreEffect, SymExpr } from "./types.js";

/* ---- failure carrying its location -------------------------------------- */

export class UnsupportedTarget extends Error {
  constructor(readonly reason: string, readonly vram: number[]) {
    super(reason);
    this.name = "UnsupportedTarget";
  }
}

/* ---- expressions --------------------------------------------------------- */

export const constExpr = (value: number): SymExpr => ({ kind: "const", value: value >>> 0 });

export function canon(expr: SymExpr): string {
  switch (expr.kind) {
    case "const": return `#${expr.value >>> 0}`;
    case "entry": return `@${expr.register}`;
    case "load": {
      const place = expr.base ? `${canon(expr.base)}+${expr.address}` : `${expr.address >>> 0}`;
      const epoch = expr.epoch ? `@${expr.epoch}` : "";
      return `M${expr.width}${expr.signed ? "s" : "u"}[${place}]${epoch}`;
    }
    case "unary": return `${expr.op}(${canon(expr.operand)})`;
    case "binary": return `${expr.op}(${canon(expr.left)},${canon(expr.right)})`;
  }
}

/**
 * Split a non-constant address into a symbolic base and a constant offset.
 * Only pointer-shaped bases — an argument register's entry value, or a loaded
 * pointer — qualify; computed bases (scaled indexing, sums of two pointers)
 * are outside the supported classes and return null.
 */
export function splitAddress(expr: SymExpr): { base: SymExpr; offset: number } | null {
  let offset = 0;
  let current = expr;
  for (let depth = 0; depth < 8; depth++) {
    if (current.kind === "entry" || current.kind === "load") return { base: current, offset };
    if (current.kind === "binary" && current.op === "add") {
      const left = current.left;
      const right = current.right;
      if (right.kind === "const") {
        offset += right.value | 0;
        current = left;
        continue;
      }
      if (left.kind === "const") {
        offset += left.value | 0;
        current = right;
        continue;
      }
    }
    return null;
  }
  return null;
}

const asConst = (expr: SymExpr): number | undefined =>
  expr.kind === "const" ? expr.value >>> 0 : undefined;

const toSigned = (value: number): number => value | 0;

/** Build a binary expression, folding what can be folded. */
export function binary(op: BinaryOp, left: SymExpr, right: SymExpr): SymExpr {
  const a = asConst(left);
  const b = asConst(right);
  if (a !== undefined && b !== undefined) {
    switch (op) {
      case "add": return constExpr(a + b);
      case "sub": return constExpr(a - b);
      case "and": return constExpr(a & b);
      case "or": return constExpr(a | b);
      case "xor": return constExpr(a ^ b);
      case "nor": return constExpr(~(a | b));
      case "sll": return constExpr(a << (b & 31));
      case "srl": return constExpr(a >>> (b & 31));
      case "sra": return constExpr(toSigned(a) >> (b & 31));
      case "sltS": return constExpr(toSigned(a) < toSigned(b) ? 1 : 0);
      case "sltU": return constExpr(a >>> 0 < b >>> 0 ? 1 : 0);
    }
  }
  /* x + 0, x | 0, x ^ 0, x << 0 … keep expressions in their simplest spelling. */
  if (b === 0 && (op === "add" || op === "sub" || op === "or" || op === "xor" || op === "sll" || op === "srl" || op === "sra")) {
    return left;
  }
  if (a === 0 && (op === "add" || op === "or" || op === "xor")) return right;

  if (op === "and" && (b === 0xffff || b === 0xff)) {
    return zeroExtend(left, b === 0xffff ? 16 : 8);
  }
  /* (x << 16) >> 16 arithmetic — cc1's 16-bit sign extension. */
  if (op === "sra" && b !== undefined && left.kind === "binary" && left.op === "sll") {
    const shift = asConst(left.right);
    if (shift === b && (b === 16 || b === 24)) {
      return signExtend(left.left, b === 16 ? 16 : 8);
    }
  }
  return { kind: "binary", op, left, right };
}

function zeroExtend(expr: SymExpr, bits: 8 | 16): SymExpr {
  if (expr.kind === "const") return constExpr(expr.value & (bits === 16 ? 0xffff : 0xff));
  if (expr.kind === "load" && !expr.signed && expr.width * 8 <= bits) return expr;
  if (expr.kind === "unary" && (expr.op === "zext16" || expr.op === "zext8")) {
    const inner = expr.op === "zext16" ? 16 : 8;
    if (inner <= bits) return expr;
  }
  return { kind: "unary", op: bits === 16 ? "zext16" : "zext8", operand: expr };
}

function signExtend(expr: SymExpr, bits: 8 | 16): SymExpr {
  if (expr.kind === "const") {
    const mask = bits === 16 ? 0xffff : 0xff;
    const sign = bits === 16 ? 0x8000 : 0x80;
    const value = expr.value & mask;
    return constExpr(value & sign ? value - (mask + 1) : value);
  }
  if (expr.kind === "load" && expr.signed && expr.width * 8 <= bits) return expr;
  return { kind: "unary", op: bits === 16 ? "sext16" : "sext8", operand: expr };
}

/* ---- hash-consed decision DAG -------------------------------------------- */

export function canonPredicate(pred: Predicate): string {
  if (pred.right === undefined) return `${pred.op}(${canon(pred.left)})`;
  const left = canon(pred.left);
  const right = canon(pred.right);
  /* eq is symmetric; a canonical operand order makes the machine's and the
   * template's spelling of the same test identical. */
  if (pred.op === "eq" && right < left) return `eq(${right},${left})`;
  return `${pred.op}(${left},${right})`;
}

export class DagArena {
  readonly nodes: DagNode[] = [];
  private readonly keys = new Map<string, DagRef>();

  private intern(key: string, node: DagNode): DagRef {
    const existing = this.keys.get(key);
    if (existing !== undefined) return existing;
    const ref = this.nodes.length;
    this.nodes.push(node);
    this.keys.set(key, ref);
    return ref;
  }

  leaf(value: SymExpr, effects: StoreEffect[] = []): DagRef {
    const effectKey = effects.map((effect) => `${effect.address}:${effect.width}:${canon(effect.value)}`).join(",");
    return this.intern(`L${canon(value)}|E${effectKey}`, { kind: "leaf", value, effects });
  }

  test(pred: Predicate, onTrue: DagRef, onFalse: DagRef): DagRef {
    /* Both outcomes reaching the same continuation makes the test dead. */
    if (onTrue === onFalse) return onTrue;
    return this.intern(`T${canonPredicate(pred)}|${onTrue}|${onFalse}`, { kind: "test", pred, onTrue, onFalse });
  }

  node(ref: DagRef): DagNode {
    return this.nodes[ref]!;
  }
}

/* ---- support pre-scan ---------------------------------------------------- */

/**
 * Cheap whole-function classification before any execution. Everything found
 * is reported at once, so an unsupported function names all its blockers
 * rather than the first one per run.
 */
export function classifySupport(insns: DecodedInsn[]): { reason: string; vram: number[] }[] {
  const found = new Map<string, number[]>();
  const note = (reason: string, vram: number) => {
    found.set(reason, [...(found.get(reason) ?? []), vram]);
  };
  const start = insns[0]?.vram ?? 0;
  const end = start + insns.length * 4;

  for (const insn of insns) {
    if (insn.op === "jal" || insn.op === "jalr") note("calls another function (the supported class is call-free)", insn.vram);
    else if (insn.op === "unknown") note(`word 0x${(insn.word >>> 0).toString(16)} is outside the decoded integer subset`, insn.vram);
    else if ((isBranch(insn.op) || insn.op === "j") && insn.target !== undefined && (insn.target < start || insn.target >= end)) {
      note("control transfers outside the function", insn.vram);
    }
  }
  return [...found.entries()].map(([reason, vram]) => ({ reason, vram }));
}

/* ---- liveness ------------------------------------------------------------ */

function defsUses(insn: DecodedInsn): { defs: number; uses: number } {
  const bit = (register: number) => (register === 0 ? 0 : 1 << register);
  switch (insn.op) {
    case "addu": case "subu": case "and": case "or": case "xor": case "nor":
    case "slt": case "sltu":
      return { defs: bit(insn.rd), uses: bit(insn.rs) | bit(insn.rt) };
    case "sll": case "srl": case "sra":
      return { defs: bit(insn.rd), uses: bit(insn.rt) };
    case "sllv": case "srlv": case "srav":
      return { defs: bit(insn.rd), uses: bit(insn.rt) | bit(insn.rs) };
    case "addiu": case "addi": case "slti": case "sltiu":
    case "andi": case "ori": case "xori":
      return { defs: bit(insn.rt), uses: bit(insn.rs) };
    case "lui":
      return { defs: bit(insn.rt), uses: 0 };
    case "lb": case "lbu": case "lh": case "lhu": case "lw":
      return { defs: bit(insn.rt), uses: bit(insn.rs) };
    case "sb": case "sh": case "sw":
      return { defs: 0, uses: bit(insn.rt) | bit(insn.rs) };
    case "beq": case "bne":
      return { defs: 0, uses: bit(insn.rs) | bit(insn.rt) };
    case "blez": case "bgtz": case "bltz": case "bgez":
      return { defs: 0, uses: bit(insn.rs) };
    case "jr":
      /* Returning hands `$v0` to the caller, which is the only way the return
       * value becomes live. */
      return { defs: 0, uses: bit(insn.rs) | bit(2) };
    default:
      return { defs: 0, uses: 0 };
  }
}

/**
 * Live-in registers per instruction, as a bitmask, over an instruction-level
 * CFG whose edges follow execution order: a branch reads its condition, then
 * its delay slot executes, then control transfers.
 */
export function computeLiveIn(insns: DecodedInsn[]): Int32Array {
  const count = insns.length;
  const start = insns[0]?.vram ?? 0;
  const indexOf = (vram: number) => (vram - start) / 4;

  const successors: number[][] = insns.map(() => []);
  for (let index = 0; index < count; index++) {
    const insn = insns[index]!;
    if (isBranch(insn.op) || insn.op === "j" || insn.op === "jr") {
      /* The transfer is decided here but the delay slot runs first. */
      if (index + 1 < count) successors[index]!.push(index + 1);
      const delay = index + 1;
      if (delay < count) {
        const delayTargets: number[] = [];
        if (insn.op === "jr") {
          /* exit — no successor */
        } else if (insn.op === "j") {
          if (insn.target !== undefined) delayTargets.push(indexOf(insn.target));
        } else {
          if (insn.target !== undefined) delayTargets.push(indexOf(insn.target));
          if (delay + 1 < count) delayTargets.push(delay + 1);
        }
        for (const target of delayTargets) {
          if (target >= 0 && target < count) successors[delay]!.push(target);
        }
      }
      index++; /* the delay slot's own fall-through edge was just added */
    } else if (index + 1 < count) {
      successors[index]!.push(index + 1);
    }
  }

  const liveIn = new Int32Array(count);
  const liveOut = new Int32Array(count);
  const meta = insns.map(defsUses);

  let changed = true;
  while (changed) {
    changed = false;
    for (let index = count - 1; index >= 0; index--) {
      let out = 0;
      for (const successor of successors[index]!) out |= liveIn[successor]!;
      const before = liveIn[index]!;
      liveOut[index] = out;
      liveIn[index] = meta[index]!.uses | (out & ~meta[index]!.defs);
      if (liveIn[index] !== before) changed = true;
    }
  }
  return liveIn;
}

/* ---- the executor -------------------------------------------------------- */

export interface ExecOptions {
  /** `$gp` when the container has one; concrete gp makes gp-relative loads resolvable. */
  gpValue?: number | undefined;
  maxStates?: number | undefined;
  maxSteps?: number | undefined;
}

export interface LoadMeta {
  /** Absolute address, or the offset within `baseCanon`'s group. */
  address: number;
  width: 1 | 2 | 4;
  signed: boolean;
  viaGp: boolean;
  /** Canonical base for pointer-relative loads; absent for absolute ones. */
  baseCanon?: string | undefined;
}

export interface ExecResult {
  arena: DagArena;
  root: DagRef;
  /** Distinct load atoms the relation reads. */
  loads: LoadMeta[];
  states: number;
  steps: number;
}

type Registers = SymExpr[];

/**
 * One known cell value, keyed by `group|offset|width` where the group is the
 * canonical base ("" for absolute addresses). Holds the latest stored value,
 * or the atom a previous load created, so repeat reads see one value.
 */
interface MemCell {
  offset: number;
  width: 1 | 2 | 4;
  value: SymExpr;
}

/** The executor's whole per-path state: registers, memory, and store log. */
interface ExecState {
  regs: Registers;
  memory: Map<string, MemCell>;
  effects: StoreEffect[];
}

const cloneState = (state: ExecState): ExecState => ({
  regs: state.regs.slice(),
  memory: new Map(state.memory),
  effects: state.effects.slice(),
});

const V0 = 2;

export function executeFunction(insns: DecodedInsn[], options: ExecOptions = {}): ExecResult {
  const blockers = classifySupport(insns);
  if (blockers.length > 0) {
    throw new UnsupportedTarget(
      blockers.map((blocker) => blocker.reason).join("; "),
      blockers.flatMap((blocker) => blocker.vram),
    );
  }

  const start = insns[0]?.vram ?? 0;
  const count = insns.length;
  const liveIn = computeLiveIn(insns);
  const arena = new DagArena();
  const loads = new Map<string, LoadMeta>();
  const maxStates = options.maxStates ?? 4096;
  const maxSteps = options.maxSteps ?? 200_000;
  let states = 0;
  let steps = 0;

  const initial: Registers = REGISTER_NAMES.map((name, index) => {
    if (index === 0) return constExpr(0);
    if (name === "gp" && options.gpValue) return constExpr(options.gpValue);
    return { kind: "entry", register: name };
  });

  const indexOf = (vram: number): number => {
    const index = (vram - start) / 4;
    if (!Number.isInteger(index) || index < 0 || index >= count) {
      throw new UnsupportedTarget("control transfers outside the function", [vram]);
    }
    return index;
  };

  const memo = new Map<string, DagRef | "in-progress">();

  const stateKey = (index: number, state: ExecState): string => {
    const live = liveIn[index]!;
    const parts: string[] = [];
    for (let register = 1; register < 32; register++) {
      if (live & (1 << register)) parts.push(`${register}=${canon(state.regs[register]!)}`);
    }
    /* Memory and the store log are live state everywhere — a merged
     * continuation must agree on what has been written and in what order. */
    const memoryKey = state.effects
      .map((effect) => `${effect.address}:${effect.width}:${canon(effect.value)}`)
      .join(",");
    return `${index}|${parts.join(",")}|M${memoryKey}`;
  };

  const loadAtom = (
    base: SymExpr | undefined,
    offset: number,
    width: 1 | 2 | 4,
    signed: boolean,
    viaGp: boolean,
    epoch: number,
  ): SymExpr => {
    const atom: SymExpr = {
      kind: "load",
      address: base ? offset : offset >>> 0,
      width,
      signed,
      ...(base ? { base } : {}),
      ...(epoch > 0 ? { epoch } : {}),
    };
    const key = canon(atom).replace(/@\d+$/, "");
    const existing = loads.get(key);
    if (!existing) {
      loads.set(key, {
        address: base ? offset : offset >>> 0,
        width,
        signed,
        viaGp,
        ...(base ? { baseCanon: canon(base) } : {}),
      });
    } else if (viaGp) existing.viaGp = true;
    return atom;
  };

  /** Narrow a stored value back out the way a sized load would see it. */
  const loadedBack = (cell: MemCell, signed: boolean): SymExpr => {
    if (cell.width === 4) return cell.value;
    const bits: 8 | 16 = cell.width === 2 ? 16 : 8;
    return signed ? signExtend(cell.value, bits) : zeroExtend(cell.value, bits);
  };

  /** Apply one non-control instruction to the state. */
  const apply = (insn: DecodedInsn, state: ExecState): void => {
    const regs = state.regs;
    const set = (register: number, value: SymExpr) => {
      if (register !== 0) regs[register] = value;
    };
    const rs = regs[insn.rs]!;
    const rt = regs[insn.rt]!;
    switch (insn.op) {
      case "nop": return;
      case "addu": return set(insn.rd, binary("add", rs, rt));
      case "subu": return set(insn.rd, binary("sub", rs, rt));
      case "and": return set(insn.rd, binary("and", rs, rt));
      case "or": return set(insn.rd, binary("or", rs, rt));
      case "xor": return set(insn.rd, binary("xor", rs, rt));
      case "nor": return set(insn.rd, binary("nor", rs, rt));
      case "slt": return set(insn.rd, binary("sltS", rs, rt));
      case "sltu": return set(insn.rd, binary("sltU", rs, rt));
      case "sll": return set(insn.rd, binary("sll", rt, constExpr(insn.shamt)));
      case "srl": return set(insn.rd, binary("srl", rt, constExpr(insn.shamt)));
      case "sra": return set(insn.rd, binary("sra", rt, constExpr(insn.shamt)));
      case "sllv": return set(insn.rd, binary("sll", rt, binary("and", rs, constExpr(31))));
      case "srlv": return set(insn.rd, binary("srl", rt, binary("and", rs, constExpr(31))));
      case "srav": return set(insn.rd, binary("sra", rt, binary("and", rs, constExpr(31))));
      case "addiu": case "addi": return set(insn.rt, binary("add", rs, constExpr(insn.simm)));
      case "slti": return set(insn.rt, binary("sltS", rs, constExpr(insn.simm)));
      case "sltiu": return set(insn.rt, binary("sltU", rs, constExpr(insn.simm)));
      case "andi": return set(insn.rt, binary("and", rs, constExpr(insn.uimm)));
      case "ori": return set(insn.rt, binary("or", rs, constExpr(insn.uimm)));
      case "xori": return set(insn.rt, binary("xor", rs, constExpr(insn.uimm)));
      case "lui": return set(insn.rt, constExpr(insn.uimm << 16));
      case "lb": case "lbu": case "lh": case "lhu": case "lw": {
        const place = resolvePlace(rs, insn, "load");
        const width = loadWidth(insn.op);
        if (place.offset % width !== 0) {
          throw new UnsupportedTarget(`misaligned load at 0x${insn.vram.toString(16)}`, [insn.vram]);
        }
        const cellKey = `${place.group}|${place.offset}|${width}`;
        const known = state.memory.get(cellKey);
        if (known) return set(insn.rt, loadedBack(known, loadSigned(insn.op)));
        checkOverlap(state, place.group, place.offset, width, insn.vram, "load");
        const atom = loadAtom(place.base, place.offset, width, loadSigned(insn.op), insn.rs === 28, state.effects.length);
        /* Remember the atom so a repeat read is the same value, not a twin. */
        state.memory.set(cellKey, { offset: place.offset, width, value: atom });
        return set(insn.rt, atom);
      }
      case "sb": case "sh": case "sw": {
        const place = resolvePlace(rs, insn, "store");
        const width: 1 | 2 | 4 = insn.op === "sw" ? 4 : insn.op === "sh" ? 2 : 1;
        if (place.offset % width !== 0) {
          throw new UnsupportedTarget(`misaligned store at 0x${insn.vram.toString(16)}`, [insn.vram]);
        }
        checkOverlap(state, place.group, place.offset, width, insn.vram, "store");
        if (state.effects.length >= 1024) {
          throw new UnsupportedTarget("store budget (1024) exhausted", [insn.vram]);
        }
        /* A store through one base may alias any cell reached through a
         * different base (two absolute cells excepted — their addresses are
         * concrete and distinct). Forget those forwarded values; the store
         * log itself loses nothing. */
        for (const key of [...state.memory.keys()]) {
          const group = key.slice(0, key.lastIndexOf("|", key.lastIndexOf("|") - 1));
          if (group === place.group) continue;
          if (place.group === "" && group === "") continue;
          state.memory.delete(key);
        }
        state.memory.set(`${place.group}|${place.offset}|${width}`, { offset: place.offset, width, value: rt });
        state.effects.push({
          address: place.offset,
          width,
          value: rt,
          seq: state.effects.length,
          vram: insn.vram,
          ...(place.base ? { base: place.base } : {}),
          viaGp: insn.rs === 28,
        });
        return;
      }
      default:
        throw new UnsupportedTarget(`unmodelled instruction ${insn.op} at 0x${insn.vram.toString(16)}`, [insn.vram]);
    }
  };

  /** Where a memory access lands: an absolute cell, or (base, offset). */
  function resolvePlace(
    rs: SymExpr,
    insn: DecodedInsn,
    what: string,
  ): { group: string; offset: number; base?: SymExpr | undefined } {
    const addressExpr = binary("add", rs, constExpr(insn.simm));
    const absolute = asConst(addressExpr);
    if (absolute !== undefined) return { group: "", offset: absolute };
    const split = splitAddress(addressExpr);
    if (!split) {
      throw new UnsupportedTarget(
        `${what} at 0x${insn.vram.toString(16)} has a computed address (${canon(addressExpr)})`,
        [insn.vram],
      );
    }
    return { group: canon(split.base), offset: split.offset, base: split.base };
  }

  /**
   * A partial overlap between differently-sized accesses within one base
   * group needs a byte-accurate memory model this class does not carry —
   * refuse rather than forward a wrong value. Same (offset, width) is not an
   * overlap; cells under different bases are handled by invalidation instead.
   */
  function checkOverlap(state: ExecState, group: string, offset: number, width: number, vram: number, what: string): void {
    for (const [key, cell] of state.memory) {
      const cellGroup = key.slice(0, key.lastIndexOf("|", key.lastIndexOf("|") - 1));
      if (cellGroup !== group) continue;
      if (cell.offset === offset && cell.width === width) continue;
      if (cell.offset < offset + width && offset < cell.offset + cell.width) {
        throw new UnsupportedTarget(
          `${what} at 0x${vram.toString(16)} partially overlaps an earlier access at offset 0x${cell.offset.toString(16)}`,
          [vram],
        );
      }
    }
  }

  /**
   * A branch condition as either a decided constant or a predicate. `slt`
   * results compared against zero are folded back to the comparison they
   * encode, so the DAG speaks in source-level comparisons.
   */
  const condition = (insn: DecodedInsn, regs: Registers): { concrete?: boolean; pred?: Predicate } => {
    const rs = regs[insn.rs]!;
    const rt = regs[insn.rt]!;
    const a = asConst(rs);
    const b = asConst(rt);
    switch (insn.op) {
      case "beq": case "bne": {
        if (a !== undefined && b !== undefined) {
          const equal = a === b;
          return { concrete: insn.op === "beq" ? equal : !equal };
        }
        /* beqz/bnez over an slt result is the comparison itself. */
        const sltSide = insn.rt === 0 && rs.kind === "binary" && (rs.op === "sltS" || rs.op === "sltU") ? rs : undefined;
        if (sltSide) {
          const pred: Predicate = { op: sltSide.op === "sltS" ? "ltS" : "ltU", left: sltSide.left, right: sltSide.right };
          /* beqz(slt) branches when the comparison is FALSE. */
          return { pred: insn.op === "beq" ? invert(pred) : pred };
        }
        const pred: Predicate = { op: "eq", left: rs, right: rt };
        return { pred: insn.op === "beq" ? pred : invertMarker(pred) };
      }
      case "blez": case "bgtz": case "bltz": case "bgez": {
        if (a !== undefined) {
          const value = toSigned(a);
          const taken = insn.op === "blez" ? value <= 0 : insn.op === "bgtz" ? value > 0 : insn.op === "bltz" ? value < 0 : value >= 0;
          return { concrete: taken };
        }
        const op = insn.op === "blez" ? "lez" : insn.op === "bgtz" ? "gtz" : insn.op === "bltz" ? "ltz" : "gez";
        return { pred: { op, left: rs } };
      }
      default:
        throw new UnsupportedTarget(`unmodelled branch ${insn.op}`, [insn.vram]);
    }
  };

  /* A predicate paired with which DAG edge "taken" maps to. Inversion swaps
   * the DAG children instead of introducing negated operators, keeping the
   * predicate vocabulary closed under what the template builder also emits. */
  const INVERTED = new WeakSet<Predicate>();
  function invert(pred: Predicate): Predicate {
    return invertMarker({ ...pred });
  }
  function invertMarker(pred: Predicate): Predicate {
    INVERTED.add(pred);
    return pred;
  }

  /**
   * Explore from one arrival point. Control transfers that need no fork —
   * `j`, and branches whose condition folded to a constant — continue in this
   * frame's loop rather than recursing, so a long concrete loop costs states,
   * never stack. Every key visited along the chain resolves to the same DAG
   * value, because nothing between two checkpoints adds decision structure.
   */
  let forkDepth = 0;

  const explore = (entryIndex: number, entryState: ExecState): DagRef => {
    const pendingKeys: string[] = [];
    const finish = (ref: DagRef): DagRef => {
      for (const key of pendingKeys) memo.set(key, ref);
      return ref;
    };

    let pc = entryIndex;
    const state = entryState;

    for (;;) {
      /* Checkpoint: arrival at the entry or at any control-transfer target. */
      const key = stateKey(pc, state);
      const known = memo.get(key);
      if (known === "in-progress") {
        throw new UnsupportedTarget(
          `cycle with unchanged live state at 0x${(start + pc * 4).toString(16)} — the function does not terminate on this path`,
          [start + pc * 4],
        );
      }
      if (known !== undefined) return finish(known);
      if (memo.size >= maxStates) {
        throw new UnsupportedTarget(`state budget (${maxStates}) exhausted — the control structure is outside the bounded class`, []);
      }
      memo.set(key, "in-progress");
      states++;
      pendingKeys.push(key);

      /* Straight-line run until the next control transfer. */
      transfer: for (;;) {
        if (pc < 0 || pc >= count) {
          throw new UnsupportedTarget("execution fell off the end of the function", [start + (pc - 1) * 4]);
        }
        if (++steps > maxSteps) {
          throw new UnsupportedTarget(`step budget (${maxSteps}) exhausted`, []);
        }
        const insn = insns[pc]!;

        if (insn.op === "jr") {
          if (insn.rs !== 31) throw new UnsupportedTarget(`indirect jump at 0x${insn.vram.toString(16)}`, [insn.vram]);
          const delay = insns[pc + 1];
          if (delay) applyDelay(delay, state);
          return finish(arena.leaf(state.regs[V0]!, state.effects));
        }

        if (insn.op === "j") {
          const delay = insns[pc + 1];
          if (delay) applyDelay(delay, state);
          pc = indexOf(insn.target!);
          break transfer;
        }

        if (isBranch(insn.op)) {
          const decided = condition(insn, state.regs);
          const delay = insns[pc + 1];
          if (delay) applyDelay(delay, state);
          const takenIndex = indexOf(insn.target!);
          const fallIndex = pc + 2;
          if (decided.concrete !== undefined) {
            pc = decided.concrete ? takenIndex : fallIndex;
            break transfer;
          }
          const pred = decided.pred!;
          const inverted = INVERTED.has(pred);
          /* A path with hundreds of sequential decisions is a symbolic-bound
           * loop unrolling itself — outside the bounded class, and a stack
           * overflow if left to recurse. */
          if (++forkDepth > 256) {
            throw new UnsupportedTarget("decision depth (256) exceeded — a symbolic-bound loop is outside the bounded class", [insn.vram]);
          }
          try {
            const onTaken = explore(takenIndex, cloneState(state));
            const onFall = explore(fallIndex, cloneState(state));
            return finish(inverted ? arena.test(pred, onFall, onTaken) : arena.test(pred, onTaken, onFall));
          } finally {
            forkDepth--;
          }
        }

        apply(insn, state);
        pc++;
      }
    }
  };

  const applyDelay = (insn: DecodedInsn, state: ExecState): void => {
    if (isBranch(insn.op) || insn.op === "j" || insn.op === "jr") {
      throw new UnsupportedTarget(`control instruction in a delay slot at 0x${insn.vram.toString(16)}`, [insn.vram]);
    }
    apply(insn, state);
  };

  const root = explore(0, { regs: initial, memory: new Map(), effects: [] });
  return { arena, root, loads: [...loads.values()], states, steps };
}

/** Decode raw little-endian bytes into instructions at a base address. */
export function decodeBytes(bytes: Buffer, baseVram: number): DecodedInsn[] {
  const insns: DecodedInsn[] = [];
  for (let offset = 0; offset + 4 <= bytes.length; offset += 4) {
    insns.push(decodeWord(bytes.readUInt32LE(offset), baseVram + offset));
  }
  return insns;
}
