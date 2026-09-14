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
import type { BinaryOp, CallEffect, DagNode, DagRef, Effect, Predicate, StoreEffect, SymExpr } from "./types.js";
import { LOOP_BACK } from "./types.js";
import { isUnaligned } from "./decode.js";
import { classifyUnknownWord, type FailureCategory } from "./failure-category.js";

/* Re-import for the executor's register file. */
import * as decodeModule from "./decode.js";

/* ---- failure carrying its location -------------------------------------- */

/**
 * A refusal that names both where it happened and *which capability* would
 * lift it. The category is chosen at the throw site, because the code that
 * refuses is the only thing that reliably knows the mechanism — recovering it
 * later by searching the prose is the census defect this replaces.
 */
export class UnsupportedTarget extends Error {
  constructor(
    readonly reason: string,
    readonly vram: number[],
    readonly category: FailureCategory = "structure-unsupported",
  ) {
    super(reason);
    this.name = "UnsupportedTarget";
  }
}

/* ---- hi/lo register indices ---------------------------------------------- */

export const HI_REG = 32;
export const LO_REG = 33;
export const REGISTER_COUNT = 34;

/**
 * Where the fifth argument sits in the caller's frame.
 *
 * O32 reserves sixteen bytes of outgoing argument area for the four register
 * arguments even though they travel in registers, so argument five is the
 * first word past that reservation.
 */
export const OUTGOING_ARGUMENT_BASE = 0x10;

