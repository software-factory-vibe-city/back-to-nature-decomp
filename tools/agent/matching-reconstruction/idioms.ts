/**
 * Constant-divisor and shift-division recognition by sampling equivalence.
 *
 * The compiler replaces constant-divisor `/` and `%` with magic-multiply or
 * shift sequences, so the target shows `mulHiS`/`mulHiU` or `sra`/`srl` of the
 * dividend rather than a `div` instruction. These are *untranslatable* as
 * mulHi (no C operator produces the high half of a product), so the
 * generic translation path throws on them (D1). This module recovers the
 * original `/ D` or `% D` form by evaluating candidate expressions at
 * concrete sample points and checking that every sample agrees with
 * arithmetic division.
 *
 * This is a *proposal*, not a proof — the byte oracle still judges the
 * candidate, so a false recognition can only cost a failed compile.
 */

import { canon, constExpr } from "./exec.js";
import type { BinaryOp, SymExpr } from "./types.js";

/**
 * Evaluate a symbolic expression over concrete integer values for the entry
 * and load atoms referenced in `env`. Returns `null` when the expression
 * contains atoms not present in `env` (cannot evaluate).
 */
export function evaluateConcrete(
  expr: SymExpr,
  env: Map<string, number>,
): number | null {
  switch (expr.kind) {
    case "const": return expr.value >>> 0;
    case "entry": return env.get(`@${expr.register}`) ?? null;
    case "load": {
      if (expr.base) return null;
      const base = expr.epoch ? `${expr.address >>> 0}@${expr.epoch}` : `${expr.address >>> 0}`;
      return env.get(`M${expr.width}${expr.signed ? "s" : "u"}[${base}]`) ?? null;
    }
    case "unary": {
      const inner = evaluateConcrete(expr.operand, env);
      if (inner === null) return null;
      const value = inner >>> 0;
      switch (expr.op) {
        case "zext16": return value & 0xffff;
        case "zext8": return value & 0xff;
        case "sext16": {
          const narrow = value & 0xffff;
          return (narrow & 0x8000 ? narrow - 0x10000 : narrow) >>> 0;
        }
        case "sext8": {
          const narrow = value & 0xff;
          return (narrow & 0x80 ? narrow - 0x100 : narrow) >>> 0;
        }
      }
      break;
    }
    case "binary": {
      const left = evaluateConcrete(expr.left, env);
      const right = evaluateConcrete(expr.right, env);
      if (left === null || right === null) return null;
      const la = left >>> 0;
      const lb = left | 0;
      const ra = right >>> 0;
      const rb = right | 0;
      switch (expr.op) {
        case "add": return (la + ra) >>> 0;
        case "sub": return (la - ra) >>> 0;
        case "and": return la & ra;
        case "or": return la | ra;
        case "xor": return la ^ ra;
        case "nor": return ~(la | ra) >>> 0;
        case "sll": return (la << (ra & 31)) >>> 0;
        case "srl": return la >>> (ra & 31);
        case "sra": return (lb >> (rb & 31)) >>> 0;
        case "sltS": return lb < rb ? 1 : 0;
        case "sltU": return la < ra ? 1 : 0;
        case "mulLo": return (lb * rb) >>> 0;
        case "mulHiS": {
          const product = BigInt(lb) * BigInt(rb);
          return Number((product >> 32n) & 0xffffffffn) >>> 0;
        }
        case "mulHiU": {
          const product = BigInt(la) * BigInt(ra);
          return Number((product >> 32n) & 0xffffffffn) >>> 0;
        }
        case "divS": return rb === 0 ? null : (Math.trunc(lb / rb) >>> 0);
        case "divU": return ra === 0 ? null : Math.trunc(la / ra) >>> 0;
        case "remS": return rb === 0 ? null : (lb % rb) >>> 0;
        case "remU": return ra === 0 ? null : (la % ra) >>> 0;
      }
      break;
    }
  }
  return null;
}

/**
 * Determine whether an expression structurally depends on a single variable,
 * and extract that variable's "identity" string for environment construction.
 * Returns null if the expression uses zero or more than one distinct variable.
 */
function singleLeafKey(expr: SymExpr): string | null {
  const leaves = new Set<string>();
  const walk = (e: SymExpr): void => {
    switch (e.kind) {
      case "entry": leaves.add(`@${e.register}`); break;
      case "load": {
        if (e.base) { walk(e.base); return; }
        leaves.add(canon({ ...e, epoch: undefined }).replace(/@\d+$/, ""));
        break;
      }
      case "unary": walk(e.operand); break;
      case "binary": walk(e.left); walk(e.right); break;
      default: break;
    }
  };
  walk(expr);
  return leaves.size === 1 ? [...leaves][0]! : null;
}

