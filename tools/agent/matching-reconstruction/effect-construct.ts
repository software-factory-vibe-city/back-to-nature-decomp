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
import { recognizeDivision } from "./idioms.js";
import {
  type CExpr,
  type CStmt,
  STANDALONE_TYPEDEF_BLOCK,
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
  /* No stores and no returned value is still a relation: the empty function. */
  const sourceEffects = effects.filter((effect) => effect.kind !== "call" && !isSpStore(effect)) as StoreEffect[];
  return {
    kind: "straight-line-effects",
    effects: sourceEffects,
    returnValue: leafValue,
    evidence: [`${sourceEffects.length} store(s) in machine order; return ${canon(leafValue)}`],
  };
}

/* ---- cell collection ------------------------------------------------------ */

interface Atom {
  base?: SymExpr | undefined;
  offset: number;
  width: 1 | 2 | 4;
  signed: boolean;
  /** Scaled index for array-style addressing (D3). */
  index?: { expr: SymExpr; scale: number } | undefined;
}

const atomGroup = (atom: Atom): string => {
  if (atom.base) {
    const base = canon(atom.base);
    if (atom.index) return `${base}[${canon(atom.index.expr)}*${atom.index.scale}]`;
    return base;
  }
  return "";
};
const cellKey = (group: string, offset: number, width: number): string => `${group}|${offset}|${width}`;

