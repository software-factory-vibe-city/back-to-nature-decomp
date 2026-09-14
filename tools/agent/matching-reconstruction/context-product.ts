/**
 * The recovered-context product — what the target's own words prove about a
 * function's interface and the storage it touches, independent of whether any
 * constructor produced compilable C.
 *
 * This exists because the repair layer used to obtain its "recovered context"
 * by parsing a winning or best-effort C string. That inverts the dependency:
 * the analysis that is most valuable when construction *fails* was only
 * available when construction *succeeded*. Everything here is derived from
 * decoded words plus the symbol tables, so a function the executor refuses on
 * its first instruction still yields parameters, call sites, and the set of
 * globals it names.
 *
 * Three separations are deliberate:
 *
 *   - **Proof strength is carried, not flattened.** A callee signature from a
 *     matched definition and one inferred from a register-argument snapshot
 *     are both recorded, labelled differently. A consumer may prefer one; it
 *     may never silently read the second as the first.
 *   - **Unknown stays a set, not a default.** An unresolved callee gets an
 *     arity *range*, not a fabricated arity, and a parameter whose width no
 *     instruction narrows has no width claimed for it.
 *   - **Extent is a minimum.** Seeing `obj + 0x28` proves the object is at
 *     least 0x2a bytes; it proves nothing about where it ends.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { containerTargetPath, vramToRom, type Container } from "../../lib/container.js";
import { loadSymbolIndex, requireFunctionLocation, resolveAddress } from "../../lib/symbolIndex.js";
import { ROOT } from "../decompToolchain.js";
import { computeLiveIn, canon, decodeBytes, executeFunction, UnsupportedTarget, type ExecResult } from "./exec.js";
import { isLoad, isStore, loadSigned, loadWidth, REGISTER_NAMES, type DecodedInsn } from "./decode.js";
import { resolveSignature, inferSignatureRange } from "./callee-signature.js";
import { abiArguments } from "./effect-construct.js";
import { targetFeatures, type TargetFeatures } from "./failure-category.js";
import { describeCopyRecipe, recognizeCopyRecipe, type CopyRecipe } from "./copy-recipe.js";
import type { CallEffect, Effect, StoreEffect, SymExpr } from "./types.js";

export const RECOVERED_CONTEXT_SCHEMA_VERSION = 1 as const;

/* ---- the record ----------------------------------------------------------- */

/** How strongly a fact is held. Never collapsed into a single "confidence". */
export type EvidenceStrength =
  /** The callee's own matched definition, or a witnessed machine fact. */
  | "proved"
  /** An SDK or library declaration — authoritative for its own entry points. */
  | "declared"
  /** Derived from the callee's machine code: a bound, not an exact value. */
  | "bounded"
  /** Derived from this caller's setup alone; the weakest tier. */
  | "caller-evidence";

export interface ParameterFact {
  /** `a0`..`a3`, or a stack slot name for the fifth argument onward. */
  register: string;
  /** Zero-based ABI position. */
  index: number;
  /** Narrowings the body applies before use, in the order first seen. */
  conversions: string[];
  /** The body dereferences it: a pointer, whatever else it may also be. */
  usedAsPointerBase: boolean;
  /** Byte offsets reached through it, when it is a pointer base. */
  fieldOffsets: number[];
  strength: EvidenceStrength;
  evidence: string[];
}

export interface CallFact {
  vram: number;
  callee: string;
  indirect: boolean;
  /** Resolved arity and types, when a tier answered. */
  signature?: {
    arity: number;
    paramTypes: string[];
    returnsValue: boolean;
    returnType: string;
    strength: EvidenceStrength;
  };
  /** When no tier answered: the bounded range enumeration should stay inside. */
  range?: { arityLo: number; arityHi: number; returns: "yes" | "no" | "unknown" };
  /** The caller's argument expressions, canonical, in ABI order. */
  argExprs?: string[];
  /** Whether this caller reads the result. */
  resultUsed?: boolean;
}

export interface GlobalFact {
  address: number;
  /** Label covering the address, when the symbol tables know one. */
  symbol?: string;
  /** Byte offset from that label. */
  offset?: number;
  width: 1 | 2 | 4;
  signed: boolean;
  access: "load" | "store" | "both";
  /** Reached through `$gp` — small-data addressing, a translation-unit fact. */
  viaGp: boolean;
}

