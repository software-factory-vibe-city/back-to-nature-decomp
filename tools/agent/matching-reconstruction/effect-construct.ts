/**
 * Constructors for the straight-line effect class (plan §8, first census-led
 * expansion): the function performs a fixed sequence of stores and returns a
 * value, with no symbolic branching. The census sized this as the largest
 * tractable bucket — field setters and small initializers.
 *
 * Storage comes in two shapes, both evidence-typed:
 *   - absolute cells, grouped under the symbol whose label covers them —
 *     $gp-relative small data becomes a tentative definition (the only
 *     spelling that reproduces small-data addressing), absolute data an
 *     extern with a view struct reached by cast;
 *   - pointer-relative cells, grouped under their symbolic base — an argument
 *     register becomes a pointer-typed parameter, and a pointer loaded from a
 *     cell types that cell as pointer-to-view, recursively.
 *
 * Assignment order is the machine's store order (stores are never reordered
 * against each other), and parameter types come from the conversions the
 * machine applied.
 */

import { loadSymbolIndex, resolveAddress, type SymbolIndex } from "../../lib/symbolIndex.js";
import type { Container } from "../../lib/container.js";
import { canon, type LoadMeta } from "./exec.js";
import { recognizeConstantMultiply, recognizeDivision } from "./idioms.js";
import { resolveSignature, inferSignatureRange, type CalleeSignature, type InferredSignatureRange } from "./callee-signature.js";
import {
  type CExpr,
  type CStmt,
  STANDALONE_TYPEDEF_BLOCK,
  castForParameter,
  elementType,
  id,
  int,
  renderStmts,
} from "./construct.js";
import type { CallEffect, Effect, EffectRelation, StoreEffect, SymExpr, UnaryOp } from "./types.js";

/* ---- division idiom resolution (D2) --------------------------------------- */

/**
 * Before translating an expression through `translate`, try to recover a
 * constant-divisor `/` or `%` that the compiler replaced with a multiply-high
 * or shift sequence. When the recognizer succeeds, replace the expression
 * with one that `translate` can render directly.
 */
function resolveDivision(expr: SymExpr): SymExpr {
  const recognized = recognizeDivision(expr);
  if (!recognized) return expr;
  const divisorExpr: SymExpr = { kind: "const", value: recognized.divisor >>> 0 };
  if (recognized.op === "/") {
    return { kind: "binary", op: "divS", left: recognized.operand, right: divisorExpr };
  } else {
    return { kind: "binary", op: "remS", left: recognized.operand, right: divisorExpr };
  }
}

/* ---- fit ------------------------------------------------------------------ */

const ENTRY_V0: SymExpr = { kind: "entry", register: "v0" };

/** Stack-frame stores (spills and locals) are calling convention, not source. */
const isSpStore = (effect: { base?: SymExpr | undefined; kind?: string }): boolean =>
  effect.kind === undefined || effect.kind === "store"
    ? effect.base !== undefined && canon(effect.base) === "@sp"
    : false;

export function fitStraightLineEffects(
  leafValue: SymExpr,
  effects: Effect[],
): EffectRelation | { unfit: string } {
  /* No stores and no returned value is still a relation: the empty function.
   * Stack-frame stores (spills and locals) are calling convention, not
   * source — they are dropped. Calls are kept: the constructor emits them. */
  const sourceEffects = effects.filter((effect) => !isSpStore(effect)) as Effect[];
  return {
    kind: "straight-line-effects",
    effects: sourceEffects,
    returnValue: leafValue,
    evidence: [`${sourceEffects.length} effect(s) in machine order; return ${canon(leafValue)}`],
  };
}

/* ---- call resolution (S2/S3) --------------------------------------------- */

/**
 * Resolve the signature of every call effect in a relation, trimming each
 * call's captured argument snapshot to the callee's real arity.
 *
 * Over-capture is the bug this fixes: the executor snapshots all four
 * argument registers (a0..a3) because it cannot know how many the callee
 * consumes, and three of those "arguments" could be the caller's own
 * untouched entry-garbage registers. Feeding them to `deriveParamPlans`
 * manufactures caller parameters that never existed.
 *
 * `results.resolved` maps each call's seq to its resolved signature.
 * `results.unknownRanges` maps each seq whose callee could not be resolved
 * but is a named, direct target — inferred range bounds for enumeration.
 */
export interface ResolvedCall {
  arity: number;
  calleeName: string;
  returnsValue: boolean;
  returnType: string;
  /**
   * The callee's declared parameter types, in order.
   *
   * Carried rather than discarded. Printing `s32` for every parameter turns a
   * pointer argument into an integer argument in the declaration the candidate
   * compiles against, and a draft handed to an agent then states a signature
   * the evidence contradicts.
   */
  paramTypes: string[];
  source: CalleeSignature["source"];
}

export function resolveCallSignatures(
  effects: Effect[],
  container: Container,
): {
  resolved: Map<number, ResolvedCall>;
  unknownRanges: Map<number, { calleeName: string; arityLo: number; arityHi: number; returns: "yes" | "no" | "unknown" }>;
  /** Declared signatures the caller's own setup contradicts. Never resolved here. */
  conflicts: string[];
} {
  const resolved = new Map<number, ResolvedCall>();
  const conflicts: string[] = [];
  const unknownRanges = new Map<number, { calleeName: string; arityLo: number; arityHi: number; returns: "yes" | "no" | "unknown" }>();
  for (const effect of effects) {
    if (effect.kind !== "call") continue;
    /* The executor already resolved the target to a name when it could. */
    const name = effect.calleeName ?? effect.callee;
    const signature = resolveSignature(name, effect.calleeAddress, container);
    if ("unknown" in signature) {
      /* For a named, direct callee with an unresolvable signature, record
       * the inferred range for later enumeration. Indirect calls and bare
       * hex names stay refused. */
      if (name && !effect.indirect && !/^0x[0-9a-f]+$/i.test(name)) {
        /* Compute initial range using call-site args (consumedCalls not yet
         * known — pass empty set; returns refinement happens later). The
         * complete ABI list is passed, so a written fifth slot raises the
         * bound instead of being invisible. */
        const range = inferSignatureRange(name, effect.calleeAddress, container, abiArguments(effect), new Set(), effect.seq);
        unknownRanges.set(effect.seq, {
          calleeName: name,
          arityLo: range.arityLo,
          arityHi: range.arityHi,
          returns: range.returns,
        });
      }
      continue;
    }
    /*
     * ABI evidence is a *lower bound*, not an exact signature: it counts the
     * argument registers and stack slots the callee is seen to read, and a
     * callee that reads its fifth argument on one path only reads none on the
     * others. So a caller that wrote an outgoing-argument slot proves the
     * arity reaches that slot, and the bound is raised to meet it.
     *
     * A `matched` or `sdk` signature is a declaration, not a bound; a caller
     * that appears to write past it is a disagreement, recorded on the result
     * rather than silently resolved in either direction.
     */
    let arity = signature.arity;
    const full = abiArguments(effect);
    let writtenSlots = 0;
    for (let slot = full.length - 1; slot >= 4; slot--) {
      if (full[slot] !== null && full[slot] !== undefined) { writtenSlots = slot + 1; break; }
    }
    if (writtenSlots > arity) {
      if (signature.source === "abi") {
        arity = writtenSlots;
      } else {
        conflicts.push(
          `${effect.calleeName ?? effect.callee} is declared with ${signature.arity} parameter(s) (${signature.source}), ` +
          `but the caller at 0x${effect.vram.toString(16)} writes outgoing argument slot ${writtenSlots - 1}`,
        );
      }
    }
    resolved.set(effect.seq, {
      arity,
      calleeName: effect.calleeName ?? effect.callee,
      returnsValue: signature.returnsValue,
      returnType: signature.returnType,
      paramTypes: signature.paramTypes,
      source: signature.source,
    });
  }
  return { resolved, unknownRanges, conflicts };
}

/**
 * The complete ABI argument list at one call site: four register slots, then
 * the outgoing-argument-area slots the caller wrote.
 *
 * `null` marks a slot nothing established. It is deliberately not zero: a
 * fabricated zero compiles, reproduces nothing, and tells a reader that the
 * caller passed a value it never passed.
 */
export function abiArguments(effect: CallEffect): Array<SymExpr | null> {
  const full: Array<SymExpr | null> = [...effect.args, ...(effect.stackArgs ?? [])];
  while (full.length > 4 && full[full.length - 1] === null) full.pop();
  return full;
}

/**
 * The first `arity` arguments, or the slots that are missing.
 *
 * A missing slot is a construction failure for that arity hypothesis, not
 * something to fill in. The enumeration over unknown arities then discards
 * exactly the hypotheses the evidence cannot support, which is how an arity
 * gets decided by the target rather than by a default.
 */
export function argumentsForArity(
  effect: CallEffect,
  arity: number,
): { args: SymExpr[] } | { missing: number[] } {
  const full = abiArguments(effect);
  const args: SymExpr[] = [];
  const missing: number[] = [];
  for (let index = 0; index < arity; index++) {
    const value = full[index];
    if (value === undefined || value === null) missing.push(index);
    else args.push(value);
  }
  return missing.length > 0 ? { missing } : { args };
}

/**
 * Build the cartesian product of inferred signature assignments for unknown
 * callees. Each combination is a Map from call seq to {arity, returnsValue,
 * calleeName} — one hypothesis for every unknown call in the function.
 *
 * The product is capped at MAX_COMBOS (24). When the unbounded product would
 * exceed the cap, each range is narrowed to its best single-evidence
 * hypothesis (arityLo, returns when known). If still over, the capped subset
 * is returned without silent exclusion — the caller logs `budget-exhausted`.
 */
type SigEnumCombination = Map<number, { arity: number; returnsValue: boolean; calleeName: string }>;

const MAX_INFERRED_COMBOS = 24;

function buildInferredCombinations(
  unknownRanges: Map<number, { calleeName: string; arityLo: number; arityHi: number; returns: "yes" | "no" | "unknown" }>,
  consumedCalls: Set<number>,
): SigEnumCombination[] {
  if (unknownRanges.size === 0) return [new Map()];

  const entries = [...unknownRanges.entries()];

  /* Refine returns: if a call's result IS consumed and returns was "unknown",
   * it must be "yes" — the caller reads the value and cannot read garbage. */
  for (const [seq] of entries) {
    const range = unknownRanges.get(seq)!;
    if (range.returns === "unknown" && consumedCalls.has(seq)) {
      unknownRanges.set(seq, { ...range, returns: "yes" });
    }
  }

  /* Pre-compute per-call option lists. */
  const perCallOptions: Array<Array<{ seq: number; arity: number; returnsValue: boolean; calleeName: string }>> = [];
  let totalCombos = 1;
  for (const [seq, range] of entries) {
    const options: Array<{ seq: number; arity: number; returnsValue: boolean; calleeName: string }> = [];
    for (let arity = range.arityLo; arity <= range.arityHi; arity++) {
      const returnValues = range.returns === "yes" ? [true]
        : range.returns === "no" ? [false]
        : [false, true];
      for (const returnsValue of returnValues) {
        options.push({ seq, arity, returnsValue, calleeName: range.calleeName });
      }
    }
    if (options.length === 0) continue;
    totalCombos *= options.length;
    perCallOptions.push(options);
  }

  /* Narrow when product exceeds cap. */
  if (totalCombos > MAX_INFERRED_COMBOS) {
    const narrowed: Array<Array<{ seq: number; arity: number; returnsValue: boolean; calleeName: string }>> = [];
    for (const [seq, range] of entries) {
      const options: Array<{ seq: number; arity: number; returnsValue: boolean; calleeName: string }> = [];
      /* Best single-evidence: arityLo, and returns when known. */
      if (range.returns === "yes") {
        options.push({ seq, arity: range.arityLo, returnsValue: true, calleeName: range.calleeName });
      } else if (range.returns === "no") {
        options.push({ seq, arity: range.arityLo, returnsValue: false, calleeName: range.calleeName });
      } else {
        /* Unknown returns: try both arityLo with false and true. */
        options.push({ seq, arity: range.arityLo, returnsValue: false, calleeName: range.calleeName });
        options.push({ seq, arity: range.arityLo, returnsValue: true, calleeName: range.calleeName });
      }
      narrowed.push(options);
    }
    const narrowedProduct = narrowed.reduce((p, o) => p * o.length, 1);
    if (narrowedProduct <= MAX_INFERRED_COMBOS) {
      perCallOptions.length = 0;
      perCallOptions.push(...narrowed);
    }
  }

  /* Build cartesian product with cap. */
  const combos: SigEnumCombination[] = [new Map()];
  for (const options of perCallOptions) {
    const next: SigEnumCombination[] = [];
    for (const existing of combos) {
      for (const opt of options) {
        const merged = new Map(existing);
        merged.set(opt.seq, { arity: opt.arity, returnsValue: opt.returnsValue, calleeName: opt.calleeName });
        next.push(merged);
        if (next.length >= MAX_INFERRED_COMBOS) break;
      }
      if (next.length >= MAX_INFERRED_COMBOS) break;
    }
    combos.length = 0;
    combos.push(...next);
    if (combos.length >= MAX_INFERRED_COMBOS) break;
  }

  return combos;
}

/**
 * Prototype declarations for every resolved, named callee.
 *
 * Every candidate containing a call MUST declare the callee (S3 §3): an
 * undeclared callee is C89 implicit-int, which defines `$v0` even when
 * nothing reads it and reshapes allocation. In umbrella context the generated
 * header declares matched callees, but unmatched ones are absent there, and
 * in standalone context nothing is declared — so emitting the prototype from
 * the recovered signature in both contexts keeps the boundary safe.
 * A callee with an unknown signature cannot be declared; those calls are
 * refused by the caller earlier, so none reach here.
 */
/**
 * Types a reconstruction candidate can actually name.
 *
 * A candidate compiles either standalone (a fixed typedef block) or against
 * the umbrella header; neither has the project's aggregate types. So a
 * recovered `Vec3 *` is written `void *` — which preserves the one property
 * the code generator reads, pointer-ness, and produces identical words — and a
 * recovered aggregate *by value* is refused, because its size and alignment
 * change the calling sequence and no substitute is equivalent.
 */
const EXPRESSIBLE_SCALARS = new Set([
  "void", "char", "signed char", "unsigned char", "short", "unsigned short",
  "int", "unsigned int", "long", "unsigned long", "unsigned",
  "s8", "u8", "s16", "u16", "s32", "u32",
]);

export function expressibleType(type: string): string | null {
  const trimmed = type.replace(/\s+/g, " ").trim();
  if (trimmed === "") return null;
  if (trimmed.endsWith("*")) return "void *";
  if (EXPRESSIBLE_SCALARS.has(trimmed)) return trimmed;
  return null;
}