/** Every load atom in an expression, including the atoms inside pointer bases and indexes. */
function collectAtoms(expr: SymExpr, into: Map<string, Atom>): void {
  switch (expr.kind) {
    case "load": {
      const atom: Atom = { base: expr.base, offset: expr.address, width: expr.width, signed: expr.signed, index: expr.index };
      into.set(`${atomGroup(atom)}|${atom.offset}|${atom.width}|${atom.index ? canon(atom.index.expr) : ""}`, atom);
      if (expr.base) collectAtoms(expr.base, into);
      if (expr.index) collectAtoms(expr.index.expr, into);
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

interface CellUse extends Atom {
  viaGp: boolean;
  loaded: boolean;
  stored: boolean;
  /** Set when a symbolic group's base reads this cell: its C type is a pointer. */
  pointeeView?: string | undefined;
}

/* ---- storage mapping ------------------------------------------------------ */

interface StorageMap {
  typedefs: string[];
  externDecls: string[];
  /** Tentative definitions — required in every context: they are how
   *  gp-relative addressing is expressed (see the generated profile). */
  tentativeDefs: string[];
  /** Pointer-typed parameters, by register. */
  pointerParams: Map<string, string>;
  /** Loop step text per induction register (`arg0++`, `arg0 += 2`), for
   *  registers whose IV group maps to a pointer whose pointee size divides
   *  the delta. A register absent here cannot be advanced in C. */
  pointerSteps: Map<string, string>;
  access: (atom: Atom) => CExpr;
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
function buildStorageMap(
  cells: Map<string, CellUse>,
  index: SymbolIndex,
  ivDeltas: Map<string, number> = new Map(),
): StorageMap | { invalid: string } | { unresolved: string } {
  const typedefs: string[] = [];
  const externDecls: string[] = [];
  const tentativeDefs: string[] = [];
  const integration: string[] = [];
  const pointerParams = new Map<string, string>();
  const pointerSteps = new Map<string, string>();
  const accessors = new Map<string, CExpr>();
  /* Base accessors for indexed groups, keyed by the canonical base expression. */
  const indexedBaseAccessors = new Map<string, CExpr>();

  /* Separate cells by group. */
  const byGroup = new Map<string, CellUse[]>();
  for (const cell of cells.values()) {
    const group = atomGroup(cell);
    byGroup.set(group, [...(byGroup.get(group) ?? []), cell]);
  }

  /* ---- split into absolute, plain symbolic, and indexed symbolic groups --- */
  const plainGroups: Array<{ group: string; cells: CellUse[] }> = [];
  const indexedGroups: Array<{ group: string; cells: CellUse[] }> = [];
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
    if (groupCells.some((cell) => cell.index)) {
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
    } else if (effectiveBase.kind !== "load") {
      return { invalid: `pointer base ${canon(base)} is neither an argument nor a loaded pointer` };
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
      viewName: effectiveBase.kind === "entry" ? `Recon${effectiveBase.register.toUpperCase()}View` : `ReconPointee${viewIndex++}View`,
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

  /** Emit one view struct over a group's cells; returns the typedef text and
   *  the struct's byte size. `strideTo` pads the tail so the pointee size
   *  equals a loop induction's advance and `pointer++` walks one record. */
  const viewTypedef = (
    viewName: string,
    groupCells: CellUse[],
    strideTo?: number,
  ): { text: string; size: number } | { invalid: string } => {
    const byOffset = new Map<number, CellUse>();
    for (const cell of groupCells) {
      const existing = byOffset.get(cell.offset);
      if (existing && existing.width !== cell.width) {
        return { invalid: `two access widths at offset 0x${cell.offset.toString(16)} of ${viewName}` };
      }
      if (!existing || (cell.loaded && !existing.loaded) || cell.pointeeView) byOffset.set(cell.offset, cell);
    }
    const offsets = [...byOffset.keys()].sort((a, b) => a - b);
    const lines: string[] = ["typedef struct {"];
    let cursor = 0;
    for (const offset of offsets) {
      const cell = byOffset.get(offset)!;
      if (offset % cell.width !== 0) return { invalid: `misaligned field at offset 0x${offset.toString(16)} of ${viewName}` };
      if (offset < cursor) return { invalid: `overlapping fields at offset 0x${offset.toString(16)} of ${viewName}` };
      if (offset > cursor) lines.push(`    char pad_${cursor.toString(16).toUpperCase()}[0x${(offset - cursor).toString(16).toUpperCase()}];`);
      const type = cell.pointeeView ? `${cell.pointeeView} *` : elementType(cell.width, cell.signed);
      lines.push(`    ${type}${type.endsWith("*") ? "" : " "}${fieldName(offset)};`);
      cursor = offset + cell.width;
    }
    if (strideTo !== undefined) {
      if (cursor > strideTo) return { invalid: `fields of ${viewName} extend past its induction stride ${strideTo}` };
      if (cursor < strideTo) {
        lines.push(`    char pad_${cursor.toString(16).toUpperCase()}[0x${(strideTo - cursor).toString(16).toUpperCase()}];`);
        cursor = strideTo;
      }
    }
    lines.push("}");
    return { text: `${lines.join("\n")} ${viewName};`, size: cursor };
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

    const viewName = `Recon${group.symbol.replace(/\W/g, "")}View`;
    const shifted = group.cells.map((cell) => ({ ...cell, offset: cell.offset - group.base }));
    const typedef = viewTypedef(viewName, shifted);
    if ("invalid" in typedef) return typedef;
    typedefs.push(typedef.text);
    if (group.viaGp) {
      tentativeDefs.push(`${viewName} ${group.symbol};`);
      integration.push(`${group.symbol} is $gp-relative small data; the view type and tentative definition must live with its owning translation unit`);
      for (const cell of group.cells) {
        accessors.set(cellKey("", cell.offset, cell.width), {
          kind: "member", base: id(group.symbol), field: fieldName(cell.offset - group.base), arrow: false,
        });
      }
    } else {
      externDecls.push(`extern u8 ${group.symbol}[];`);
      integration.push(`move the ${viewName} typedef into the shared type header named by the generated profile; ${group.symbol} keeps its declaration and is accessed by cast`);
      for (const cell of group.cells) {
        accessors.set(cellKey("", cell.offset, cell.width), {
          kind: "member",
          base: { kind: "cast", type: `${viewName} *`, expr: id(group.symbol) },
          field: fieldName(cell.offset - group.base),
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
    } else {
      integration.push(`the ${symbolicGroup.viewName} typedef belongs in the shared type header`);
    }
    for (const cell of symbolicGroup.cells) {
      accessors.set(cellKey(atomGroup(cell), cell.offset, cell.width), {
        kind: "member",
        base: lvalue,
        field: fieldName(cell.offset),
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

  /* ---- indexed groups: array access --------------------------------------- */
  for (const { group, cells: groupCells } of indexedGroups) {
    const base = groupCells[0]!.base!;
    if (!groupCells[0]!.index) {
      return { invalid: `indexed group ${group} has no index on its first cell` };
    }
    const scale = groupCells[0]!.index!.scale;

    /* Validate: all offsets must be < scale (within element) or multiples of scale (next element). */
    for (const cell of groupCells) {
      if (cell.offset < 0 || cell.offset >= scale) {
        return { invalid: `indexed group ${group} has offset 0x${cell.offset.toString(16)} >= scale ${scale}` };
      }
    }

    /* Determine if plain array or struct array. */
    const offsets = [...new Set(groupCells.map((c) => c.offset))].sort((a, b) => a - b);
    const isSimple = offsets.length === 1 && offsets[0] === 0;

    /* Resolve the base expression. */
    let baseExpr: CExpr | { invalid: string } | undefined;
    if (base.kind === "entry") {
      const idx = ["a0", "a1", "a2", "a3"].indexOf(base.register);
      if (idx < 0) return { invalid: `indexed base ${canon(base)} is not an argument register` };
      if (isSimple) {
        const elemType = elementType(groupCells[0]!.width, groupCells[0]!.signed);
        pointerParams.set(base.register, `${elemType} *`);
        integration.push(`the ${base.register} parameter is a ${elemType} array pointer`);
      } else {
        /* Struct array: emit a view typedef with stride = scale. */
        const viewName = `Recon${base.register.toUpperCase()}ArrView`;
        const typedefResult = viewTypedef(viewName, groupCells);
        if ("invalid" in typedefResult) return typedefResult;
        typedefs.push(typedefResult.text);
        pointerParams.set(base.register, `${viewName} *`);
        integration.push(`the ${base.register} parameter is a ${viewName} array pointer; move to shared type header`);
      }
      baseExpr = id(`arg${idx}`);
    } else if (base.kind === "const") {
      /* Absolute base: resolve the address as a symbol. */
      const resolved = resolveAddress(index, base.value >>> 0);
      if (!resolved) return { unresolved: `no label covers the array base at 0x${(base.value >>> 0).toString(16)}` };
      const viaGp = false; /* Absolute bases are not gp-relative. */
      if (isSimple) {
        const elemType = elementType(groupCells[0]!.width, groupCells[0]!.signed);
        externDecls.push(`extern ${elemType} ${resolved.symbol}[];`);
        integration.push(`${resolved.symbol} is an array of ${elemType}`);
      } else {
        const viewName = `Recon${resolved.symbol.replace(/\W/g, "")}ArrView`;
        const typedefResult = viewTypedef(viewName, groupCells);
        if ("invalid" in typedefResult) return typedefResult;
        typedefs.push(typedefResult.text);
        externDecls.push(`extern ${viewName} ${resolved.symbol}[];`);
        integration.push(`${resolved.symbol} is a ${viewName} array`);
      }
      baseExpr = id(resolved.symbol);
    } else if (base.kind === "load") {
      /* Loaded pointer: need the accessor from the loaded cell. */
      const accessorKey = cellKey(base.base ? canon(base.base) : "", base.address, base.width);
      const loadedAccessor = accessors.get(accessorKey);
      if (!loadedAccessor) {
        return { invalid: `no accessor for the loaded pointer base ${canon(base)}` };
      }
      if (isSimple) {
        integration.push(`indexed access through loaded pointer ${canon(base)}, typed ${elementType(groupCells[0]!.width, groupCells[0]!.signed)} array`);
      } else {
        integration.push(`indexed struct access through loaded pointer ${canon(base)}`);
      }
      baseExpr = loadedAccessor;
    } else {
      return { invalid: `indexed base ${canon(base)} is not an entry, const, or load` };
    }
    if (!baseExpr || "invalid" in baseExpr) return baseExpr as unknown as { invalid: string };

    indexedBaseAccessors.set(canon(base), baseExpr);

    /* Store accessors for every cell in this indexed group. */
    for (const cell of groupCells) {
      accessors.set(cellKey(group, cell.offset, cell.width), baseExpr);
    }
  }

  return {
    typedefs,
    externDecls,
    tentativeDefs,
    pointerParams,
    pointerSteps,
    integration,
    access: (atom) => {
      if (atom.index) {
        /* Indexed access: return the base expression; translate adds the subscript. */
        const baseExpr = indexedBaseAccessors.get(canon(atom.base!));
        if (!baseExpr) throw new Error(`no indexed base for ${canon(atom.base!)}`);
        return baseExpr;
      }
      const found = accessors.get(cellKey(atomGroup(atom), atom.offset, atom.width));
      if (!found) throw new Error(`no accessor for ${atomGroup(atom) || "absolute"}+0x${atom.offset.toString(16)}`);
      return found;
    },
  };
}

/* ---- parameters ----------------------------------------------------------- */

interface ParamPlan {
  params: Array<{ name: string; type: string; register: string }>;
  absorbed: Map<string, UnaryOp>;
  label: string;
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
      default: return;
    }
  };
  for (const expr of exprs) walk(expr);
  return uses;
}

export function deriveParamPlans(
  exprs: SymExpr[],
  pointerParams: Map<string, string>,
): ParamPlan[] | { invalid: string } {
  const uses = argumentUses(exprs);
  for (const register of pointerParams.keys()) {
    if (uses.has(register)) {
      return { invalid: `${register} is used both as a pointer base and as a value` };
    }
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
    label: registers.map((register) => (plan.types.get(register) ?? "s32").replace(/[^A-Za-z0-9]+/g, "p"),).join("-"),
  }));
}

/* ---- expression translation ----------------------------------------------- */

function translate(expr: SymExpr, map: StorageMap, plan: ParamPlan, temps: Map<string, string>): CExpr {
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
      return id(param.name);
    }
    case "iv": {
      /* IV expressions (D7) represent the induction variable's value at the
       * start of each iteration. We translate them as the underlying entry
       * register — the loop body's pointer increments represent the advance. */
      const param = plan.params.find((entry) => entry.register === expr.register);
      if (!param) throw new Error(`entry value of ${expr.register} (iv) reaches the result but is not a parameter`);
      return id(param.name);
    }
    case "load": {
      const temp = temps.get(canon({ ...expr, epoch: undefined }));
      if (temp) return id(temp);
      const baseAccess = map.access({ base: expr.base, offset: expr.address, width: expr.width, signed: expr.signed });
      if (expr.index) {
        const idxExpr = translate(expr.index.expr, map, plan, temps);
        /* When the offset is non-zero within the stride, it is a struct field access. */
        if (expr.address !== 0 && expr.index.scale > 1) {
          const elemOffset = expr.address % expr.index.scale;
          const elemIndex = Math.floor(expr.address / expr.index.scale);
          if (elemOffset !== 0) {
            /* Struct array: base[idx + N].field */
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
        }
        /* Plain array: base[idx + offset/scale] */
        if (expr.address !== 0) {
          const offsetElements = expr.address / expr.index.scale;
          if (offsetElements !== 0) {
            return {
              kind: "index", base: baseAccess,
              index: { kind: "binary", op: "+", left: idxExpr, right: int(offsetElements) },
            };
          }
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
  const isVoid = canon(relation.returnValue) === canon(ENTRY_V0);

  /* Every accessed cell: stores, loads inside values, and pointer bases. */
  const atoms = new Map<string, Atom>();
  for (const effect of relation.effects) {
    if (effect.kind === "call") continue;
    collectAtoms(effect.value, atoms);
    if (effect.base) collectAtoms(effect.base, atoms);
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
  const map = buildStorageMap(cells, index);
  if ("unresolved" in map) return map;
  if ("invalid" in map) return map;

  const exprs = [...relation.effects.flatMap((effect) => {
    if (effect.kind === "call") return effect.args;
    return [effect.value];
  }), ...(isVoid ? [] : [relation.returnValue])];
  const plans = deriveParamPlans(exprs, map.pointerParams);
  if ("invalid" in plans) return plans;

  /* A value that reads a cell an *earlier* assignment overwrote must read it
   * before that assignment; those pre-store reads become temporaries at the
   * top, in first-read order. Post-store re-reads (epoch atoms) read in place. */
  const overwrittenReads = new Map<string, SymExpr & { kind: "load" }>();
  const storedBefore = new Set<string>();
  const noteOverwritten = (expr: SymExpr): void => {
    const reads = new Map<string, Atom>();
    collectAtoms(expr, reads);
    for (const [key, read] of reads) {
      if (key.includes("@")) continue; /* epoch re-read: reads updated memory on purpose */
      if (storedBefore.has(cellKey(atomGroup(read), read.offset, read.width))) {
        overwrittenReads.set(key, { kind: "load", address: read.offset, width: read.width, signed: read.signed, base: read.base });
      }
    }
  };
  for (const effect of relation.effects) {
    if (effect.kind === "call") {
      /* A call reads nothing from the overwritten set, but it invalidates
       * every non-@sp cell — later reads are fresh epoch atoms. */
      storedBefore.clear();
      continue;
    }
    noteOverwritten(effect.value);
    storedBefore.add(cellKey(effect.base ? canon(effect.base) : "", effect.address, effect.width));
  }
  if (!isVoid) noteOverwritten(relation.returnValue);

  /* Increment idioms first: a lone `cell = cell ± 1` whose old value is (or
   * is not) returned has `SYM++` as its natural source, and the post-increment
   * form keeps the copy the machine shows where the temporary form does not. */
  const lvalueOf = (storage: StorageMap, atom: Atom): CExpr => storage.access(atom);
  const incrementBodies: Array<{ label: string; body: (map: StorageMap) => CStmt[] }> = [];
  /* Only for absolute cells: a pointer-based increment would need the pointer
   * parameter in the signature, which the generic plans already produce. */
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
      if (op && isVoid) {
        incrementBodies.push({ label: `post${op === "++" ? "inc" : "dec"}`, body: (map) => [
          { kind: "exprstmt", expr: { kind: "postfix", op, expr: lvalueOf(map, cellAtom) } },
        ]});
      }
      if (op && !isVoid && readsOwnCell(relation.returnValue)) {
        incrementBodies.push({ label: `ret-post${op === "++" ? "inc" : "dec"}`, body: (map) => [
          { kind: "return", expr: { kind: "postfix", op, expr: lvalueOf(map, cellAtom) } },
        ]});
      }
      if (op && !isVoid && canon(relation.returnValue) === canon(value)) {
        incrementBodies.push({ label: `ret-pre${op === "++" ? "inc" : "dec"}`, body: (map) => [
          { kind: "return", expr: { kind: "prefix", op, expr: lvalueOf(map, cellAtom) } },
        ]});
      }
    }
  }

  const candidates: EffectCandidate[] = [];
  for (const increment of incrementBodies) {
    for (const context of ["standalone", "umbrella"] as const) {
      const source = [
        context === "umbrella" ? `#include "common.h"` : STANDALONE_TYPEDEF_BLOCK,
        "",
        ...map.typedefs.flatMap((typedef) => [typedef, ""]),
        ...(context === "standalone" ? map.externDecls.flatMap((decl) => [decl, ""]) : []),
        ...map.tentativeDefs.flatMap((decl) => [decl, ""]),
        `${isVoid ? "void" : "s32"} ${functionName}(void) {`,
        ...renderStmts(increment.body(map), "    "),
        "}",
        "",
      ].join("\n");
      candidates.push({
        label: `effects-${increment.label}-${context}`,
        source,
        integrationPlan: [
          ...map.integration,
          "write the function body into its container's source directory with the project umbrella includes",
        ],
      });
    }
  }
  for (const plan of plans) {
    /* Declared-temp axis (D5): a subexpression the compiler had to materialize
     * more than once (spills made it recompute, or a register wasn't enough)
     * reads as repeated canon in the relation. Both spellings — inline and
     * hoisted to a local temp — are candidates; the byte oracle chooses. */
    const allValueExprs = [
      ...relation.effects.filter((effect) => effect.kind === "store" && !isSpStore(effect)).map((effect) => (effect as StoreEffect).value),
      ...(isVoid ? [] : [relation.returnValue]),
    ];
    const repeated: Array<{ key: string; expr: SymExpr }> = [];
    {
      const counts = new Map<string, { count: number; expr: SymExpr }>();
      const walk = (e: SymExpr): void => {
        if (e.kind === "entry" || e.kind === "const") return;
        const key = canon(e);
        const before = counts.get(key);
        if (before) {
          before.count++;
        } else {
          /* Do not hoist an expression its own value is a plain address; the
           * compiler recomputes addresses freely. Keep loads and computes. */
          if (e.kind === "load" || e.kind === "binary" || e.kind === "unary") counts.set(key, { count: 1, expr: e });
        }
        switch (e.kind) {
          case "load":
            if (e.base) walk(e.base);
            if (e.index) walk(e.index.expr);
            return;
          case "unary": walk(e.operand); return;
          case "binary":
            walk(e.left);
            walk(e.right);
            return;
          default: return;
        }
      };
      for (const value of allValueExprs) walk(value);
      repeated.push(...[...counts.entries()]
        .filter(([, entry]) => entry.count >= 2)
        .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
        .slice(0, 4)
        .map(([key, entry]) => ({ key, expr: entry.expr })));
    }

    /* 2^n hoist sets, capped at 16. */
    const hoistSets: Array<Set<string>> = [new Set()];
    for (const sub of repeated) {
      const more = hoistSets.map((set) => new Set([...set, sub.key]));
      hoistSets.push(...more);
      if (hoistSets.length >= 16) break;
    }

    for (const hoisted of hoistSets) {
      for (const context of ["standalone", "umbrella"] as const) {
        let body: CStmt[];
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
          /* Hoisted subexpressions: declare before first use, keep the name
           * for every later occurrence. */
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
          for (const effect of relation.effects) {
            if (effect.kind === "call") {
              const args = effect.args.map((arg) => translate(arg, map, plan, temps));
              body.push({ kind: "exprstmt", expr: { kind: "call", callee: effect.callee, args } });
            } else {
              if (isSpStore(effect)) continue;
              body.push({
                kind: "assign",
                target: map.access({ base: effect.base, offset: effect.address, width: effect.width, signed: true }),
                value: translate(effect.value, map, plan, temps),
              });
            }
          }
          if (!isVoid) body.push({ kind: "return", expr: translate(relation.returnValue, map, plan, temps) });
        } catch {
          /* An untranslatable expression fails this plan, not the whole class. */
          continue;
        }

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
        label: `effects-${plan.label || "noargs"}-${context}`,
        source,
        integrationPlan: [
          ...map.integration,
          "write the function body into its container's source directory with the project umbrella includes",
        ],
      });
    }
  }
  }
  if (candidates.length === 0) return { invalid: "no parameter plan could express the relation's values" };
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
        for (const arg of effect.args) {
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
  const map = buildStorageMap(cells, index, ivDeltas);
  if ("unresolved" in map) return map;
  if ("invalid" in map) return map;

  const plans = deriveParamPlans(exprs, map.pointerParams);
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
              const args = effect.args.map((a) => translate(a, map, plan, temps));
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
          const inner = emitNode(node.body, emitted, new Set(stored), true);
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
      } catch {
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
  if (candidates.length === 0) return { invalid: "no parameter plan could express the guarded structure" };
  return candidates;
}