export interface ObjectFact {
  /** Canonical symbolic base — `@a0`, a loaded pointer, a call result. */
  base: string;
  /** Where the base came from, in words a reader can act on. */
  origin: "parameter" | "loaded-pointer" | "call-result" | "stack" | "absolute" | "other";
  fields: Array<{
    offset: number;
    width: 1 | 2 | 4;
    signed: boolean;
    access: "load" | "store" | "both";
    /** Stride of a scaled index reaching this field, when one does. */
    indexScale?: number;
  }>;
  /** Highest witnessed byte + its width. A floor on the object's size. */
  minimumExtent: number;
}

export interface RecoveredContext {
  schemaVersion: typeof RECOVERED_CONTEXT_SCHEMA_VERSION;
  functionName: string;
  containerId: string;
  vram: number;
  sizeBytes: number;
  features: TargetFeatures;
  parameters: ParameterFact[];
  returns: { kind: "value" | "void" | "unknown"; strength: EvidenceStrength; evidence: string[] };
  calls: CallFact[];
  globals: GlobalFact[];
  objects: ObjectFact[];
  /**
   * Compiler operations recovered from the words: a block move the backend
   * expanded inline, and in future the other expansions §3.5 names.
   *
   * These are what makes a region of `lwl`/`swl` an *operation* rather than a
   * bucket of unmodelled opcodes, and the difference decides whether the
   * function is filed as ordinary compiler output or as handwritten code.
   */
  operations: RecognizedOperation[];
  /** What could not be recovered, and why — never an omission. */
  notes: string[];
}

/** One compiler-generated operation the recogniser identified. */
export type RecognizedOperation = CopyRecipe & { summary: string };

/* ---- derivation ----------------------------------------------------------- */

const ARG_REGISTERS = ["a0", "a1", "a2", "a3"];

/**
 * Parameters, from the entry live-in set.
 *
 * An argument register live at instruction zero is read on some path before
 * anything defines it, which is exactly the definition of a parameter the
 * callee consumes. The liveness fixpoint that the executor already needs is
 * the same one that answers this, so no second analysis can drift from it.
 */
function recoverParameters(insns: DecodedInsn[]): ParameterFact[] {
  if (insns.length === 0) return [];
  const liveIn = computeLiveIn(insns);
  const entryLive = liveIn[0]!;
  const facts: ParameterFact[] = [];
  for (let index = 0; index < ARG_REGISTERS.length; index++) {
    const register = 4 + index;
    if (!(entryLive & (1 << register))) continue;
    facts.push({
      register: ARG_REGISTERS[index]!,
      index,
      conversions: [],
      usedAsPointerBase: false,
      fieldOffsets: [],
      strength: "proved",
      evidence: [`$${ARG_REGISTERS[index]} is live at entry — read before any definition`],
    });
  }
  return facts;
}

/**
 * Return-value evidence, from the words alone.
 *
 * `$v0` live at the `jr $ra` means the caller receives something. Absence is
 * weaker than presence: a function may compute a value the caller ignores, so
 * "no write to `$v0`" is reported as `void` only when no instruction defines
 * it at all, and `unknown` otherwise.
 */
function recoverReturn(insns: DecodedInsn[]): RecoveredContext["returns"] {
  let definesV0 = false;
  for (const insn of insns) {
    switch (insn.op) {
      case "addu": case "subu": case "and": case "or": case "xor": case "nor":
      case "slt": case "sltu": case "sll": case "srl": case "sra":
      case "sllv": case "srlv": case "srav": case "mfhi": case "mflo":
        if (insn.rd === 2) definesV0 = true;
        break;
      case "addiu": case "addi": case "slti": case "sltiu":
      case "andi": case "ori": case "xori": case "lui":
      case "lb": case "lbu": case "lh": case "lhu": case "lw":
        if (insn.rt === 2) definesV0 = true;
        break;
      case "jal": case "jalr":
        definesV0 = true;
        break;
      default:
        break;
    }
  }
  if (!definesV0) {
    return { kind: "void", strength: "proved", evidence: ["no instruction defines $v0 on any path"] };
  }
  const liveIn = computeLiveIn(insns);
  for (let index = 0; index < insns.length; index++) {
    if (insns[index]!.op !== "jr" || insns[index]!.rs !== 31) continue;
    if (liveIn[index * 2]! & (1 << 2)) {
      return { kind: "value", strength: "proved", evidence: [`$v0 is live at the return at 0x${insns[index]!.vram.toString(16)}`] };
    }
  }
  return {
    kind: "unknown",
    strength: "bounded",
    evidence: ["$v0 is written but not live at the return — the value may still be the caller's"],
  };
}