export function calleeDeclarations(
  caps: Map<number, { arity: number; calleeName: string; returnsValue: boolean; returnType: string; paramTypes?: string[] }>,
): string[] | { invalid: string } {
  const seen = new Set<string>();
  const decls: string[] = [];
  for (const cap of caps.values()) {
    if (seen.has(cap.calleeName)) continue;
    seen.add(cap.calleeName);
    /* A name that is still a bare hex address never got resolved — the call
     * is refused upstream, but guard anyway: never declare with a guess. */
    if (/^0x[0-9a-f]+$/i.test(cap.calleeName)) continue;
    const returnType = cap.returnsValue ? (expressibleType(cap.returnType) ?? null) : "void";
    if (returnType === null) {
      return { invalid: `${cap.calleeName} returns ${cap.returnType}, which a reconstruction candidate cannot name` };
    }
    let params: string;
    if (cap.arity === 0) {
      params = "void";
    } else {
      const rendered: string[] = [];
      for (let index = 0; index < cap.arity; index++) {
        /* A parameter the evidence says nothing about stays `s32`; one the
         * evidence types keeps its type, expressible form. */
        const declared = cap.paramTypes?.[index];
        const type = declared === undefined ? "s32" : expressibleType(declared);
        if (type === null) {
          return { invalid: `${cap.calleeName}'s parameter ${index} is ${declared}, which a reconstruction candidate cannot name` };
        }
        rendered.push(`${type}${type.endsWith("*") ? "" : " "}arg${index}`);
      }
      params = rendered.join(", ");
    }
    decls.push(`${returnType}${returnType.endsWith("*") ? "" : " "}${cap.calleeName}(${params});`);
  }
  return decls;
}

/* ---- cell collection ------------------------------------------------------ */

export interface Atom {
  base?: SymExpr | undefined;
  offset: number;
  width: 1 | 2 | 4;
  signed: boolean;
  /** Scaled index for array-style addressing (D3). */
  index?: { expr: SymExpr; scale: number } | undefined;
  /** The outer subscript of a nested access; the wider stride. */
  outerIndex?: { expr: SymExpr; scale: number } | undefined;
}

const atomGroup = (atom: Atom): string => {
  if (!atom.base) return "";
  const base = canon(atom.base);
  const outer = atom.outerIndex ? `[${canon(atom.outerIndex.expr)}*${atom.outerIndex.scale}]` : "";
  const inner = atom.index ? `[${canon(atom.index.expr)}*${atom.index.scale}]` : "";
  return `${base}${outer}${inner}`;
};
const cellKey = (group: string, offset: number, width: number): string => `${group}|${offset}|${width}`;

/** Every load atom in an expression, including the atoms inside pointer bases and indexes. */
export function collectAtoms(expr: SymExpr, into: Map<string, Atom>): void {
  switch (expr.kind) {
    case "load": {
      const atom: Atom = {
        base: expr.base, offset: expr.address, width: expr.width, signed: expr.signed,
        index: expr.index, outerIndex: expr.outerIndex,
      };
      into.set(`${atomGroup(atom)}|${atom.offset}|${atom.width}|${atom.index ? canon(atom.index.expr) : ""}`, atom);
      if (expr.base) collectAtoms(expr.base, into);
      if (expr.index) collectAtoms(expr.index.expr, into);
      if (expr.outerIndex) collectAtoms(expr.outerIndex.expr, into);
      return;
    }
    case "unary": return collectAtoms(expr.operand, into);
    case "binary":
      collectAtoms(expr.left, into);
      collectAtoms(expr.right, into);
      return;
    default: return;
  }
}

export interface CellUse extends Atom {
  viaGp: boolean;
  loaded: boolean;
  stored: boolean;
  /** Set when a symbolic group's base reads this cell: its C type is a pointer. */
  pointeeView?: string | undefined;
}

/* ---- storage mapping ------------------------------------------------------ */

/** Where the array an indexed access walks begins, relative to its base. */
export function arrayStartOf(atom: Atom): number {
  if (!atom.index || atom.index.scale <= 0) return 0;
  return atom.offset - (((atom.offset % atom.index.scale) + atom.index.scale) % atom.index.scale);
}

const indexedKey = (base: string, arrayOffset: number): string => `${base}@${arrayOffset}`;

/**
 * A pointer to the array's first element: the base stepped forward by the
 * array's own offset and retyped.
 *
 * `(T *)base` when the array starts at the base, `(T *)((u8 *)base + k)`
 * otherwise. The byte cast is what makes the arithmetic mean bytes regardless
 * of what the base was already typed as.
 */
function castArrayBase(base: CExpr, arrayOffset: number, elementTypeName: string): CExpr {
  const pointerType = `${elementTypeName} *`;
  if (arrayOffset === 0) return { kind: "cast", type: pointerType, expr: base };
  return {
    kind: "cast",
    type: pointerType,
    expr: { kind: "binary", op: "+", left: { kind: "cast", type: "u8 *", expr: base }, right: int(arrayOffset, true) },
  };
}


export interface StorageMap {
  typedefs: string[];
  externDecls: string[];
  /** Tentative definitions — required in every context: they are how
   *  gp-relative addressing is expressed (see the generated profile). */
  tentativeDefs: string[];
  /** Pointer-typed parameters, by register. */
  pointerParams: Map<string, string>;
  /**
   * Call sequence → the view-pointer type its result carries, for a callee
   * that returns a pointer the body dereferences.
   *
   * The body declares one local per consumed call result; without this it
   * would declare that local `s32` and then dereference it, which is a
   * different program from the one the target runs.
   */
  callResultViews: Map<number, string>;
  /** Loop step text per induction register (`arg0++`, `arg0 += 2`), for
   *  registers whose IV group maps to a pointer whose pointee size divides
   *  the delta. A register absent here cannot be advanced in C. */
  pointerSteps: Map<string, string>;
  access: (atom: Atom) => CExpr;
  /**
   * Byte offset the indexed accessor already covers.
   *
   * `translate` turns the rest of the offset into element counts, so it must
   * not count bytes the base expression has already stepped over — otherwise
   * `object->tail[i]` comes out as `object->tail[i + 20]`.
   */
  indexBaseOffset?: (atom: Atom) => number;
  /**
   * The C expression for a symbolic base whose accesses are spelled as byte
   * arithmetic rather than through a declared view — a nested subscript.
   */
  basePointer?: (base: SymExpr) => CExpr | undefined;
  /** Cast-form accessor for fallback plans: `*(s16 *)((u8 *)arg0 + 0x1C)`.
   *  Present when the map contains pointer-based cells and can produce raw
   *  access expressions without typed views. */
  rawAccess?: (atom: Atom) => CExpr | undefined;
  integration: string[];
}

interface SymbolicGroup {
  group: string;
  /** Every raw group key merged into this one (`@a0`, `IV(a0,2)`, …). */
  groups: string[];
  base: SymExpr;
  viewName: string;
  cells: CellUse[];
  /** Chain length to an absolute or argument anchor, for typedef ordering. */
  depth: number;
}

function baseDepth(expr: SymExpr): number {
  if (expr.kind === "load" && expr.base) return 1 + baseDepth(expr.base);
  if (expr.kind === "iv" || expr.kind === "entry") return 0;
  return 1;
}

/**
 * Build the whole storage mapping, or say exactly what is missing. One
 * deterministic mapping — the byte oracle judges it; alternatives can widen
 * this later if the census shows misses.
 */
/**
 * A private type name nothing else in the project can collide with.
 *
 * A view is invented for *this* function's pointer parameter, and its layout is
 * this function's evidence — `arg0` here is not `arg0` anywhere else. A shared
 * spelling like `ReconA0View` compiles anyway, because each candidate is its
 * own translation unit, and then fails at the boundary where the names become
 * project-wide: the exported m2c context sees one name referenced by three
 * signatures with three layouts and publishes one opaque guess for all of them.
 * Stamping the owner into the name makes the collision impossible rather than
 * detectable.
 */
function viewOwnerTag(owner: string | undefined): string {
  if (!owner) return "";
  const address = owner.match(/([0-9A-Fa-f]{6,8})$/)?.[1];
  return address ? address.toUpperCase() : owner.replace(/\W/g, "");
}

