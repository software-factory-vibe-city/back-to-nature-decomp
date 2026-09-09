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
import {
  type CExpr,
  type CStmt,
  STANDALONE_TYPEDEF_BLOCK,
  elementType,
  id,
  int,
  renderStmts,
} from "./construct.js";
import type { EffectRelation, StoreEffect, SymExpr, UnaryOp } from "./types.js";

/* ---- fit ------------------------------------------------------------------ */

const ENTRY_V0: SymExpr = { kind: "entry", register: "v0" };

export function fitStraightLineEffects(
  leafValue: SymExpr,
  effects: StoreEffect[],
): EffectRelation | { unfit: string } {
  /* No stores and no returned value is still a relation: the empty function. */
  return {
    kind: "straight-line-effects",
    effects,
    returnValue: leafValue,
    evidence: [`${effects.length} store(s) in machine order; return ${canon(leafValue)}`],
  };
}

/* ---- cell collection ------------------------------------------------------ */

interface Atom {
  base?: SymExpr | undefined;
  offset: number;
  width: 1 | 2 | 4;
  signed: boolean;
}

const atomGroup = (atom: Atom): string => (atom.base ? canon(atom.base) : "");
const cellKey = (group: string, offset: number, width: number): string => `${group}|${offset}|${width}`;

/** Every load atom in an expression, including the atoms inside pointer bases. */
function collectAtoms(expr: SymExpr, into: Map<string, Atom>): void {
  switch (expr.kind) {
    case "load": {
      const atom: Atom = { base: expr.base, offset: expr.address, width: expr.width, signed: expr.signed };
      into.set(`${canon({ ...expr, epoch: undefined })}`, atom);
      if (expr.base) collectAtoms(expr.base, into);
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
  access: (atom: Atom) => CExpr;
  integration: string[];
}

interface SymbolicGroup {
  group: string;
  base: SymExpr;
  viewName: string;
  cells: CellUse[];
  /** Chain length to an absolute or argument anchor, for typedef ordering. */
  depth: number;
}

function baseDepth(expr: SymExpr): number {
  if (expr.kind === "load" && expr.base) return 1 + baseDepth(expr.base);
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
): StorageMap | { invalid: string } | { unresolved: string } {
  const typedefs: string[] = [];
  const externDecls: string[] = [];
  const tentativeDefs: string[] = [];
  const integration: string[] = [];
  const pointerParams = new Map<string, string>();
  const accessors = new Map<string, CExpr>();

  /* Symbolic groups, deepest chains first so child views precede the views
   * and declarations that name them. */
  const symbolicGroups: SymbolicGroup[] = [];
  const byGroup = new Map<string, CellUse[]>();
  for (const cell of cells.values()) {
    const group = atomGroup(cell);
    byGroup.set(group, [...(byGroup.get(group) ?? []), cell]);
  }
  let viewIndex = 0;
  for (const [group, groupCells] of byGroup) {
    if (group === "") continue;
    const base = groupCells[0]!.base!;
    if (base.kind === "entry") {
      if (!["a0", "a1", "a2", "a3"].includes(base.register)) {
        return { invalid: `pointer base ${canon(base)} is not an argument register` };
      }
    } else if (base.kind !== "load") {
      return { invalid: `pointer base ${canon(base)} is neither an argument nor a loaded pointer` };
    }
    symbolicGroups.push({
      group,
      base,
      viewName: base.kind === "entry" ? `Recon${base.register.toUpperCase()}View` : `ReconPointee${viewIndex++}View`,
      cells: groupCells,
      depth: baseDepth(base),
    });
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

  /** Emit one view struct over a group's cells; returns the typedef text. */
  const viewTypedef = (viewName: string, groupCells: CellUse[]): string | { invalid: string } => {
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
    lines.push("}");
    return `${lines.join("\n")} ${viewName};`;
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
  for (const symbolicGroup of symbolicGroups) {
    const typedef = viewTypedef(symbolicGroup.viewName, symbolicGroup.cells);
    if (typeof typedef !== "string") return typedef;
    typedefs.push(typedef);
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
    if (typeof typedef !== "string") return typedef;
    typedefs.push(typedef);
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

  /* Now wire symbolic accessors, shallowest first, so bases resolve. */
  for (const symbolicGroup of [...symbolicGroups].sort((a, b) => a.depth - b.depth)) {
    const lvalue = baseLvalue(symbolicGroup.base);
    if (!("kind" in lvalue)) return lvalue;
    symbolicAccessorBase.set(symbolicGroup.group, lvalue);
    if (symbolicGroup.base.kind === "entry") {
      pointerParams.set(symbolicGroup.base.register, `${symbolicGroup.viewName} *`);
      integration.push(`the ${symbolicGroup.base.register} parameter is a ${symbolicGroup.viewName} pointer; move the typedef to the shared type header`);
    } else {
      integration.push(`the ${symbolicGroup.viewName} typedef belongs in the shared type header`);
    }
    for (const cell of symbolicGroup.cells) {
      accessors.set(cellKey(symbolicGroup.group, cell.offset, cell.width), {
        kind: "member",
        base: lvalue,
        field: fieldName(cell.offset),
        arrow: true,
      });
    }
  }

  return {
    typedefs,
    externDecls,
    tentativeDefs,
    pointerParams,
    integration,
    access: (atom) => {
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
    case "load": {
      const temp = temps.get(canon({ ...expr, epoch: undefined }));
      if (temp) return id(temp);
      return map.access({ base: expr.base, offset: expr.address, width: expr.width, signed: expr.signed });
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
    const group = effect.base ? canon(effect.base) : "";
    const key = cellKey(group, effect.address, effect.width);
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
  }

  const index = loadSymbolIndex(container);
  const map = buildStorageMap(cells, index);
  if ("unresolved" in map) return map;
  if ("invalid" in map) return map;

  const exprs = [...relation.effects.map((effect) => effect.value), ...(isVoid ? [] : [relation.returnValue])];
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
  if (relation.effects.length === 1 && !relation.effects[0]!.base) {
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
        for (const effect of relation.effects) {
          body.push({
            kind: "assign",
            target: map.access({ base: effect.base, offset: effect.address, width: effect.width, signed: true }),
            value: translate(effect.value, map, plan, temps),
          });
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
): EffectCandidate[] | { unresolved: string } | { invalid: string } {
  /* Bound the structure. */
  const testRefs = new Set<DagRef>();
  const leafRefs = new Set<DagRef>();
  const walk = (ref: DagRef): void => {
    const node = arena.node(ref);
    if (node.kind === "leaf") {
      leafRefs.add(ref);
      return;
    }
    if (testRefs.has(ref)) return;
    testRefs.add(ref);
    walk(node.onTrue);
    walk(node.onFalse);
  };
  walk(root);
  if (testRefs.size > 32 || leafRefs.size > 16) {
    return { invalid: `the decision structure is too large for the guarded class (${testRefs.size} tests, ${leafRefs.size} leaves)` };
  }

  const leaves = [...leafRefs].map((ref) => arena.node(ref) as DagNode & { kind: "leaf" });
  const voidLeaves = leaves.filter((leaf) => canon(leaf.value) === canon(ENTRY_V0)).length;
  if (voidLeaves > 0 && voidLeaves < leaves.length) {
    return { invalid: "some paths return a value and some leave it unset" };
  }
  const isVoid = voidLeaves === leaves.length;

  /* Cells and argument uses across every predicate, value, and store. */
  const atoms = new Map<string, Atom>();
  const exprs: SymExpr[] = [];
  for (const leaf of leaves) {
    if (!isVoid) {
      exprs.push(leaf.value);
      collectAtoms(leaf.value, atoms);
    }
    for (const effect of leaf.effects) {
      exprs.push(effect.value);
      collectAtoms(effect.value, atoms);
      if (effect.base) collectAtoms(effect.base, atoms);
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
  for (const leaf of leaves) {
    for (const effect of leaf.effects) {
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
    }
  }

  const index = loadSymbolIndex(container);
  const map = buildStorageMap(cells, index);
  if ("unresolved" in map) return map;
  if ("invalid" in map) return map;

  const plans = deriveParamPlans(exprs, map.pointerParams);
  if ("invalid" in plans) return plans;

  const effectKey = (effect: StoreEffect): string =>
    `${effect.base ? canon(effect.base) : ""}|${effect.address}|${effect.width}=${canon(effect.value)}`;

  const leavesBelowMemo = new Map<DagRef, Array<DagNode & { kind: "leaf" }>>();
  const leavesBelow = (ref: DagRef): Array<DagNode & { kind: "leaf" }> => {
    const known = leavesBelowMemo.get(ref);
    if (known) return known;
    const node = arena.node(ref);
    const result = node.kind === "leaf"
      ? [node]
      : [...leavesBelow(node.onTrue), ...leavesBelow(node.onFalse)];
    leavesBelowMemo.set(ref, result);
    return result;
  };

  class InvalidGuard extends Error {}

  const predToC = (pred: Predicate, plan: ParamPlan, temps: Map<string, string>): CExpr => {
    const left = translate(pred.left, map, plan, temps);
    const right = pred.right ? translate(pred.right, map, plan, temps) : undefined;
    switch (pred.op) {
      case "eq": return { kind: "binary", op: "==", left, right: right! };
      case "ltS": return { kind: "binary", op: "<", left, right: right! };
      case "ltU": return {
        kind: "binary", op: "<",
        left: { kind: "cast", type: "u32", expr: left },
        right: { kind: "cast", type: "u32", expr: right! },
      };
      case "lez": return { kind: "binary", op: "<=", left, right: int(0) };
      case "gtz": return { kind: "binary", op: ">", left, right: int(0) };
      case "ltz": return { kind: "binary", op: "<", left, right: int(0) };
      case "gez": return { kind: "binary", op: ">=", left, right: int(0) };
    }
  };

  const candidates: EffectCandidate[] = [];
  for (const plan of plans) {
    for (const context of ["standalone", "umbrella"] as const) {
      const temps = new Map<string, string>();

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

      const emitNode = (ref: DagRef, emitted: number, stored: Set<string>): CStmt[] => {
        const node = arena.node(ref);
        const assignments = (effects: StoreEffect[]): CStmt[] =>
          effects.map((effect) => {
            guardReads(effect.value, stored);
            stored.add(cellKey(effect.base ? canon(effect.base) : "", effect.address, effect.width));
            return {
              kind: "assign",
              target: map.access({ base: effect.base, offset: effect.address, width: effect.width, signed: true }),
              value: translate(effect.value, map, plan, temps),
            } as CStmt;
          });

        if (node.kind === "leaf") {
          const statements = assignments(node.effects.slice(emitted));
          if (!isVoid) {
            guardReads(node.value, stored);
            statements.push({ kind: "return", expr: translate(node.value, map, plan, temps) });
          }
          return statements;
        }

        const below = leavesBelow(ref);
        const reference = below[0]!.effects;
        let common = emitted;
        while (common < reference.length &&
          below.every((leaf) => common < leaf.effects.length && effectKey(leaf.effects[common]!) === effectKey(reference[common]!))) {
          common++;
        }
        const statements = assignments(reference.slice(emitted, common));
        guardReads(node.pred.left, stored);
        if (node.pred.right) guardReads(node.pred.right, stored);
        const thenStmts = emitNode(node.onTrue, common, new Set(stored));
        const elseStmts = emitNode(node.onFalse, common, new Set(stored));
        statements.push({
          kind: "if",
          cond: predToC(node.pred, plan, temps),
          body: thenStmts,
          ...(elseStmts.length > 0 ? { elseBody: elseStmts } : {}),
        });
        return statements;
      };

      let body: CStmt[];
      try {
        body = emitNode(root, 0, new Set());
      } catch {
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
        label: `guarded-${plan.label || "noargs"}-${context}`,
        source,
        integrationPlan: [
          ...map.integration,
          "write the function body into its container's source directory with the project umbrella includes",
        ],
      });
    }
  }
  if (candidates.length === 0) return { invalid: "no parameter plan could express the guarded structure" };
  return candidates;
}