/** Walk every effect and expression the DAG holds, in arena order. */
function walkEffects(executed: ExecResult, visit: (effect: Effect) => void): void {
  const seen = new Set<number>();
  const walk = (ref: number): void => {
    if (ref < 0 || seen.has(ref)) return;
    seen.add(ref);
    const node = executed.arena.node(ref);
    if (!node) return;
    if (node.kind === "leaf") {
      for (const effect of node.effects) visit(effect);
      return;
    }
    if (node.kind === "test") { walk(node.onTrue); walk(node.onFalse); return; }
    if (node.kind === "dispatch") { for (const target of node.targets) walk(target); return; }
    if (node.kind === "loop") { walk(node.body); return; }
  };
  walk(executed.root);
}

/** Classify where a symbolic base came from, for the object record. */
function originOf(base: string): ObjectFact["origin"] {
  if (base === "@sp") return "stack";
  if (/^@a[0-3]$/.test(base)) return "parameter";
  if (base.startsWith("@")) return "other";
  if (base.startsWith("M")) return "loaded-pointer";
  if (base.startsWith("CR(")) return "call-result";
  if (base.startsWith("#")) return "absolute";
  return "other";
}

type AccessKind = "load" | "store";
const mergeAccess = (existing: "load" | "store" | "both" | undefined, next: AccessKind): "load" | "store" | "both" =>
  existing === undefined ? next : existing === next ? existing : "both";

/**
 * Globals and objects, from the decoded words plus (when execution succeeded)
 * the recovered relation's own accesses.
 *
 * The word-level pass runs unconditionally, so an absolute address the
 * function names is recorded even when the function is unrepresentable.
 */
function recoverStorage(
  executed: ExecResult | undefined,
  container: Container,
): { globals: GlobalFact[]; objects: ObjectFact[] } {
  const globals = new Map<number, GlobalFact>();
  const objects = new Map<string, ObjectFact>();
  let symbolIndex: ReturnType<typeof loadSymbolIndex> | undefined;
  try {
    symbolIndex = loadSymbolIndex(container);
  } catch {
    symbolIndex = undefined;
  }

  const noteGlobal = (address: number, width: 1 | 2 | 4, signed: boolean, access: AccessKind, viaGp: boolean): void => {
    /* A label is attached only when it plausibly covers the address. A
     * hi/lo pair scanned out of a register the code never actually used as a
     * base can name any number, and `resolveAddress` will happily return the
     * nearest preceding symbol with a megabyte-wide offset — which reads as a
     * fact and is not one. */
    const resolved = symbolIndex ? coveringSymbol(symbolIndex, address >>> 0) : null;
    const existing = globals.get(address >>> 0);
    if (existing) {
      existing.access = mergeAccess(existing.access, access);
      existing.viaGp ||= viaGp;
      return;
    }
    globals.set(address >>> 0, {
      address: address >>> 0,
      ...(resolved ? { symbol: resolved.symbol, offset: resolved.offset } : {}),
      width,
      signed,
      access,
      viaGp,
    });
  };

  const noteFieldAt = (
    key: string,
    offset: number,
    width: 1 | 2 | 4,
    signed: boolean,
    access: AccessKind,
    indexScale: number | undefined,
  ): void => {
    const record = objects.get(key) ?? { base: key, origin: originOf(key), fields: [], minimumExtent: 0 };
    const existing = record.fields.find((field) => field.offset === offset && field.width === width);
    if (existing) existing.access = mergeAccess(existing.access, access);
    else {
      record.fields.push({
        offset, width, signed, access,
        ...(indexScale !== undefined ? { indexScale } : {}),
      });
    }
    record.minimumExtent = Math.max(record.minimumExtent, offset + width);
    objects.set(key, record);
  };

  const noteField = (
    base: SymExpr,
    offset: number,
    width: 1 | 2 | 4,
    signed: boolean,
    access: AccessKind,
    indexScale: number | undefined,
  ): void => noteFieldAt(canon(base), offset, width, signed, access, indexScale);

  if (executed) {
    /* The load table is the complete set of atoms the relation reads, and it
     * is the only place a read-only function's object shape shows up at all —
     * a function with no stores has no effect log to mine. */
    for (const load of executed.loads) {
      if (load.baseCanon === undefined) {
        noteGlobal(load.address, load.width, load.signed, "load", load.viaGp);
      } else {
        /* An indexed base canon carries its own `[...]` suffix; the object is
         * the base without it, and the bracket names the stride. */
        const indexed = load.baseCanon.match(/^(.*)\[(.*)\*(\d+)\]$/);
        const base = indexed ? indexed[1]! : load.baseCanon;
        const scale = indexed ? Number(indexed[3]) : undefined;
        noteFieldAt(base, load.address, load.width, load.signed, "load", scale);
      }
    }
    /* Loads carry their base only as a canonical string; the store effects
     * carry the expression, which is what an object record needs. Pointer
     * loads are recovered from the store side plus the atoms inside stored
     * values, which is where every base expression appears. */
    walkEffects(executed, (effect) => {
      if (effect.kind === "store") {
        const store = effect as StoreEffect;
        if (store.base) {
          noteField(store.base, store.address, store.width, false, "store", store.index?.scale);
        } else {
          noteGlobal(store.address, store.width, false, "store", store.viaGp ?? false);
        }
        collectLoadBases(store.value, noteField, noteGlobal);
      } else {
        for (const arg of abiArguments(effect as CallEffect)) {
          if (arg) collectLoadBases(arg, noteField, noteGlobal);
        }
      }
    });
  }

  return {
    globals: [...globals.values()].sort((left, right) => left.address - right.address),
    objects: [...objects.values()]
      .map((object) => ({ ...object, fields: object.fields.sort((left, right) => left.offset - right.offset) }))
      .sort((left, right) => left.base.localeCompare(right.base)),
  };
}

