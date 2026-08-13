#!/usr/bin/env npx tsx
/**
 * sdkIdioms.ts — recognize PSY-Q packet types and macro operations in a
 * target function.
 *
 * A GPU packet emitter compiles to anonymous shift/mask arithmetic against
 * anonymous struct offsets. Reconstructed by hand it becomes invented types
 * and hand-rolled bitfield math; reconstructed with the SDK header it is a
 * handful of macro calls. Nothing about the target says "libgpu" — so an agent
 * that does not already suspect it will never look.
 *
 * Born from func_80016C08 (2026-08-02), where a session was spent
 * reverse-engineering a POLY_FT4 emitter as anonymous arithmetic, and the
 * `tpage` word — a whole `getTPage()` call — was simply missing from the
 * reconstruction because nothing named the field. Extended after
 * func_800134C4 (2026-08-13), where the primitive was invisible because the
 * target's code byte was `0x2A`: `setPolyF4`'s base `0x28` with
 * `setSemiTrans`'s documented attribute bit already applied.
 *
 * Every SDK fact — packet sizes, field offsets, command values, attribute
 * masks, macro expansions, the struct a command macro builds — is PARSED from
 * the vendored include/psyq/libgpu.h at run time. Nothing is duplicated here:
 * change the header vintage and this tool follows it.
 *
 * Recognition anchors:
 *   - `setXxx(p)` expands to `setlen(p,L), setcode(p,C)`, emitting
 *     `sb <L>, 3(base)` and `sb <C>, 7(base)` against a shared base. The
 *     (len, base code) pair identifies the primitive type outright once the
 *     parsed attribute bits are stripped from the observed code.
 *   - a command macro expands to `setlen(p,L)` plus fixed word stores whose
 *     top byte is a GPU command; the length and the command discriminate the
 *     packet family.
 *   - `addPrim(ot, p)` is two complete 24-bit tag merges, each preserving one
 *     word's top byte and taking the other's low 24 bits.
 *
 * Usage:
 *   npx tsx tools/agent/sdkIdioms.ts func_800134C4
 *   npx tsx tools/agent/sdkIdioms.ts func_800134C4 --json
 */

import { existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import {
  ROOT,
  type DisassembledInstruction,
  assembleTarget,
  disassembleObject,
  normalizeFunctionName,
} from "./decompToolchain.js";
import { defUse } from "./webAnalysis.js";

const LIBGPU_RELATIVE = "include/psyq/libgpu.h";
const LIBGPU = join(ROOT, LIBGPU_RELATIVE);

/* --- header parsing: struct layouts --- */

export interface PrimitiveField {
  offset: number;
  name: string;
  size: number;
  /** Element count when this row is the aggregate of a fixed-size array. */
  elementCount?: number;
}

export interface StructLayout {
  /** Addressable rows: scalars, plus one aggregate row per fixed array
   *  followed by its element rows. */
  fields: PrimitiveField[];
  size: number;
}

export interface PrimitiveType {
  /** Struct name, e.g. POLY_FT4. */
  name: string;
  /** Initializer macro, e.g. setPolyFT4. */
  macro: string;
  len: number;
  code: number;
  size: number;
  fields: PrimitiveField[];
}

const TYPE_SIZES: Record<string, number> = {
  char: 1, u_char: 1, uchar: 1, s8: 1, u8: 1,
  short: 2, u_short: 2, ushort: 2, s16: 2, u16: 2,
  int: 4, long: 4, u_long: 4, ulong: 4, unsigned: 4, s32: 4, u32: 4,
};

function align(offset: number, to: number): number {
  return Math.ceil(offset / to) * to;
}

/**
 * Lay out a C struct body under natural alignment.
 *
 * Fixed-size arrays of a known element type are modeled, because the special
 * primitives are declared that way (`u_long code[2]` is what makes DR_MODE
 * twelve bytes) and a parser that rejects them cannot see those packets at
 * all. Everything the layout cannot place exactly — bitfields, flexible or
 * non-literal array bounds, unknown element types, nested aggregates —
 * returns null rather than a guess.
 */
export function layoutStruct(body: string): StructLayout | null {
  const cleaned = body.replace(/\/\*[\s\S]*?\*\//g, " ");
  if (/[{}]/.test(cleaned)) return null; /* nested anonymous aggregate */
  const fields: PrimitiveField[] = [];
  let offset = 0;
  let maxAlign = 1;

  for (const chunk of cleaned.split(";")) {
    const text = chunk.trim();
    if (!text) continue;
    if (text.includes(":")) return null; /* bitfield — not a layout we model */

    const match = text.match(/^(\w+)\s+([\w,\s[\]]+)$/);
    if (!match) return null;
    const size = TYPE_SIZES[match[1]];
    if (!size) return null;

    for (const rawName of match[2].split(",")) {
      const name = rawName.trim();
      if (!name) continue;
      if (name.includes("[")) {
        const array = name.match(/^(\w+)\[(\d+)\]$/);
        if (!array) return null; /* flexible or non-literal dimension */
        const count = parseInt(array[2], 10);
        if (count <= 0) return null;
        offset = align(offset, size);
        fields.push({ offset, name: array[1], size: size * count, elementCount: count });
        for (let index = 0; index < count; index++) {
          fields.push({ offset: offset + index * size, name: `${array[1]}[${index}]`, size });
        }
        offset += size * count;
        maxAlign = Math.max(maxAlign, size);
        continue;
      }
      offset = align(offset, size);
      fields.push({ offset, name, size });
      offset += size;
      maxAlign = Math.max(maxAlign, size);
    }
  }

  if (fields.length === 0) return null;
  return { fields, size: align(offset, maxAlign) };
}

/** The rows a store can land on: aggregates are spans, not addressable slots. */
function scalarFields(fields: PrimitiveField[]): PrimitiveField[] {
  return fields.filter((field) => field.elementCount === undefined);
}

/**
 * `setPolyFT4` -> `POLY_FT4`, `setSprt8` -> `SPRT_8`, `setTile16` -> `TILE_16`.
 * Matching on the underscore-stripped uppercase name avoids guessing where
 * the SDK put its separators.
 */
function structNameFor(macroSuffix: string, known: Map<string, string>): string | undefined {
  return known.get(macroSuffix.toUpperCase());
}

function readHeader(): string | null {
  if (!existsSync(LIBGPU)) return null;
  /* The vendored SDK headers are CRLF; splice continuations so a multi-line
   * macro reads as the single expression it is. */
  return readFileSync(LIBGPU, "utf-8").replace(/\r\n/g, "\n");
}

export function loadStructLayouts(header: string): {
  layouts: Map<string, StructLayout>;
  byStrippedName: Map<string, string>;
} {
  const layouts = new Map<string, StructLayout>();
  const byStrippedName = new Map<string, string>();
  const structRe = /typedef\s+struct\s*\{([\s\S]*?)\}\s*(\w+)\s*;/g;
  for (let m = structRe.exec(header); m; m = structRe.exec(header)) {
    const layout = layoutStruct(m[1]);
    if (!layout) continue;
    layouts.set(m[2], layout);
    byStrippedName.set(m[2].replace(/_/g, "").toUpperCase(), m[2]);
  }
  return { layouts, byStrippedName };
}

/* --- header parsing: attribute macros --- */

export interface AttributeMacro {
  macro: string;
  mask: number;
}

/**
 * `setSemiTrans` and `setShadeTex` are code-byte attributes, not primitives:
 * they set or clear one documented bit of an already-initialized packet. Their
 * masks are read out of the header rather than restated, because stripping a
 * bit the active SDK does not define would turn an unexplained code byte into
 * a confident wrong type.
 */
export function parseAttributeMacros(header: string): AttributeMacro[] {
  const spliced = header.replace(/\\\n/g, " ");
  const result: AttributeMacro[] = [];
  const re = /#define\s+(set\w+)\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*([^\n]*)/g;
  for (let m = re.exec(spliced); m; m = re.exec(spliced)) {
    const [, macro, pointer, flag, body] = m;
    const pattern = new RegExp(
      `^\\(\\(${flag}\\)\\s*\\?\\s*setcode\\(\\s*${pointer}\\s*,\\s*getcode\\(\\s*${pointer}\\s*\\)\\s*\\|\\s*(0x[0-9a-fA-F]+|\\d+)\\s*\\)` +
      `\\s*:\\s*setcode\\(\\s*${pointer}\\s*,\\s*getcode\\(\\s*${pointer}\\s*\\)\\s*&\\s*~\\s*(0x[0-9a-fA-F]+|\\d+)\\s*\\)\\s*\\)`,
    );
    const attribute = body.trim().match(pattern);
    if (!attribute) continue;
    const set = Number(attribute[1]);
    const clear = Number(attribute[2]);
    /* A set mask that differs from the cleared mask is not one attribute. */
    if (!Number.isFinite(set) || set !== clear || set === 0) continue;
    result.push({ macro, mask: set });
  }
  return result;
}

/* --- header parsing: primitive initializer table --- */

export function loadPrimitiveTable(header?: string): PrimitiveType[] {
  const text = header ?? readHeader();
  if (text === null) return [];
  const { layouts, byStrippedName } = loadStructLayouts(text);

  const primitives: PrimitiveType[] = [];
  const macroRe =
    /#define\s+set(\w+)\s*\(\s*p\s*\)\s*setlen\s*\(\s*p\s*,\s*(\d+)\s*\)\s*,\s*setcode\s*\(\s*p\s*,\s*(0x[0-9a-fA-F]+)\s*\)/g;
  for (let m = macroRe.exec(text); m; m = macroRe.exec(text)) {
    const structName = structNameFor(m[1], byStrippedName);
    if (!structName) continue;
    const layout = layouts.get(structName);
    if (!layout) continue;
    primitives.push({
      name: structName,
      macro: `set${m[1]}`,
      len: parseInt(m[2], 10),
      code: parseInt(m[3], 16),
      size: layout.size,
      fields: layout.fields,
    });
  }
  return primitives;
}

/* --- header parsing: command-packet recipes --- */

export interface ExpressionTerm {
  kind: "constant" | "conditional" | "masked" | "unknown";
  /** Constant value, or the bit a conditional term contributes. */
  value?: number;
  /** Mask a passthrough term contributes. */
  mask?: number;
  parameter?: string;
  /** Source text of a term the model cannot place exactly. */
  text?: string;
}

export type PacketExpression =
  | { kind: "or-chain"; terms: ExpressionTerm[] }
  /** `param ? <expression> : 0` — the SDK's optional-argument form. */
  | { kind: "nullable"; parameter: string; whenTrue: PacketExpression }
  | { kind: "opaque"; text: string };

export interface PacketWrite {
  offset: number;
  width: number;
  expression: string;
  parsed: PacketExpression;
  /** Every bit the expression can set, when that is known exactly. */
  constantMask?: number;
  /** The whole word, when the expression is a literal. */
  constantValue?: number;
}

export interface SdkPacketRecipe {
  macro: string;
  type: string;
  size: number;
  /** The packet struct's layout, so a store outside it refuses the recipe. */
  fields: PrimitiveField[];
  len: number;
  parameters: string[];
  writes: PacketWrite[];
}

/** Split on a top-level separator, ignoring anything inside parentheses. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === "(") depth++;
    else if (character === ")") depth--;
    else if (character === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim());
}

/**
 * Drop a leading pointer cast. Only the `(TYPE *)` form is stripped: a
 * parenthesized bare identifier is indistinguishable from a non-pointer cast,
 * and stripping that would delete the operand.
 */
function stripPointerCast(text: string): string {
  return text.trim().replace(/^\(\s*[A-Za-z_]\w*(?:\s+[A-Za-z_]\w*)*\s*\*+\s*\)\s*/, "");
}

function stripOuterParens(text: string): string {
  let value = text.trim();
  while (value.startsWith("(") && value.endsWith(")")) {
    let depth = 0;
    let balanced = true;
    for (let index = 0; index < value.length; index++) {
      if (value[index] === "(") depth++;
      else if (value[index] === ")") depth--;
      if (depth === 0 && index < value.length - 1) { balanced = false; break; }
    }
    if (!balanced) break;
    value = value.slice(1, -1).trim();
  }
  return value;
}

interface MacroDefinition {
  parameters: string[];
  body: string;
}

/** Every object-or-function-like `#define` in the header, by name. */
export function parseMacroDefinitions(header: string): Map<string, MacroDefinition> {
  const spliced = header.replace(/\\\n/g, " ");
  const result = new Map<string, MacroDefinition>();
  const re = /^[ \t]*#[ \t]*define[ \t]+(\w+)\(([^)]*)\)([^\n]*)$/gm;
  for (let m = re.exec(spliced); m; m = re.exec(spliced)) {
    const parameters = m[2].split(",").map((name) => name.trim()).filter(Boolean);
    result.set(m[1], { parameters, body: m[3].replace(/\/\*[\s\S]*?\*\//g, " ").trim() });
  }
  return result;
}

/** Expand registered helper macro calls inside an expression, bounded. */
function expandHelpers(text: string, macros: Map<string, MacroDefinition>, depth = 0): string {
  if (depth > 4) return text;
  const call = text.trim().match(/^([A-Za-z_]\w*)\s*\((.*)\)$/s);
  if (!call) return text;
  const definition = macros.get(call[1]);
  if (!definition) return text;
  const args = splitTopLevel(call[2], ",");
  if (args.length !== definition.parameters.length) return text;
  let body = definition.body;
  definition.parameters.forEach((parameter, index) => {
    body = body.replace(new RegExp(`\\b${parameter}\\b`, "g"), `(${args[index]})`);
  });
  return expandHelpers(body, macros, depth + 1);
}

/**
 * Model a packet word expression exactly or refuse.
 *
 * The supported shape is the one the SDK actually uses for command words: a
 * top-level `|` chain of a literal command constant, `(flag ? BIT : 0)`
 * attribute bits, and `(arg & MASK)` passthroughs. A term outside that set is
 * kept as `unknown` rather than discarding the whole chain, because OR never
 * clears a bit: the literal command constant of a chain is a necessary
 * condition on the observed word even when the rest cannot be modeled.
 */
export function parseExpression(text: string, macros: Map<string, MacroDefinition>): PacketExpression {
  const expanded = stripOuterParens(expandHelpers(text, macros));

  const ternary = splitTernary(expanded);
  if (ternary && ternary.otherwise.trim() === "0") {
    const condition = stripPointerCast(stripOuterParens(ternary.condition));
    if (/^[A-Za-z_]\w*$/.test(condition)) {
      return { kind: "nullable", parameter: condition, whenTrue: parseExpression(ternary.then, macros) };
    }
  }

  const pieces = splitTopLevel(expanded, "|");
  if (pieces.length === 1 && splitTernary(stripOuterParens(pieces[0])) !== null) {
    /* A lone ternary that is not the nullable form carries no bit structure. */
    return { kind: "opaque", text: expanded };
  }
  const terms: ExpressionTerm[] = [];
  for (const piece of pieces) {
    const inner = stripOuterParens(piece);
    const literal = inner.match(/^(?:0x[0-9a-fA-F]+|\d+)$/);
    if (literal) { terms.push({ kind: "constant", value: Number(inner) }); continue; }

    const conditional = splitTernary(inner);
    if (conditional && conditional.otherwise.trim() === "0") {
      const parameter = stripPointerCast(stripOuterParens(conditional.condition));
      const bit = stripOuterParens(conditional.then);
      if (/^[A-Za-z_]\w*$/.test(parameter) && /^(?:0x[0-9a-fA-F]+|\d+)$/.test(bit)) {
        terms.push({ kind: "conditional", value: Number(bit), parameter });
        continue;
      }
    }

    const conjuncts = splitTopLevel(inner, "&");
    if (conjuncts.length === 2) {
      const argument = stripPointerCast(stripOuterParens(conjuncts[0]));
      const mask = stripOuterParens(conjuncts[1]);
      if (/^[A-Za-z_]\w*$/.test(argument) && /^(?:0x[0-9a-fA-F]+|\d+)$/.test(mask)) {
        terms.push({ kind: "masked", mask: Number(mask), parameter: argument });
        continue;
      }
    }
    terms.push({ kind: "unknown", text: inner });
  }
  return { kind: "or-chain", terms };
}

function splitTernary(text: string): { condition: string; then: string; otherwise: string } | null {
  let depth = 0;
  let question = -1;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === "(") depth++;
    else if (character === ")") depth--;
    else if (character === "?" && depth === 0) { question = index; break; }
  }
  if (question < 0) return null;
  depth = 0;
  for (let index = question + 1; index < text.length; index++) {
    const character = text[index];
    if (character === "(") depth++;
    else if (character === ")") depth--;
    else if (character === ":" && depth === 0) {
      return {
        condition: text.slice(0, question),
        then: text.slice(question + 1, index),
        otherwise: text.slice(index + 1),
      };
    }
  }
  return null;
}

export interface EvaluatedArgument {
  name: string;
  value: number;
  /** `exact` when the observed word determines the argument's effect on the
   *  packet; `compatible` when only the masked bits are established. */
  confidence: "exact" | "compatible";
  note: string;
}

export type WordEvaluation =
  | { ok: true; arguments: EvaluatedArgument[] }
  | { ok: false; incompatible: boolean; reason: string };

/** Invert one modeled expression against an observed 32-bit word. */
export function evaluateWord(expression: PacketExpression, observed: number): WordEvaluation {
  if (expression.kind === "opaque") {
    return { ok: false, incompatible: false, reason: `expression not modeled: ${expression.text}` };
  }
  if (expression.kind === "nullable") {
    if (observed === 0) {
      const inner = expression.whenTrue;
      const alwaysSets = inner.kind === "or-chain" &&
        inner.terms.some((term) => term.kind === "constant" && (term.value ?? 0) !== 0);
      return {
        ok: true,
        arguments: [{
          name: expression.parameter,
          value: 0,
          confidence: alwaysSets ? "exact" : "compatible",
          note: alwaysSets
            ? "the non-null branch always sets a nonzero command constant, so a zero word means the argument was null"
            : "a zero word is consistent with a null argument",
        }],
      };
    }
    const inner = evaluateWord(expression.whenTrue, observed);
    if (inner.ok) {
      return { ok: true, arguments: [{ name: expression.parameter, value: 1, confidence: "compatible", note: "non-null argument" }, ...inner.arguments] };
    }
    return inner;
  }

  /* Every accumulator is kept unsigned: a GPU command constant such as
   * 0xE1000000 is negative under JavaScript's signed bitwise operators, and a
   * signed/unsigned mix here silently rejects the very packets this recognizes. */
  const word = observed >>> 0;
  let base = 0;
  let conditionalBits = 0;
  let maskBits = 0;
  let unknownTerms = 0;
  for (const term of expression.terms) {
    if (term.kind === "unknown") { unknownTerms++; continue; }
    if (term.kind === "constant") base = (base | (term.value ?? 0)) >>> 0;
    else if (term.kind === "conditional") {
      const bit = (term.value ?? 0) >>> 0;
      if (((conditionalBits & bit) >>> 0) !== 0 || ((maskBits & bit) >>> 0) !== 0) {
        return { ok: false, incompatible: false, reason: "attribute bits overlap; the inversion would be ambiguous" };
      }
      conditionalBits = (conditionalBits | bit) >>> 0;
    } else {
      const mask = (term.mask ?? 0) >>> 0;
      if (((maskBits & mask) >>> 0) !== 0 || ((conditionalBits & mask) >>> 0) !== 0) {
        return { ok: false, incompatible: false, reason: "argument masks overlap; the inversion would be ambiguous" };
      }
      maskBits = (maskBits | mask) >>> 0;
    }
  }

  /* OR only sets bits, so every literal constant in the chain is a necessary
   * condition on the result — including when other terms are unmodeled. */
  if (((word & base) >>> 0) !== base) {
    return { ok: false, incompatible: true, reason: `observed word does not carry the command constant ${hex(base)}` };
  }
  if (unknownTerms > 0) {
    return {
      ok: false,
      incompatible: false,
      reason: `${unknownTerms} term(s) of this expression are not modeled; the command constant ${hex(base)} is consistent but no argument is recovered`,
    };
  }

  const claimed = (base | conditionalBits | maskBits) >>> 0;
  const unexplained = (word & ~claimed) >>> 0;
  if (unexplained !== 0) {
    return { ok: false, incompatible: true, reason: `observed word sets ${hex(unexplained)} which this expression cannot produce` };
  }

  const args: EvaluatedArgument[] = [];
  for (const term of expression.terms) {
    if (term.kind === "conditional") {
      const bit = (term.value ?? 0) >>> 0;
      const set = ((word & bit) >>> 0) !== 0;
      args.push({
        name: term.parameter!,
        value: set ? 1 : 0,
        confidence: "exact",
        note: `bit ${hex(bit)} is ${set ? "set" : "clear"}; the enabled state is established, the source expression is not`,
      });
    } else if (term.kind === "masked") {
      const mask = (term.mask ?? 0) >>> 0;
      args.push({
        name: term.parameter!,
        value: (word & mask) >>> 0,
        confidence: "compatible",
        note: `only the ${hex(mask)} bits of this argument reach the packet`,
      });
    }
  }
  return { ok: true, arguments: args };
}

/**
 * Command macros build a typed packet through raw word stores, so the struct
 * they belong to is not recoverable from the macro name. The header states it
 * next door: every `setXxx` command macro has a `SetXxx` library prototype
 * whose first parameter is the packet type.
 */
export function parsePacketTypes(header: string): Map<string, string> {
  const result = new Map<string, string>();
  const re = /\bextern\s+\w+\s+(Set\w+)\s*\(\s*(\w+)\s*\*/g;
  for (let m = re.exec(header); m; m = re.exec(header)) result.set(m[1], m[2]);
  return result;
}

export function loadPacketRecipes(header?: string): SdkPacketRecipe[] {
  const text = header ?? readHeader();
  if (text === null) return [];
  const { layouts } = loadStructLayouts(text);
  const macros = parseMacroDefinitions(text);
  const prototypeTypes = parsePacketTypes(text);

  const recipes: SdkPacketRecipe[] = [];
  for (const [name, definition] of macros) {
    if (!/^set[A-Z]/.test(name)) continue;
    const pointer = definition.parameters[0];
    if (!pointer) continue;
    const typeName = prototypeTypes.get(`${name[0].toUpperCase()}${name.slice(1)}`);
    if (!typeName) continue;
    const layout = layouts.get(typeName);
    if (!layout) continue;

    let len: number | undefined;
    const writes: PacketWrite[] = [];
    let usable = true;
    for (const piece of splitTopLevel(definition.body, ",")) {
      const setlen = piece.match(new RegExp(`^setlen\\s*\\(\\s*${pointer}\\s*,\\s*(0x[0-9a-fA-F]+|\\d+)\\s*\\)$`));
      if (setlen) { len = Number(setlen[1]); continue; }
      const store = piece.match(
        new RegExp(`^\\(\\s*\\(\\s*u_long\\s*\\*\\s*\\)\\s*\\(?\\s*${pointer}\\s*\\)?\\s*\\)\\s*\\[\\s*(\\d+)\\s*\\]\\s*=\\s*([\\s\\S]+)$`),
      );
      if (!store) { usable = false; break; }
      const expressionText = store[2].trim();
      const parsed = parseExpression(expressionText, macros);
      const write: PacketWrite = {
        offset: Number(store[1]) * 4,
        width: 4,
        expression: expressionText,
        parsed,
      };
      if (parsed.kind === "or-chain" && !parsed.terms.some((term) => term.kind === "unknown")) {
        let claimed = 0;
        let literalOnly = true;
        for (const term of parsed.terms) {
          if (term.kind === "constant") claimed |= term.value ?? 0;
          else { claimed |= (term.value ?? term.mask ?? 0); literalOnly = false; }
        }
        write.constantMask = claimed >>> 0;
        if (literalOnly) write.constantValue = claimed >>> 0;
      }
      writes.push(write);
    }
    if (!usable || len === undefined || writes.length === 0) continue;

    recipes.push({
      macro: name,
      type: typeName,
      size: layout.size,
      fields: layout.fields,
      len,
      parameters: definition.parameters,
      writes,
    });
  }
  return recipes.sort((left, right) => left.macro.localeCompare(right.macro));
}

/** Offset of a named field, or undefined. */
function fieldOffset(type: { fields: PrimitiveField[] }, name: string): number | undefined {
  return type.fields.find((field) => field.name === name)?.offset;
}

/* --- constant tracking --- */

function parseImmediate(text: string): number | null {
  const trimmed = text.trim();
  const m = trimmed.match(/^(-?)(?:0x([0-9a-fA-F]+)|(\d+))$/);
  if (!m) return null;
  const value = m[2] !== undefined ? parseInt(m[2], 16) : parseInt(m[3], 10);
  return m[1] === "-" ? -value : value;
}

/** objdump prints MIPS registers bare (`v0`, `3(s0)`); cc1 assembly prints
 *  them with `$`. Accept both so one parser serves either stream. */
function registerOf(operand: string): string | null {
  const m = operand.trim().match(/^\$?(\w+)$/);
  return m && !/^\d+$/.test(m[1]) ? m[1] : null;
}

/**
 * Running map of register -> known constant, folding the `lui`/`ori` pair GCC
 * uses for constants wider than 16 bits. Deliberately linear and
 * flow-insensitive: it is used only to read immediates that were materialized
 * a few instructions earlier, where a stale value is not reachable in
 * practice.
 *
 * `$zero` is seeded because a zeroed packet field is stored straight from it,
 * and a field map that cannot read `sh zero, 8(a0)` as "writes 0" loses every
 * cleared coordinate.
 */
export function trackConstants(
  instructions: DisassembledInstruction[],
): Map<string, number>[] {
  const states: Map<string, number>[] = [];
  const regs = new Map<string, number>([["zero", 0]]);

  for (const insn of instructions) {
    states.push(new Map(regs));
    const mnemonic = insn.mnemonic.toLowerCase();
    const dest = registerOf(insn.operands[0] ?? "");
    const { defs } = defUse(insn);

    if (dest) {
      if (mnemonic === "li" || mnemonic === "lui") {
        const value = parseImmediate(insn.operands[1] ?? "");
        if (value !== null) {
          regs.set(dest, mnemonic === "lui" ? (value << 16) >>> 0 : value);
          continue;
        }
      }
      if (mnemonic === "move") {
        const source = registerOf(insn.operands[1] ?? "");
        if (source && regs.has(source)) { regs.set(dest, regs.get(source)!); continue; }
      }
      if (mnemonic === "addiu" || mnemonic === "addi" || mnemonic === "ori" || mnemonic === "addu") {
        const source = registerOf(insn.operands[1] ?? "");
        const value = parseImmediate(insn.operands[2] ?? "");
        if (source === "zero" && value !== null) { regs.set(dest, value); continue; }
        if (source === "zero" && registerOf(insn.operands[2] ?? "") === "zero") {
          regs.set(dest, 0); continue;
        }
        if (mnemonic === "ori" && source && value !== null && regs.has(source)) {
          regs.set(dest, (regs.get(source)! | value) >>> 0); continue;
        }
        if (mnemonic === "addu" && source && registerOf(insn.operands[2] ?? "") === "zero" && regs.has(source)) {
          regs.set(dest, regs.get(source)!); continue;
        }
      }
    }

    for (const def of defs) if (def !== "zero") regs.delete(def);
    if (defUse(insn).isCall) {
      for (const key of [...regs.keys()]) {
        if (key !== "zero" && !/^(s[0-7]|fp|gp|sp)$/.test(key)) regs.delete(key);
      }
    }
    regs.set("zero", 0);
  }
  return states;
}

/* --- register webs and definition sites --- */

/**
 * Linear per-register versioning. A hard register reused later for an
 * unrelated pointer opens a new web, which is what stops two objects from
 * being merged because the compiler happened to spell both bases `$a0`.
 *
 * Snapshots are taken BEFORE the instruction's own definitions are applied, so
 * an instruction that redefines the register it reads (`and a0, a0, t0`) is
 * attributed to the incoming web.
 */
export interface RegisterState {
  /** Web id (`register#version`) visible to this instruction's operands. */
  webOf: Map<string, string>;
  /** Index of the instruction that defined each register, -1 for entry. */
  defOf: Map<string, number>;
}

export function trackRegisterStates(instructions: DisassembledInstruction[]): RegisterState[] {
  const states: RegisterState[] = [];
  const versions = new Map<string, number>();
  const defs = new Map<string, number>();

  const webId = (register: string): string => `${register}#${versions.get(register) ?? 0}`;

  for (const insn of instructions) {
    const webOf = new Map<string, string>();
    const defOf = new Map<string, number>();
    for (const register of versions.keys()) webOf.set(register, webId(register));
    for (const [register, index] of defs) defOf.set(register, index);
    states.push({ webOf, defOf });

    const { defs: written, isCall } = defUse(insn);
    const index = states.length - 1;
    for (const register of written) {
      versions.set(register, (versions.get(register) ?? 0) + 1);
      defs.set(register, index);
    }
    if (isCall) {
      for (const register of ["v0", "v1"]) {
        versions.set(register, (versions.get(register) ?? 0) + 1);
        defs.set(register, index);
      }
    }
  }
  return states;
}

function webFor(states: RegisterState[], index: number, register: string): string {
  return states[index]?.webOf.get(register) ?? `${register}#0`;
}

/* --- memory accesses --- */

export interface MemoryAccess {
  index: number;
  mnemonic: string;
  base: string;
  baseWeb: string;
  offset: number;
  width: number;
  isStore: boolean;
  register: string | null;
}

const ACCESS_WIDTHS: Record<string, number> = {
  lb: 1, lbu: 1, sb: 1, lh: 2, lhu: 2, sh: 2, lw: 4, sw: 4,
};

/** Bases that never address an SDK packet. */
const NON_OBJECT_BASES = new Set(["sp", "gp", "zero", "fp", "s8", "ra"]);

export function memoryAccesses(
  instructions: DisassembledInstruction[],
  states: RegisterState[],
): MemoryAccess[] {
  const result: MemoryAccess[] = [];
  instructions.forEach((insn, index) => {
    const { isLoad, isStore } = defUse(insn);
    if (!isLoad && !isStore) return;
    const target = insn.operands[insn.operands.length - 1] ?? "";
    const m = target.match(/^(-?(?:0x)?[0-9a-fA-F]+)?\(\$?(\w+)\)$/);
    if (!m) return;
    const offset = m[1] ? parseImmediate(m[1]) ?? 0 : 0;
    const width = ACCESS_WIDTHS[insn.mnemonic.toLowerCase()];
    if (width === undefined) return;
    result.push({
      index,
      mnemonic: insn.mnemonic.toLowerCase(),
      base: m[2],
      baseWeb: webFor(states, index, m[2]),
      offset,
      width,
      isStore,
      register: registerOf(insn.operands[0] ?? ""),
    });
  });
  return result;
}

/* --- report types --- */

export interface SdkAttribute {
  macro: string;
  mask: number;
  enabled: boolean;
}

export interface PrimitiveMatch {
  kind: "primitive";
  type: PrimitiveType;
  base: string;
  baseWeb: string;
  observedLen: number;
  observedCode: number;
  baseCode: number;
  attributes: SdkAttribute[];
  confidence: "exact-composite" | "ambiguous";
  /** Every type still compatible after attribute stripping. */
  candidates: string[];
  /** Target instruction indexes this object's accesses occupy. */
  indexes: number[];
  evidence: string[];
}

export interface PacketMatch {
  kind: "command-packet";
  recipe: SdkPacketRecipe;
  base: string;
  baseWeb: string;
  observedLen: number;
  observedWords: Array<{ offset: number; value: number }>;
  arguments: EvaluatedArgument[];
  confidence: "exact" | "ambiguous";
  candidates: string[];
  /** Target instruction indexes this object's accesses occupy. */
  indexes: number[];
  evidence: string[];
}

export type SdkObjectMatch = PrimitiveMatch | PacketMatch;

export interface SdkLinkMatch {
  kind: "addPrim";
  confidence: "exact" | "partial";
  orderingTableBase: string;
  orderingTableWeb: string;
  objectBase: string;
  objectWeb: string;
  /** Struct name when the linked base is also a recognized object. */
  objectType: string | null;
  /** Target instruction indexes the merge occupies. */
  indexes: number[];
  evidence: string[];
}

export interface IdiomFinding {
  kind: string;
  summary: string;
  evidence: string[];
  /** Base register web the finding belongs to, when it is object-scoped. */
  baseWeb?: string;
}

/** One SDK operation the target establishes, as the source should express it. */
export interface SdkOperation {
  macro: string;
  /** Spellings that express the same operation; any one satisfies the gap. */
  alternatives: string[];
  type: string | null;
  baseWeb: string | null;
  detail: string;
}

export interface IdiomReport {
  objects: SdkObjectMatch[];
  links: SdkLinkMatch[];
  /** Every recognized operation, for the reconstruction-gap check. */
  operations: SdkOperation[];
  findings: IdiomFinding[];
  /** @deprecated compatibility projection of the first recognized primitive. */
  primitive: PrimitiveType | null;
  /** @deprecated compatibility projection. */
  base: string | null;
  /** @deprecated compatibility projection. */
  written: PrimitiveField[];
}

/* --- primitive recognition --- */

/** Every store through this base lands inside a declared field of the type. */
function geometryCompatible(
  type: { fields: PrimitiveField[]; size: number },
  accesses: MemoryAccess[],
): { ok: true } | { ok: false; reason: string } {
  const rows = scalarFields(type.fields);
  for (const access of accesses) {
    if (!access.isStore) continue;
    if (access.offset < 0 || access.offset + access.width > type.size) {
      return { ok: false, reason: `store at ${hex(access.offset)} width ${access.width} lies outside the ${hex(type.size)}-byte packet` };
    }
    const covered = rows.some((field) =>
      field.offset <= access.offset && access.offset + access.width <= field.offset + field.size);
    if (!covered) {
      return { ok: false, reason: `store at ${hex(access.offset)} width ${access.width} matches no declared field` };
    }
  }
  return { ok: true };
}

/**
 * The len/code store pair is the anchor. Both bytes must be materialized
 * constants stored through the same base web at the P_TAG offsets (len at 0x3,
 * code at 0x7) — a coincidence that does not arise from ordinary struct code.
 *
 * The observed code is matched against the parsed initializer's base code with
 * the parsed attribute bits removed, because `setPolyF4(p); setSemiTrans(p,1);`
 * is ordinary SDK composition and leaves `0x2A` where the table says `0x28`.
 * Only bits the active header documents as attributes may be stripped; any
 * other differing bit refuses the match outright.
 */
function findPrimitives(
  instructions: DisassembledInstruction[],
  table: PrimitiveType[],
  attributes: AttributeMacro[],
  accesses: MemoryAccess[],
  constants: Map<string, number>[],
): PrimitiveMatch[] {
  const attributeMask = attributes.reduce((mask, attribute) => mask | attribute.mask, 0);
  const matches: PrimitiveMatch[] = [];
  const seen = new Set<string>();

  const lens = accesses.filter((a) => a.isStore && a.mnemonic === "sb" && a.offset === 0x3);
  const codes = accesses.filter((a) => a.isStore && a.mnemonic === "sb" && a.offset === 0x7);

  for (const lenAccess of lens) {
    if (NON_OBJECT_BASES.has(lenAccess.base) || seen.has(lenAccess.baseWeb)) continue;
    const lenValue = lenAccess.register ? constants[lenAccess.index].get(lenAccess.register) : undefined;
    if (lenValue === undefined) continue;

    for (const codeAccess of codes) {
      if (codeAccess.baseWeb !== lenAccess.baseWeb) continue;
      const codeValue = codeAccess.register ? constants[codeAccess.index].get(codeAccess.register) : undefined;
      if (codeValue === undefined) continue;

      const throughBase = accesses.filter((a) => a.baseWeb === lenAccess.baseWeb);
      const compatible: Array<{ type: PrimitiveType; attributes: SdkAttribute[] }> = [];
      for (const type of table) {
        if (type.len !== lenValue) continue;
        const differing = (codeValue ^ type.code) >>> 0;
        if ((differing & ~attributeMask) !== 0) continue;
        if (!geometryCompatible(type, throughBase).ok) continue;
        compatible.push({
          type,
          attributes: attributes
            .filter((attribute) => (differing & attribute.mask) !== 0 || (type.code & attribute.mask) !== 0 || (codeValue & attribute.mask) !== 0)
            .map((attribute) => ({
              macro: attribute.macro,
              mask: attribute.mask,
              enabled: (codeValue & attribute.mask) !== 0,
            })),
        });
      }
      if (compatible.length === 0) continue;

      const chosen = compatible[0];
      const ambiguous = compatible.length > 1;
      const composedBits = compatible
        .map((candidate) => (codeValue ^ candidate.type.code) >>> 0)
        .reduce((left, right) => left | right, 0);
      const evidence = [
        `${instructions[lenAccess.index].raw.trim()}   (len = ${lenValue})`,
        `${instructions[codeAccess.index].raw.trim()}   (code = ${hex(codeValue)})`,
        ambiguous
          ? `after stripping the parsed attribute mask ${hex(attributeMask)}, ${compatible.length} initializers remain compatible`
          : `observed code ${hex(codeValue)} = base ${hex(chosen.type.code)}` +
            (composedBits === 0
              ? " (no attribute bits applied)"
              : ` | ${chosen.attributes.filter((a) => a.enabled && (composedBits & a.mask) !== 0)
                  .map((a) => `${a.macro} bit ${hex(a.mask)}`).join(" | ")}`),
        `${chosen.type.macro}(p) expands to exactly the len/code pair — see ${LIBGPU_RELATIVE}`,
      ];
      if (!ambiguous && composedBits !== 0) {
        evidence.push(
          `${chosen.type.name} via ${chosen.type.macro}(p) + ` +
          chosen.attributes.filter((a) => (composedBits & a.mask) !== 0)
            .map((a) => `${a.macro}(p, ${a.enabled ? 1 : 0})`).join(" + "),
        );
      }

      matches.push({
        kind: "primitive",
        type: chosen.type,
        base: lenAccess.base,
        baseWeb: lenAccess.baseWeb,
        observedLen: lenValue,
        observedCode: codeValue,
        baseCode: chosen.type.code,
        attributes: chosen.attributes,
        confidence: ambiguous ? "ambiguous" : "exact-composite",
        candidates: compatible.map((candidate) => candidate.type.name),
        indexes: throughBase.map((access) => access.index).sort((left, right) => left - right),
        evidence,
      });
      seen.add(lenAccess.baseWeb);
      break;
    }
  }
  return matches;
}

/* --- command-packet recognition --- */

function findPackets(
  instructions: DisassembledInstruction[],
  recipes: SdkPacketRecipe[],
  accesses: MemoryAccess[],
  constants: Map<string, number>[],
  taken: Set<string>,
): PacketMatch[] {
  const matches: PacketMatch[] = [];
  const lens = accesses.filter((a) => a.isStore && a.mnemonic === "sb" && a.offset === 0x3);

  for (const lenAccess of lens) {
    if (NON_OBJECT_BASES.has(lenAccess.base) || taken.has(lenAccess.baseWeb)) continue;
    const lenValue = lenAccess.register ? constants[lenAccess.index].get(lenAccess.register) : undefined;
    if (lenValue === undefined) continue;
    const throughBase = accesses.filter((a) => a.baseWeb === lenAccess.baseWeb);

    interface Candidate {
      recipe: SdkPacketRecipe;
      words: Array<{ offset: number; value: number }>;
      args: EvaluatedArgument[];
      evaluated: boolean;
    }
    const candidates: Candidate[] = [];
    for (const recipe of recipes) {
      if (recipe.len !== lenValue) continue;
      if (!geometryCompatible(recipe, throughBase).ok) continue;

      const words: Array<{ offset: number; value: number }> = [];
      let structural = true;
      for (const write of recipe.writes) {
        const store = throughBase.find((a) => a.isStore && a.offset === write.offset && a.width === write.width);
        if (!store) { structural = false; break; }
        const value = store.register ? constants[store.index].get(store.register) : undefined;
        if (value === undefined) { structural = false; break; }
        words.push({ offset: write.offset, value: value >>> 0 });
      }
      if (!structural) continue;

      const args: EvaluatedArgument[] = [];
      let evaluated = true;
      let incompatible = false;
      recipe.writes.forEach((write, index) => {
        const evaluation = evaluateWord(write.parsed, words[index]!.value);
        if (evaluation.ok) args.push(...evaluation.arguments);
        else {
          evaluated = false;
          if (evaluation.incompatible) incompatible = true;
        }
      });
      if (incompatible) continue;
      candidates.push({ recipe, words, args, evaluated });
    }
    if (candidates.length === 0) continue;

    /* A fully inverted candidate outranks one whose expressions stayed
     * opaque: the command constants are what separate same-length packets. */
    const evaluatedCandidates = candidates.filter((candidate) => candidate.evaluated);
    const pool = evaluatedCandidates.length > 0 ? evaluatedCandidates : candidates;
    const chosen = pool[0]!;
    const ambiguous = pool.length > 1 || !chosen.evaluated;

    const evidence = [
      `${instructions[lenAccess.index].raw.trim()}   (len = ${lenValue})`,
      ...chosen.words.map((word) => `word at +${hex(word.offset)} = ${hex(word.value)}`),
      `${chosen.recipe.macro}(${chosen.recipe.parameters.join(", ")}) writes len ${chosen.recipe.len} at +0x3 and ` +
      `${chosen.recipe.writes.map((write) => `+${hex(write.offset)}`).join(", ")} — see ${LIBGPU_RELATIVE}`,
    ];
    if (ambiguous) {
      evidence.push(pool.length > 1
        ? `${pool.length} command macros remain compatible with this length and word geometry`
        : "the packet expressions could not be inverted from the observed constants; the family is reported without arguments");
    }
    for (const argument of chosen.args) {
      evidence.push(`argument ${argument.name} = ${hex(argument.value)} (${argument.confidence}) — ${argument.note}`);
    }

    matches.push({
      kind: "command-packet",
      recipe: chosen.recipe,
      base: lenAccess.base,
      baseWeb: lenAccess.baseWeb,
      observedLen: lenValue,
      observedWords: chosen.words,
      arguments: ambiguous && pool.length > 1 ? [] : chosen.args,
      confidence: ambiguous ? "ambiguous" : "exact",
      candidates: pool.map((candidate) => candidate.recipe.macro),
      indexes: throughBase.map((access) => access.index).sort((left, right) => left - right),
      evidence,
    });
    taken.add(lenAccess.baseWeb);
  }
  return matches;
}

/* --- addPrim link recognition --- */

const ADDRESS_MASK = 0xffffff;
const TAG_BYTE_MASK = 0xff000000;

interface MergeStore {
  index: number;
  /** Base web whose tag word is written. */
  destinationWeb: string;
  destinationBase: string;
  /** `getaddr` source when the merged value came from another packet's tag. */
  sourceWeb: string | null;
  sourceBase: string | null;
  /** Set when the merged value is the pointer itself, not a loaded tag. */
  pointerSource: boolean;
  indexes: number[];
  evidence: string[];
}

/**
 * Recognize one complete `setaddr(dest, X)` — the whole 24-bit merge, not just
 * "a mask constant is present somewhere". The store must write a word built by
 * OR-ing the destination tag's preserved top byte with a 24-bit-masked value,
 * and that value must itself be either a tag word loaded from another packet
 * (`getaddr(q)`) or a packet pointer.
 */
function findMergeStores(
  instructions: DisassembledInstruction[],
  accesses: MemoryAccess[],
  constants: Map<string, number>[],
  states: RegisterState[],
): MergeStore[] {
  const stores = accesses.filter((a) => a.isStore && a.mnemonic === "sw" && a.offset === 0 && !NON_OBJECT_BASES.has(a.base));
  const result: MergeStore[] = [];

  const definitionOf = (index: number, register: string): number | undefined => {
    const at = states[index]?.defOf.get(register);
    return at !== undefined && at >= 0 ? at : undefined;
  };

  /** The masked source of `and rD, rS, rM` where rM holds `mask`. */
  const maskedSource = (index: number, mask: number): string | null => {
    const insn = instructions[index];
    if (!insn || insn.mnemonic.toLowerCase() !== "and") return null;
    const left = registerOf(insn.operands[1] ?? "");
    const right = registerOf(insn.operands[2] ?? "");
    if (!left || !right) return null;
    const state = constants[index];
    if ((state.get(right) ?? -1) >>> 0 === mask) return left;
    if ((state.get(left) ?? -1) >>> 0 === mask) return right;
    return null;
  };

  for (const store of stores) {
    if (!store.register) continue;
    const orIndex = definitionOf(store.index, store.register);
    if (orIndex === undefined) continue;
    const orInsn = instructions[orIndex];
    if (!orInsn || orInsn.mnemonic.toLowerCase() !== "or") continue;
    const operands = [registerOf(orInsn.operands[1] ?? ""), registerOf(orInsn.operands[2] ?? "")];
    if (!operands[0] || !operands[1]) continue;

    for (const [highRegister, lowRegister] of [[operands[0], operands[1]], [operands[1], operands[0]]] as const) {
      const highAndIndex = definitionOf(orIndex, highRegister!);
      const lowAndIndex = definitionOf(orIndex, lowRegister!);
      if (highAndIndex === undefined || lowAndIndex === undefined) continue;
      const preserved = maskedSource(highAndIndex, TAG_BYTE_MASK);
      const merged = maskedSource(lowAndIndex, ADDRESS_MASK);
      if (!preserved || !merged) continue;

      /* The preserved top byte must come from the destination's own tag. */
      const preservedDefinition = definitionOf(highAndIndex, preserved);
      const preservedLoad = preservedDefinition === undefined
        ? undefined
        : accesses.find((a) => a.index === preservedDefinition && !a.isStore && a.offset === 0 && a.mnemonic === "lw");
      if (!preservedLoad || preservedLoad.baseWeb !== store.baseWeb) continue;

      /* The merged 24 bits are either a tag word read from another packet or
       * a packet pointer stored straight into the tag. */
      const mergedDefinition = definitionOf(lowAndIndex, merged);
      const mergedLoad = mergedDefinition === undefined
        ? undefined
        : accesses.find((a) => a.index === mergedDefinition && !a.isStore && a.offset === 0 && a.mnemonic === "lw");
      let sourceWeb: string | null = null;
      let sourceBase: string | null = null;
      let pointerSource = false;
      if (mergedLoad) {
        sourceWeb = mergedLoad.baseWeb;
        sourceBase = mergedLoad.base;
      } else if (mergedDefinition !== undefined) {
        /* The compiler reuses the word it just wrote rather than reloading
         * it; that is still `getaddr(q)` of whichever packet it was stored to. */
        const reused = accesses.find((a) =>
          a.isStore && a.mnemonic === "sw" && a.offset === 0 && a.index > mergedDefinition && a.index < store.index &&
          a.register === merged && (states[a.index]?.defOf.get(merged) === mergedDefinition));
        if (reused) { sourceWeb = reused.baseWeb; sourceBase = reused.base; }
      }
      if (!sourceWeb) {
        const mergedWeb = webFor(states, lowAndIndex, merged!);
        const isPointer = accesses.some((a) => a.baseWeb === mergedWeb);
        if (!isPointer) continue;
        pointerSource = true;
        sourceWeb = mergedWeb;
        sourceBase = merged;
      }

      result.push({
        index: store.index,
        destinationWeb: store.baseWeb,
        destinationBase: store.base,
        sourceWeb,
        sourceBase,
        pointerSource,
        indexes: [preservedLoad.index, highAndIndex, lowAndIndex, orIndex, store.index],
        evidence: [
          instructions[preservedLoad.index].raw.trim(),
          instructions[highAndIndex].raw.trim(),
          instructions[lowAndIndex].raw.trim(),
          instructions[orIndex].raw.trim(),
          instructions[store.index].raw.trim(),
        ],
      });
      break;
    }
  }
  return result.sort((left, right) => left.index - right.index);
}

/**
 * `addPrim(ot, p)` is `setaddr(p, getaddr(ot)), setaddr(ot, p)`. Both halves
 * must be present and must name the same two bases, in that order; anything
 * less is reported as compatible/partial rather than as the macro.
 */
function findLinks(
  instructions: DisassembledInstruction[],
  accesses: MemoryAccess[],
  constants: Map<string, number>[],
  states: RegisterState[],
  objects: SdkObjectMatch[],
): SdkLinkMatch[] {
  const merges = findMergeStores(instructions, accesses, constants, states);
  const typeOf = new Map<string, string>();
  for (const object of objects) {
    typeOf.set(object.baseWeb, object.kind === "primitive" ? object.type.name : object.recipe.type);
  }

  const links: SdkLinkMatch[] = [];
  const consumed = new Set<number>();

  for (const first of merges) {
    if (consumed.has(first.index) || first.pointerSource || !first.sourceWeb) continue;
    const second = merges.find((candidate) =>
      !consumed.has(candidate.index) &&
      candidate.index > first.index &&
      candidate.pointerSource &&
      candidate.destinationWeb === first.sourceWeb &&
      candidate.sourceWeb === first.destinationWeb);
    if (!second) continue;
    consumed.add(first.index);
    consumed.add(second.index);
    links.push({
      kind: "addPrim",
      confidence: "exact",
      orderingTableBase: first.sourceBase!,
      orderingTableWeb: first.sourceWeb,
      objectBase: first.destinationBase,
      objectWeb: first.destinationWeb,
      objectType: typeOf.get(first.destinationWeb) ?? null,
      indexes: [...new Set([...first.indexes, ...second.indexes])].sort((left, right) => left - right),
      evidence: [
        "addPrim(ot, p) = setaddr(p, getaddr(ot)), setaddr(ot, p)",
        `setaddr($${first.destinationBase}, getaddr($${first.sourceBase})):`,
        ...first.evidence.map((line) => `  ${line}`),
        `setaddr($${second.destinationBase}, $${second.sourceBase}):`,
        ...second.evidence.map((line) => `  ${line}`),
      ],
    });
  }

  for (const merge of merges) {
    if (consumed.has(merge.index)) continue;
    links.push({
      kind: "addPrim",
      confidence: "partial",
      orderingTableBase: merge.sourceBase ?? "?",
      orderingTableWeb: merge.sourceWeb ?? "?",
      objectBase: merge.destinationBase,
      objectWeb: merge.destinationWeb,
      objectType: typeOf.get(merge.destinationWeb) ?? null,
      indexes: [...merge.indexes].sort((left, right) => left - right),
      evidence: [
        "one complete 24-bit tag merge with no matching second half — compatible with a link, not proven to be addPrim",
        ...merge.evidence,
      ],
    });
  }

  return links;
}

/* --- field-keyed macro advice --- */

/** Field-keyed macro advice. The field name is what tells the agent which
 *  macro builds the value; the corroborating constants are secondary. */
const FIELD_MACROS: { field: string; macro: string; constants: number[]; note: string }[] = [
  {
    field: "clut",
    macro: "getClut(x, y)",
    constants: [0x3f],
    note: "CLUT id — `(y << 6) | ((x >> 4) & 0x3f)`",
  },
  {
    field: "tpage",
    macro: "getTPage(tp, abr, x, y)",
    constants: [0x3ff, 0x100, 0x200],
    note: "texture page id — abr/tp folded away when passed as constants",
  },
];

const RGB_GROUPS: { fields: string[]; macro: string }[] = [
  { fields: ["r0", "g0", "b0"], macro: "setRGB0(p, r, g, b)" },
  { fields: ["r1", "g1", "b1"], macro: "setRGB1(p, r, g, b)" },
  { fields: ["r2", "g2", "b2"], macro: "setRGB2(p, r, g, b)" },
  { fields: ["r3", "g3", "b3"], macro: "setRGB3(p, r, g, b)" },
];

/**
 * `setXYWH(p, x, y, w, h)` writes four points whose coordinates are two
 * distinct values each. When every coordinate is a known constant and the
 * rectangle relation holds, the four points are one macro call rather than
 * eight assignments — and stating that is what keeps a reconstruction from
 * spelling out the corners.
 */
function rectangleAdvice(
  type: PrimitiveType,
  storedConstants: Map<number, number>,
): string[] | null {
  const names = ["x0", "y0", "x1", "y1", "x2", "y2", "x3", "y3"];
  const values: number[] = [];
  for (const name of names) {
    const offset = fieldOffset(type, name);
    if (offset === undefined) return null;
    const value = storedConstants.get(offset);
    if (value === undefined) return null;
    values.push(value);
  }
  const [x0, y0, x1, y1, x2, y2, x3, y3] = values;
  const width = x1 - x0;
  const height = y2 - y0;
  if (y1 !== y0 || x2 !== x0 || x3 !== x0 + width || y3 !== y0 + height) return null;
  return [
    `setXYWH(p, ${hex(x0)}, ${hex(y0)}, ${hex(width)}, ${hex(height)})`,
    `x0,y0 = ${hex(x0)},${hex(y0)}; w = ${hex(width)}; h = ${hex(height)} — the four corners satisfy the setXYWH relation exactly`,
  ];
}

/* --- assembly --- */

export function recognizeIdioms(
  instructions: DisassembledInstruction[],
  sourceText?: string,
): IdiomReport {
  const header = readHeader();
  const table = loadPrimitiveTable(header ?? undefined);
  const attributes = header ? parseAttributeMacros(header) : [];
  const recipes = loadPacketRecipes(header ?? undefined);

  const states = trackRegisterStates(instructions);
  const constants = trackConstants(instructions);
  const accesses = memoryAccesses(instructions, states);

  const primitives = findPrimitives(instructions, table, attributes, accesses, constants);
  const taken = new Set(primitives.map((match) => match.baseWeb));
  const packets = findPackets(instructions, recipes, accesses, constants, taken);
  const objects: SdkObjectMatch[] = [...primitives, ...packets]
    .sort((left, right) => left.baseWeb.localeCompare(right.baseWeb));
  const links = findLinks(instructions, accesses, constants, states, objects);

  const findings: IdiomFinding[] = [];
  const operations: SdkOperation[] = [];
  const sourceCode = sourceText === undefined ? undefined : stripCommentsAndStrings(sourceText);
  const knows = (name: string): boolean =>
    sourceCode !== undefined && new RegExp(`\\b${name}\\b`).test(sourceCode);

  for (const object of objects) {
    const throughBase = accesses.filter((a) => a.baseWeb === object.baseWeb);
    const writtenOffsets = new Set(throughBase.filter((a) => a.isStore).map((a) => a.offset));
    /* Only a field written with one constant everywhere has a value worth
     * printing: two stores of different constants are two control-flow paths,
     * and naming either one of them as "the" value is a fabrication. */
    const observedValues = new Map<number, Set<number>>();
    const nonConstant = new Set<number>();
    for (const access of throughBase) {
      if (!access.isStore || !access.register) continue;
      const value = constants[access.index].get(access.register);
      if (value === undefined) { nonConstant.add(access.offset); continue; }
      const seen = observedValues.get(access.offset);
      if (seen) seen.add(value);
      else observedValues.set(access.offset, new Set([value]));
    }
    const storedConstants = new Map<number, number>();
    for (const [offset, values] of observedValues) {
      if (values.size === 1 && !nonConstant.has(offset)) storedConstants.set(offset, [...values][0]!);
    }

    const typeName = object.kind === "primitive" ? object.type.name : object.recipe.type;
    const macroName = object.kind === "primitive" ? object.type.macro : object.recipe.macro;
    const size = object.kind === "primitive" ? object.type.size : object.recipe.size;
    const fields = object.kind === "primitive" ? object.type.fields : object.recipe.fields;

    if (object.confidence === "ambiguous") {
      findings.push({
        kind: "sdk-ambiguous",
        baseWeb: object.baseWeb,
        summary:
          `the packet built through $${object.base} matches ${object.candidates.length} SDK ` +
          `${object.kind === "primitive" ? "primitive" : "command"} definitions; no concrete type is recommended`,
        evidence: [...object.evidence, `candidates: ${object.candidates.join(", ")}`],
      });
      continue;
    }

    findings.push({
      kind: "sdk-object",
      baseWeb: object.baseWeb,
      summary:
        `the packet built through $${object.base} is a PSY-Q ${typeName} ` +
        `(sizeof ${hex(size)}), built by ${macroName}` +
        (object.kind === "primitive" && object.attributes.some((a) => (object.observedCode ^ object.baseCode) & a.mask)
          ? ` composed with ${object.attributes.filter((a) => (object.observedCode ^ object.baseCode) & a.mask).map((a) => a.macro).join(" + ")}`
          : "") +
        (knows(typeName) ? "" : " — your source does not mention this type"),
      evidence: [
        ...object.evidence,
        `add \`#include "psyq/libgpu.h"\` and declare the pointer as \`${typeName} *\``,
      ],
    });
    operations.push({
      macro: macroName,
      alternatives: [macroName],
      type: typeName,
      baseWeb: object.baseWeb,
      detail: `initializes the ${typeName} built through $${object.base}`,
    });

    if (fields.length > 0) {
      findings.push({
        kind: "sdk-fields",
        baseWeb: object.baseWeb,
        summary: `${typeName} field map (offsets the target writes are marked)`,
        evidence: fields.map((field) => {
          const label = field.elementCount === undefined ? field.name : `${field.name}[${field.elementCount}]`;
          const written = field.elementCount === undefined && writtenOffsets.has(field.offset);
          const value = storedConstants.get(field.offset);
          return `${hex(field.offset)} ${label}${written ? "  <- written" : ""}` +
            (written && value !== undefined ? ` (${hex(value)})` : "");
        }),
      });
    }

    if (object.kind === "primitive") {
      for (const attribute of object.attributes) {
        if (((object.observedCode ^ object.baseCode) & attribute.mask) === 0) continue;
        findings.push({
          kind: "sdk-macro",
          baseWeb: object.baseWeb,
          summary: `code bit ${hex(attribute.mask)} is set on top of ${object.type.macro}'s base — use \`${attribute.macro}(p, 1)\``,
          evidence: [
            `${attribute.macro} is defined in ${LIBGPU_RELATIVE} as a set/clear of code bit ${hex(attribute.mask)}`,
            "the enabled state is established; the Boolean source expression behind it is not",
          ],
        });
        operations.push({
          macro: attribute.macro,
          alternatives: [attribute.macro, "setcode"],
          type: typeName,
          baseWeb: object.baseWeb,
          detail: `code bit ${hex(attribute.mask)} composed on top of ${object.type.macro}`,
        });
      }

      const allConstants = new Set<number>();
      for (const state of constants) for (const value of state.values()) allConstants.add(value);
      for (const insn of instructions) {
        const immediate = parseImmediate(insn.operands[insn.operands.length - 1] ?? "");
        if (immediate !== null) allConstants.add(immediate);
      }
      for (const rule of FIELD_MACROS) {
        const offset = fieldOffset(object.type, rule.field);
        if (offset === undefined || !writtenOffsets.has(offset)) continue;
        const seen = rule.constants.filter((value) => allConstants.has(value));
        findings.push({
          kind: "sdk-macro",
          baseWeb: object.baseWeb,
          summary: `writes ${object.type.name}.${rule.field} (${hex(offset)}) — build it with \`${rule.macro}\``,
          evidence: [
            rule.note,
            seen.length > 0
              ? `corroborating immediates present: ${seen.map(hex).join(", ")}`
              : "no corroborating mask constants found — confirm against the assembly",
          ],
        });
      }

      for (const group of RGB_GROUPS) {
        const offsets = group.fields.map((name) => fieldOffset(object.type, name));
        if (!offsets.every((offset) => offset !== undefined && writtenOffsets.has(offset))) continue;
        const name = group.macro.slice(0, group.macro.indexOf("("));
        findings.push({
          kind: "sdk-macro",
          baseWeb: object.baseWeb,
          summary: `writes ${group.fields.join("/")} — use \`${group.macro}\``,
          evidence: [`offsets ${offsets.map((offset) => hex(offset!)).join(", ")}`],
        });
        operations.push({
          macro: name,
          alternatives: [name],
          type: typeName,
          baseWeb: object.baseWeb,
          detail: `writes ${group.fields.join("/")}`,
        });
      }

      const rectangle = rectangleAdvice(object.type, storedConstants);
      if (rectangle) {
        findings.push({
          kind: "sdk-macro",
          baseWeb: object.baseWeb,
          summary: `writes all four screen points as one rectangle — use \`${rectangle[0]}\``,
          evidence: [rectangle[1]],
        });
        operations.push({
          macro: "setXYWH",
          /* setXY4 spells the same four points without the rectangle relation;
           * a source using it is a legitimate reconstruction, not a gap. */
          alternatives: ["setXYWH", "setXY4"],
          type: typeName,
          baseWeb: object.baseWeb,
          detail: rectangle[0],
        });
      }
    } else {
      findings.push({
        kind: "sdk-macro",
        baseWeb: object.baseWeb,
        summary:
          `build this packet with \`${object.recipe.macro}(${object.recipe.parameters.join(", ")})\`` +
          (object.arguments.length > 0
            ? ` — observed arguments: ${object.arguments.map((argument) => `${argument.name}=${hex(argument.value)}`).join(", ")}`
            : " — the target does not establish the argument values"),
        evidence: object.arguments.length > 0
          ? object.arguments.map((argument) => `${argument.name} = ${hex(argument.value)} (${argument.confidence}) — ${argument.note}`)
          : ["packet type and macro family are established; arguments are not"],
      });
      /* The initializer operation for a command packet IS the macro already
       * recorded above; no second operation is owed. */
    }

    const stride = instructions.find((insn) =>
      insn.mnemonic.toLowerCase() === "addiu" &&
      registerOf(insn.operands[1] ?? "") === object.base &&
      parseImmediate(insn.operands[2] ?? "") === size);
    if (stride) {
      findings.push({
        kind: "sdk-stride",
        baseWeb: object.baseWeb,
        summary: `pointer advances by sizeof(${typeName}) = ${hex(size)} — confirms the type`,
        evidence: [stride.raw.trim()],
      });
    }
  }

  const exactLinks = links.filter((link) => link.confidence === "exact");
  if (exactLinks.length > 0) {
    operations.push({
      macro: "addPrim",
      alternatives: ["addPrim", "addPrims"],
      type: null,
      baseWeb: null,
      detail: `${exactLinks.length} complete 24-bit tag merge pair(s)`,
    });
    const tables = new Set(exactLinks.map((link) => link.orderingTableWeb));
    findings.push({
      kind: "sdk-link",
      summary:
        `${exactLinks.length} complete addPrim operation(s) over ${tables.size} ordering-table pointer(s) — ` +
        "write them as `addPrim(ot, p)` calls, not as hand-rolled 24-bit tag arithmetic",
      evidence: exactLinks.flatMap((link) => [
        `addPrim($${link.orderingTableBase}, $${link.objectBase})` +
        (link.objectType ? `   /* ${link.objectType} */` : ""),
        ...link.evidence.map((line) => `  ${line}`),
      ]),
    });
  }
  for (const link of links.filter((entry) => entry.confidence === "partial")) {
    findings.push({
      kind: "sdk-link-partial",
      summary:
        `a 24-bit tag merge into $${link.objectBase} has no matching second half — compatible with a link, ` +
        "not proven to be addPrim",
      evidence: link.evidence,
    });
  }

  const firstPrimitive = primitives.find((match) => match.confidence === "exact-composite") ?? null;
  const written = firstPrimitive
    ? scalarFields(firstPrimitive.type.fields).filter((field) =>
        accesses.some((a) => a.baseWeb === firstPrimitive.baseWeb && a.isStore && a.offset === field.offset))
    : [];

  return {
    objects,
    links,
    operations,
    findings,
    primitive: firstPrimitive?.type ?? null,
    base: firstPrimitive?.base ?? null,
    written,
  };
}

/* --- reconstruction gap --------------------------------------------------- */

/**
 * Remove comments and string/character literals.
 *
 * The gap check asks whether the source *uses* a type or macro. A mention
 * inside a comment answers that question wrongly in the one direction that
 * matters: it silences the finding on a source that does not use the SDK at
 * all. Preprocessor lines are left alone — an `#include` naming the header is
 * not a false positive for any name this checks.
 */
export function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

export interface SdkReconstructionGap {
  /** Struct names the target's recognized packets establish. */
  types: string[];
  missingTypes: string[];
  /** SDK operations the target's recognized packets establish. */
  macros: string[];
  missingMacros: string[];
  /** Target instruction indexes covered by recognized SDK operations. */
  indexes: number[];
  /** No recognized type or operation is missing from the source. */
  complete: boolean;
}

/**
 * What a candidate source still expands by hand.
 *
 * Returns null when the target carries no confidently recognized SDK
 * operation, so silence here means "nothing recognized", never "nothing to do".
 */
export function sdkReconstructionGap(
  report: IdiomReport,
  sourceText?: string,
): SdkReconstructionGap | null {
  const confident = report.objects.filter((object) => object.confidence !== "ambiguous");
  if (confident.length === 0 && report.operations.length === 0) return null;

  const code = sourceText === undefined ? undefined : stripCommentsAndStrings(sourceText);
  const uses = (name: string): boolean =>
    code !== undefined && new RegExp(`\\b${name}\\b`).test(code);

  const types = [...new Set(confident.map((object) =>
    object.kind === "primitive" ? object.type.name : object.recipe.type))];
  const macros = [...new Set(report.operations.map((operation) => operation.macro))];

  const missingTypes = code === undefined ? types : types.filter((type) => !uses(type));
  const missingMacros = code === undefined
    ? macros
    : [...new Set(report.operations
        .filter((operation) => !operation.alternatives.some(uses))
        .map((operation) => operation.macro))];

  const indexes = [...new Set([
    ...confident.flatMap((object) => object.indexes),
    ...report.links.filter((link) => link.confidence === "exact").flatMap((link) => link.indexes),
  ])].sort((left, right) => left - right);

  return {
    types,
    missingTypes,
    macros,
    missingMacros,
    indexes,
    complete: missingTypes.length === 0 && missingMacros.length === 0,
  };
}

function hex(value: number): string {
  return `0x${(value < 0 ? -value : value).toString(16).toUpperCase()}`;
}

/* --- CLI --- */

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const positional = args.filter((a) => !a.startsWith("--"));
  if (positional.length !== 1) {
    console.error("Usage: npx tsx tools/agent/sdkIdioms.ts <func_name> [--json]");
    process.exit(1);
  }

  const name = normalizeFunctionName(positional[0]);
  const scratch = join(ROOT, "build/triage", `${name}-sdk`);
  let instructions: DisassembledInstruction[];
  try {
    instructions = disassembleObject(assembleTarget(name, scratch));
  } catch (error) {
    console.error(`sdkIdioms: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  const sourcePath = join(ROOT, "src", `${name}.c`);
  const sourceText = existsSync(sourcePath) ? readFileSync(sourcePath, "utf-8") : undefined;
  const report = recognizeIdioms(instructions, sourceText);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (report.objects.length === 0 && report.links.length === 0) {
    console.log(`sdkIdioms ${name}: no PSY-Q packet signature found.`);
    console.log("  (the anchors are a setlen/setcode byte pair at +0x3/+0x7 through one base,");
    console.log("   a setlen plus fixed command words, and a complete 24-bit tag merge)");
    return;
  }

  const headline = report.objects
    .map((object) => object.kind === "primitive"
      ? `${object.type.name} via ${object.type.macro}`
      : `${object.recipe.type} via ${object.recipe.macro}`)
    .join(", ");
  console.log(`sdkIdioms ${name} — ${headline || "tag links only"}\n`);
  for (const finding of report.findings) {
    console.log(`[${finding.kind}] ${finding.summary}`);
    for (const line of finding.evidence) console.log(`    | ${line}`);
    console.log();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