/**
 * Classify the division "flavor" by examining marker ops in the expression:
 * - "unsigned" when the expression uses `mulHiU` or `srl` (exclusive of `sra`/`mulHiS`)
 * - "signed" when the expression uses `mulHiS` or `sra` (exclusive of `mulHiU`/`srl`)
 * - "mixed" when both appear (unusual but possible)
 */
type DivisionFlavor = "unsigned" | "signed" | "mixed";

function determineFlavor(expr: SymExpr): DivisionFlavor {
  let hasSigned = false;
  let hasUnsigned = false;
  const walk = (e: SymExpr): void => {
    if (e.kind !== "binary") { if (e.kind === "unary") walk(e.operand); return; }
    if (e.op === "mulHiS" || e.op === "sra") hasSigned = true;
    if (e.op === "mulHiU" || e.op === "srl") hasUnsigned = true;
    walk(e.left);
    walk(e.right);
  };
  walk(expr);
  if (hasSigned && hasUnsigned) return "mixed";
  if (hasUnsigned) return "unsigned";
  return "signed";
}

/**
 * Try to recover a constant divisor from a value expression that the compiler
 * emitted as a multiply-high or shift-division sequence.
 *
 * Strategy: find the unique operand variable, check for division markers
 * (mulHiS/mulHiU / sra/srl of the operand), determine signed vs unsigned
 * flavor, then for each candidate divisor evaluate the entire expression and
 * the corresponding arithmetic division at many sample points. All agreeing
 * => recognized.
 */
export function recognizeDivision(
  expr: SymExpr,
): { operand: SymExpr; divisor: number; op: "/" | "%" } | null {
  /* 1. Find the single unique variable leaf. */
  const leafKey = singleLeafKey(expr);
  if (!leafKey) return null;

  /* 2. Check the tree contains a division idiom marker. */
  const hasMarker = (e: SymExpr): boolean => {
    if (e.kind !== "binary") return false;
    /* mulHiS/mulHiU with a variable left operand (not a tiny constant) */
    if ((e.op === "mulHiS" || e.op === "mulHiU") && !(e.left.kind === "const")) return true;
    /* sra/srl whose left operand contains only the variable leaf */
    if ((e.op === "sra" || e.op === "srl") && singleLeafKey(e.left) === leafKey) return true;
    return hasMarker(e.left) || hasMarker(e.right);
  };

  if (!hasMarker(expr)) return null;

  /* 3. Determine signed vs unsigned flavor. */
  const flavor = determineFlavor(expr);

  /* 4. Determine if this encodes `/` or `%`. For remainder, the expression
   *    is typically `x - (x / D) * D` — a subtract of a multiply. */
  const isRemainder = (e: SymExpr): boolean => {
    if (e.kind !== "binary" || e.op !== "sub") return false;
    const rhs = e.right;
    if (rhs.kind !== "binary" || rhs.op !== "mulLo") return false;
    return rhs.right.kind === "const";
  };

  const op: "/" | "%" = isRemainder(expr) ? "%" : "/";

  /* 5. Build sample set appropriate for the flavor.
   *    For signed: include both positive and negative values.
   *    For unsigned: include only non-negative values. */
  function uint(x: number): number { return x >>> 0; }

  const signedSamples = [
    uint(0), uint(1), uint(2), uint(7), uint(1000003),
    uint(-1), uint(-2), uint(-7), uint(-1000003), uint(0x7fffffff),
    uint(0x80000000), uint(0x80000001),
  ];
  const unsignedSamples = [
    uint(0), uint(1), uint(2), uint(7), uint(1000003),
    uint(0x7fffffff), uint(0x80000000), uint(0x80000001),
    uint(0xffeeddcc), uint(0xfffffff0),
  ];

  const samples = flavor === "unsigned" ? unsignedSamples : signedSamples;

  /* Build candidate divisor set. */
  const candidateDivisor = new Set<number>();
  for (let pow = 2; pow <= 0x40000; pow *= 2) candidateDivisor.add(pow);
  for (let d = 2; d <= 1024; d++) candidateDivisor.add(d);

  const env = new Map<string, number>();

  for (const divisor of candidateDivisor) {
    if (divisor === 0) continue;
    let allAgree = true;

    for (const sample of samples) {
      const x = sample;
      env.set(leafKey, x);
      const actual = evaluateConcrete(expr, env);
      if (actual === null) { allAgree = false; break; }

      let expected: number;
      if (op === "/") {
        if (flavor === "unsigned") {
          /* For unsigned, use floor division (no negative values in samples anyway) */
          expected = (Math.floor((x >>> 0) / divisor) >>> 0);
        } else {
          /* For signed, use truncation toward zero */
          expected = uint(Math.trunc((x | 0) / divisor));
        }
      } else {
        if (flavor === "unsigned") {
          expected = ((x >>> 0) - Math.floor((x >>> 0) / divisor) * divisor) >>> 0;
        } else {
          const sx = x | 0;
          expected = uint(sx - Math.trunc(sx / divisor) * divisor);
        }
      }

      if (actual !== expected) { allAgree = false; break; }
    }

    if (allAgree) {
      /* Build the operand SymExpr from the leaf key. */
      let operand: SymExpr | undefined;
      if (leafKey.startsWith("@")) {
        operand = { kind: "entry", register: leafKey.slice(1) };
      } else {
        const match = leafKey.match(/^M(\d)([su])\[(\d+)\]$/);
        if (match) {
          operand = {
            kind: "load",
            address: parseInt(match[3]!, 10),
            width: parseInt(match[1]!, 10) as 1 | 2 | 4,
            signed: match[2] === "s",
          };
        }
      }
      if (!operand) return null;
      return { operand, divisor, op };
    }
  }

  return null;
}
/* ---- constant multiplication -------------------------------------------- */