/**
 * The symbol covering an address, when one plausibly does.
 *
 * Two filters, and both are about not stating a fact the evidence does not
 * support. An address outside the machine's data regions is not data — it is
 * usually a half-formed value a scan picked up — and a "symbol + 0x1f7daf1c"
 * is the symbol table's nearest preceding entry, not a label for this address.
 */
const SYMBOL_OFFSET_LIMIT = 0x10000;

function plausibleDataAddress(address: number): boolean {
  const value = address >>> 0;
  /* Main RAM, cached and uncached; the scratchpad; the I/O window. */
  if (value >= 0x80000000 && value < 0x80800000) return true;
  if (value >= 0xa0000000 && value < 0xa0800000) return true;
  if (value >= 0x1f800000 && value < 0x1f802000) return true;
  if (value >= 0x1f000000 && value < 0x1f100000) return true;
  return false;
}

function coveringSymbol(
  index: ReturnType<typeof loadSymbolIndex>,
  address: number,
): { symbol: string; offset: number } | null {
  if (!plausibleDataAddress(address)) return null;
  const resolved = resolveAddress(index, address >>> 0);
  if (!resolved) return null;
  return resolved.offset > SYMBOL_OFFSET_LIMIT ? null : resolved;
}

/** Every load atom inside an expression, routed to the right record. */
function collectLoadBases(
  expr: SymExpr,
  noteField: (base: SymExpr, offset: number, width: 1 | 2 | 4, signed: boolean, access: AccessKind, indexScale: number | undefined) => void,
  noteGlobal: (address: number, width: 1 | 2 | 4, signed: boolean, access: AccessKind, viaGp: boolean) => void,
): void {
  switch (expr.kind) {
    case "load":
      if (expr.base) noteField(expr.base, expr.address, expr.width, expr.signed, "load", expr.index?.scale);
      else noteGlobal(expr.address, expr.width, expr.signed, "load", false);
      if (expr.base) collectLoadBases(expr.base, noteField, noteGlobal);
      if (expr.index) collectLoadBases(expr.index.expr, noteField, noteGlobal);
      return;
    case "unary": return collectLoadBases(expr.operand, noteField, noteGlobal);
    case "binary":
      collectLoadBases(expr.left, noteField, noteGlobal);
      collectLoadBases(expr.right, noteField, noteGlobal);
      return;
    default: return;
  }
}