export function buildStorageMap(
  cells: Map<string, CellUse>,
  index: SymbolIndex,
  ivDeltas: Map<string, number> = new Map(),
  /** The function these views belong to; stamped into every invented name. */
  owner?: string,
): StorageMap | { invalid: string } | { unresolved: string } {
  const tag = viewOwnerTag(owner);
  const typedefs: string[] = [];
  const externDecls: string[] = [];
  const tentativeDefs: string[] = [];
  const integration: string[] = [];
  const pointerParams = new Map<string, string>();
  const pointerSteps = new Map<string, string>();
  const callResultViews = new Map<number, string>();
  const accessors = new Map<string, CExpr>();
  /* Base accessors for indexed groups, keyed by base *and* the array's own
   * start offset: one pointer can carry several arrays. */
  const indexedBaseAccessors = new Map<string, CExpr>();
  /* How many bytes each indexed base expression already accounts for, so the
   * subscript is computed from the remainder rather than from the whole
   * offset. */
  const indexedOffsets = new Map<string, number>();

  /* Separate cells by group. */
  const byGroup = new Map<string, CellUse[]>();
  for (const cell of cells.values()) {
    const group = atomGroup(cell);
    byGroup.set(group, [...(byGroup.get(group) ?? []), cell]);
  }

  /* ---- split into absolute, plain symbolic, and indexed symbolic groups --- */
  const plainGroups: Array<{ group: string; cells: CellUse[] }> = [];
  const indexedGroups: Array<{ group: string; cells: CellUse[] }> = [];
  const nestedGroups: Array<{ group: string; cells: CellUse[] }> = [];
  let hasSpAccess = false;
  for (const [group, groupCells] of byGroup) {
    if (group === "") { plainGroups.push({ group, cells: groupCells }); continue; }
    /* Stack spills and locals are calling convention, not source: drop them
     * from the storage map entirely, rejecting any access that survives
     * (unforwarded load from sp → escape). */
    if (group === "@sp" || group.startsWith("@sp[")) {
      hasSpAccess = true;
      continue;
    }
    if (groupCells.some((cell) => cell.outerIndex)) {
      /* A nested access carries two strides. It is expressed by arithmetic on
       * a byte pointer rather than by a declared two-dimensional type: the
       * strides are witnessed, the extents are not, and a `T v[N][M]` would
       * assert both. */
      nestedGroups.push({ group, cells: groupCells });
    } else if (groupCells.some((cell) => cell.index)) {
      indexedGroups.push({ group, cells: groupCells });
    } else {
      plainGroups.push({ group, cells: groupCells });
    }
  }

  /* ---- plain symbolic groups ---------------------------------------------- */
  /* An IV base and its underlying argument register are ONE storage object:
   * IV(a0,2) is just a0 as seen mid-loop. Merge groups by effective base so
   * pre-loop and in-loop accesses share one view (and one typedef name). */
  const symbolicGroups: SymbolicGroup[] = [];
  const byEffectiveBase = new Map<string, SymbolicGroup>();
  let viewIndex = 0;
  for (const { group, cells: groupCells } of plainGroups) {
    if (group === "") continue;
    const base = groupCells[0]!.base!;
    const effectiveBase = base.kind === "iv" ? { kind: "entry" as const, register: base.register } : base;
    if (effectiveBase.kind === "entry") {
      if (!["a0", "a1", "a2", "a3"].includes(effectiveBase.register)) {
        return { invalid: `pointer base ${canon(base)} is not an argument register` };
      }
    } else if (effectiveBase.kind === "call-result") {
      /* A callee returned a pointer and this function dereferenced it. The C
       * is a local holding the call's result; refusing it excluded every
       * "ask the helper for an object, then read a field of it" function. */
      if (effectiveBase.register !== "v0") {
        return { invalid: `pointer base ${canon(base)} is a call result in $${effectiveBase.register}, not the return register` };
      }
    } else if (effectiveBase.kind !== "load") {
      return { invalid: `pointer base ${canon(base)} is neither an argument, a loaded pointer, nor a call result` };
    }
    const mergeKey = canon(effectiveBase);
    const existing = byEffectiveBase.get(mergeKey);
    if (existing) {
      existing.cells.push(...groupCells);
      existing.groups.push(group);
      continue;
    }
    const created: SymbolicGroup = {
      group,
      groups: [group],
      base: effectiveBase,
      viewName: effectiveBase.kind === "entry"
        ? `Recon${tag}${effectiveBase.register.toUpperCase()}View`
        : effectiveBase.kind === "call-result"
          ? `Recon${tag}CallRet${effectiveBase.seq}View`
          : `Recon${tag}Pointee${viewIndex++}View`,
      cells: groupCells,
      depth: baseDepth(effectiveBase),
    };
    byEffectiveBase.set(mergeKey, created);
    symbolicGroups.push(created);
  }
  symbolicGroups.sort((a, b) => b.depth - a.depth || a.group.localeCompare(b.group));

  /* A cell whose value is a group's base pointer gets that view's pointer type. */
  for (const symbolicGroup of symbolicGroups) {
    if (symbolicGroup.base.kind !== "load") continue;
    const baseAtom = symbolicGroup.base;
    const key = cellKey(baseAtom.base ? canon(baseAtom.base) : "", baseAtom.address, baseAtom.width);
    const cell = [...cells.values()].find((entry) => cellKey(atomGroup(entry), entry.offset, entry.width) === key);
    if (!cell) return { invalid: `the pointer base ${canon(baseAtom)} is not among the collected cells` };
    if (cell.width !== 4) return { invalid: `the pointer base ${canon(baseAtom)} is not a word-sized cell` };
    cell.pointeeView = symbolicGroup.viewName;
  }

  const fieldName = (offset: number): string => `unk${offset.toString(16).toUpperCase()}`;

  /**
   * Union members, per view: `viewName` → (offset*8 + width) → member name.
   *
   * A mixed-width field is emitted as a union, and C requires the member to be
   * named at every use. Recording the mapping here is what lets the accessor
   * write `p->unk0.w4_s` instead of `p->unk0`, which does not compile.
   */
  const unionMembers = new Map<string, Map<number, string>>();
  const unionSuffix = (viewName: string, cell: CellUse, offset: number): string => {
    const member = unionMembers.get(viewName)?.get(offset * 8 + cell.width);
    return member ? `.${member}` : "";
  };

  /** Emit one view struct over a group's cells; returns the typedef text and
   *  the struct's byte size. `strideTo` pads the tail so the pointee size
   *  equals a loop induction's advance and `pointer++` walks one record.
   *
   *  When two accesses at the same offset disagree on width, a union member
   *  is emitted (E: overlapping/mixed-width access). The oracle judges which
   *  axis the compiler actually used. */
  const viewTypedef = (
    viewName: string,
    groupCells: CellUse[],
    strideTo?: number,
  ): { text: string; size: number; unions: Map<number, string> } | { invalid: string } => {
    const byOffset = new Map<number, CellUse[]>();
    for (const cell of groupCells) {
      const existing = byOffset.get(cell.offset);
      if (existing) {
        /* Collect all cells at this offset — union/overlap resolution
         * happens at emission time (E). */
        existing.push(cell);
      } else {
        byOffset.set(cell.offset, [cell]);
      }
    }
    const offsets = [...byOffset.keys()].sort((a, b) => a - b);
    const lines: string[] = ["typedef struct {"];
    /* Offsets whose field is a union, and the member name each (offset,width)
     * access must select. A union member that is never named does not compile,
     * and this used to be the only thing the mixed-width path produced. */
    const unions = new Map<number, string>();
    let cursor = 0;
    for (const offset of offsets) {
      const cells = byOffset.get(offset)!;
      const primary = cells.find((c) => c.loaded || c.pointeeView) ?? cells[0]!;
      if (offset % primary.width !== 0) return { invalid: `misaligned field at offset 0x${offset.toString(16)} of ${viewName}` };
      if (offset < cursor) return { invalid: `overlapping fields at offset 0x${offset.toString(16)} of ${viewName}` };
      if (offset > cursor) lines.push(`    char pad_${cursor.toString(16).toUpperCase()}[0x${(offset - cursor).toString(16).toUpperCase()}];`);

      /* When multiple widths exist at one offset, emit a union (E). */
      if (cells.length > 1 && cells.some((c) => c.width !== cells[0]!.width)) {
        const members = new Map<string, string>();
        for (const cell of cells) {
          const type = cell.pointeeView ? `${cell.pointeeView} *` : elementType(cell.width, cell.signed);
          const member = `w${cell.width}_${cell.signed ? "s" : "u"}`;
          members.set(member, `        ${type}${type.endsWith("*") ? "" : " "}${member};`);
          unions.set(offset * 8 + cell.width, member);
        }
        lines.push(`    union {`);
        lines.push(...members.values());
        lines.push(`    } unk${offset.toString(16).toUpperCase()};`);
        const maxWidth = Math.max(...cells.map((c) => c.width));
        cursor = offset + maxWidth;
      } else {
        const type = primary.pointeeView ? `${primary.pointeeView} *` : elementType(primary.width, primary.signed);
        const fieldType = `${type}${type.endsWith("*") ? "" : " "}`;
        lines.push(`    ${fieldType}unk${offset.toString(16).toUpperCase()};`);
        cursor = offset + primary.width;
      }
    }
    if (strideTo !== undefined) {
      if (cursor > strideTo) return { invalid: `fields of ${viewName} extend past its induction stride ${strideTo}` };
      if (cursor < strideTo) {
        lines.push(`    char pad_${cursor.toString(16).toUpperCase()}[0x${(strideTo - cursor).toString(16).toUpperCase()}];`);
        cursor = strideTo;
      }
    }
    lines.push("}");
    return { text: `${lines.join("\n")} ${viewName};`, size: cursor, unions };
  };

  /* Symbolic groups: parameter pointers and loaded pointers. Their accessors
   * depend on the base's own accessor, so build deepest-first and look the
   * base accessor up when the shallower group is built — which works because
   * a base chain's atoms are strictly shallower than the group they carry. */
  const symbolicAccessorBase = new Map<string, CExpr>();

  const baseLvalue = (base: SymExpr): CExpr | { invalid: string } => {
    if (base.kind === "entry") {
      const paramName = `arg${["a0", "a1", "a2", "a3"].indexOf(base.register)}`;
      return id(paramName);
    }
    if (base.kind === "load") {
      const accessor = accessors.get(cellKey(base.base ? canon(base.base) : "", base.address, base.width));
      if (!accessor) return { invalid: `no accessor yet for pointer base ${canon(base)}` };
      return accessor;
    }
    if (base.kind === "call-result") return id(`callRet${base.seq}`);
    return { invalid: `unsupported pointer base ${canon(base)}` };
  };

  /* Absolute cells first (they anchor loaded-pointer chains), grouped by the
   * covering label. */
  const absolute = byGroup.get("") ?? [];
  const absoluteBySymbol = new Map<string, { symbol: string; base: number; cells: CellUse[]; viaGp: boolean }>();
  for (const cell of absolute) {
    const resolved = resolveAddress(index, cell.offset);
    if (!resolved || resolved.offset > 0x100000) {
      return { unresolved: `no label covers the accessed address 0x${cell.offset.toString(16)}` };
    }
    const base = cell.offset - resolved.offset;
    const group = absoluteBySymbol.get(resolved.symbol) ?? { symbol: resolved.symbol, base, cells: [], viaGp: false };
    group.cells.push(cell);
    group.viaGp = group.viaGp || cell.viaGp;
    absoluteBySymbol.set(resolved.symbol, group);
  }

  /* Deepest symbolic views first, then absolute declarations, then shallower
   * accessor wiring — typedefs are emitted in that order too. */
  const viewSizes = new Map<string, number>();
  for (const symbolicGroup of symbolicGroups) {
    const stride = symbolicGroup.base.kind === "entry" ? ivDeltas.get(symbolicGroup.base.register) : undefined;
    const typedef = viewTypedef(symbolicGroup.viewName, symbolicGroup.cells, stride !== undefined ? Math.abs(stride) : undefined);
    if ("invalid" in typedef) return typedef;
    typedefs.push(typedef.text);
    viewSizes.set(symbolicGroup.viewName, typedef.size);
    unionMembers.set(symbolicGroup.viewName, typedef.unions);
  }

  for (const group of [...absoluteBySymbol.values()].sort((a, b) => a.base - b.base)) {
    const offsets = [...new Set(group.cells.map((cell) => cell.offset - group.base))].sort((a, b) => a - b);
    const single = offsets.length === 1 && offsets[0] === 0 ? group.cells.find((cell) => cell.offset === group.base)! : undefined;
    if (single) {
      const type = single.pointeeView ? `${single.pointeeView} *` : elementType(single.width, single.signed);
      (group.viaGp ? tentativeDefs : externDecls).push(
        group.viaGp ? `${type}${type.endsWith("*") ? "" : " "}${group.symbol};` : `extern ${type}${type.endsWith("*") ? "" : " "}${group.symbol};`);
      integration.push(group.viaGp
        ? `${group.symbol} is $gp-relative: its translation unit must carry the tentative definition (ownership per the generated profile's small-data rule)`
        : `${group.symbol} keeps its generated declaration${single.pointeeView ? `, typed ${single.pointeeView} * in the override header` : ""}`);
      accessors.set(cellKey("", single.offset, single.width), id(group.symbol));
      continue;
    }

    const viewName = `Recon${tag}${group.symbol.replace(/\W/g, "")}View`;
    const shifted = group.cells.map((cell) => ({ ...cell, offset: cell.offset - group.base }));
    const typedef = viewTypedef(viewName, shifted);
    if ("invalid" in typedef) return typedef;
    typedefs.push(typedef.text);
    unionMembers.set(viewName, typedef.unions);
    if (group.viaGp) {
      tentativeDefs.push(`${viewName} ${group.symbol};`);
      integration.push(`${group.symbol} is $gp-relative small data; the view type and tentative definition must live with its owning translation unit`);
      for (const cell of group.cells) {
        accessors.set(cellKey("", cell.offset, cell.width), {
          kind: "member",
          base: id(group.symbol),
          field: `${fieldName(cell.offset - group.base)}${unionSuffix(viewName, cell, cell.offset - group.base)}`,
          arrow: false,
        });
      }
    } else {
      externDecls.push(`extern u8 ${group.symbol}[];`);
      integration.push(`move the ${viewName} typedef into the shared type header named by the generated profile; ${group.symbol} keeps its declaration and is accessed by cast`);
      for (const cell of group.cells) {
        accessors.set(cellKey("", cell.offset, cell.width), {
          kind: "member",
          base: { kind: "cast", type: `${viewName} *`, expr: id(group.symbol) },
          field: `${fieldName(cell.offset - group.base)}${unionSuffix(viewName, cell, cell.offset - group.base)}`,
          arrow: true,
        });
      }
    }
  }

  /* Now wire symbolic accessors, shallowest first. A merged group registers
   * each cell under its own raw group key (`@a0` and `IV(a0,2)` alike), which
   * is the key the access lookup computes from the atom. */
  for (const symbolicGroup of [...symbolicGroups].sort((a, b) => a.depth - b.depth)) {
    const lvalue = baseLvalue(symbolicGroup.base);
    if (!("kind" in lvalue)) return lvalue;
    for (const raw of symbolicGroup.groups) symbolicAccessorBase.set(raw, lvalue);
    if (symbolicGroup.base.kind === "entry") {
      pointerParams.set(symbolicGroup.base.register, `${symbolicGroup.viewName} *`);
      integration.push(`the ${symbolicGroup.base.register} parameter is a ${symbolicGroup.viewName} pointer; move the typedef to the shared type header`);
    } else if (symbolicGroup.base.kind === "call-result") {
      callResultViews.set(symbolicGroup.base.seq, `${symbolicGroup.viewName} *`);
      integration.push(`the call at sequence ${symbolicGroup.base.seq} returns a ${symbolicGroup.viewName} pointer; declare the callee's return type accordingly`);
    } else {
      integration.push(`the ${symbolicGroup.viewName} typedef belongs in the shared type header`);
    }
    for (const cell of symbolicGroup.cells) {
      accessors.set(cellKey(atomGroup(cell), cell.offset, cell.width), {
        kind: "member",
        base: lvalue,
        field: `${fieldName(cell.offset)}${unionSuffix(symbolicGroup.viewName, cell, cell.offset)}`,
        arrow: true,
      });
    }
    /* The loop step this pointer realizes, when its stride divides the delta. */
    if (symbolicGroup.base.kind === "entry") {
      const delta = ivDeltas.get(symbolicGroup.base.register);
      const size = viewSizes.get(symbolicGroup.viewName);
      if (delta !== undefined && size !== undefined && size > 0 && Math.abs(delta) % size === 0) {
        const name = `arg${["a0", "a1", "a2", "a3"].indexOf(symbolicGroup.base.register)}`;
        const count = Math.abs(delta) / size;
        const text = delta > 0
          ? (count === 1 ? `${name}++` : `${name} += ${count}`)
          : (count === 1 ? `${name}--` : `${name} -= ${count}`);
        pointerSteps.set(symbolicGroup.base.register, text);
      }
    }
  }

  /* ---- nested groups: a subscript inside a subscript ----------------------- */
  /*
   * The base still has to be typed — an argument, a loaded pointer, a call
   * result — because the arithmetic starts from it. Nothing else is declared:
   * `translate` builds the whole address from the witnessed strides, which is
   * the only spelling that claims exactly what the target proves.
   */
  const nestedBases = new Map<string, CExpr>();
  for (const { group, cells: groupCells } of nestedGroups) {
    const base = groupCells[0]!.base;
    if (!base) return { invalid: `nested indexed group ${group} has no base` };
    const effectiveBase = base.kind === "iv" ? { kind: "entry" as const, register: base.register } : base;
    if (effectiveBase.kind === "entry") {
      const idx = ["a0", "a1", "a2", "a3"].indexOf(effectiveBase.register);
      if (idx < 0) return { invalid: `nested indexed base ${canon(base)} is not an argument register` };
      nestedBases.set(canon(base), id(`arg${idx}`));
      integration.push(`the ${effectiveBase.register} parameter carries a nested array; its strides are witnessed, its extents are not`);
      continue;
    }
    if (effectiveBase.kind === "const") {
      const resolved = resolveAddress(index, effectiveBase.value >>> 0);
      if (!resolved) return { unresolved: `no label covers the nested array base at 0x${(effectiveBase.value >>> 0).toString(16)}` };
      externDecls.push(`extern u8 ${resolved.symbol}[];`);
      nestedBases.set(canon(base), id(resolved.symbol));
      integration.push(`${resolved.symbol} carries a nested array reached by byte arithmetic`);
      continue;
    }
    const lvalue = baseLvalue(effectiveBase);
    if (!("kind" in lvalue)) return lvalue;
    nestedBases.set(canon(base), lvalue);
    integration.push(`${canon(effectiveBase)} carries a nested array; its strides are witnessed, its extents are not`);
  }

  /* ---- indexed groups: array access --------------------------------------- */
  /*
   * An indexed access reads `base + scale*index + offset`. The offset splits
   * in exactly one way that is always meaningful:
   *
   *     arrayOffset = offset - (offset mod scale)   the array's own start
   *     elemOffset  = offset mod scale              a field inside one element
   *
   * Requiring `offset < scale` — which is what this used to do — asserts that
   * every indexed access starts at the base, and refused the ordinary shape
   * `object->halfwords[i]`, where the array is a member at a constant offset.
   * Splitting instead of refusing costs nothing and is exact: both readings
   * produce the same address, and the split is forced by the arithmetic.
   *
   * The array's extent is deliberately never declared. A pointer cast at the
   * array's own start says exactly what the target says — "elements of this
   * width live here" — where a struct member `T field[N]` would additionally
   * assert an N nothing witnessed.
   */
  for (const { group, cells: groupCells } of indexedGroups) {
    const base = groupCells[0]!.base!;
    if (!groupCells[0]!.index) {
      return { invalid: `indexed group ${group} has no index on its first cell` };
    }
    const scale = groupCells[0]!.index!.scale;
    if (scale <= 0) return { invalid: `indexed group ${group} has a non-positive scale ${scale}` };
    for (const cell of groupCells) {
      if (cell.offset < 0) {
        return { invalid: `indexed group ${group} has a negative offset ${cell.offset}` };
      }
      if (cell.index && cell.index.scale !== scale) {
        return { invalid: `indexed group ${group} mixes strides ${scale} and ${cell.index.scale}` };
      }
    }

    /* One array per distinct start offset: `p[i]` and `p->tail[i]` are two
     * arrays through one pointer, and merging them would misplace both. */
    const byArrayOffset = new Map<number, CellUse[]>();
    for (const cell of groupCells) {
      const arrayOffset = cell.offset - (cell.offset % scale);
      byArrayOffset.set(arrayOffset, [...(byArrayOffset.get(arrayOffset) ?? []), cell]);
    }

    /* Whether this base already has a non-indexed view. When it does, the
     * parameter (or local) is already typed, and the array is reached from
     * that pointer rather than by retyping it. */
    const effectiveBase = base.kind === "iv" ? { kind: "entry" as const, register: base.register } : base;
    const plainGroup = byEffectiveBase.get(canon(effectiveBase));

    for (const [arrayOffset, cells] of [...byArrayOffset.entries()].sort((a, b) => a[0] - b[0])) {
      const elemOffsets = [...new Set(cells.map((cell) => cell.offset % scale))].sort((a, b) => a - b);
      const isSimple = elemOffsets.length === 1 && elemOffsets[0] === 0;
      const elemType = elementType(cells[0]!.width, cells[0]!.signed);

      /* The element type: the scalar itself when the element is one cell, a
       * view struct padded to the stride when it holds several fields. */
      let elementTypeName = elemType;
      if (!isSimple) {
        const viewName = `Recon${tag}Arr${arrayOffset.toString(16).toUpperCase()}_${scale}View`;
        const rebased = cells.map((cell) => ({ ...cell, offset: cell.offset % scale }));
        const typedefResult = viewTypedef(viewName, rebased, scale);
        if ("invalid" in typedefResult) return typedefResult;
        typedefs.push(typedefResult.text);
        unionMembers.set(viewName, typedefResult.unions);
        elementTypeName = viewName;
        integration.push(`the ${viewName} element type belongs in the shared type header; its stride ${scale} is witnessed, its element count is not`);
      } else if (cells[0]!.width !== scale) {
        /* A stride wider than the element means the access skips bytes the
         * target never touched — real, but not an array of this scalar. */
        integration.push(`the array at +0x${arrayOffset.toString(16)} is read ${cells[0]!.width} byte(s) at a stride of ${scale}; the element type is a hypothesis`);
      }

      /* The base expression the subscript applies to. */
      let baseExpr: CExpr;
      if (plainGroup === undefined && base.kind === "entry" && arrayOffset === 0) {
        const idx = ["a0", "a1", "a2", "a3"].indexOf(base.register);
        if (idx < 0) return { invalid: `indexed base ${canon(base)} is not an argument register` };
        pointerParams.set(base.register, `${elementTypeName} *`);
        integration.push(`the ${base.register} parameter is a ${elementTypeName} array pointer`);
        baseExpr = id(`arg${idx}`);
      } else if (plainGroup === undefined && base.kind === "const") {
        const resolved = resolveAddress(index, base.value >>> 0);
        if (!resolved) return { unresolved: `no label covers the array base at 0x${(base.value >>> 0).toString(16)}` };
        if (arrayOffset === 0 && resolved.offset === 0) {
          externDecls.push(`extern ${elementTypeName} ${resolved.symbol}[];`);
          integration.push(`${resolved.symbol} is an array of ${elementTypeName}`);
          baseExpr = id(resolved.symbol);
        } else {
          externDecls.push(`extern u8 ${resolved.symbol}[];`);
          integration.push(`${resolved.symbol} carries a ${elementTypeName} array at +0x${(arrayOffset + resolved.offset).toString(16)}`);
          baseExpr = castArrayBase(id(resolved.symbol), arrayOffset + resolved.offset, elementTypeName);
        }
      } else {
        /* Reached through an already-typed pointer: an argument, a loaded
         * pointer, a call result, or a base with its own view. */
        const lvalue = baseLvalue(effectiveBase);
        if (!("kind" in lvalue)) return lvalue;
        baseExpr = castArrayBase(lvalue, arrayOffset, elementTypeName);
        integration.push(
          `the array of ${elementTypeName} at +0x${arrayOffset.toString(16)} of ${canon(effectiveBase)} is reached by cast; ` +
          `its element count is not witnessed`,
        );
      }

      indexedBaseAccessors.set(indexedKey(canon(base), arrayOffset), baseExpr);
      indexedOffsets.set(indexedKey(canon(base), arrayOffset), arrayOffset);
      for (const cell of cells) {
        accessors.set(cellKey(group, cell.offset, cell.width), baseExpr);
      }
    }
  }

  return {
    typedefs,
    externDecls,
    tentativeDefs,
    pointerParams,
    pointerSteps,
    callResultViews,
    indexBaseOffset: (atom) => (atom.index && !atom.outerIndex ? arrayStartOf(atom) : 0),
    basePointer: (base) => nestedBases.get(canon(base)),
    integration,
    access: (atom) => {
      if (atom.outerIndex) {
        /* Built by `translate`, which is where the subscript expressions are
         * available; the map only supplies the base pointer. */
        throw new Error(`nested indexed access at ${atomGroup(atom)} is built by translate, not by the accessor table`);
      }
      if (atom.index) {
        /* Indexed access: return the base expression; translate adds the
         * subscript, minus whatever the base expression already covers. */
        const key = indexedKey(canon(atom.base!), arrayStartOf(atom));
        const baseExpr = indexedBaseAccessors.get(key);
        if (!baseExpr) throw new Error(`no indexed base for ${canon(atom.base!)} at +0x${arrayStartOf(atom).toString(16)}`);
        return baseExpr;
      }
      const found = accessors.get(cellKey(atomGroup(atom), atom.offset, atom.width));
      if (!found) throw new Error(`no accessor for ${atomGroup(atom) || "absolute"}+0x${atom.offset.toString(16)}`);
      return found;
    },
    /* Cast-form fallback accessor: produces `*(type *)((u8 *)base + offset)`.
     * Returns undefined for absolute cells (which have ordinary accessors via
     * extern symbols) — those do not need fallback. */
    rawAccess: (atom) => {
      if (!atom.base) return undefined;
      const group = canon(atom.base);
      if (!group || group === "@sp") return undefined;
      /* Build base expression from the base's canonical name. */
      let baseExpr: CExpr;
      if (atom.base.kind === "entry") {
        const reg = atom.base.register;
        const idx = ["a0", "a1", "a2", "a3"].indexOf(reg);
        if (idx < 0) return undefined;
        baseExpr = id(`arg${idx}`);
      } else if (atom.base.kind === "call-result") {
        baseExpr = id(`callRet${atom.base.seq}`);
      } else if (atom.base.kind === "iv") {
        const reg = atom.base.register;
        const idx = ["a0", "a1", "a2", "a3"].indexOf(reg);
        if (idx < 0) return undefined;
        baseExpr = id(`arg${idx}`);
      } else if (atom.base.kind === "load") {
        const baseKey = cellKey(atom.base.base ? canon(atom.base.base) : "", atom.base.address, atom.base.width);
        const baseAccessor = accessors.get(baseKey);
        if (!baseAccessor) return undefined;
        baseExpr = baseAccessor;
      } else {
        return undefined;
      }
      const ptrType = atom.signed ? `s${atom.width * 8}` : `u${atom.width * 8}`;
      const castBase: CExpr = atom.offset === 0
        ? { kind: "cast", type: `${ptrType} *`, expr: baseExpr }
        : { kind: "cast", type: `${ptrType} *`, expr: {
            kind: "binary", op: "+",
            left: { kind: "cast", type: "u8 *", expr: baseExpr },
            right: int(atom.offset, true),
          } };
      return { kind: "unaryop", op: "*", expr: castBase };
    },
  };
}