/**
 * Recover `x * K` from the shift-and-add sequence the compiler expanded it to.
 *
 * At `-O2` a multiply by a small constant becomes shifts and adds: `i * 40`
 * comes out as `((i << 2) + i) << 3`. Translated literally that is what the
 * candidate says, and while it computes the right value it is not what the
 * source said — which matters here, because the next compilation has to
 * re-derive the same expansion from it, and a reader has to recognise a
 * stride.
 *
 * The recognition is exact rather than sampled: an expression built only from
 * shifts, additions and subtractions of one leaf *is* linear in that leaf, so
 * evaluating it at 0 and 1 settles both the coefficient and the absence of a
 * constant term. Anything else — a second leaf, a mask, a multiply-high —
 * returns null.
 */
export function recognizeConstantMultiply(expr: SymExpr): { operand: SymExpr; factor: number } | null {
  if (expr.kind !== "binary") return null;
  const leaf = singleLeafKey(expr);
  if (leaf === null) return null;

  /* Only the operations an expansion uses. A `sll` by a constant, an `add` or
   * a `sub`; the leaf itself; and constants. */
  /* The multiplicand: whatever the expansion is built over. A narrowing —
   * `(u16)i` — is part of the multiplicand, not part of the arithmetic, so it
   * is treated as opaque; every occurrence must be the same one, or the
   * expression is over two different values that happen to share a leaf. */
  let operand: SymExpr | undefined;
  let operandCanon: string | undefined;
  const noteOperand = (node: SymExpr): boolean => {
    const key = canon(node);
    if (operandCanon === undefined) {
      operandCanon = key;
      operand = node;
      return true;
    }
    return operandCanon === key;
  };
  const linear = (node: SymExpr): boolean => {
    switch (node.kind) {
      case "const": return true;
      case "entry": return noteOperand(node);
      case "unary": return noteOperand(node);
      case "load":
        if (node.base) return false;
        return noteOperand(node);
      case "binary":
        if (node.op === "sll") return node.right.kind === "const" && linear(node.left);
        if (node.op === "add" || node.op === "sub") return linear(node.left) && linear(node.right);
        return false;
      default:
        return false;
    }
  };
  if (!linear(expr) || !operand) return null;

  const at = (value: number): number | null => evaluateConcrete(expr, new Map([[leaf, value]]));
  const zero = at(0);
  const one = at(1);
  if (zero === null || one === null) return null;
  /* A non-zero value at zero means there is an additive term, which is a
   * different expression from a scale and must not be spelled as one. */
  if ((zero | 0) !== 0) return null;
  const factor = (one | 0) - (zero | 0);
  /* Factors of zero and one are not multiplications, and a power of two is
   * already spelled as a shift by the ordinary translation. */
  if (factor <= 1 || (factor & (factor - 1)) === 0) return null;

  /* Confirm linearity at two further points rather than trusting the shape:
   * a shift by 31 overflows, and an overflowing expansion is not `x * K`. */
  for (const sample of [2, 3, 7]) {
    const observed = at(sample);
    if (observed === null) return null;
    if (((observed | 0) >>> 0) !== ((Math.imul(sample, factor)) >>> 0)) return null;
  }
  return { operand, factor };
}