/** Absolute addresses named by hi/lo pairs, even when execution refused. */
function absoluteAddressesFromWords(insns: DecodedInsn[]): Array<{ address: number; width?: 1 | 2 | 4; signed?: boolean; access?: AccessKind }> {
  const pending = new Map<number, number>(); /* register -> high half */
  const out: Array<{ address: number; width?: 1 | 2 | 4; signed?: boolean; access?: AccessKind }> = [];
  for (const insn of insns) {
    if (insn.op === "lui") {
      pending.set(insn.rt, (insn.uimm << 16) >>> 0);
      continue;
    }
    /* A register redefined by anything other than `lui` stops carrying a high
     * half; checked before the use below so `lw v0, lo(v0)` still resolves
     * against the half it was just given. */
    const redefined = insn.rt !== 0 && insn.rt !== insn.rs;
    const high = pending.get(insn.rs);
    if (high === undefined) {
      if (redefined) pending.delete(insn.rt);
      continue;
    }
    if (isLoad(insn.op)) {
      out.push({ address: (high + insn.simm) >>> 0, width: loadWidth(insn.op), signed: loadSigned(insn.op), access: "load" });
    } else if (isStore(insn.op)) {
      const width: 1 | 2 | 4 = insn.op === "sw" ? 4 : insn.op === "sh" ? 2 : 1;
      out.push({ address: (high + insn.simm) >>> 0, width, signed: false, access: "store" });
    } else if (insn.op === "addiu" || insn.op === "ori") {
      out.push({ address: (high + (insn.op === "ori" ? insn.uimm : insn.simm)) >>> 0 });
    }
    if (redefined) pending.delete(insn.rt);
  }
  return out;
}

/**
 * Recover everything the target proves about one function's context.
 *
 * `executed` is optional: pass the executor's result when it succeeded, and
 * omit it when it refused. The word-level facts are produced either way, which
 * is the whole point of the product.
 */