/* ---- parameters ----------------------------------------------------------- */

export interface ParamPlan {
  params: Array<{ name: string; type: string; register: string }>;
  absorbed: Map<string, UnaryOp>;
  /** Pointer parameters the body also reads as plain values; cast at use. */
  pointerValueUses?: Set<string>;
  label: string;
}

/** The plan's pointer-typed parameter names, for pointer-ness of an expression. */
export function pointerParamNames(plan: ParamPlan): Set<string> {
  return new Set(plan.params.filter((param) => param.type.trim().endsWith("*")).map((param) => param.name));
}

const ARG_ORDER = ["a0", "a1", "a2", "a3"];
const CONVERSION_TYPE: Record<UnaryOp, string> = { zext8: "u8", zext16: "u16", sext8: "s8", sext16: "s16" };

/** Value uses of argument registers — pointer-base uses are not value uses. */
function argumentUses(exprs: SymExpr[]): Map<string, Set<UnaryOp | "raw">> {
  const uses = new Map<string, Set<UnaryOp | "raw">>();
  const note = (register: string, use: UnaryOp | "raw") => {
    if (!ARG_ORDER.includes(register)) return;
    uses.set(register, new Set([...(uses.get(register) ?? []), use]));
  };
  const walk = (expr: SymExpr): void => {
    switch (expr.kind) {
      case "entry": return note(expr.register, "raw");
      /* IV expressions (D7) represent the loop's induction pointer — they are
       * pointer-base uses, not value uses, and should NOT be counted as a
       * "value use" that conflicts with pointer-type params. */
      case "iv": return;
      case "unary":
        if (expr.operand.kind === "entry") return note(expr.operand.register, expr.op);
        return walk(expr.operand);
      case "binary":
        walk(expr.left);
        walk(expr.right);
        return;
      case "load":
        /* A subscript is a value use: `p[i]` reads `i` as a number. The base
         * is not — `p` is dereferenced, not read — so it is descended into
         * only past a bare register, where a deeper subscript may hide. */
        if (expr.index) walk(expr.index.expr);
        if (expr.outerIndex) walk(expr.outerIndex.expr);
        if (expr.base && expr.base.kind !== "entry" && expr.base.kind !== "iv") walk(expr.base);
        return;
      default: return;
    }
  };
  for (const expr of exprs) walk(expr);
  return uses;
}

/**
 * Identify registers whose only "raw" entry references occur as call arguments,
 * never in store values, return values, or comparison/arithmetic contexts.
 * These are pointer-compatible — the callee receives the pointer value itself,
 * and the caller never performs arithmetic on it.
 */
function callArgOnlyRegisters(exprs: SymExpr[], effects: Effect[]): Set<string> {
  /* Collect every register mentioned in a value context (store values,
   * return values, branch conditions). A register that only appears in
   * call argument positions and never here is call-arg-only. */
  const valueContextRegs = new Set<string>();
  const walkValue = (expr: SymExpr): void => {
    switch (expr.kind) {
      case "entry":
        if (ARG_ORDER.includes(expr.register)) valueContextRegs.add(expr.register);
        return;
      case "iv": return;
      case "unary": walkValue(expr.operand); return;
      case "binary": walkValue(expr.left); walkValue(expr.right); return;
      case "call-result": return;
      case "load":
        if (expr.index) walkValue(expr.index.expr);
        if (expr.outerIndex) walkValue(expr.outerIndex.expr);
        if (expr.base && expr.base.kind !== "entry" && expr.base.kind !== "iv") walkValue(expr.base);
        return;
      default: return;
    }
  };
  for (const effect of effects) {
    if (effect.kind === "store") walkValue(effect.value);
    /* call effects are NOT value context — their args are the callee's concern */
  }
  /* Also check exprs that are NOT from call effects (standalone value expressions) */
  for (const expr of exprs) walkValue(expr);

  /* Now collect all registers mentioned in call argument positions. */
  const callArgRegs = new Set<string>();
  for (const effect of effects) {
    if (effect.kind !== "call") continue;
    for (const arg of abiArguments(effect)) {
      if (arg === null) continue;
      const walkArg = (e: SymExpr): void => {
        if (e.kind === "entry" && ARG_ORDER.includes(e.register)) callArgRegs.add(e.register);
        if (e.kind === "unary") walkArg(e.operand);
        if (e.kind === "binary") { walkArg(e.left); walkArg(e.right); }
      };
      walkArg(arg);
    }
  }

  /* A register is call-arg-only if it appears in call args but not in value context. */
  const result = new Set<string>();
  for (const reg of callArgRegs) {
    if (!valueContextRegs.has(reg)) result.add(reg);
  }
  return result;
}

export function deriveParamPlans(
  exprs: SymExpr[],
  pointerParams: Map<string, string>,
  /** Optional — effects list for distinguishing call-argument uses from value uses */
  effects?: Effect[] | undefined,
): ParamPlan[] | { invalid: string } {
  const uses = argumentUses(exprs);
  const callArgOnly = effects ? callArgOnlyRegisters(exprs, effects) : new Set<string>();
  /*
   * A pointer parameter the body also uses as a value is ordinary C — storing
   * a pointer in a field, passing it on, comparing it against null. Refusing
   * it excluded a whole family of state handlers, each of which stores its own
   * argument somewhere. The value uses are recorded instead, and `translate`
   * casts at those sites; the pointer and the integer are the same register
   * value, so the cast costs no instruction.
   *
   * A *narrowing* use is different and still refused: a parameter the body
   * sign-extends from sixteen bits is not a pointer at all, and typing it as
   * one would be a claim the machine contradicts.
   */
  const pointerValueUses = new Set<string>();
  for (const register of pointerParams.keys()) {
    const registerUses = uses.get(register);
    if (!registerUses || callArgOnly.has(register)) continue;
    const narrowing = [...registerUses].filter((use) => use !== "raw");
    if (narrowing.length > 0) {
      return { invalid: `${register} is a pointer base but the body narrows it (${narrowing.join(", ")})` };
    }
    pointerValueUses.add(register);
  }
  const used = ARG_ORDER.filter((register) => uses.has(register) || pointerParams.has(register));
  if (used.length === 0) return [{ params: [], absorbed: new Map(), label: "no-args" }];
  const last = ARG_ORDER.indexOf(used[used.length - 1]!);
  const registers = ARG_ORDER.slice(0, last + 1);

  let plans: Array<{ absorbed: Map<string, UnaryOp>; types: Map<string, string> }> = [
    { absorbed: new Map(), types: new Map() },
  ];
  for (const register of registers) {
    const pointer = pointerParams.get(register);
    if (pointer) {
      for (const plan of plans) plan.types.set(register, pointer);
      continue;
    }
    const registerUses = uses.get(register);
    const conversions = registerUses ? [...registerUses] : [];
    const single = conversions.length === 1 && conversions[0] !== "raw" ? (conversions[0] as UnaryOp) : undefined;
    if (!single) {
      for (const plan of plans) plan.types.set(register, "s32");
      continue;
    }
    const next: typeof plans = [];
    for (const plan of plans) {
      next.push({
        absorbed: new Map([...plan.absorbed, [register, single]]),
        types: new Map([...plan.types, [register, CONVERSION_TYPE[single]]]),
      });
      next.push({ absorbed: new Map(plan.absorbed), types: new Map([...plan.types, [register, "s32"]]) });
    }
    plans = next.slice(0, 16);
  }

  return plans.map((plan) => ({
    params: registers.map((register, index) => ({
      name: `arg${index}`,
      type: plan.types.get(register) ?? "s32",
      register,
    })),
    absorbed: plan.absorbed,
    ...(pointerValueUses.size > 0 ? { pointerValueUses } : {}),
    label: registers.map((register) => (plan.types.get(register) ?? "s32").replace(/[^A-Za-z0-9]+/g, "p"),).join("-"),
  }));
}

/* ---- expression translation ----------------------------------------------- */

/** Collect argument register names referenced in a SymExpr. */
function collectArgRegs(expr: SymExpr, into: Set<string>): void {
  switch (expr.kind) {
    case "entry":
      if (["a0", "a1", "a2", "a3"].includes(expr.register)) into.add(expr.register);
      return;
    case "iv":
      if (["a0", "a1", "a2", "a3"].includes(expr.register)) into.add(expr.register);
      return;
    case "load":
      if (expr.base) collectArgRegs(expr.base, into);
      if (expr.index) collectArgRegs(expr.index.expr, into);
      return;
    case "unary": return collectArgRegs(expr.operand, into);
    case "binary":
      collectArgRegs(expr.left, into);
      collectArgRegs(expr.right, into);
      return;
    case "call-result": return;
    default: return;
  }
}

/**
 * A nested subscript, spelled as byte arithmetic on the base pointer.
 *
 * `*(u16 *)((u8 *)base + i * 40 + j * 2 + 4)` says exactly what the machine
 * says: two witnessed strides and a witnessed offset, from a pointer the
 * evidence types. The alternative — declaring `struct { ...; u16 row[M]; } v[N]`
 * — would additionally assert an N and an M that no access witnesses, which is
 * the standalone-array mistake in two dimensions.
 */