/** Registers a callee must preserve; their entry values in the frame are spills. */
const CALLEE_SAVED = new Set(["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "fp", "ra", "gp", "sp"]);

/** True when a stack cell holds the untouched entry value of a saved register. */
function isCalleeSavedSpill(value: SymExpr): boolean {
  return value.kind === "entry" && CALLEE_SAVED.has(value.register);
}

/* Extended register name table for the executor's internal register file.
 * REGISTER_NAMES in decode.ts stays at 32 entries for consumers that assume
 * that size (instruction decode, etc.). */
const EXEC_REGISTER_NAMES = [...decodeModule.REGISTER_NAMES, "hi", "lo"];

/* ---- expressions --------------------------------------------------------- */

export const constExpr = (value: number): SymExpr => ({ kind: "const", value: value >>> 0 });

/** True when an expression reaches the stack pointer (a passed local address). */
export function containsSp(expr: SymExpr): boolean {
  switch (expr.kind) {
    case "entry": return expr.register === "sp";
    case "load":
      return (expr.base !== undefined && containsSp(expr.base)) ||
        (expr.index !== undefined && containsSp(expr.index.expr));
    case "unary": return containsSp(expr.operand);
    case "binary": return containsSp(expr.left) || containsSp(expr.right);
    case "call-result": return false;
    default: return false;
  }
}

export function canon(expr: SymExpr): string {
  /* Normalize: add(add(X, #-N), #N) → X — common idiom for stack frame
   * restore. Also add(X, #0) → X, sub(X, #0) → X. */
  let normalized = expr;
  if (normalized.kind === "binary" && normalized.op === "add" && normalized.left.kind === "binary" && normalized.left.op === "add") {
    const inner = normalized.left;
    if (inner.right.kind === "const" && normalized.right.kind === "const") {
      const innerVal = inner.right.value | 0;
      const outerVal = normalized.right.value | 0;
      if (innerVal + outerVal === 0) {
        normalized = inner.left;
      }
    }
  }
  if (normalized.kind === "binary" && normalized.op === "add" && normalized.right.kind === "const" && normalized.right.value === 0) {
    normalized = normalized.left;
  }
  if (normalized.kind === "binary" && normalized.op === "sub" && normalized.right.kind === "const" && normalized.right.value === 0) {
    normalized = normalized.left;
  }
  switch (normalized.kind) {
    case "const": return `#${normalized.value >>> 0}`;
    case "entry": return `@${normalized.register}`;
    case "load": {
      const place = normalized.base ? `${canon(normalized.base)}+${normalized.address}` : `${normalized.address >>> 0}`;
      const outer = normalized.outerIndex ? `[${canon(normalized.outerIndex.expr)}*${normalized.outerIndex.scale}]` : "";
      const idx = `${outer}${normalized.index ? `[${canon(normalized.index.expr)}*${normalized.index.scale}]` : ""}`;
      const epoch = normalized.epoch ? `@${normalized.epoch}` : "";
      return `M${normalized.width}${normalized.signed ? "s" : "u"}[${place}]${idx}${epoch}`;
    }
    case "unary": return `${normalized.op}(${canon(normalized.operand)})`;
    case "binary": return `${normalized.op}(${canon(normalized.left)},${canon(normalized.right)})`;
    case "call-result": return `CR(${normalized.seq},${normalized.register})`;
    case "iv": return `IV(${normalized.register},${normalized.delta})`;
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
    if (current.kind === "entry" || current.kind === "load" || current.kind === "call-result" || current.kind === "iv") return { base: current, offset };
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

/**
 * Extended address splitter that also recognizes a single scaled-index term.
 * Returns the base, a constant offset, and optionally an index expression with
 * its scale. The index term must be a `sll(e, k)` node whose left operand is
 * not a constant; at most one such term is permitted.
 *
 * Legal combinations: base + index [+ offset], base + offset [+ index],
 * and bare absolute address without base/index. Anything else (two indexes,
 * two bases, index with no base) returns null.
 */
export function splitIndexedAddress(
  expr: SymExpr,
): { base: SymExpr; offset: number; index?: { expr: SymExpr; scale: number }; outerIndex?: { expr: SymExpr; scale: number } } | null {
  /* Flatten the add tree into terms, depth ≤ 8. */
  const terms: SymExpr[] = [];
  const flatten = (e: SymExpr, depth: number): void => {
    if (depth > 8) { terms.push(e); return; }
    if (e.kind === "binary" && e.op === "add") {
      flatten(e.left, depth + 1);
      flatten(e.right, depth + 1);
    } else {
      terms.push(e);
    }
  };
  flatten(expr, 0);

  /* Find the constant term, the scaled index terms, and potential base(s).
   *
   * Two index terms are permitted, not one. `base + 40*i + 2*j + 4` is a
   * halfword array inside a record array — ordinary C — and refusing it as a
   * "computed address" discards the whole function, not just the access. The
   * wider stride is the outer subscript; the narrower one indexes within an
   * element. A third term has no two-dimensional reading, so it is refused. */
  let constant = 0;
  const indexTerms: Array<{ expr: SymExpr; scale: number }> = [];
  const baseCandidates: SymExpr[] = [];

  for (const term of terms) {
    if (term.kind === "const") {
      constant += term.value | 0;
    } else if (term.kind === "binary" && term.op === "sll" && term.left.kind !== "const") {
      if (indexTerms.length >= 2) return null;
      const scale = (term.right.kind === "const") ? (1 << (term.right.value & 31)) : 1;
      indexTerms.push({ expr: term.left, scale });
    } else if (term.kind === "entry" || term.kind === "load" || term.kind === "call-result" || term.kind === "iv") {
      baseCandidates.push(term);
    } else {
      /* Any other term (e.g. another add, a pointer of non-standard shape) — refuse. */
      return null;
    }
  }

  if (baseCandidates.length > 1) return null; /* ambiguous */
  const base = baseCandidates[0];
  if (indexTerms.length === 2) {
    /* Two subscripts of equal stride have no nesting order, so there is no
     * unique reading and the refusal is honest rather than arbitrary. */
    if (indexTerms[0]!.scale === indexTerms[1]!.scale) return null;
  }
  indexTerms.sort((left, right) => left.scale - right.scale);
  const indexTerm = indexTerms[0];
  const outerTerm = indexTerms[1];

  if (!base && indexTerm && constant === 0) {
    /* Pure index with no base and zero offset — an absolute index? Refuse —
     * we need a base for array semantics. */
    return null;
  }
  if (!base && indexTerm) {
    /* Absolute base + index: the constant is the base address.
     * Return it as a constant base, offset 0, with the index term. */
    return {
      base: { kind: "const", value: constant >>> 0 },
      offset: 0,
      index: indexTerm,
      ...(outerTerm ? { outerIndex: outerTerm } : {}),
    };
  }
  if (!base && !indexTerm) {
    /* Only a constant — that is an ordinary absolute address. */
    return null;
  }

  return base
    ? {
        base,
        offset: constant,
        ...(indexTerm ? { index: indexTerm } : {}),
        ...(outerTerm ? { outerIndex: outerTerm } : {}),
      }
    : null;
}

const asConst = (expr: SymExpr): number | undefined =>
  expr.kind === "const" ? expr.value >>> 0 : undefined;

const toSigned = (value: number): number => value | 0;

/** Build a binary expression, folding what can be folded. */
export function binary(op: BinaryOp, left: SymExpr, right: SymExpr): SymExpr {
  /* Simplify add/sub by zero to avoid phantom differences. */
  if (op === "add" && right.kind === "const" && right.value === 0) return left;
  if (op === "add" && left.kind === "const" && left.value === 0) return right;
  if (op === "sub" && right.kind === "const" && right.value === 0) return left;
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
      case "mulLo": {
        const product = BigInt(toSigned(a)) * BigInt(toSigned(b));
        return constExpr(Number(product & 0xffffffffn));
      }
      case "mulHiS": {
        const product = BigInt(toSigned(a)) * BigInt(toSigned(b));
        return constExpr(Number((product >> 32n) & 0xffffffffn));
      }
      case "mulHiU": {
        const product = BigInt(a >>> 0) * BigInt(b >>> 0);
        return constExpr(Number((product >> 32n) & 0xffffffffn));
      }
      case "divS": {
        if (b === 0) throw new UnsupportedTarget("division by constant zero", [], "division-by-zero");
        return constExpr(toSigned(Math.trunc(toSigned(a) / toSigned(b))));
      }
      case "divU": {
        if (b === 0) throw new UnsupportedTarget("division by constant zero", [], "division-by-zero");
        return constExpr((a >>> 0) / (b >>> 0) >>> 0);
      }
      case "remS": {
        if (b === 0) throw new UnsupportedTarget("division by constant zero", [], "division-by-zero");
        return constExpr(toSigned(a) % toSigned(b));
      }
      case "remU": {
        if (b === 0) throw new UnsupportedTarget("division by constant zero", [], "division-by-zero");
        return constExpr((a >>> 0) % (b >>> 0));
      }
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

/**
 * The identity of one effect, for memoization and hash-consing.
 *
 * Stack arguments are part of it. Two calls that agree on their four argument
 * registers and differ in the fifth are different calls, and a key that
 * omitted the fifth would let the executor merge them.
 */
export function effectKeyOf(effect: Effect): string {
  if (effect.kind !== "call") {
    return `${effect.base ? canon(effect.base) : ""}+${effect.address}:${effect.width}:${canon(effect.value)}`;
  }
  const stack = (effect.stackArgs ?? []).map((arg) => (arg === null ? "?" : canon(arg))).join(",");
  return `call(${effect.seq},${effect.callee},${effect.args.map(canon).join(",")}${stack ? `|${stack}` : ""})`;
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

  leaf(value: SymExpr, effects: Effect[] = []): DagRef {
    const effectKey = effects.map(effectKeyOf).join(",");
    return this.intern(`L${canon(value)}|E${effectKey}`, { kind: "leaf", value, effects });
  }

  test(pred: Predicate, onTrue: DagRef, onFalse: DagRef): DagRef {
    /* Both outcomes reaching the same continuation makes the test dead. */
    if (onTrue === onFalse) return onTrue;
    return this.intern(`T${canonPredicate(pred)}|${onTrue}|${onFalse}`, { kind: "test", pred, onTrue, onFalse });
  }

  dispatch(index: SymExpr, targets: DagRef[]): DagRef {
    const targetKey = targets.join(",");
    return this.intern(`D${canon(index)}|${targetKey}`, { kind: "dispatch", index, targets });
  }

  /**
   * The leaf an exceptional exit reaches.
   *
   * A `break` does not return; it traps. Modelling it as a distinguished leaf
   * keeps the path in the relation — its existence is what identifies the
   * guard around it — without pretending it produces a value.
   */
  trapRef(): DagRef {
    return this.intern("@__trap", {
      kind: "leaf",
      value: { kind: "entry", register: "__trap" },
      effects: [],
    });
  }

  /** Sentinel "continue" leaf used inside loop body DAGs. */
  continueRef(): DagRef {
    return this.intern("@__continue", {
      kind: "leaf",
      value: { kind: "entry", register: "__continue" },
      effects: [],
    });
  }

  loop(induction: Array<{ register: string; delta: number }>, body: DagRef, entryEffectCount = 0): DagRef {
    const key = `Lp${induction.map((iv) => `${iv.register}+${iv.delta}`).join(",")}|B${body}|E${entryEffectCount}`;
    return this.intern(key, { kind: "loop", induction, body, entryEffectCount });
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
export function classifySupport(
  insns: DecodedInsn[],
): { reason: string; vram: number[]; category: FailureCategory }[] {
  const found = new Map<string, { vram: number[]; category: FailureCategory }>();
  const note = (reason: string, vram: number, category: FailureCategory) => {
    const existing = found.get(reason);
    if (existing) existing.vram.push(vram);
    else found.set(reason, { vram: [vram], category });
  };
  const start = insns[0]?.vram ?? 0;
  const end = start + insns.length * 4;

  for (const insn of insns) {
    if (insn.op === "unknown") {
      /* The word says which mechanism is missing, and they are not the same
       * capability: unaligned accesses and the division trap packet are
       * ordinary compiler output, COP2 may be an SDK macro or handwritten
       * code. Collapsing them into one "undecoded" bucket is what made the
       * bucket unactionable. */
      const tag = classifyUnknownWord(insn.word >>> 0);
      const category: FailureCategory =
        tag === "lwl-lwr" || tag === "swl-swr" ? "unaligned-access"
          : tag === "break" ? "trap-packet"
          : tag === "cop2" || tag === "cop0" ? "coprocessor"
          : "undecoded-opcode";
      note(`word 0x${(insn.word >>> 0).toString(16)} (${tag}) is outside the decoded integer subset`, insn.vram, category);
    } else if (isUnaligned(insn.op)) {
      /* Decoded, but not a scalar access. `lwl`/`lwr` and `swl`/`swr` come in
       * pairs that together move one unaligned word, and they appear in this
       * project almost exclusively inside the backend's expansion of an
       * aggregate copy. Executing the halves would model the expansion; the
       * useful recovery is the copy, so the refusal names that capability. */
      note("unaligned word access (lwl/lwr/swl/swr)", insn.vram, "unaligned-access");
    } else if ((isBranch(insn.op) || insn.op === "j") && insn.target !== undefined && (insn.target < start || insn.target >= end)) {
      note("control transfers outside the function", insn.vram, "nonlocal-control");
    }
    /* `jr rs` with rs !== ra is a dispatch — handled in the executor. */
    /* `jal`/`jalr` are opaque calls handled in the executor (D6). */
  }
  return [...found.entries()].map(([reason, entry]) => ({ reason, vram: entry.vram, category: entry.category }));
}

/* ---- liveness ------------------------------------------------------------ */

const HI_BIT = 1 << (HI_REG - 32);  /* bit 0 of second word */
const LO_BIT = 1 << (LO_REG - 32);  /* bit 1 of second word */

function defsUses(insn: DecodedInsn): { defs: number; uses: number; defsHiLo: number; usesHiLo: number } {
  const bit = (register: number) => (register === 0 ? 0 : 1 << register);
  const hiLoBit = (register: number) => register >= 32 ? 1 << (register - 32) : 0;
  const defsHiLo = 0;
  const usesHiLo = 0;
  switch (insn.op) {
    case "mult": case "multu": case "div": case "divu":
      return { defs: 0, uses: bit(insn.rs) | bit(insn.rt), defsHiLo: HI_BIT | LO_BIT, usesHiLo: 0 };
    case "mfhi":
      return { defs: bit(insn.rd), uses: 0, defsHiLo: 0, usesHiLo: HI_BIT };
    case "mflo":
      return { defs: bit(insn.rd), uses: 0, defsHiLo: 0, usesHiLo: LO_BIT };
    case "addu": case "subu": case "and": case "or": case "xor": case "nor":
    case "slt": case "sltu":
      return { defs: bit(insn.rd), uses: bit(insn.rs) | bit(insn.rt), defsHiLo: 0, usesHiLo: 0 };
    case "sll": case "srl": case "sra":
      return { defs: bit(insn.rd), uses: bit(insn.rt), defsHiLo: 0, usesHiLo: 0 };
    case "sllv": case "srlv": case "srav":
      return { defs: bit(insn.rd), uses: bit(insn.rt) | bit(insn.rs), defsHiLo: 0, usesHiLo: 0 };
    case "addiu": case "addi": case "slti": case "sltiu":
    case "andi": case "ori": case "xori":
      return { defs: bit(insn.rt), uses: bit(insn.rs), defsHiLo: 0, usesHiLo: 0 };
    case "lui":
      return { defs: bit(insn.rt), uses: 0, defsHiLo: 0, usesHiLo: 0 };
    case "lb": case "lbu": case "lh": case "lhu": case "lw":
      return { defs: bit(insn.rt), uses: bit(insn.rs), defsHiLo: 0, usesHiLo: 0 };
    case "sb": case "sh": case "sw":
      return { defs: 0, uses: bit(insn.rt) | bit(insn.rs), defsHiLo: 0, usesHiLo: 0 };
    case "beq": case "bne":
      return { defs: 0, uses: bit(insn.rs) | bit(insn.rt), defsHiLo: 0, usesHiLo: 0 };
    case "blez": case "bgtz": case "bltz": case "bgez":
      return { defs: 0, uses: bit(insn.rs), defsHiLo: 0, usesHiLo: 0 };
    case "jr":
      /* Returning hands `$v0` to the caller, which is the only way the return
       * value becomes live. */
      return { defs: 0, uses: bit(insn.rs) | bit(2), defsHiLo: 0, usesHiLo: 0 };
    case "jal": case "jalr":
      /* Opaque call: clobbers v0, v1, a0-a3, t0-t9, at, ra, hi, lo.
       * Defines those registers; uses register arguments (a0-a3) implicitly
       * through the calling convention and rs explicitly for jalr. */
      return {
        defs: bit(2) | bit(3) | /* v0, v1 */
          bit(1) | /* at */
          bit(4) | bit(5) | bit(6) | bit(7) | /* a0-a3 */
          bit(8) | bit(9) | bit(10) | bit(11) | /* t0-t3 */
          bit(12) | bit(13) | bit(14) | bit(15) | /* t4-t7 */
          bit(24) | bit(25) | /* t8-t9 */
          bit(31) | /* ra */
          (insn.op === "jalr" ? bit(insn.rs) : 0), /* jalr also reads rs */
        uses: (insn.op === "jalr" ? bit(insn.rs) : 0),
        defsHiLo: HI_BIT | LO_BIT,
        usesHiLo: 0,
      };
    default:
      return { defs: 0, uses: 0, defsHiLo: 0, usesHiLo: 0 };
  }
}

/**
 * Instruction-level CFG successors in execution order: a branch reads its
 * condition, then its delay slot runs, then control transfers. Shared by the
 * liveness fixpoint and the loop-head normalization.
 */
export function buildSuccessors(insns: DecodedInsn[]): number[][] {
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
    } else if (insn.op === "break") {
      /* An exceptional exit has no successor; giving it a fall-through makes
       * the liveness fixpoint carry values past a path that never resumes. */
    } else if (index + 1 < count) {
      successors[index]!.push(index + 1);
    }
  }
  return successors;
}

/**
 * Live-in registers per instruction, as a bitmask over a 34-register file
 * packed into two words (word 0: r0-r31, word 1: hi/lo and future extensions).
 */
export function computeLiveIn(insns: DecodedInsn[]): Int32Array {
  const count = insns.length;
  const successors = buildSuccessors(insns);

  /* Two words per instruction: word0 = r0-r31, word1 = hi/lo */
  const liveIn = new Int32Array(count * 2);
  const liveOut = new Int32Array(count * 2);
  const meta = insns.map(defsUses);

  let changed = true;
  while (changed) {
    changed = false;
    for (let index = count - 1; index >= 0; index--) {
      let out0 = 0;
      let out1 = 0;
      for (const successor of successors[index]!) {
        out0 |= liveIn[successor * 2]!;
        out1 |= liveIn[successor * 2 + 1]!;
      }
      const before0 = liveIn[index * 2]!;
      const before1 = liveIn[index * 2 + 1]!;
      liveOut[index * 2] = out0;
      liveOut[index * 2 + 1] = out1;
      liveIn[index * 2] = meta[index]!.uses | (out0 & ~meta[index]!.defs);
      liveIn[index * 2 + 1] = meta[index]!.usesHiLo | (out1 & ~meta[index]!.defsHiLo);
      if (liveIn[index * 2] !== before0 || liveIn[index * 2 + 1] !== before1) changed = true;
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
  /**
   * Read one little-endian 32-bit word from the container's bytes at the
   * given VRAM address. Required for jump-table dispatch (D4).
   */
  readWord?: ((vram: number) => number | undefined) | undefined;
  /**
   * Resolve a code address to its symbol name (S1). When absent — test
   * fixtures, or a container with no symbol tables — call targets stay
   * hex addresses.
   */
  resolveCallTarget?: ((address: number) => string | null) | undefined;
}

export interface LoadMeta {
  /** Absolute address, or the offset within `baseCanon`'s group. */
  address: number;
  width: 1 | 2 | 4;
  signed: boolean;
  viaGp: boolean;
  /** Canonical base for pointer-relative loads; absent for absolute ones. */
  baseCanon?: string | undefined;
  /** Stride of the innermost subscript, when the access is indexed. */
  indexScale?: number | undefined;
  /** Stride of the outer subscript, for a nested access. */
  outerIndexScale?: number | undefined;
}

export interface ExecResult {
  arena: DagArena;
  root: DagRef;
  /** Distinct load atoms the relation reads. */
  loads: LoadMeta[];
  /** Canonical keys of unsigned load atoms the machine re-masked — evidence
   *  of a wide-variable + narrowed-variable pair in the source. */
  maskWitnesses: Set<string>;
  /**
   * The operands of every division this execution performed, canonicalised.
   *
   * The divide-check trap packet is recognised by testing the *guard* against
   * these, not by noticing that a division happened somewhere in the function.
   * Without the operands, "this function divides" is the only available
   * evidence, and it licenses removing any guarded trap at all.
   */
  divisions: DivisionWitness[];
  states: number;
  steps: number;
}

/** One division, by the canonical form of its dividend and divisor. */
export interface DivisionWitness {
  signed: boolean;
  dividend: string;
  divisor: string;
  vram: number;
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
  effects: Effect[];
}

const cloneState = (state: ExecState): ExecState => ({
  regs: state.regs.slice(),
  memory: new Map(state.memory),
  effects: state.effects.slice(),
});

const V0 = 2;

/**
 * Raised when an affine loop is first detected. Detection happens at the
 * SECOND arrival at the head, by which point the first iteration has already
 * been unrolled into the DAG — and a peeled first iteration is a structure no
 * plain-loop source reproduces. So detection restarts the whole execution
 * with the head recorded, and the retry summarizes the loop at its first
 * arrival instead of unrolling it at all.
 */
class RestartWithLoop extends Error {
  constructor(readonly pc: number, readonly deltas: Array<{ register: string; delta: number }>) {
    super("restart with loop summary");
  }
}

export function executeFunction(insns: DecodedInsn[], options: ExecOptions = {}): ExecResult {
  const blockers = classifySupport(insns);
  if (blockers.length > 0) {
    /* Several blockers can coexist; the reported category is the first in a
     * fixed precedence so the same function always buckets the same way.
     * Coprocessor code outranks the rest because it is the one class that may
     * not be ordinary compiler output at all. */
    const precedence: FailureCategory[] = ["coprocessor", "undecoded-opcode", "unaligned-access", "trap-packet", "nonlocal-control"];
    const category = precedence.find((candidate) => blockers.some((blocker) => blocker.category === candidate))
      ?? blockers[0]!.category;
    /* One line per distinct mechanism, with a count and the first location.
     * A refusal that repeats the same sentence once per instruction is a wall
     * of text that hides how many distinct problems there are. */
    const reason = blockers
      .map((blocker) =>
        `${blocker.reason}${blocker.vram.length > 1 ? ` ×${blocker.vram.length}` : ""}` +
        `${blocker.vram.length > 0 ? ` from 0x${blocker.vram[0]!.toString(16)}` : ""}`)
      .join("; ");
    throw new UnsupportedTarget(reason, blockers.flatMap((blocker) => blocker.vram), category);
  }

  const knownHeads = new Map<number, Array<{ register: string; delta: number }>>();
  for (let attempt = 0; attempt <= 8; attempt++) {
    try {
      return runAttempt();
    } catch (error) {
      if (error instanceof RestartWithLoop) {
        if (process.env.RECON_DEBUG) {
          console.error(`RESTART: head pc=${error.pc} vram=0x${((insns[0]?.vram ?? 0) + error.pc * 4).toString(16)} deltas=${JSON.stringify(error.deltas)}`);
        }
        knownHeads.set(error.pc, error.deltas);
        continue;
      }
      throw error;
    }
  }
  throw new UnsupportedTarget("too many interacting symbolic-bound loops", [], "loop-interaction");

  function runAttempt(): ExecResult {
  const start = insns[0]?.vram ?? 0;
  const count = insns.length;
  const liveIn = computeLiveIn(insns);
  const arena = new DagArena();
  const loads = new Map<string, LoadMeta>();
  const maskWitnesses = new Set<string>();
  const divisions: DivisionWitness[] = [];
  const maxStates = options.maxStates ?? 4096;
  const maxSteps = options.maxSteps ?? 200_000;
  let states = 0;
  let steps = 0;

  const initial: Registers = (REGISTER_NAMES as readonly string[]).map((name, index) => {
    if (index === 0) return constExpr(0);
    if (name === "gp" && options.gpValue) return constExpr(options.gpValue);
    return { kind: "entry", register: name };
  });
  /* hi/lo: extend the register file to 34 entries with entry atoms. */
  (initial as SymExpr[])[HI_REG] = { kind: "entry", register: "hi" };
  (initial as SymExpr[])[LO_REG] = { kind: "entry", register: "lo" };

  const indexOf = (vram: number): number => {
    const index = (vram - start) / 4;
    if (!Number.isInteger(index) || index < 0 || index >= count) {
      throw new UnsupportedTarget("control transfers outside the function", [vram], "nonlocal-control");
    }
    return index;
  };

  const memo = new Map<string, DagRef | "in-progress">();

  const stateKey = (index: number, state: ExecState): string => {
    const live0 = liveIn[index * 2]!;
    const live1 = liveIn[index * 2 + 1]!;
    const parts: string[] = [];
    for (let register = 1; register < 32; register++) {
      if (live0 & (1 << register)) parts.push(`${register}=${canon(state.regs[register]!)}`);
    }
    /* hi/lo: include in state key when live. */
    if (live1 & HI_BIT) parts.push(`hi=${canon(state.regs[HI_REG]!)}`);
    if (live1 & LO_BIT) parts.push(`lo=${canon(state.regs[LO_REG]!)}`);
    /* Memory and the store log are live state everywhere — a merged
     * continuation must agree on what has been written and in what order. */
    const memoryKey = state.effects.map(effectKeyOf).join(",");
    return `${index}|${parts.join(",")}|M${memoryKey}`;
  };

  const loadAtom = (
    base: SymExpr | undefined,
    offset: number,
    width: 1 | 2 | 4,
    signed: boolean,
    viaGp: boolean,
    epoch: number,
    index?: { expr: SymExpr; scale: number } | undefined,
    outerIndex?: { expr: SymExpr; scale: number } | undefined,
  ): SymExpr => {
    const atom: SymExpr = {
      kind: "load",
      address: base ? offset : offset >>> 0,
      width,
      signed,
      ...(base ? { base } : {}),
      ...(index ? { index } : {}),
      ...(outerIndex ? { outerIndex } : {}),
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
        ...(index ? { indexScale: index.scale } : {}),
        ...(outerIndex ? { outerIndexScale: outerIndex.scale } : {}),
      });
    } else if (viaGp) existing.viaGp = true;
    return atom;
  };

  /** The cell whose bytes wholly contain `[offset, offset + width)`, if any. */
  const containingCell = (state: ExecState, group: string, offset: number, width: number): MemCell | undefined => {
    for (const [key, cell] of state.memory) {
      const cellGroup = key.slice(0, key.lastIndexOf("|", key.lastIndexOf("|") - 1));
      if (cellGroup !== group) continue;
      if (cell.offset === offset && cell.width === width) continue;
      if (cell.offset <= offset && offset + width <= cell.offset + cell.width) return cell;
    }
    return undefined;
  };

  /**
   * The value a sized read at `offset` sees inside a wider stored cell.
   *
   * Little-endian: byte k of a word sits in bits [8k, 8k+8). The shift and the
   * narrowing are both expressed symbolically, so the recovered relation says
   * what the machine says without a byte-array model.
   */
  const extractFrom = (cell: MemCell, offset: number, width: 1 | 2 | 4, signed: boolean): SymExpr => {
    const shift = (offset - cell.offset) * 8;
    const shifted = shift === 0 ? cell.value : binary("srl", cell.value, constExpr(shift));
    if (width === 4) return shifted;
    const bits: 8 | 16 = width === 2 ? 16 : 8;
    return signed ? signExtend(shifted, bits) : zeroExtend(shifted, bits);
  };

  /** Forget every cell a write at `[offset, offset + width)` partially covers. */
  const forgetOverlapping = (state: ExecState, group: string, offset: number, width: number): void => {
    for (const [key, cell] of [...state.memory]) {
      const cellGroup = key.slice(0, key.lastIndexOf("|", key.lastIndexOf("|") - 1));
      if (cellGroup !== group) continue;
      if (cell.offset === offset && cell.width === width) continue;
      if (cell.offset < offset + width && offset < cell.offset + cell.width) state.memory.delete(key);
    }
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
    const setHiLo = (hi: SymExpr, lo: SymExpr): void => {
      regs[HI_REG] = hi;
      regs[LO_REG] = lo;
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
      case "andi": {
        /* A mask that re-narrows an already-narrow unsigned load folds away
         * semantically, but the instruction is evidence: the source held the
         * load in a wide variable and narrowed a second one from it. Witness
         * the atom so construction can offer that two-variable spelling. */
        if (
          rs.kind === "load" && !rs.signed &&
          ((insn.uimm === 0xffff && rs.width <= 2) || (insn.uimm === 0xff && rs.width === 1))
        ) {
          maskWitnesses.add(canon({ ...rs, epoch: undefined }));
        }
        return set(insn.rt, binary("and", rs, constExpr(insn.uimm)));
      }
      case "ori": return set(insn.rt, binary("or", rs, constExpr(insn.uimm)));
      case "xori": return set(insn.rt, binary("xor", rs, constExpr(insn.uimm)));
      case "lui": return set(insn.rt, constExpr(insn.uimm << 16));
      /* multiply / divide: set hi/lo */
      case "mult": {
        const product = binary("mulLo", rs, rt);
        const hi = binary("mulHiS", rs, rt);
        return setHiLo(hi, product);
      }
      case "multu": {
        const product = binary("mulLo", rs, rt);
        const hi = binary("mulHiU", rs, rt);
        return setHiLo(hi, product);
      }
      case "div": {
        const quotient = binary("divS", rs, rt);
        const remainder = binary("remS", rs, rt);
        divisions.push({ signed: true, dividend: canon(rs), divisor: canon(rt), vram: insn.vram });
        return setHiLo(remainder, quotient);
      }
      case "divu": {
        const quotient = binary("divU", rs, rt);
        const remainder = binary("remU", rs, rt);
        divisions.push({ signed: false, dividend: canon(rs), divisor: canon(rt), vram: insn.vram });
        return setHiLo(remainder, quotient);
      }
      case "mfhi": return set(insn.rd, regs[HI_REG]!);
      case "mflo": return set(insn.rd, regs[LO_REG]!);
      case "lb": case "lbu": case "lh": case "lhu": case "lw": {
        const place = resolvePlace(rs, insn, "load");
        const width = loadWidth(insn.op);
        if (place.offset % width !== 0) {
          throw new UnsupportedTarget(`misaligned load at 0x${insn.vram.toString(16)}`, [insn.vram], "misaligned-access");
        }
        const cellKey = `${place.group}|${place.offset}|${width}`;
        const known = state.memory.get(cellKey);
        if (known) return set(insn.rt, loadedBack(known, loadSigned(insn.op)));
        /* A narrower read inside a wider cell this path already wrote is not
         * an unsupported overlap — it is a byte view of a value we hold. On a
         * little-endian target the byte at offset k of a stored word is
         * `(value >> 8k)`, narrowed. Refusing it excluded the ordinary
         * "write the word, then read one of its bytes" shape. */
        const contained = containingCell(state, place.group, place.offset, width);
        if (contained) {
          return set(insn.rt, extractFrom(contained, place.offset, width, loadSigned(insn.op)));
        }
        checkOverlap(state, place.group, place.offset, width, insn.vram, "load");
        const atom = loadAtom(place.base, place.offset, width, loadSigned(insn.op), insn.rs === 28, state.effects.length, place.index, place.outerIndex);
        /* Remember the atom so a repeat read is the same value, not a twin. */
        state.memory.set(cellKey, { offset: place.offset, width, value: atom });
        return set(insn.rt, atom);
      }
      case "sb": case "sh": case "sw": {
        const place = resolvePlace(rs, insn, "store");
        const width: 1 | 2 | 4 = insn.op === "sw" ? 4 : insn.op === "sh" ? 2 : 1;
        if (place.offset % width !== 0) {
          throw new UnsupportedTarget(`misaligned store at 0x${insn.vram.toString(16)}`, [insn.vram], "misaligned-access");
        }
        /* A store that partially covers an earlier cell makes that cell's
         * forwarded value stale. The cell is forgotten; the store log keeps
         * both writes in order, so nothing about the sequence is lost — only
         * the ability to read the older value back, which is correct. */
        forgetOverlapping(state, place.group, place.offset, width);
        if (state.effects.length >= 1024) {
          throw new UnsupportedTarget("store budget (1024) exhausted", [insn.vram], "store-budget");
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
          kind: "store",
          address: place.offset,
          width,
          value: rt,
          seq: state.effects.length,
          vram: insn.vram,
          ...(place.base ? { base: place.base } : {}),
          ...(place.index ? { index: place.index } : {}),
          ...(place.outerIndex ? { outerIndex: place.outerIndex } : {}),
          viaGp: insn.rs === 28,
        });
        return;
      }
      case "jal": case "jalr": {
        /* Opaque call (D6): record the effect, clobber, invalidate memory.
         * The callee is not explored; the function continues inline.
         *
         * S1: resolve the target to a symbol name when possible.
         *
         * Argument registers are read from `state` below, which already
         * reflects the delay slot: on real MIPS the delay slot runs before
         * the target, and the explore loop honors that order — it calls
         * `applyDelay(next, state)` before `apply(jal, state)` (see the
         * jal/jalr case in `explore`). So `regs[4..7]` here is the correct
         * post-delay snapshot; no temporary state is needed. */
        const seq = state.effects.length;
        /* Determine callee identity (name / address / indirect). */
        let key: string;
        let calleeAddress: number | undefined;
        let calleeName: string | null | undefined;
        let indirect = false;
        if (insn.op === "jal" && insn.target !== undefined) {
          calleeAddress = insn.target >>> 0;
          calleeName = options.resolveCallTarget?.(calleeAddress) ?? null;
          key = calleeName ?? `0x${calleeAddress.toString(16)}`;
        } else if (insn.op === "jalr") {
          const targetExpr = regs[insn.rs]!;
          const constAddr = asConst(targetExpr);
          if (constAddr !== undefined) {
            calleeAddress = constAddr >>> 0;
            calleeName = options.resolveCallTarget?.(calleeAddress) ?? null;
            key = calleeName ?? `0x${calleeAddress.toString(16)}`;
          } else {
            /* Indirect call through a register — resolve honestly refused. */
            indirect = true;
            key = `indirect@0x${insn.vram.toString(16)}`;
          }
        } else {
          key = `0x0`;
        }
        /* Over-capture all four argument registers; the delay slot has
         * already been applied (see above), so each is the post-delay
         * value. resolveCallSignatures trims this snapshot to the callee's
         * real arity — three of these may be the caller's entry garbage. */
        const args = [regs[4]!, regs[5]!, regs[6]!, regs[7]!];
        /* Arguments five and beyond travel in the caller's outgoing argument
         * area at sp+0x10 onward. Those cells are already tracked, so the
         * complete ABI list costs a lookup — and a snapshot that stopped at
         * four registers could only express a five-argument call by inventing
         * the fifth value. `null` records "the caller never wrote this slot",
         * which is what an honest arity decision needs. */
        const stackArgs: Array<SymExpr | null> = [];
        for (let slot = 0; slot < 4; slot++) {
          /* Relative to the *current* stack pointer, not the entry one: the
           * prologue has already opened the frame, so the outgoing area sits
           * at `sp_entry - frameSize + 0x10`. Resolving through the same
           * splitter the store used is what makes the two keys agree. */
          const place = splitAddress(binary("add", regs[29]!, constExpr(OUTGOING_ARGUMENT_BASE + slot * 4)));
          const cell = place ? state.memory.get(`${canon(place.base)}|${place.offset}|4`) : undefined;
          /* The outgoing area ends where the frame's own bookkeeping begins.
           * Two things end it, and both must, or a saved `$s0` two words up
           * is read as a seventh argument: a slot the caller never wrote (ABI
           * arguments are contiguous), and a slot holding the entry value of a
           * callee-saved register, which is a spill rather than an argument. */
          if (!cell || isCalleeSavedSpill(cell.value)) break;
          stackArgs.push(cell.value);
        }
        state.effects.push({
          kind: "call", callee: key, seq, vram: insn.vram, args, resultUsed: false,
          calleeAddress, calleeName, indirect,
          ...(stackArgs.length > 0 ? { stackArgs } : {}),
        });
        /* Clobber: v0, v1 := call-result; at, a0-a3, t0-t9, ra, hi, lo likewise. */
        const clobbered = [2, 3, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 24, 25, 31];
        for (const register of clobbered) {
          state.regs[register] = { kind: "call-result", seq, register: REGISTER_NAMES[register] ?? String(register) };
        }
        state.regs[HI_REG] = { kind: "call-result", seq, register: "hi" };
        state.regs[LO_REG] = { kind: "call-result", seq, register: "lo" };
        /* Invalidate every non-@sp memory group; keep @sp cells unless an
         * argument expression reaches through the stack. */
        const stackArg = args.some((arg) => containsSp(arg));
        for (const key of [...state.memory.keys()]) {
          const group = key.slice(0, key.lastIndexOf("|", key.lastIndexOf("|") - 1));
          if (group.startsWith("@sp") && !stackArg) continue;
          state.memory.delete(key);
        }
        return;
      }
      default:
        throw new UnsupportedTarget(`unmodelled instruction ${insn.op} at 0x${insn.vram.toString(16)}`, [insn.vram], "unmodelled-instruction");
    }
  };

  /** Where a memory access lands: an absolute cell, or (base, offset), with optional index. */
  function resolvePlace(
    rs: SymExpr,
    insn: DecodedInsn,
    what: string,
  ): {
    group: string;
    offset: number;
    base?: SymExpr | undefined;
    index?: { expr: SymExpr; scale: number } | undefined;
    outerIndex?: { expr: SymExpr; scale: number } | undefined;
  } {
    const addressExpr = binary("add", rs, constExpr(insn.simm));
    const absolute = asConst(addressExpr);
    if (absolute !== undefined) return { group: "", offset: absolute };
    /* Try the basic split first */
    const split = splitAddress(addressExpr);
    if (split) return { group: canon(split.base), offset: split.offset, base: split.base };
    /* Try the indexed split (D3) */
    const indexed = splitIndexedAddress(addressExpr);
    if (indexed) {
      const subscripts =
        (indexed.outerIndex ? `[${canon(indexed.outerIndex.expr)}*${indexed.outerIndex.scale}]` : "") +
        (indexed.index ? `[${canon(indexed.index.expr)}*${indexed.index.scale}]` : "");
      return {
        group: canon(indexed.base) + subscripts,
        offset: indexed.offset,
        base: indexed.base,
        index: indexed.index,
        ...(indexed.outerIndex ? { outerIndex: indexed.outerIndex } : {}),
      };
    }
    throw new UnsupportedTarget(
      `${what} at 0x${insn.vram.toString(16)} has a computed address (${canon(addressExpr)})`,
      [insn.vram],
      "computed-address",
    );
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
          "mixed-width-overlap",
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
        throw new UnsupportedTarget(`unmodelled branch ${insn.op}`, [insn.vram], "unmodelled-branch");
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

  /* Affine loop detection (D7): track the state at first arrival per pc so we
   * can recognise a repeat at the same pc with constant register deltas. */
  const firstStateAtPc = new Map<number, ExecState>();

  /**
   * Detection fires wherever the exploration happens to checkpoint twice —
   * usually a branch target inside the loop's rotated tail, mid-advance.
   * The natural body start for reconstruction is the cycle's entry from
   * outside: the unique instruction of the loop's strongly-connected
   * component with a predecessor outside it. Multiple entries (irreducible
   * flow) keep the detected pc, and the entry-value check downstream refuses
   * honestly.
   */
  const successors = buildSuccessors(insns);
  const predecessors: number[][] = insns.map(() => []);
  for (let from = 0; from < count; from++) {
    for (const to of successors[from]!) predecessors[to]!.push(from);
  }
  const normalizeHead = (detectedPc: number): number => {
    const reach = (from: number, edges: number[][]): Set<number> => {
      const seen = new Set<number>([from]);
      const queue = [from];
      while (queue.length > 0) {
        for (const next of edges[queue.pop()!]!) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      return seen;
    };
    const forward = reach(detectedPc, successors);
    const backward = reach(detectedPc, predecessors);
    const cycle = new Set<number>([...forward].filter((pc) => backward.has(pc)));
    const entries = [...cycle].filter((pc) =>
      pc === 0 || predecessors[pc]!.some((pred) => !cycle.has(pred)));
    return entries.length === 1 ? entries[0]! : detectedPc;
  };

  /** Detect whether `current` at the same pc is an affine body iteration
   *  relative to `prev`. Returns induction deltas when affine, else null. */
  const detectAffine = (pc: number, prev: ExecState, current: ExecState, liveWords: Int32Array): Array<{ register: string; delta: number }> | null => {
    if (prev.effects.length !== current.effects.length) return null;
    for (let i = 0; i < prev.effects.length; i++) {
      const p = prev.effects[i]!;
      const c = current.effects[i]!;
      if (p.kind !== c.kind) return null;
      if (p.kind === "store" && c.kind === "store") {
        if (canon(p.base ?? constExpr(0)) !== canon(c.base ?? constExpr(0))) return null;
        if (p.address !== c.address || p.width !== c.width) return null;
      } else if (p.kind === "call" && c.kind === "call") {
        if (p.callee !== c.callee || p.args.length !== c.args.length) return null;
      }
    }
    const live0 = liveWords[pc * 2]!;
    const live1 = liveWords[pc * 2 + 1]!;
    const inductions: Array<{ register: string; delta: number }> = [];
    for (let r = 1; r < 34; r++) {
      const word = r < 32 ? live0 : live1;
      const bit = r < 32 ? (1 << r) : (1 << (r - 32));
      if (!(word & bit)) continue;
      const pv = prev.regs[r]!;
      const cv = current.regs[r]!;
      const pCanon = canon(pv);
      const cCanon = canon(cv);
      if (pCanon === cCanon) continue;
      if (cv.kind === "binary" && (cv.op === "add" || cv.op === "sub") && cv.right.kind === "const") {
        if (canon(cv.left) === pCanon) {
          const k = cv.right.value | 0;
          const delta = cv.op === "add" ? k : -k;
          const name = r < 32 ? EXEC_REGISTER_NAMES[r] ?? String(r) : r === HI_REG ? "hi" : "lo";
          inductions.push({ register: name, delta });
          continue;
        }
      }
      /* Every other mismatch is a loop-varying, non-induction register — a
       * per-iteration result value, a reloaded pointer, a reset flag. Those
       * do not block summarization: the body either recomputes them before
       * use (correct), or their stale entry value surfaces in a leaf and
       * construction rejects it (honest). Only the total absence of a true
       * induction says this is not an affine loop. */
    }
    if (inductions.length === 0) return null;
    return inductions;
  };

  /**
   * Walk a DAG and replace every occurrence of `sentinelRef` with
   * `replacementRef`. Returns a new DAG where all nodes are fresh-created
   * in the arena; the original DAG is unchanged.
   */
  const replaceSentinel = (ref: DagRef, sentinelRef: DagRef, replacementRef: DagRef): DagRef => {
    if (ref === sentinelRef) return replacementRef;
    const node = arena.node(ref);
    if (node.kind === "leaf" || node.kind === "loop") return ref;
    if (node.kind === "test") {
      const onTrue = replaceSentinel(node.onTrue, sentinelRef, replacementRef);
      const onFalse = replaceSentinel(node.onFalse, sentinelRef, replacementRef);
      if (onTrue === node.onTrue && onFalse === node.onFalse) return ref;
      return arena.test(node.pred, onTrue, onFalse);
    }
    if (node.kind === "dispatch") {
      const targets = node.targets.map((t) => replaceSentinel(t, sentinelRef, replacementRef));
      if (targets.every((t, i) => t === node.targets[i])) return ref;
      return arena.dispatch(node.index, targets);
    }
    return ref;
  };

  /**
   * Summarize an affine loop at its head (D7). One iteration is explored
   * from the head with the induction registers replaced by IV atoms; paths
   * that return to the head end in LOOP_BACK (swapped for the continue
   * marker), every other path ends in an ordinary return leaf. The advances
   * themselves live in the induction list, not the DAG — the constructor
   * realizes them as the loop's step clause.
   *
   * v1 boundaries, refused rather than approximated: inductions must start
   * at parameter values (the C loop starts where the parameter points), and
   * the body must be effect-free — a store or call inside a symbolic-bound
   * loop needs per-iteration effect summaries this model does not carry.
   */
  const buildLoopNode = (pc: number, state: ExecState, deltas: Array<{ register: string; delta: number }>): DagRef => {
    const ivState = cloneState(state);
    for (const { register, delta } of deltas) {
      const idx = EXEC_REGISTER_NAMES.indexOf(register);
      const current = idx >= 0 ? state.regs[idx] : undefined;
      if (idx < 0 || !current || current.kind !== "entry") {
        throw new UnsupportedTarget(
          `loop induction ${register} does not start at a parameter value (${current ? canon(current) : "?"})`,
          [start + pc * 4],
          "loop-induction-origin",
        );
      }
      ivState.regs[idx] = { kind: "iv", register, delta };
    }

    const rawBody = explore(pc, ivState, { head: pc, entered: false });

    /* Record the effect count at loop entry so the constructor can separate
     * pre-loop effects from per-iteration body effects. We no longer require
     * the body to be pure — stores and calls inside loops are now supported
     * (D1: counted loops with effects in the body). */
    const entryEffectCount = state.effects.length;

    const body = replaceSentinel(rawBody, LOOP_BACK as DagRef, arena.continueRef());
    return arena.loop(deltas, body, entryEffectCount);
  };

  const explore = (entryIndex: number, entryState: ExecState, loop?: { head: number; entered: boolean }): DagRef => {
    const pendingKeys: string[] = [];
    const finish = (ref: DagRef): DagRef => {
      for (const key of pendingKeys) memo.set(key, ref);
      return ref;
    };

    let pc = entryIndex;
    const state = entryState;

    for (;;) {
      /* Checkpoint: arrival at the entry or at any control-transfer target.
       * Loop-body keys carry the head so two loops with the same induction
       * shapes cannot share memo entries. */
      const key = (loop ? `H${loop.head}|` : "") + stateKey(pc, state);
      const known = memo.get(key);
      if (known === "in-progress") {
        throw new UnsupportedTarget(
          `cycle with unchanged live state at 0x${(start + pc * 4).toString(16)} — the function does not terminate on this path`,
          [start + pc * 4],
          "nonterminating-cycle",
        );
      }
      if (known !== undefined) return finish(known);
      if (!loop) {
        /* A head a previous attempt discovered: summarize the loop here, at
         * its FIRST arrival, so no iteration is peeled into the DAG. */
        const summarize = knownHeads.get(pc);
        if (summarize) return finish(buildLoopNode(pc, state, summarize));
        /* Affine loop detection (D7): a repeat visit whose only differences
         * are constant register deltas is an affine loop. Restart so the
         * retry can summarize it from the top. */
        const prevState = firstStateAtPc.get(pc);
        if (prevState) {
          /* Only detect at non-control PCs — a branch or jump pc is a
           * back-edge or exit point, not the head where the body starts. */
          const pcInsn = insns[pc];
          const isControlPc = pcInsn && (
            pcInsn.op === "j" || pcInsn.op === "jr" || pcInsn.op === "jal" || pcInsn.op === "jalr" || isBranch(pcInsn.op)
          );
          if (!isControlPc) {
            const deltas = detectAffine(pc, prevState, state, liveIn);
            if (deltas !== null) throw new RestartWithLoop(normalizeHead(pc), deltas);
          }
        }
        firstStateAtPc.set(pc, cloneState(state));
      } else if (pc === loop.head) {
        /* Returning to the head ends the iteration — this, and only this, is
         * the loop back-edge. A backward jump elsewhere (the rotated tail
         * with its exit check and advances) is part of the iteration and is
         * followed, which is what keeps the exit test inside the body. */
        if (loop.entered) return finish(LOOP_BACK as DagRef);
        loop.entered = true;
      } else if (knownHeads.has(pc)) {
        throw new UnsupportedTarget(
          `nested symbolic-bound loops at 0x${(start + pc * 4).toString(16)} are outside the summarized class`,
          [start + pc * 4],
          "nested-loop",
        );
      }
      if (memo.size >= maxStates) {
        throw new UnsupportedTarget(`state budget (${maxStates}) exhausted — the control structure is outside the bounded class`, [], "state-budget");
      }
      memo.set(key, "in-progress");
      states++;
      pendingKeys.push(key);
      const arrivedAt = pc;

      /* Straight-line run until the next control transfer. */
      transfer: for (;;) {
        if (pc < 0 || pc >= count) {
          throw new UnsupportedTarget("execution fell off the end of the function", [start + (pc - 1) * 4], "fell-off-end");
        }
        if (++steps > maxSteps) {
          throw new UnsupportedTarget(`step budget (${maxSteps}) exhausted`, [], "step-budget");
        }
        /* A known loop head is a checkpoint even when reached by plain
         * fall-through — summarization (outer) and the back-edge test (loop
         * context) both live at the checkpoint, and a head reached only by
         * fall-through would otherwise never get either. */
        if (pc !== arrivedAt && (knownHeads.has(pc) || (loop && pc === loop.head))) break transfer;
        const insn = insns[pc]!;

        if (insn.op === "jr") {
          if (insn.rs !== 31) {
            const target = state.regs[insn.rs]!;
            /* Dispatch via a jump table: register holds M4[T + idx*4]. */
            if (
              target.kind === "load" &&
              target.width === 4 &&
              target.index &&
              target.index.scale === 4 &&
              target.base &&
              target.base.kind === "const"
            ) {
              const tableBase = target.base.value >>> 0;
              if (!options.readWord) {
                throw new UnsupportedTarget(
                  "indirect jump needs a container word reader (readWord) to resolve the jump table",
                  [insn.vram],
                  "indirect-jump",
                );
              }
              /* Read consecutive table words; each must decode to an address
               * inside the function's span. Bounds check appears as a test
               * above the dispatch, so we read until a non-function word. */
              const entries: number[] = [];
              let strideOffset = 0;
              const functionStart = insns[0]?.vram ?? 0;
              const functionEnd = functionStart + insns.length * 4;
              for (let index = 0; index < 64; index++) {
                const word = options.readWord(tableBase + index * 4);
                if (word === undefined) break;
                const vram = word >>> 0;
                if (vram < functionStart || vram >= functionEnd) break;
                entries.push(vram);
                strideOffset = index + 1;
              }
              if (entries.length < 2) {
                throw new UnsupportedTarget(
                  `jump table at 0x${tableBase.toString(16)} has fewer than 2 in-function entries`,
                  [insn.vram],
                  "indirect-jump",
                );
              }
              const delay = insns[pc + 1];
              if (delay) applyDelay(delay, state);
              /* Explore every target entry with a cloned state. */
              const targets: DagRef[] = [];
              for (const entry of entries) {
                const entryIndex = indexOf(entry);
                targets.push(explore(entryIndex, cloneState(state), loop));
              }
              return finish(arena.dispatch(target.index.expr, targets));
            }
            throw new UnsupportedTarget(
              `indirect jump at 0x${insn.vram.toString(16)} does not carry a recognized jump-table load`,
              [insn.vram],
              "indirect-jump",
            );
          }
          const delay = insns[pc + 1];
          if (delay) applyDelay(delay, state);
          /* Frame balance: the returning function must have restored the stack
           * pointer to its entry value; a residual `add(@sp, k)` means the
           * frame never came back (k ≠ 0) and is a real bug in the model. */
          if (canon(state.regs[29]!) !== "@sp") {
            throw new UnsupportedTarget(
              `unbalanced stack frame at 0x${insn.vram.toString(16)}: sp is ${canon(state.regs[29]!)} at return`,
              [insn.vram],
              "unbalanced-frame",
            );
          }
          return finish(arena.leaf(state.regs[V0]!, state.effects));
        }

        if (insn.op === "break") {
          /* An exceptional exit. The path stops here; the guard that skips it
           * is recognised afterwards and removed if it is a compiler packet. */
          return finish(arena.trapRef());
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
            throw new UnsupportedTarget("decision depth (256) exceeded — a symbolic-bound loop is outside the bounded class", [insn.vram], "decision-depth");
          }
          try {
            const onTaken = explore(takenIndex, cloneState(state), loop);
            const onFall = explore(fallIndex, cloneState(state), loop);
            return finish(inverted ? arena.test(pred, onFall, onTaken) : arena.test(pred, onTaken, onFall));
          } finally {
            forkDepth--;
          }
        }

        if (insn.op === "jal" || insn.op === "jalr") {
          /* Opaque call: the delay slot runs first, then the call's
           * register effects and memory invalidation are applied. */
          const delay = insns[pc + 1];
          if (delay) applyDelay(delay, state);
          apply(insn, state);
          pc += 2;
          break transfer;
        }

        apply(insn, state);
        pc++;
      }
    }
  };

  const applyDelay = (insn: DecodedInsn, state: ExecState): void => {
    if (isBranch(insn.op) || insn.op === "j" || insn.op === "jr") {
      throw new UnsupportedTarget(`control instruction in a delay slot at 0x${insn.vram.toString(16)}`, [insn.vram], "delay-slot-control");
    }
    apply(insn, state);
  };

  const rawRoot = explore(0, { regs: initial, memory: new Map(), effects: [] });
  const root = stripTrapGuards(arena, rawRoot, insns, divisions);
  return { arena, root, loads: [...loads.values()], maskWitnesses, divisions, states, steps };
  }
}

/** Decode raw little-endian bytes into instructions at a base address. */
export function decodeBytes(bytes: Buffer, baseVram: number): DecodedInsn[] {
  const insns: DecodedInsn[] = [];
  for (let offset = 0; offset + 4 <= bytes.length; offset += 4) {
    insns.push(decodeWord(bytes.readUInt32LE(offset), baseVram + offset));
  }
  return insns;
}

/* ---- compiler trap packets ------------------------------------------------ */

/**
 * Remove the guards around a compiler-generated trap, or refuse.
 *
 * `a / b` with a variable divisor expands to the division, a test that the
 * divisor is non-zero, and a `break` on the failing arm — and for signed
 * division a second packet guarding `INT_MIN / -1`. Those guards are not part
 * of the source: the source wrote `/`, and this backend emits the packet for
 * every `/` it compiles. Leaving them in makes the recovered relation a
 * decision structure no C expression produces.
 *
 * The evidence bar is the *guard*, not the function. "This function divides
 * somewhere" licenses removing any guarded trap in it, including a
 * hand-written one that has nothing to do with the division — and removing a
 * guard is removing a path, so the recovered relation then describes a program
 * that behaves differently from the target. So a guard is removed only when
 * its predicate is one of the four the packet actually emits, over the
 * operands of a division this execution actually performed. Anything else
 * keeps its trap, and the surviving trap is refused with its own category.
 */
const INT_MIN_U32 = 0x80000000;

export function stripTrapGuards(
  arena: DagArena,
  root: DagRef,
  insns: DecodedInsn[],
  divisions: DivisionWitness[],
): DagRef {
  const trap = arena.trapRef();
  const breaks = insns.filter((insn) => insn.op === "break");
  if (breaks.length === 0) return root;

  const divisors = new Set(divisions.map((division) => division.divisor));
  const signedDivisors = new Set(divisions.filter((d) => d.signed).map((d) => d.divisor));
  const signedDividends = new Set(divisions.filter((d) => d.signed).map((d) => d.dividend));

  const constantOf = (expr: SymExpr | undefined): number | undefined =>
    expr && expr.kind === "const" ? expr.value >>> 0 : undefined;

  /**
   * Whether `pred` is one of the divide-check packet's guards.
   *
   * All four are equalities *whose true arm is the exceptional one*, so only a
   * trap on the true arm is ever a packet: the backend spells the guard
   * `bne <operand>, <guard>, ok`, and the DAG builder maps the inverted
   * branch's fall-through — the `break` — to the true arm. A trap on the false
   * arm is some other structure, and this returns false for it.
   */
  const isPacketGuard = (pred: Predicate): boolean => {
    if (pred.op !== "eq") return false;
    const left = pred.left;
    const right = pred.right;
    const sides: Array<[SymExpr, SymExpr | undefined]> = [[left, right], ...(right ? [[right, left] as [SymExpr, SymExpr]] : [])];
    for (const [value, against] of sides) {
      const constant = constantOf(against);
      /* `divisor == 0`, written `bne divisor, $zero`. A missing right operand
       * is the same comparison against zero. */
      if ((constant === 0 || against === undefined) && divisors.has(canon(value))) return true;
      if (constant === undefined) continue;
      /* `divisor == -1`, either directly or as `divisor + 1 == 0`. */
      if (constant === 0xffffffff && signedDivisors.has(canon(value))) return true;
      /* `dividend == INT_MIN`, against the `lui $at, 0x8000` the packet sets. */
      if (constant === INT_MIN_U32 && signedDividends.has(canon(value))) return true;
    }
    /* `divisor + 1 == 0` — the backend forms `addiu $at, divisor, 1` and tests
     * that, rather than materialising -1. */
    const zeroSide = constantOf(right) === 0 ? left : constantOf(left) === 0 ? right : undefined;
    if (zeroSide && zeroSide.kind === "binary" && zeroSide.op === "add") {
      for (const [value, against] of [[zeroSide.left, zeroSide.right], [zeroSide.right, zeroSide.left]] as Array<[SymExpr, SymExpr]>) {
        if (constantOf(against) === 1 && signedDivisors.has(canon(value))) return true;
      }
    }
    return false;
  };

  /** Whether every leaf reachable from `ref` is the trap leaf. */
  const onlyTraps = (ref: DagRef, seen = new Set<DagRef>()): boolean => {
    if (ref === trap) return true;
    if (ref < 0 || seen.has(ref)) return false;
    seen.add(ref);
    const node = arena.node(ref);
    if (!node) return false;
    if (node.kind === "leaf") return false;
    if (node.kind === "test") return onlyTraps(node.onTrue, seen) && onlyTraps(node.onFalse, seen);
    if (node.kind === "dispatch") return node.targets.every((target) => onlyTraps(target, seen));
    return false;
  };

  const rewritten = new Map<DagRef, DagRef>();
  const rewrite = (ref: DagRef): DagRef => {
    if (ref < 0) return ref;
    const cached = rewritten.get(ref);
    if (cached !== undefined) return cached;
    const node = arena.node(ref);
    let result = ref;
    if (node.kind === "test") {
      if (onlyTraps(node.onTrue) && isPacketGuard(node.pred)) result = rewrite(node.onFalse);
      else {
        const onTrue = rewrite(node.onTrue);
        const onFalse = rewrite(node.onFalse);
        result = onTrue === node.onTrue && onFalse === node.onFalse ? ref : arena.test(node.pred, onTrue, onFalse);
      }
    } else if (node.kind === "dispatch") {
      const targets = node.targets.map(rewrite);
      result = targets.every((target, index) => target === node.targets[index]) ? ref : arena.dispatch(node.index, targets);
    } else if (node.kind === "loop") {
      const body = rewrite(node.body);
      result = body === node.body ? ref : arena.loop(node.induction, body, node.entryEffectCount);
    }
    rewritten.set(ref, result);
    return result;
  };

  if (divisions.length === 0) {
    throw new UnsupportedTarget(
      `break at ${breaks.map((insn) => `0x${insn.vram.toString(16)}`).join(", ")} is not a division trap packet ` +
      `— the function performs no division, so the exceptional exit is not compiler-generated`,
      breaks.map((insn) => insn.vram),
      "trap-packet",
    );
  }

  const stripped = rewrite(root);
  /* A trap the guard removal could not reach means the exceptional path is not
   * guarded the way a division packet is; say so rather than discarding it. */
  const reachable = new Set<DagRef>();
  const visit = (ref: DagRef): void => {
    if (ref < 0 || reachable.has(ref)) return;
    reachable.add(ref);
    const node = arena.node(ref);
    if (!node) return;
    if (node.kind === "test") { visit(node.onTrue); visit(node.onFalse); }
    else if (node.kind === "dispatch") { for (const target of node.targets) visit(target); }
    else if (node.kind === "loop") visit(node.body);
  };
  visit(stripped);
  if (reachable.has(trap)) {
    throw new UnsupportedTarget(
      "a trap path survives guard removal — its guard is not one of the divide-check packet's tests over an " +
      `operand of a division this function performs (${divisions.length} division(s) witnessed)`,
      breaks.map((insn) => insn.vram),
      "trap-packet",
    );
  }
  return stripped;
}