export function recoverContext(
  functionName: string,
  options: { container?: Container | undefined } = {},
): RecoveredContext {
  const location = requireFunctionLocation(functionName);
  const container = options.container ?? location.container;
  const span = location.span;
  const image = readFileSync(containerTargetPath(container));
  const rom = vramToRom(container, span.vram);
  const insns = decodeBytes(image.subarray(rom, rom + span.size), span.vram);
  const notes: string[] = [];

  let executed: ExecResult | undefined;
  try {
    const symbolIndex = loadSymbolIndex(container);
    executed = executeFunction(insns, {
      gpValue: container.gpValue || undefined,
      readWord: (vram) => {
        const at = vramToRom(container, vram);
        if (at < 0 || at + 4 > image.length) return undefined;
        return image.readUInt32LE(at);
      },
      resolveCallTarget: (address) => {
        const resolved = resolveAddress(symbolIndex, address >>> 0);
        return resolved ? resolved.symbol : null;
      },
    });
  } catch (error) {
    executed = undefined;
    notes.push(
      error instanceof UnsupportedTarget
        ? `symbolic execution refused (${error.category}): ${error.reason} — word-level facts below still hold`
        : `symbolic execution failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return recoverContextFrom({ functionName, container, vram: span.vram, sizeBytes: span.size, insns, executed, notes });
}

/**
 * The pure half: context from words the caller already has.
 *
 * The engine has both the decode and the executor's result by the time it
 * wants a context product, and executing twice for one bundle is a real cost
 * on a function with a large decision structure.
 */
export function recoverContextFrom(input: {
  functionName: string;
  container: Container;
  vram: number;
  sizeBytes: number;
  insns: DecodedInsn[];
  executed?: ExecResult | undefined;
  notes?: string[] | undefined;
}): RecoveredContext {
  const { functionName, container, insns, executed } = input;
  const span = { vram: input.vram, size: input.sizeBytes };
  const notes = [...(input.notes ?? [])];

  const parameters = recoverParameters(insns);
  const returns = recoverReturn(insns);
  const storage = recoverStorage(executed, container);

  /* Fold pointer use back into the parameter records: a base `@aN` in the
   * object table means the body dereferenced that parameter. */
  for (const object of storage.objects) {
    const match = object.base.match(/^@a([0-3])$/);
    if (!match) continue;
    const parameter = parameters.find((candidate) => candidate.index === Number(match[1]));
    if (!parameter) continue;
    parameter.usedAsPointerBase = true;
    parameter.fieldOffsets = object.fields.map((field) => field.offset);
    parameter.evidence.push(`dereferenced at offsets ${object.fields.map((field) => `0x${field.offset.toString(16)}`).join(", ")}`);
  }

  /* Calls: resolved signatures where a tier answers, bounded ranges where
   * none does. Both from the target; neither invented. */
  const calls: CallFact[] = [];
  const consumed = new Set<number>();
  if (executed) {
    walkEffects(executed, (effect) => {
      if (effect.kind !== "call") return;
      if (effect.resultUsed) consumed.add(effect.seq);
    });
    const seen = new Set<number>();
    walkEffects(executed, (effect) => {
      if (effect.kind !== "call") return;
      const call = effect as CallEffect;
      if (seen.has(call.vram)) return;
      seen.add(call.vram);
      const name = call.calleeName ?? call.callee;
      /* The complete ABI list: the register slots plus the outgoing-area
       * slots the caller wrote. Reporting only the registers understates the
       * arity of every call with more than four arguments. */
      const abi = abiArguments(call);
      const fact: CallFact = {
        vram: call.vram,
        callee: name,
        indirect: call.indirect ?? false,
        argExprs: abi.map((arg) => (arg === null ? "(not established)" : canon(arg))),
        resultUsed: call.resultUsed,
      };
      const signature = resolveSignature(call.calleeName, call.calleeAddress, container);
      if ("unknown" in signature) {
        if (!call.indirect && !/^0x[0-9a-f]+$/i.test(name)) {
          const range = inferSignatureRange(name, call.calleeAddress, container, abi, consumed, call.seq);
          fact.range = range;
        }
      } else {
        fact.signature = {
          arity: signature.arity,
          paramTypes: signature.paramTypes,
          returnsValue: signature.returnsValue,
          returnType: signature.returnType,
          strength: signature.source === "matched" ? "proved" : signature.source === "sdk" ? "declared" : "bounded",
        };
      }
      calls.push(fact);
    });
  } else {
    /* Without execution, `jal` targets are still absolute and resolvable. */
    let symbolIndex: ReturnType<typeof loadSymbolIndex> | undefined;
    try { symbolIndex = loadSymbolIndex(container); } catch { symbolIndex = undefined; }
    for (const insn of insns) {
      if (insn.op === "jalr") {
        calls.push({ vram: insn.vram, callee: `indirect@0x${insn.vram.toString(16)}`, indirect: true });
        continue;
      }
      if (insn.op !== "jal" || insn.target === undefined) continue;
      const address = insn.target >>> 0;
      const resolved = symbolIndex ? resolveAddress(symbolIndex, address) : null;
      const name = resolved ? resolved.symbol : `0x${address.toString(16)}`;
      const fact: CallFact = { vram: insn.vram, callee: name, indirect: false };
      const signature = resolved ? resolveSignature(name, address, container) : { unknown: "unresolved target" };
      if (!("unknown" in signature)) {
        fact.signature = {
          arity: signature.arity,
          paramTypes: signature.paramTypes,
          returnsValue: signature.returnsValue,
          returnType: signature.returnType,
          strength: signature.source === "matched" ? "proved" : signature.source === "sdk" ? "declared" : "bounded",
        };
      }
      calls.push(fact);
    }
  }

  /* Absolute addresses the words name, merged in so a refused function still
   * reports the globals it touches. */
  if (!executed) {
    let symbolIndex: ReturnType<typeof loadSymbolIndex> | undefined;
    try { symbolIndex = loadSymbolIndex(container); } catch { symbolIndex = undefined; }
    const byAddress = new Map(storage.globals.map((global) => [global.address, global]));
    for (const witness of absoluteAddressesFromWords(insns)) {
      if (byAddress.has(witness.address)) continue;
      if (!plausibleDataAddress(witness.address)) continue;
      const resolved = symbolIndex ? coveringSymbol(symbolIndex, witness.address) : null;
      byAddress.set(witness.address, {
        address: witness.address,
        ...(resolved ? { symbol: resolved.symbol, offset: resolved.offset } : {}),
        width: witness.width ?? 4,
        signed: witness.signed ?? false,
        access: witness.access ?? "load",
        viaGp: false,
      });
    }
    storage.globals = [...byAddress.values()].sort((left, right) => left.address - right.address);
  }

  /* Operations recovered from the words. This runs whether or not execution
   * succeeded: a block move is exactly the case the executor refuses. */
  const operations: RecognizedOperation[] = [];
  const copy = recognizeCopyRecipe(insns);
  if (copy) operations.push({ ...copy, summary: describeCopyRecipe(copy) });

  return {
    schemaVersion: RECOVERED_CONTEXT_SCHEMA_VERSION,
    functionName,
    containerId: container.id,
    vram: span.vram,
    sizeBytes: span.size,
    features: targetFeatures(insns),
    parameters,
    returns,
    calls,
    globals: storage.globals,
    objects: storage.objects,
    operations,
    notes,
  };
}

/**
 * Prototype text for every callee whose signature is known, for a draft that
 * must declare what it calls.
 *
 * Parameter types are preserved: dropping them and printing `s32` is how a
 * pointer argument becomes an integer argument in the draft handed to an
 * agent, and it is not cheaper than keeping what was already resolved.
 */
export function calleePrototypes(context: RecoveredContext): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const call of context.calls) {
    if (!call.signature || seen.has(call.callee)) continue;
    if (/^(0x[0-9a-f]+|indirect@)/i.test(call.callee)) continue;
    seen.add(call.callee);
    const returnType = call.signature.returnsValue ? call.signature.returnType : "void";
    const params = call.signature.arity === 0
      ? "void"
      : Array.from({ length: call.signature.arity }, (_, index) =>
          `${call.signature!.paramTypes[index] ?? "s32"} arg${index}`).join(", ");
    out.push(`${returnType} ${call.callee}(${params});`);
  }
  return out;
}

/** Where a function's recovered context is persisted. */
export function contextPath(functionName: string): string {
  return join(ROOT, "build/matchingReconstruction", functionName, "context.json");
}

/** Human-readable summary; the CLI's output and a bundle's context section. */
export function renderContext(context: RecoveredContext): string[] {
  const lines: string[] = [];
  lines.push(`${context.functionName} @ 0x${context.vram.toString(16)} (${context.sizeBytes} B, ${context.containerId})`);
  const features = context.features;
  lines.push(
    `  target: ${features.words} words` +
    `${features.hasCalls ? ", calls" : ""}${features.hasStores ? ", stores" : ""}` +
    `${features.hasBackEdge ? ", back-edge" : ""}` +
    `${features.unknownOpcodes.length ? `, undecoded(${features.unknownOpcodes.join("+")})` : ""}`,
  );
  lines.push(`  returns: ${context.returns.kind} [${context.returns.strength}] — ${context.returns.evidence[0] ?? ""}`);
  lines.push(`  parameters: ${context.parameters.length === 0 ? "(none proved)" : ""}`);
  for (const parameter of context.parameters) {
    lines.push(
      `    ${parameter.register} [${parameter.strength}]` +
      `${parameter.usedAsPointerBase ? ` pointer, fields ${parameter.fieldOffsets.map((offset) => `0x${offset.toString(16)}`).join(",")}` : ""}`,
    );
  }
  if (context.calls.length > 0) {
    lines.push(`  calls:`);
    for (const call of context.calls) {
      const signature = call.signature
        ? `arity ${call.signature.arity} [${call.signature.strength}]${call.signature.returnsValue ? " → value" : " → void"}`
        : call.range
          ? `arity ${call.range.arityLo}..${call.range.arityHi} [caller-evidence], returns ${call.range.returns}`
          : "unresolved";
      lines.push(`    0x${call.vram.toString(16)} ${call.callee} — ${signature}`);
    }
  }
  if (context.globals.length > 0) {
    lines.push(`  globals:`);
    for (const global of context.globals) {
      const label = global.symbol ? `${global.symbol}${global.offset ? `+0x${global.offset.toString(16)}` : ""}` : "(unlabelled)";
      lines.push(`    0x${global.address.toString(16)} ${label} ${global.width}B ${global.access}${global.viaGp ? " via-gp" : ""}`);
    }
  }
  for (const object of context.objects) {
    lines.push(`  object ${object.base} (${object.origin}), minimum extent 0x${object.minimumExtent.toString(16)}:`);
    for (const field of object.fields) {
      lines.push(
        `    +0x${field.offset.toString(16)} ${field.width}B ${field.signed ? "signed" : "unsigned"} ${field.access}` +
        `${field.indexScale ? ` index*${field.indexScale}` : ""}`,
      );
    }
  }
  for (const operation of context.operations) {
    lines.push(`  operation: ${operation.summary}`);
    for (const item of operation.evidence) lines.push(`    ${item}`);
  }
  for (const note of context.notes) lines.push(`  note: ${note}`);
  return lines;
}

/* Re-exported so consumers need one import for the register vocabulary. */
export { REGISTER_NAMES };