function nestedAccess(
  expr: SymExpr & { kind: "load" },
  base: SymExpr,
  outerIndex: { expr: SymExpr; scale: number },
  innerIndex: { expr: SymExpr; scale: number } | undefined,
  map: StorageMap,
  plan: ParamPlan,
  temps: Map<string, string>,
): CExpr {
  const basePointer = map.basePointer?.(base);
  if (!basePointer) throw new Error(`no base pointer for the nested access at ${canon(base)}`);
  let address: CExpr = { kind: "cast", type: "u8 *", expr: basePointer };
  const addTerm = (term: CExpr): void => {
    address = { kind: "binary", op: "+", left: address, right: term };
  };
  const scaled = (subscript: { expr: SymExpr; scale: number }): CExpr => {
    /* A subscript the compiler expanded into shifts and adds is written back
     * as the multiplication it came from, and folded into the stride: the
     * source said `i * 40`, not `((i << 2) + i) * 8`. */
    const recognized = recognizeConstantMultiply(subscript.expr);
    const inner = recognized ? recognized.operand : subscript.expr;
    const factor = (recognized ? recognized.factor : 1) * subscript.scale;
    const translated = translate(inner, map, plan, temps);
    return factor === 1
      ? translated
      : { kind: "binary", op: "*", left: translated, right: int(factor) };
  };
  addTerm(scaled(outerIndex));
  if (innerIndex) addTerm(scaled(innerIndex));
  if (expr.address !== 0) addTerm(int(expr.address, true));
  const pointerType = `${elementType(expr.width, expr.signed)} *`;
  return { kind: "unaryop", op: "*", expr: { kind: "cast", type: pointerType, expr: address } };
}

/**
 * A parameter read in a value context.
 *
 * A pointer parameter the body also treats as a number is spelled with an
 * explicit cast rather than left to an implicit conversion: the cast emits no
 * instruction, and it is the difference between source that states what it is
 * doing and source that relies on the compiler not to complain.
 */
function asValue(param: { name: string; type: string; register: string }, plan: ParamPlan): CExpr {
  if (plan.pointerValueUses?.has(param.register) && param.type.trim().endsWith("*")) {
    return { kind: "cast", type: "s32", expr: id(param.name) };
  }
  return id(param.name);
}

export function translate(expr: SymExpr, map: StorageMap, plan: ParamPlan, temps: Map<string, string>): CExpr {
  /* A hoisted subexpression (D5 declared-temp axis) is one name. */
  const temp = temps.get(canon(expr));
  if (temp) return id(temp);
  switch (expr.kind) {
    case "const": {
      const value = expr.value | 0;
      return int(value, Math.abs(value) >= 16);
    }
    case "entry": {
      const param = plan.params.find((entry) => entry.register === expr.register);
      if (!param) throw new Error(`entry value of ${expr.register} reaches the result but is not a parameter`);
      return asValue(param, plan);
    }
    case "iv": {
      /* IV expressions (D7) represent the induction variable's value at the
       * start of each iteration. We translate them as the underlying entry
       * register — the loop body's pointer increments represent the advance. */
      const param = plan.params.find((entry) => entry.register === expr.register);
      if (!param) throw new Error(`entry value of ${expr.register} (iv) reaches the result but is not a parameter`);
      return asValue(param, plan);
    }
    case "load": {
      const temp = temps.get(canon({ ...expr, epoch: undefined }));
      if (temp) return id(temp);
      if (expr.outerIndex && expr.base) {
        return nestedAccess(expr, expr.base, expr.outerIndex, expr.index, map, plan, temps);
      }
      /* The index travels with the atom: it is what tells the map which of a
       * base's arrays this access walks, and dropping it made every indexed
       * read look like a plain field read at the same offset. */
      const baseAccess = map.access({
        base: expr.base, offset: expr.address, width: expr.width, signed: expr.signed,
        ...(expr.index ? { index: expr.index } : {}),
      });
      if (expr.index) {
        const idxExpr = translate(expr.index.expr, map, plan, temps);
        /* The base expression already steps to the array's own start; only
         * the remainder becomes a subscript and a field. */
        const atom: Atom = {
          base: expr.base, offset: expr.address, width: expr.width, signed: expr.signed, index: expr.index,
        };
        const covered = map.indexBaseOffset?.(atom) ?? 0;
        const remaining = expr.address - covered;
        const elemOffset = expr.index.scale > 0 ? remaining % expr.index.scale : remaining;
        const elemIndex = expr.index.scale > 0 ? Math.floor(remaining / expr.index.scale) : 0;
        if (elemOffset !== 0) {
          /* A field inside one element: base[idx + N].field */
          const adjustedIdx: CExpr = elemIndex === 0
            ? idxExpr
            : { kind: "binary", op: "+", left: idxExpr, right: int(elemIndex) };
          return {
            kind: "member",
            base: { kind: "index", base: baseAccess, index: adjustedIdx },
            field: `unk${elemOffset.toString(16).toUpperCase()}`,
            arrow: false,
          };
        }
        if (elemIndex !== 0) {
          return {
            kind: "index", base: baseAccess,
            index: { kind: "binary", op: "+", left: idxExpr, right: int(elemIndex) },
          };
        }
        return { kind: "index", base: baseAccess, index: idxExpr };
      }
      return baseAccess;
    }
    case "unary": {
      if (expr.operand.kind === "entry" && plan.absorbed.get(expr.operand.register) === expr.op) {
        return translate(expr.operand, map, plan, temps);
      }
      const inner = translate(expr.operand, map, plan, temps);
      switch (expr.op) {
        case "zext16": return { kind: "binary", op: "&", left: inner, right: int(0xffff, true) };
        case "zext8": return { kind: "binary", op: "&", left: inner, right: int(0xff, true) };
        case "sext16": return { kind: "cast", type: "s16", expr: inner };
        case "sext8": return { kind: "cast", type: "s8", expr: inner };
      }
      break;
    }
    case "binary": {
      const left = translate(expr.left, map, plan, temps);
      const right = translate(expr.right, map, plan, temps);
      switch (expr.op) {
        case "add": return { kind: "binary", op: "+", left, right };
        case "sub": return { kind: "binary", op: "-", left, right };
        case "and": return { kind: "binary", op: "&", left, right };
        case "or": return { kind: "binary", op: "|", left, right };
        case "xor": return { kind: "binary", op: "^", left, right };
        case "nor": return { kind: "unaryop", op: "~", expr: { kind: "binary", op: "|", left, right } };
        /* mul/div: D1 supports mulLo, divS, remS; mulHiS/mulHiU are untranslatable */
        case "mulLo": return { kind: "binary", op: "*", left, right };
        case "divS": return { kind: "binary", op: "/", left, right };
        case "remS": return { kind: "binary", op: "%", left, right };
        case "divU": return {
          kind: "binary", op: "/",
          left: { kind: "cast", type: "u32", expr: left },
          right: { kind: "cast", type: "u32", expr: right },
        };
        case "remU": return {
          kind: "binary", op: "%",
          left: { kind: "cast", type: "u32", expr: left },
          right: { kind: "cast", type: "u32", expr: right },
        };
        case "mulHiS": case "mulHiU": {
          /* D2: try constant-divisor recognition on the full expression. */
          const resolved = resolveDivision(expr);
          if (resolved !== expr) return translate(resolved, map, plan, temps);
          throw new Error(`mulHi is untranslatable in D1; value expression ${canon(expr)} needs constant-divisor recognition`);
        }
        case "sll": return { kind: "binary", op: "<<", left, right };
        case "sra": return { kind: "binary", op: ">>", left, right };
        case "srl": return { kind: "binary", op: ">>", left: { kind: "cast", type: "u32", expr: left }, right };
        case "sltS": return { kind: "binary", op: "<", left, right };
        case "sltU":
          /* `sltiu x, 1` is how the compiler spells `x == 0`. */
          if (expr.right.kind === "const" && expr.right.value === 1) {
            return { kind: "binary", op: "==", left, right: int(0) };
          }
          return {
            kind: "binary", op: "<",
            left: { kind: "cast", type: "u32", expr: left },
            right: { kind: "cast", type: "u32", expr: right },
          };
      }
    }
    case "call-result": {
      const key = `CR(${expr.seq},${expr.register})`;
      const temp = temps.get(key);
      if (!temp) throw new Error(`call-result CR(${expr.seq},${expr.register}) is not in the temps map — the call producing it was not captured`);
      return id(temp);
    }
  }
  throw new Error(`untranslatable expression ${canon(expr)}`);
}

/* ---- the constructor ------------------------------------------------------ */

export interface EffectCandidate {
  label: string;
  source: string;
  integrationPlan: string[];
}

export function constructEffectCandidates(
  functionName: string,
  relation: EffectRelation,
  loadsMeta: LoadMeta[],
  container: Container,
): EffectCandidate[] | { unresolved: string } | { invalid: string } {
  let isVoid = canon(relation.returnValue) === canon(ENTRY_V0);

  /* T2: resolve call signatures from the callee oracle, and collect unknown
   * ranges for named-but-undecompiled callees that the enumeration axis
   * will hypothesize over. */
  const { resolved: baseCallCaps, unknownRanges } = resolveCallSignatures(relation.effects, container);

  /* Pre-compute which call results are consumed and whether the function is
   * a void wrapper around a void callee (CR atom from jr liveness, not a
   * real return value). */
  /*
   * A call's *result* is `$v0`, and only `$v0`.
   *
   * The executor marks every caller-saved register a call clobbers with a
   * `call-result` atom, because after the call none of them holds what it held
   * before. That is the right model of the machine and the wrong thing to read
   * as consumption: the next call's `$a0` slot is full of the previous call's
   * clobber atom, so counting any `call-result` here reports the earlier call's
   * result as consumed by the later one. The consequences are not cosmetic —
   * the candidate declares a temporary and assigns a value nothing reads, and a
   * callee correctly declared `void` makes the whole hypothesis invalid,
   * refusing a function whose weaker-evidence spelling reconstructs exactly.
   */
  const consumedCalls = new Set<number>();
  const walkCR = (expr: SymExpr): void => {
    if (expr.kind === "call-result" && expr.register === "v0") consumedCalls.add(expr.seq);
  };
  const walkAll = (expr: SymExpr): void => {
    walkCR(expr);
    if (expr.kind === "unary") walkAll(expr.operand);
    else if (expr.kind === "binary") { walkAll(expr.left); walkAll(expr.right); }
    else if (expr.kind === "load") {
      /* A call result used as a *pointer base* is consumed just as surely as
       * one used as a value; not descending here left the body with no local
       * to hold the pointer it then dereferenced. */
      if (expr.base) walkAll(expr.base);
      if (expr.index) walkAll(expr.index.expr);
    }
  };
  for (const effect of relation.effects) {
    if (effect.kind === "call") {
      for (const arg of abiArguments(effect)) { if (arg) walkAll(arg); }
    } else {
      walkAll(effect.value);
    }
  }
  if (!isVoid) walkAll(relation.returnValue);

  /* T2: merge resolved sigs with each inferred combo to form per-combo caps.
   * Each combo loop builds candidates under one full hypothesis of every
   * unknown call's arity and return-value usage. */
  const sigCombos = buildInferredCombinations(unknownRanges, consumedCalls);

  /* Every accessed cell: stores, loads inside values, pointer bases,
   * and call argument values. This is shared across all combos — it does
   * not depend on call caps. */
  const atoms = new Map<string, Atom>();
  for (const effect of relation.effects) {
    if (effect.kind === "call") {
      for (const arg of abiArguments(effect)) { if (arg) collectAtoms(arg, atoms); }
    } else {
      collectAtoms(effect.value, atoms);
      if (effect.base) collectAtoms(effect.base, atoms);
    }
  }
  if (!isVoid) collectAtoms(relation.returnValue, atoms);

  const gpByCell = new Map(
    loadsMeta.filter((load) => !load.baseCanon).map((load) => [cellKey("", load.address, load.width), load.viaGp]),
  );

  const cells = new Map<string, CellUse>();
  for (const atom of atoms.values()) {
    const key = cellKey(atomGroup(atom), atom.offset, atom.width);
    const existing = cells.get(key);
    if (existing) existing.loaded = true;
    else cells.set(key, { ...atom, viaGp: gpByCell.get(key) ?? false, loaded: true, stored: false });
  }
  for (const effect of relation.effects) {
    if (effect.kind === "call") continue;
    const storeAtom: Atom = { base: effect.base, offset: effect.address, width: effect.width, signed: true, index: effect.index };
    const group = atomGroup(storeAtom);
    const key = cellKey(group, effect.address, effect.width);
    const existing = cells.get(key);
    if (existing) {
      existing.stored = true;
      if (effect.viaGp) existing.viaGp = true;
    } else {
      cells.set(key, {
        base: effect.base, offset: effect.address, width: effect.width, signed: true, index: effect.index,
        viaGp: effect.viaGp ?? false, loaded: false, stored: true,
      });
    }
    if (effect.base) collectAtoms(effect.base, atoms);
    if (effect.index) collectAtoms(effect.index.expr, atoms);
  }

  const index = loadSymbolIndex(container);
  const map = buildStorageMap(cells, index, new Map(), functionName);
  if ("unresolved" in map) return map;
  if ("invalid" in map) return map;

  const candidates: EffectCandidate[] = [];
  const refedSyms = new Set<string>();
  const errors: string[] = [];

  for (const combo of sigCombos) {
    /* Build merged caps: resolved sigs + this combo's inferred sigs. */
    const callCaps = new Map(baseCallCaps);
    for (const [seq, spec] of combo) {
      callCaps.set(seq, {
        arity: spec.arity,
        calleeName: spec.calleeName,
        returnsValue: spec.returnsValue,
        returnType: spec.returnsValue ? "s32" : "void",
        /* An inferred arity carries no declared types: the hypothesis is
         * about how many arguments there are, not what they are. */
        paramTypes: [],
        source: "abi" as CalleeSignature["source"],
      });
    }
    /* A callee whose result this function dereferences returns a pointer.
     * Declaring it `s32` and assigning that to a pointer local is an implicit
     * conversion the draft should not contain — the evidence says pointer. */
    for (const [seq] of map.callResultViews) {
      const cap = callCaps.get(seq);
      if (cap && cap.returnsValue) callCaps.set(seq, { ...cap, returnType: "void *" });
    }
    let isVoidLocal = isVoid;

    /* When the return value is a call-result from a void callee, the function
     * is a void wrapper — the CR atom is just `jr $ra`'s v0 liveness, not a
     * real value. Drop the return. */
    if (!isVoidLocal && relation.returnValue.kind === "call-result") {
      const cap = callCaps.get(relation.returnValue.seq);
      if (cap && !cap.returnsValue) isVoidLocal = true;
    }

    /* For each consumed call result, check the signature provides a return
     * type. When a void callee's CR is consumed elsewhere (not as the return
     * value), that is reading undefined garbage — skip this combo. */
    const callResultTemps = new Map<string, string>();
    let comboInvalid = false;
    for (const seq of consumedCalls) {
      const cap = callCaps.get(seq);
      if (!cap || (!cap.returnsValue && !(isVoidLocal && relation.returnValue.kind === "call-result" && relation.returnValue.seq === seq))) {
        comboInvalid = true;
        break;
      }
      if (!cap.returnsValue) continue;
      const tempName = `callRet${seq}`;
      callResultTemps.set(`CR(${seq},v0)`, tempName);
    }
    if (comboInvalid) continue;

    /* Compute exprs under this combo's arity choices. An arity whose
     * arguments the caller never established is not a hypothesis the target
     * supports; the combo is dropped rather than completed with zeros. */
    let argumentsMissing: string | undefined;
    const exprs = [...relation.effects.flatMap((effect) => {
      if (effect.kind === "call") {
        const cap = callCaps.get(effect.seq);
        if (!cap) return abiArguments(effect).filter((arg): arg is SymExpr => arg !== null);
        const selected = argumentsForArity(effect, cap.arity);
        if ("missing" in selected) {
          argumentsMissing = `${cap.calleeName} takes ${cap.arity} argument(s) but the caller never established slot(s) ${selected.missing.join(", ")}`;
          return [];
        }
        return selected.args;
      }
      return [effect.value];
    }), ...(isVoidLocal ? [] : [relation.returnValue])];
    if (argumentsMissing !== undefined) {
      errors.push(argumentsMissing);
      continue;
    }
    const plans = deriveParamPlans(exprs, map.pointerParams, relation.effects);
    if ("invalid" in plans) continue;

    /* A value that reads a cell an *earlier* assignment overwrote must read it
     * before that assignment; those pre-store reads become temporaries at the
     * top, in first-read order. Post-store re-reads (epoch atoms) read in place. */
    const overwrittenReads = new Map<string, SymExpr & { kind: "load" }>();
    const storedBefore = new Set<string>();
    const noteOverwritten = (expr: SymExpr): void => {
      const reads = new Map<string, Atom>();
      collectAtoms(expr, reads);
      for (const [key, read] of reads) {
        if (key.includes("@")) continue;
        if (storedBefore.has(cellKey(atomGroup(read), read.offset, read.width))) {
          overwrittenReads.set(key, { kind: "load", address: read.offset, width: read.width, signed: read.signed, base: read.base });
        }
      }
    };
    for (const effect of relation.effects) {
      if (effect.kind === "call") {
        storedBefore.clear();
        continue;
      }
      noteOverwritten(effect.value);
      storedBefore.add(cellKey(effect.base ? canon(effect.base) : "", effect.address, effect.width));
    }
    if (!isVoidLocal) noteOverwritten(relation.returnValue);

    /* Increment idioms (call-free only — never reach here if there are calls). */
    const lvalueOf = (storage: StorageMap, atom: Atom): CExpr => storage.access(atom);
    const incrementBodies: Array<{ label: string; body: (map: StorageMap) => CStmt[] }> = [];
    if (relation.effects.length === 1 && relation.effects[0]!.kind === "store" && !relation.effects[0]!.base) {
      const effect = relation.effects[0]!;
      const value = effect.value;
      const cellAtom: Atom = { base: effect.base, offset: effect.address, width: effect.width, signed: true };
      const readsOwnCell = (expr: SymExpr): boolean =>
        expr.kind === "load" && !expr.epoch &&
        (expr.base ? canon(expr.base) : "") === (effect.base ? canon(effect.base) : "") &&
        expr.address === effect.address && expr.width === effect.width;
      if (value.kind === "binary" && value.op === "add" && readsOwnCell(value.left) && value.right.kind === "const") {
        const delta = value.right.value | 0;
        const op: "++" | "--" | undefined = delta === 1 ? "++" : delta === -1 ? "--" : undefined;
        if (op && isVoidLocal) {
          incrementBodies.push({ label: `post${op === "++" ? "inc" : "dec"}`, body: (m) => [
            { kind: "exprstmt", expr: { kind: "postfix", op, expr: lvalueOf(m, cellAtom) } },
          ]});
        }
        if (op && !isVoidLocal && readsOwnCell(relation.returnValue)) {
          incrementBodies.push({ label: `ret-post${op === "++" ? "inc" : "dec"}`, body: (m) => [
            { kind: "return", expr: { kind: "postfix", op, expr: lvalueOf(m, cellAtom) } },
          ]});
        }
        if (op && !isVoidLocal && canon(relation.returnValue) === canon(value)) {
          incrementBodies.push({ label: `ret-pre${op === "++" ? "inc" : "dec"}`, body: (m) => [
            { kind: "return", expr: { kind: "prefix", op, expr: lvalueOf(m, cellAtom) } },
          ]});
        }
      }
    }

    for (const increment of incrementBodies) {
      for (const context of ["standalone", "umbrella"] as const) {
        const source = [
          context === "umbrella" ? `#include "common.h"` : STANDALONE_TYPEDEF_BLOCK,
          "",
          ...map.typedefs.flatMap((typedef) => [typedef, ""]),
          ...(context === "standalone" ? map.externDecls.flatMap((decl) => [decl, ""]) : []),
          ...map.tentativeDefs.flatMap((decl) => [decl, ""]),
          `${isVoidLocal ? "void" : "s32"} ${functionName}(void) {`,
          ...renderStmts(increment.body(map), "    "),
          "}",
          "",
        ].join("\n");
        candidates.push({
          label: `effects-${increment.label}-${context}`,
          source,
          integrationPlan: [...map.integration],
        });
      }
    }

    for (const plan of plans) {
      const allValueExprs = [
        ...relation.effects.filter((effect) => effect.kind === "store" && !isSpStore(effect)).map((effect) => (effect as StoreEffect).value),
        ...(isVoidLocal ? [] : [relation.returnValue]),
      ];
      const repeated: Array<{ key: string; expr: SymExpr }> = [];
      {
        const counts = new Map<string, { count: number; expr: SymExpr }>();
        const walkR = (e: SymExpr): void => {
          if (e.kind === "entry" || e.kind === "const") return;
          const key = canon(e);
          const before = counts.get(key);
          if (before) {
            before.count++;
          } else {
            if (e.kind === "load" || e.kind === "binary" || e.kind === "unary") counts.set(key, { count: 1, expr: e });
          }
          switch (e.kind) {
            case "load":
              if (e.base) walkR(e.base);
              if (e.index) walkR(e.index.expr);
              return;
            case "unary": walkR(e.operand); return;
            case "binary":
              walkR(e.left);
              walkR(e.right);
              return;
            default: return;
          }
        };
        for (const value of allValueExprs) walkR(value);
        repeated.push(...[...counts.entries()]
          .filter(([, entry]) => entry.count >= 2)
          .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
          .slice(0, 4)
          .map(([key, entry]) => ({ key, expr: entry.expr })));
      }

      const hoistSets: Array<Set<string>> = [new Set()];
      for (const sub of repeated) {
        const more = hoistSets.map((set) => new Set([...set, sub.key]));
        hoistSets.push(...more);
        if (hoistSets.length >= 16) break;
      }

      for (const hoisted of hoistSets) {
        for (const context of ["standalone", "umbrella"] as const) {
          let body: CStmt[];
          let comboLabelTag = combo.size > 0 ? [...combo.entries()].map(([s, spec]) => `c${s}a${spec.arity}r${spec.returnsValue ? 1 : 0}`).join("_") : "";
          try {
            body = [];
            const temps = new Map<string, string>();
            let tempIndex = 0;
            for (const [key, read] of overwrittenReads) {
              const name = `saved${tempIndex++}`;
              body.push({
                kind: "declare",
                type: elementType(read.width, read.signed),
                name,
                init: map.access({ base: read.base, offset: read.address, width: read.width, signed: read.signed }),
              });
              temps.set(key, name);
            }
            let hoistIndex = 0;
            for (const sub of repeated) {
              if (!hoisted.has(sub.key)) continue;
              const name = `temp${hoistIndex++}`;
              body.push({
                kind: "declare",
                type: sub.expr.kind === "load" ? elementType(sub.expr.width, sub.expr.signed) : "s32",
                name,
                init: translate(sub.expr, map, plan, temps),
              });
              temps.set(sub.key, name);
            }
            for (const [canonKey, tempName] of callResultTemps) {
              const seq = Number(canonKey.slice(3, canonKey.indexOf(",")));
              const cap = callCaps.get(seq);
              /* A result the body dereferences is a pointer to the view the
               * storage map built for it; anything else takes the callee's
               * declared return type, in a form a candidate can name. */
              const viewType = map.callResultViews.get(seq);
              const declaredType = viewType
                ?? (cap && cap.returnType !== "void" ? expressibleType(cap.returnType) ?? "s32" : "s32");
              body.push({ kind: "declare", type: declaredType, name: tempName });
              temps.set(canonKey, tempName);
            }
            for (const effect of relation.effects) {
              if (effect.kind === "call") {
                const cap = callCaps.get(effect.seq);
                const calleeName = effect.calleeName ?? effect.callee;
                /* The complete ABI list, trimmed to the resolved arity. A
                 * slot the caller never wrote fails the candidate — it is
                 * never completed with a zero it would not have passed. */
                const selected = cap
                  ? argumentsForArity(effect, cap.arity)
                  : { args: abiArguments(effect).filter((arg): arg is SymExpr => arg !== null) };
                if ("missing" in selected) {
                  throw new Error(`${calleeName} argument slot(s) ${selected.missing.join(", ")} were never established`);
                }
                const args = selected.args.map((arg, slot) => {
                  if (arg.kind === "const") {
                    const resolved = resolveAddress(index, arg.value >>> 0);
                    if (resolved && resolved.offset === 0) {
                      refedSyms.add(resolved.symbol);
                      return { kind: "cast", type: "s32", expr: { kind: "unaryop", op: "&", expr: id(resolved.symbol) } } as CExpr;
                    }
                  }
                  /* The conversion C89 requires between an integer and the
                   * pointer the callee declares; the cast names the declared
                   * type in its expressible form, as the prototype does. */
                  const declared = cap?.paramTypes?.[slot];
                  return castForParameter(
                    translate(arg, map, plan, temps),
                    declared === undefined ? undefined : (expressibleType(declared) ?? undefined),
                    pointerParamNames(plan),
                  );
                });
                const consumed = callResultTemps.get(`CR(${effect.seq},v0)`);
                if (consumed) {
                  body.push({ kind: "assign", target: id(consumed), value: { kind: "call", callee: calleeName, args } });
                } else {
                  body.push({ kind: "exprstmt", expr: { kind: "call", callee: calleeName, args } });
                }
              } else {
                if (isSpStore(effect)) continue;
                body.push({
                  kind: "assign",
                  target: map.access({ base: effect.base, offset: effect.address, width: effect.width, signed: true }),
                  value: translate(effect.value, map, plan, temps),
                });
              }
            }
            if (!isVoidLocal) {
              body.push({ kind: "return", expr: castForParameter(translate(relation.returnValue, map, plan, temps), "s32", pointerParamNames(plan)) });
            }
          } catch (error) {
            /* The message is the finding. "body construction failed" told a
             * reader nothing and made every distinct gap look like one gap. */
            errors.push(`body construction failed: ${error instanceof Error ? error.message : String(error)}`);
            continue;
          }

          const signature = `${isVoidLocal ? "void" : "s32"} ${functionName}(${
            plan.params.length === 0 ? "void" : plan.params.map((param) => `${param.type}${param.type.endsWith("*") ? "" : " "}${param.name}`).join(", ")
          })`;

          const declared = calleeDeclarations(callCaps);
          if ("invalid" in declared) {
            errors.push(declared.invalid);
            continue;
          }
          const calleeDecls = declared;

          const source = [
            context === "umbrella" ? `#include "common.h"` : STANDALONE_TYPEDEF_BLOCK,
            "",
            ...map.typedefs.flatMap((typedef) => [typedef, ""]),
            ...(context === "standalone" ? map.externDecls.flatMap((decl) => [decl, ""]) : []),
            ...map.tentativeDefs.flatMap((decl) => [decl, ""]),
            ...calleeDecls.flatMap((decl) => [decl, ""]),
            ...[...refedSyms].sort()
              .filter((symbol) => !map.externDecls.some((decl) => decl.includes(symbol)))
              .map((symbol) => `extern u8 ${symbol}[];`)
              .flatMap((decl) => [decl, ""]),
            `${signature} {`,
            ...renderStmts(body, "    "),
            "}",
            "",
          ].join("\n");

          candidates.push({
            label: `effects-${plan.label || "noargs"}${comboLabelTag ? `-${comboLabelTag}` : ""}-${context}`,
            source,
            integrationPlan: [...map.integration],
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    /* Report dominant error instead of generic refusal. */
    const counts = new Map<string, number>();
    for (const err of errors) {
      const base = err.slice(0, 80);
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const detail = dominant ? `dominant error (${dominant[1]}/${errors.length}): ${dominant[0]}` : "all axis combinations failed";
    return { invalid: `no parameter plan could express the relation's values: ${detail}` };
  }
  return candidates;
}

/* ---- guarded effects ------------------------------------------------------ */

import { DagArena } from "./exec.js";
import type { DagNode, DagRef, Predicate } from "./types.js";

/**
 * Constructors for bounded guarded effects: a decision tree whose leaves carry
 * store sequences and return values — branchy setters, flag tests, and pure
 * comparators. Effects shared by every path below a test are, by path
 * semantics, that subtree's common prefix; they are emitted before the `if`,
 * and each arm continues from there. Reads of cells an earlier assignment on
 * the same path overwrote are refused rather than reordered.
 */
export function constructGuardedCandidates(
  functionName: string,
  arena: DagArena,
  root: DagRef,
  loadsMeta: LoadMeta[],
  container: Container,
  maskWitnesses: Set<string> = new Set(),
): EffectCandidate[] | { unresolved: string } | { invalid: string } {
  /* Bound the structure: tests + dispatches ≤ 32, leaves ≤ 16, total targets ≤ 64. */
  const testRefs = new Set<DagRef>();
  const dispatchRefs = new Set<DagRef>();
  const leafRefs = new Set<DagRef>();
  const loopRefs = new Set<DagRef>();
  let totalTargets = 0;

  /* D7: loop nodes — the body DAG may contain continue marker leaves whose
   * canon is "@__continue". They are not real leaves and must be excluded
   * from the leaf count and effect collection. */
  const isContinue = (ref: DagRef): boolean => {
    if (ref < 0 || ref >= arena.nodes.length) return false;
    const node = arena.node(ref);
    return node.kind === "leaf" && canon(node.value) === "@__continue";
  };

  const walk = (ref: DagRef): void => {
    const node = arena.node(ref);
    if (node.kind === "leaf") {
      if (!isContinue(ref)) leafRefs.add(ref);
      return;
    }
    if (node.kind === "loop") {
      if (loopRefs.has(ref)) return;
      loopRefs.add(ref);
      /* The body is an ordinary sub-DAG: its tests and leaves take part in
       * atom, parameter, and effect collection like any others — only the
       * continue markers are structural. */
      walk(node.body);
      return;
    }
    if (testRefs.has(ref) || dispatchRefs.has(ref)) return;
    if (node.kind === "dispatch") {
      dispatchRefs.add(ref);
      totalTargets += node.targets.length;
      for (const target of node.targets) walk(target);
      return;
    }
    testRefs.add(ref);
    walk(node.onTrue);
    walk(node.onFalse);
  };
  walk(root);
  if (testRefs.size + dispatchRefs.size > 32 || leafRefs.size > 16 || totalTargets > 64 || loopRefs.size > 4) {
    return { invalid: `structure too large for the guarded class (${testRefs.size} tests, ${dispatchRefs.size} dispatches, ${leafRefs.size} leaves, ${totalTargets} targets, ${loopRefs.size} loops)` };
  }

  /* Induction advances, by register — the loop step clause the constructor
   * must realize. Conflicting deltas for one register are out of class. */
  const ivDeltas = new Map<string, number>();
  for (const ref of loopRefs) {
    const node = arena.node(ref) as DagNode & { kind: "loop" };
    for (const { register, delta } of node.induction) {
      const existing = ivDeltas.get(register);
      if (existing !== undefined && existing !== delta) {
        return { invalid: `induction register ${register} advances by both ${existing} and ${delta}` };
      }
      ivDeltas.set(register, delta);
    }
  }

  const leaves = [...leafRefs].map((ref) => arena.node(ref) as DagNode & { kind: "leaf" });
  const voidLeaves = leaves.filter((leaf) => canon(leaf.value) === canon(ENTRY_V0)).length;
  if (voidLeaves > 0 && voidLeaves < leaves.length) {
    return { invalid: "some paths return a value and some leave it unset" };
  }
  const isVoid = voidLeaves === leaves.length;

  /* Stack spills and locals are calling convention, not source: keep a
   * filtered effect list per leaf for every construction step below. */
  const sourceEffects = new Map<DagRef, Effect[]>();
  for (const ref of leafRefs) {
    const node = arena.node(ref) as DagNode & { kind: "leaf" };
    sourceEffects.set(ref, node.effects.filter((effect) => !(effect.kind === "store" && isSpStore(effect))));
  }

  /* Cells and argument uses across every predicate, value, and store. */
  const atoms = new Map<string, Atom>();
  const exprs: SymExpr[] = [];
  for (const leaf of leaves) {
    if (!isVoid) {
      exprs.push(leaf.value);
      collectAtoms(leaf.value, atoms);
    }
  }
  for (const ref of leafRefs) {
    for (const effect of sourceEffects.get(ref) ?? []) {
      if (effect.kind === "call") {
        for (const arg of abiArguments(effect)) {
          if (!arg) continue;
          exprs.push(arg);
          collectAtoms(arg, atoms);
        }
      } else {
        exprs.push(effect.value);
        collectAtoms(effect.value, atoms);
        if (effect.base) collectAtoms(effect.base, atoms);
      }
    }
  }
  for (const ref of testRefs) {
    const node = arena.node(ref) as DagNode & { kind: "test" };
    collectAtoms(node.pred.left, atoms);
    exprs.push(node.pred.left);
    if (node.pred.right) {
      collectAtoms(node.pred.right, atoms);
      exprs.push(node.pred.right);
    }
  }
  for (const ref of dispatchRefs) {
    const node = arena.node(ref) as DagNode & { kind: "dispatch" };
    collectAtoms(node.index, atoms);
    exprs.push(node.index);
  }

  const gpByCell = new Map(
    loadsMeta.filter((load) => !load.baseCanon).map((load) => [cellKey("", load.address, load.width), load.viaGp]),
  );
  const cells = new Map<string, CellUse>();
  for (const atom of atoms.values()) {
    const key = cellKey(atomGroup(atom), atom.offset, atom.width);
    const existing = cells.get(key);
    if (existing) existing.loaded = true;
    else cells.set(key, { ...atom, viaGp: gpByCell.get(key) ?? false, loaded: true, stored: false });
  }
  for (const ref of leafRefs) {
    for (const effect of sourceEffects.get(ref) ?? []) {
      if (effect.kind === "call") continue;
      const key = cellKey(effect.base ? canon(effect.base) : "", effect.address, effect.width);
      const existing = cells.get(key);
      if (existing) {
        existing.stored = true;
        if (effect.viaGp) existing.viaGp = true;
      } else {
        cells.set(key, {
          base: effect.base, offset: effect.address, width: effect.width, signed: true,
          viaGp: effect.viaGp ?? false, loaded: false, stored: true,
        });
      }
      if (effect.base) collectAtoms(effect.base, atoms);
      if (effect.index) collectAtoms(effect.index.expr, atoms);
    }
  }

  const index = loadSymbolIndex(container);
  const map = buildStorageMap(cells, index, ivDeltas, functionName);
  if ("unresolved" in map) return map;
  if ("invalid" in map) return map;

  /* Collect the flat effect list for pointer-compatible call-arg detection. */
  const allEffects: Effect[] = [];
  for (const ref of leafRefs) {
    for (const effect of sourceEffects.get(ref) ?? []) allEffects.push(effect);
  }
  /* Also include predicate values since they use registers as value context */
  const plans = deriveParamPlans(exprs, map.pointerParams, allEffects);
  if ("invalid" in plans) return plans;

  const effectKey = (effect: Effect): string =>
    effect.kind === "call"
      ? `call(${effect.seq},${effect.callee})`
      : `${effect.base ? canon(effect.base) : ""}|${effect.address}|${effect.width}=${canon(effect.value)}`;

  const leavesBelowMemo = new Map<DagRef, DagRef[]>();
  const leavesBelow = (ref: DagRef): DagRef[] => {
    const known = leavesBelowMemo.get(ref);
    if (known) return known;
    const node = arena.node(ref);
    const result = node.kind === "leaf"
      ? (isContinue(ref) ? [] : [ref])
      : node.kind === "dispatch"
        ? node.targets.flatMap((target) => leavesBelow(target))
        : node.kind === "loop"
          ? leavesBelow(node.body)
          : [...leavesBelow(node.onTrue), ...leavesBelow(node.onFalse)];
    leavesBelowMemo.set(ref, result);
    return result;
  };

  /** Filtered effects for below a ref, using the sp-filtered sourceEffects. */
  const effectsBelow = (ref: DagRef): Effect[] => {
    const below = leavesBelow(ref);
    /* Return effects of the first leaf (others should match for common prefix). */
    const firstLeafRef = below[0];
    if (firstLeafRef === undefined) return [];
    return sourceEffects.get(firstLeafRef) ?? [];
  };

  class InvalidGuard extends Error {}

  const predToC = (
    pred: Predicate,
    plan: ParamPlan,
    temps: Map<string, string>,
    pairRaw?: Map<string, string>,
    negate = false,
  ): CExpr => {
    /* A pair atom compared against a constant is the sentinel test — the
     * machine tested the wide copy there, not the re-masked one. */
    let left: CExpr;
    if (
      pairRaw && pred.left.kind === "load" && pred.right?.kind === "const" &&
      pairRaw.has(canon({ ...pred.left, epoch: undefined }))
    ) {
      left = id(pairRaw.get(canon({ ...pred.left, epoch: undefined }))!);
    } else {
      left = translate(pred.left, map, plan, temps);
    }
    const right = pred.right ? translate(pred.right, map, plan, temps) : undefined;
    switch (pred.op) {
      case "eq": return { kind: "binary", op: negate ? "!=" : "==", left, right: right! };
      case "ltS": return { kind: "binary", op: negate ? ">=" : "<", left, right: right! };
      case "ltU": return {
        kind: "binary", op: negate ? ">=" : "<",
        left: { kind: "cast", type: "u32", expr: left },
        right: { kind: "cast", type: "u32", expr: right! },
      };
      case "lez": return { kind: "binary", op: negate ? ">" : "<=", left, right: int(0) };
      case "gtz": return { kind: "binary", op: negate ? "<=" : ">", left, right: int(0) };
      case "ltz": return { kind: "binary", op: negate ? ">=" : "<", left, right: int(0) };
      case "gez": return { kind: "binary", op: negate ? "<" : ">=", left, right: int(0) };
    }
  };

  /* Everything a DAG node can reach, itself included — for join detection. */
  const reachMemo = new Map<DagRef, Set<DagRef>>();
  const reach = (ref: DagRef): Set<DagRef> => {
    const known = reachMemo.get(ref);
    if (known) return known;
    const set = new Set<DagRef>([ref]);
    reachMemo.set(ref, set);
    const node = arena.node(ref);
    if (node.kind === "test") {
      for (const child of [node.onTrue, node.onFalse]) for (const r of reach(child)) set.add(r);
    } else if (node.kind === "dispatch") {
      for (const child of node.targets) for (const r of reach(child)) set.add(r);
    } else if (node.kind === "loop") {
      for (const r of reach(node.body)) set.add(r);
    }
    return set;
  };

  /**
   * The join of two arms: the shared node every shared path funnels through.
   * The machine reached it once (a shared block or a cross-jumped tail);
   * duplicating it per arm compiles to duplicated code the original does not
   * have, so emission falls through to it and emits it exactly once.
   */
  const joinOf = (onTrue: DagRef, onFalse: DagRef): DagRef | undefined => {
    const reachTrue = reach(onTrue);
    const reachFalse = reach(onFalse);
    if (reachFalse.has(onTrue)) return onTrue;
    if (reachTrue.has(onFalse)) return onFalse;
    const shared = [...reachTrue].filter((r) => reachFalse.has(r) && !isContinue(r));
    for (const candidate of shared) {
      const covered = reach(candidate);
      if (shared.every((r) => covered.has(r))) return candidate;
    }
    return undefined;
  };

  /* Loop-bearing structures admit two extra source-form axes the machine
   * evidence names: a result-variable-and-break exit (every outcome flows
   * through one register the exits share), and a wide/narrow variable pair
   * for a load the machine re-masked (the sentinel tests the wide copy). */
  const atomCanonKey = (atom: Atom): string => canon({
    kind: "load", address: atom.offset, width: atom.width, signed: atom.signed,
    base: atom.base, index: atom.index,
  });
  const witnessedPairs = [...atoms.values()]
    .filter((atom) => maskWitnesses.has(atomCanonKey(atom)) && !atom.signed && atom.width <= 2)
    .slice(0, 2)
    .map((atom) => [atomCanonKey(atom), atom] as const);
  const exitStyles: Array<"direct" | "break-result"> =
    loopRefs.size > 0 && !isVoid ? ["direct", "break-result"] : ["direct"];
  /* A shared return value read from a cell the branches overwrite must be
   * computed once, before the stores. When every real leaf returns the same
   * value and that value reads a stored cell, offer a "hoisted" form:
   * `result = <value>;` at the top, stores in the branches, `return result;`
   * once at the bottom — the compiler's own single-computation shape. */
  const realLeaves = leaves.filter((leaf) => canon(leaf.value) !== "@__continue");
  const sharedReturnValue = !isVoid && realLeaves.length > 1 &&
    realLeaves.every((leaf) => canon(leaf.value) === canon(realLeaves[0]!.value))
    ? realLeaves[0]!.value : undefined;
  const returnReadsStoredCell = (() => {
    if (!sharedReturnValue) return false;
    const reads = new Map<string, Atom>();
    collectAtoms(sharedReturnValue, reads);
    for (const read of reads.values()) {
      const cell = cells.get(cellKey(atomGroup(read), read.offset, read.width));
      if (cell?.stored) return true;
    }
    return false;
  })();
  const returnStyles: Array<"inline" | "hoisted"> =
    loopRefs.size === 0 && sharedReturnValue && returnReadsStoredCell ? ["inline", "hoisted"] : ["inline"];
  const pairStyles: Array<"plain" | "raw-pair"> =
    loopRefs.size > 0 && witnessedPairs.length > 0 ? ["plain", "raw-pair"] : ["plain"];
  /* Where the advances go decides which way cc1 rotates the loop: a step
   * clause tends to keep the exit test at the bottom, trailing statements
   * after an in-body exit test reproduce the check-then-advance top block. */
  const advanceStyles: Array<"step" | "trailing"> = loopRefs.size > 0 ? ["step", "trailing"] : ["step"];

  const candidates: EffectCandidate[] = [];
  const errors: string[] = [];
  for (const plan of plans) {
    for (const context of ["standalone", "umbrella"] as const) {
    for (const exitStyle of exitStyles) {
    for (const pairStyle of pairStyles) {
    for (const advanceStyle of advanceStyles) {
    for (const returnStyle of returnStyles) {
      const temps = new Map<string, string>();
      const hoistReturn = returnStyle === "hoisted";
      /* Canonical atom key → the wide variable's name, for sentinel tests. */
      const pairRaw = new Map<string, string>();
      const prologue: CStmt[] = [];
      const pairAssigns: CStmt[] = [];
      let usesResult = false;
      if (pairStyle === "raw-pair") {
        witnessedPairs.forEach(([key, atom], indexOfPair) => {
          const rawName = `raw${indexOfPair}`;
          const narrowName = `masked${indexOfPair}`;
          prologue.push({ kind: "declare", type: "s32", name: rawName });
          prologue.push({ kind: "declare", type: atom.width === 1 ? "u8" : "u16", name: narrowName });
          pairRaw.set(key, rawName);
          temps.set(key, narrowName);
          pairAssigns.push({ kind: "assign", target: id(rawName), value: map.access(atom) });
          pairAssigns.push({ kind: "assign", target: id(narrowName), value: id(rawName) });
        });
      }

      const guardReads = (expr: SymExpr, stored: Set<string>): void => {
        const reads = new Map<string, Atom>();
        collectAtoms(expr, reads);
        for (const [key, read] of reads) {
          if (key.includes("@")) continue; /* epoch re-read: reads the updated cell on purpose */
          if (stored.has(cellKey(atomGroup(read), read.offset, read.width))) {
            throw new InvalidGuard("a value reads a cell an earlier assignment on its path overwrote");
          }
        }
      };

      const emitNode = (ref: DagRef, emitted: number, stored: Set<string>, inLoop = false, stopAt?: DagRef): CStmt[] => {
        /* The join a factored if/else falls through to: emit nothing here —
         * the caller emits it once after the branch. */
        if (stopAt !== undefined && ref === stopAt) return [];
        /* A continue marker ends a loop-body path; the for step applies the
         * induction advances on the way back. */
        if (isContinue(ref)) return [{ kind: "continue" }];
        const node = arena.node(ref);
        const assignments = (effects: Effect[]): CStmt[] =>
          effects.map((effect) => {
            if (effect.kind === "call") {
              const captured = abiArguments(effect);
              if (captured.some((arg) => arg === null)) {
                throw new Error(`${effect.callee} has an argument slot the caller never established`);
              }
              const args = (captured as SymExpr[]).map((a) => translate(a, map, plan, temps));
              return { kind: "exprstmt", expr: { kind: "call", callee: effect.callee, args } } as CStmt;
            }
            /* A store whose value is the hoisted shared return reuses the
             * `result` temp, matching the compiler's single computation. */
            const value = hoistReturn && sharedReturnValue && canon(effect.value) === canon(sharedReturnValue)
              ? id("result")
              : (guardReads(effect.value, stored), translate(effect.value, map, plan, temps));
            stored.add(cellKey(effect.base ? canon(effect.base) : "", effect.address, effect.width));
            return {
              kind: "assign",
              target: map.access({ base: effect.base, offset: effect.address, width: effect.width, signed: true }),
              value,
            } as CStmt;
          });

        if (node.kind === "loop") {
          /* One statement: `for (;; steps) { body }`. Exit paths return from
           * inside; every continue path applies the advances exactly once via
           * the step clause — the position the machine's rotated tail gave
           * them. A missing step mapping (a pure counter induction) is a
           * missing constructor, not something to guess. */
          const steps: string[] = [];
          for (const { register, delta } of node.induction) {
            const step = map.pointerSteps.get(register);
            if (!step) {
              throw new InvalidGuard(
                `loop induction ${register} (delta ${delta}) has no pointer step — the counted-loop template is not built`,
              );
            }
            steps.push(step);
          }
          /* Start rendering body effects from the entry effect boundary,
           * skipping pre-loop effects (D1: counted loops with body stores). */
          const inner = emitNode(node.body, node.entryEffectCount, new Set(stored), true);
          if (advanceStyle === "trailing") {
            /* Trailing advances run only on the fall-through path; a body
             * that still contains an explicit `continue` would skip them. */
            const hasContinue = (stmts: CStmt[]): boolean => stmts.some((stmt) =>
              stmt.kind === "continue" ||
              (stmt.kind === "if" && (hasContinue(stmt.body) || hasContinue(stmt.elseBody ?? []))) ||
              ((stmt.kind === "for" || stmt.kind === "while") && hasContinue(stmt.body)) ||
              (stmt.kind === "switch" && (stmt.cases.some((entry) => hasContinue(entry.body)) || hasContinue(stmt.defaultBody ?? []))));
            if (hasContinue(inner)) {
              throw new InvalidGuard("trailing advances need a fall-through body, but the body continues explicitly");
            }
            const advances: CStmt[] = steps.map((step) => {
              const match = step.match(/^(\w+)(\+\+|--)$/);
              if (match) return { kind: "exprstmt", expr: { kind: "postfix", op: match[2] as "++" | "--", expr: id(match[1]!) } };
              const compound = step.match(/^(\w+) ([+-])= (\d+)$/);
              if (!compound) throw new InvalidGuard(`unrenderable trailing advance ${step}`);
              return {
                kind: "assign",
                target: id(compound[1]!),
                value: { kind: "binary", op: compound[2] as "+" | "-", left: id(compound[1]!), right: int(Number(compound[3])) },
              };
            });
            return [{ kind: "for", init: "", step: "", body: [...pairAssigns, ...inner, ...advances] }];
          }
          return [{ kind: "for", init: "", step: steps.join(", "), body: [...pairAssigns, ...inner] }];
        }

        if (node.kind === "leaf") {
          const effs = sourceEffects.get(ref) ?? [];
          const statements = assignments(effs.slice(emitted));
          if (!isVoid) {
            if (hoistReturn) {
              /* The return was computed into `result` before the stores; the
               * leaf contributes its stores only, and one `return result`
               * is appended after the whole structure. */
            } else {
              guardReads(node.value, stored);
              const value = translate(node.value, map, plan, temps);
              if (inLoop && exitStyle === "break-result") {
                usesResult = true;
                statements.push({ kind: "assign", target: id("result"), value });
                statements.push({ kind: "break" });
              } else {
                statements.push({ kind: "return", expr: value });
              }
            }
          }
          return statements;
        }

        if (node.kind === "dispatch") {
          /* Translate the dispatch index. */
          let switchExpr = translate(node.index, map, plan, temps);
          let baseCase = 0;
          /* Handle `add(x, #-k)` adjustment — source cases started at k. */
          if (node.index.kind === "binary" && node.index.op === "add") {
            if (node.index.right.kind === "const" && (node.index.right.value | 0) < 0) {
              switchExpr = translate(node.index.left, map, plan, temps);
              baseCase = -(node.index.right.value | 0);
            } else if (node.index.left.kind === "const" && (node.index.left.value | 0) < 0) {
              switchExpr = translate(node.index.right, map, plan, temps);
              baseCase = -(node.index.left.value | 0);
            }
          }

          const cases: Array<{ values: CExpr[]; body: CStmt[] }> = [];
          for (let i = 0; i < node.targets.length; i++) {
            const targetBody = emitNode(node.targets[i]!, 0, new Set(stored), inLoop, stopAt);
            cases.push({ values: [int(baseCase + i)], body: targetBody });
          }
          return [{ kind: "switch", expr: switchExpr, cases }];
        }


        /* node.kind === "test" */
        /* Detect a switch-merge shape: a bounds check whose guarded arm is the
         * dispatch and whose other arm is the default. Two machine spellings:
         *   Form 1: ltU(idx,#N) with dispatch on the true arm
         *   Form 2: eq(sltU(idx,#N),#0) OR eq(#0,sltU(idx,#N)) with dispatch
         *           on the false arm (the compiler's sltiu+beqz pattern)
         * After the merge, the C is one `switch` with a `default`, matching
         * what the original switch statement compiled to. */
        const dispatchMerge = (() => {
          const pred = node.pred;
          if ((pred.op === "ltU" || pred.op === "ltS") && pred.right && pred.right.kind === "const") {
            const N = pred.right.value;
            const trueNode = arena.node(node.onTrue);
            if (trueNode.kind === "dispatch" && trueNode.targets.length === N && canon(pred.left) === canon(trueNode.index)) {
              return { index: trueNode.index, cases: trueNode.targets, defaultRef: node.onFalse };
            }
          }
          /* Form 2: eq(sltU(idx,#N), #0) — but canon may swap to eq(#0, sltU(idx,#N)).
           * Handle both orderings. */
          const findSlt = (e: SymExpr): { idx: SymExpr; N: number } | undefined => {
            if (e.kind === "binary" && (e.op === "sltU" || e.op === "sltS") && e.right.kind === "const") {
              return { idx: e.left, N: e.right.value };
            }
            return undefined;
          };
          let inner: ReturnType<typeof findSlt> | undefined;
          if (pred.op === "eq" && pred.right && pred.right.kind === "const" && pred.right.value === 0) {
            inner = findSlt(pred.left);
          } else if (pred.op === "eq" && pred.left.kind === "const" && pred.left.value === 0 && pred.right) {
            inner = findSlt(pred.right);
          }
          if (inner) {
            const falseNode = arena.node(node.onFalse);
            if (falseNode.kind === "dispatch" && falseNode.targets.length === inner.N && canon(inner.idx) === canon(falseNode.index)) {
              return { index: falseNode.index, cases: falseNode.targets, defaultRef: node.onTrue };
            }
          }
          return undefined;
        })();
        if (dispatchMerge) {
          let switchExpr = translate(dispatchMerge.index, map, plan, temps);
          let baseCase = 0;
          if (dispatchMerge.index.kind === "binary" && dispatchMerge.index.op === "add") {
            const term = dispatchMerge.index.right.kind === "const" && (dispatchMerge.index.right.value | 0) < 0
              ? dispatchMerge.index.right.value
              : dispatchMerge.index.left.kind === "const" && (dispatchMerge.index.left.value | 0) < 0
                ? dispatchMerge.index.left.value
                : undefined;
            if (term !== undefined) {
              switchExpr = translate(
                dispatchMerge.index.right.kind === "const" ? dispatchMerge.index.left : dispatchMerge.index.right,
                map, plan, temps,
              );
              baseCase = -term;
            }
          }
          const cases: Array<{ values: CExpr[]; body: CStmt[] }> = [];
          for (let i = 0; i < dispatchMerge.cases.length; i++) {
            const targetBody = emitNode(dispatchMerge.cases[i]!, 0, new Set(stored), inLoop, stopAt);
            cases.push({ values: [int(baseCase + i)], body: targetBody });
          }
          const defaultBody = emitNode(dispatchMerge.defaultRef, 0, new Set(stored), inLoop, stopAt);
          return [{ kind: "switch", expr: switchExpr, cases, ...(defaultBody.length > 0 ? { defaultBody } : {}) }];
        }

        const below = leavesBelow(ref);
        const referenceRef = below[0];
        if (referenceRef === undefined) return [];
        const reference = sourceEffects.get(referenceRef) ?? [];
        let common = emitted;
        while (common < reference.length &&
          below.every((leafRef) => {
            const effs = sourceEffects.get(leafRef);
            return effs && common < effs.length && effectKey(effs[common]!) === effectKey(reference[common]!);
          })) {
          common++;
        }
        const statements = assignments(reference.slice(emitted, common));
        guardReads(node.pred.left, stored);
        if (node.pred.right) guardReads(node.pred.right, stored);

        /* Break-result idioms the machine spells exactly (assignments landing
         * in shared delay slots, two constants falling into one exit):
         *   - exit-or-continue: `result = K; if (P) break;` — the assignment
         *     is dead on the continue path, which is where the machine put it;
         *   - constant pair: `if (P) result = A; else result = B; break;`. */
        if (inLoop && exitStyle === "break-result" && !isVoid) {
          const constLeaf = (ref: DagRef): number | undefined => {
            const child = arena.node(ref);
            if (child.kind !== "leaf" || isContinue(ref)) return undefined;
            if (child.value.kind !== "const") return undefined;
            const effs = sourceEffects.get(ref) ?? [];
            if (effs.length !== emitted) return undefined;
            return child.value.value | 0;
          };
          const trueConst = constLeaf(node.onTrue);
          const falseConst = constLeaf(node.onFalse);
          if (trueConst !== undefined && isContinue(node.onFalse)) {
            usesResult = true;
            statements.push({ kind: "assign", target: id("result"), value: int(trueConst) });
            statements.push({ kind: "if", cond: predToC(node.pred, plan, temps, pairRaw), body: [{ kind: "break" }] });
            return statements;
          }
          if (falseConst !== undefined && isContinue(node.onTrue)) {
            usesResult = true;
            statements.push({ kind: "assign", target: id("result"), value: int(falseConst) });
            statements.push({ kind: "if", cond: predToC(node.pred, plan, temps, pairRaw, true), body: [{ kind: "break" }] });
            return statements;
          }
          if (trueConst !== undefined && falseConst !== undefined) {
            usesResult = true;
            statements.push({
              kind: "if",
              cond: predToC(node.pred, plan, temps, pairRaw),
              body: [{ kind: "assign", target: id("result"), value: int(trueConst) }],
              elseBody: [{ kind: "assign", target: id("result"), value: int(falseConst) }],
            });
            statements.push({ kind: "break" });
            return statements;
          }
        }

        /* Shared continuation: emit the arms only up to their join, then the
         * join once. An arm that IS the join contributes no block at all —
         * the branch is emitted negated with a single body. */
        const join = joinOf(node.onTrue, node.onFalse);
        if (join !== undefined && join !== stopAt) {
          if (join === node.onTrue) {
            const elseArm = emitNode(node.onFalse, common, new Set(stored), inLoop, join);
            if (elseArm.length > 0) {
              statements.push({ kind: "if", cond: predToC(node.pred, plan, temps, pairRaw, true), body: elseArm });
            }
          } else if (join === node.onFalse) {
            const thenArm = emitNode(node.onTrue, common, new Set(stored), inLoop, join);
            if (thenArm.length > 0) {
              statements.push({ kind: "if", cond: predToC(node.pred, plan, temps, pairRaw), body: thenArm });
            }
          } else {
            const thenArm = emitNode(node.onTrue, common, new Set(stored), inLoop, join);
            const elseArm = emitNode(node.onFalse, common, new Set(stored), inLoop, join);
            statements.push({
              kind: "if",
              cond: predToC(node.pred, plan, temps, pairRaw),
              body: thenArm,
              ...(elseArm.length > 0 ? { elseBody: elseArm } : {}),
            });
          }
          statements.push(...emitNode(join, common, new Set(stored), inLoop, stopAt));
          return statements;
        }

        const thenStmts = emitNode(node.onTrue, common, new Set(stored), inLoop, stopAt);
        const elseStmts = emitNode(node.onFalse, common, new Set(stored), inLoop, stopAt);
        if (thenStmts.length === 0 && elseStmts.length > 0) {
          /* An empty then-arm is a negated single-arm test — the polarity the
           * machine branches with. */
          statements.push({ kind: "if", cond: predToC(node.pred, plan, temps, pairRaw, true), body: elseStmts });
          return statements;
        }
        statements.push({
          kind: "if",
          cond: predToC(node.pred, plan, temps, pairRaw),
          body: thenStmts,
          ...(elseStmts.length > 0 ? { elseBody: elseStmts } : {}),
        });
        return statements;
      };

      let body: CStmt[];
      let resultAssign: CStmt | undefined;
      try {
        /* The hoisted return is computed from the pre-store field values, so
         * it must be built before emitNode marks any cell stored. */
        if (hoistReturn && sharedReturnValue) {
          resultAssign = { kind: "assign", target: id("result"), value: translate(sharedReturnValue, map, plan, temps) };
        }
        body = emitNode(root, 0, new Set());
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        continue;
      }
      if (hoistReturn && resultAssign) {
        body = [{ kind: "declare", type: "s32", name: "result" }, ...prologue, resultAssign, ...body, { kind: "return", expr: id("result") }];
      } else if (usesResult) {
        body = [{ kind: "declare", type: "s32", name: "result" }, ...prologue, ...body, { kind: "return", expr: id("result") }];
      } else if (prologue.length > 0) {
        body = [...prologue, ...body];
      }
      /* An axis that changed nothing about this structure adds no candidate. */
      if (exitStyle === "break-result" && !usesResult) continue;
      if (pairStyle === "raw-pair" && pairAssigns.length === 0) continue;

      const signature = `${isVoid ? "void" : "s32"} ${functionName}(${
        plan.params.length === 0 ? "void" : plan.params.map((param) => `${param.type}${param.type.endsWith("*") ? "" : " "}${param.name}`).join(", ")
      })`;

      const source = [
        context === "umbrella" ? `#include "common.h"` : STANDALONE_TYPEDEF_BLOCK,
        "",
        ...map.typedefs.flatMap((typedef) => [typedef, ""]),
        ...(context === "standalone" ? map.externDecls.flatMap((decl) => [decl, ""]) : []),
        ...map.tentativeDefs.flatMap((decl) => [decl, ""]),
        `${signature} {`,
        ...renderStmts(body, "    "),
        "}",
        "",
      ].join("\n");

      candidates.push({
        label: `guarded-${plan.label || "noargs"}${exitStyle === "break-result" ? "-breakres" : ""}${pairStyle === "raw-pair" ? "-rawpair" : ""}${advanceStyle === "trailing" ? "-trailadv" : ""}${hoistReturn ? "-hoistret" : ""}-${context}`,
        source,
        integrationPlan: [
          ...map.integration,
          "write the function body into its container's source directory with the project umbrella includes",
        ],
      });
    }
    }
    }
    }
    }
  }
  if (candidates.length === 0) {
    /* Report dominant error instead of generic refusal. */
    const counts = new Map<string, number>();
    for (const err of errors) {
      const base = err.slice(0, 80);
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const detail = dominant ? `dominant error (${dominant[1]}/${errors.length}): ${dominant[0]}` : "all axis combinations failed";
    return { invalid: `no parameter plan could express the guarded structure: ${detail}` };
  }
  return candidates;
}
