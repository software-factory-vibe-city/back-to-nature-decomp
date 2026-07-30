import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { sha256 } from "../variant-lab/artifacts.js";

/**
 * Field-effect registry for PSY-Q primitive macros.
 *
 * Every entry asserts the semantic effects of one macro and carries the exact
 * normalized definition text those effects were verified against. At load
 * time the registry re-extracts each definition from the configured header;
 * an entry whose current definition differs is deactivated, so a changed SDK
 * header can never silently inherit stale semantics. Statements calling a
 * deactivated or unlisted macro are modeled as unknown-effect and frozen.
 */

export interface MacroEffect {
  kind: "field-write" | "field-read" | "whole-object-write";
  argIndex: number;
  field?: string;
}

export interface KnownMacroDefinition {
  name: string;
  header: string;
  argCount: number;
  expectedDefinition: string;
  effects: MacroEffect[];
  evidence: string;
}

export interface ActiveMacro extends KnownMacroDefinition {
  definitionHash: string;
  bodyConstants: number[];
}

export interface MacroRegistry {
  active: Map<string, ActiveMacro>;
  inactive: Array<{ name: string; reason: string }>;
}

const GPU = "include/psyq/libgpu.h";

function fieldWrites(argIndex: number, fields: string[]): MacroEffect[] {
  return fields.map((field) => ({ kind: "field-write" as const, argIndex, field }));
}

const REGISTRY: KnownMacroDefinition[] = [
  {
    name: "setlen",
    header: GPU,
    argCount: 2,
    expectedDefinition: "setlen(p,_len) (((P_TAG *)(p))->len = (u_char)(_len))",
    effects: fieldWrites(0, ["len"]),
    evidence: "Writes only the primitive tag length byte of its pointer argument.",
  },
  {
    name: "setcode",
    header: GPU,
    argCount: 2,
    expectedDefinition: "setcode(p,_code) (((P_TAG *)(p))->code = (u_char)(_code))",
    effects: fieldWrites(0, ["code"]),
    evidence: "Writes only the primitive tag code byte of its pointer argument.",
  },
  {
    name: "setaddr",
    header: GPU,
    argCount: 2,
    expectedDefinition: "setaddr(p,_addr) (((P_TAG *)(p))->addr = (u_long)(_addr))",
    effects: fieldWrites(0, ["addr"]),
    evidence: "Writes only the primitive tag address bitfield of its pointer argument.",
  },
  {
    name: "setSprt",
    header: GPU,
    argCount: 1,
    expectedDefinition: "setSprt(p) setlen(p, 4), setcode(p, 0x64)",
    effects: fieldWrites(0, ["len", "code"]),
    evidence: "Expands to setlen and setcode on the same primitive; writes only len and code.",
  },
  {
    name: "setSprt8",
    header: GPU,
    argCount: 1,
    expectedDefinition: "setSprt8(p) setlen(p, 3), setcode(p, 0x74)",
    effects: fieldWrites(0, ["len", "code"]),
    evidence: "Expands to setlen and setcode on the same primitive; writes only len and code.",
  },
  {
    name: "setSprt16",
    header: GPU,
    argCount: 1,
    expectedDefinition: "setSprt16(p) setlen(p, 3), setcode(p, 0x7c)",
    effects: fieldWrites(0, ["len", "code"]),
    evidence: "Expands to setlen and setcode on the same primitive; writes only len and code.",
  },
  {
    name: "setClut",
    header: GPU,
    argCount: 3,
    expectedDefinition: "setClut(p,x,y) ((p)->clut = getClut(x,y))",
    effects: fieldWrites(0, ["clut"]),
    evidence: "Writes only the clut field; getClut is pure arithmetic over its scalar arguments.",
  },
  {
    name: "setTPage",
    header: GPU,
    argCount: 5,
    expectedDefinition: "setTPage(p,tp,abr,x,y) ((p)->tpage = getTPage(tp,abr,x,y))",
    effects: fieldWrites(0, ["tpage"]),
    evidence: "Writes only the tpage field; getTPage is pure arithmetic over its scalar arguments.",
  },
  {
    name: "setRGB0",
    header: GPU,
    argCount: 4,
    expectedDefinition: "setRGB0(p,_r0,_g0,_b0) (p)->r0 = _r0,(p)->g0 = _g0,(p)->b0 = _b0",
    effects: fieldWrites(0, ["r0", "g0", "b0"]),
    evidence: "Writes only the three color bytes of its pointer argument.",
  },
  {
    name: "setXY0",
    header: GPU,
    argCount: 3,
    expectedDefinition: "setXY0(p,_x0,_y0) (p)->x0 = (_x0), (p)->y0 = (_y0)",
    effects: fieldWrites(0, ["x0", "y0"]),
    evidence: "Writes only the first screen point of its pointer argument.",
  },
  {
    name: "setWH",
    header: GPU,
    argCount: 3,
    expectedDefinition: "setWH(p,_w,_h) (p)->w = _w, (p)->h = _h",
    effects: fieldWrites(0, ["w", "h"]),
    evidence: "Writes only the width and height fields of its pointer argument.",
  },
  {
    name: "setUV0",
    header: GPU,
    argCount: 3,
    expectedDefinition: "setUV0(p,_u0,_v0) (p)->u0 = (_u0), (p)->v0 = (_v0)",
    effects: fieldWrites(0, ["u0", "v0"]),
    evidence: "Writes only the first texture point of its pointer argument.",
  },
  {
    name: "addPrim",
    header: GPU,
    argCount: 2,
    expectedDefinition: "addPrim(ot, p) setaddr(p, getaddr(ot)), setaddr(ot, p)",
    effects: [
      { kind: "field-read", argIndex: 0, field: "addr" },
      { kind: "field-write", argIndex: 0, field: "addr" },
      { kind: "field-write", argIndex: 1, field: "addr" },
    ],
    evidence: "Links the primitive into the ordering-table entry: reads and writes both tag address bitfields.",
  },
  {
    name: "catPrim",
    header: GPU,
    argCount: 2,
    expectedDefinition: "catPrim(p0, p1) setaddr(p0, p1)",
    effects: fieldWrites(0, ["addr"]),
    evidence: "Writes only the tag address bitfield of its first pointer argument.",
  },
  {
    name: "termPrim",
    header: GPU,
    argCount: 1,
    expectedDefinition: "termPrim(p) setaddr(p, 0xffffffff)",
    effects: fieldWrites(0, ["addr"]),
    evidence: "Writes only the tag address bitfield of its pointer argument.",
  },
  {
    name: "setSemiTrans",
    header: GPU,
    argCount: 2,
    expectedDefinition: "setSemiTrans(p, abe) ((abe)?setcode(p, getcode(p)|0x02):setcode(p, getcode(p)&~0x02))",
    effects: [
      { kind: "field-read", argIndex: 0, field: "code" },
      { kind: "field-write", argIndex: 0, field: "code" },
    ],
    evidence: "Reads and rewrites only the primitive code byte.",
  },
  {
    name: "setShadeTex",
    header: GPU,
    argCount: 2,
    expectedDefinition: "setShadeTex(p, tge) ((tge)?setcode(p, getcode(p)|0x01):setcode(p, getcode(p)&~0x01))",
    effects: [
      { kind: "field-read", argIndex: 0, field: "code" },
      { kind: "field-write", argIndex: 0, field: "code" },
    ],
    evidence: "Reads and rewrites only the primitive code byte.",
  },
  {
    name: "setDrawTPage",
    header: GPU,
    argCount: 4,
    expectedDefinition: "setDrawTPage(p, dfe, dtd, tpage) setlen(p, 1), ((u_long *)(p))[1] = _get_mode(dfe, dtd, tpage)",
    effects: [
      { kind: "field-write", argIndex: 0, field: "len" },
      { kind: "whole-object-write", argIndex: 0 },
    ],
    evidence: "Writes the tag length and a raw word that overlaps named color/code fields, so it is ordered against every other access to the same object.",
  },
];

/**
 * Extract `#define name(...)` from header text: splice backslash
 * continuations, strip comments, and collapse whitespace so the comparison is
 * insensitive to layout but sensitive to every token.
 */
export function extractMacroDefinition(headerText: string, name: string): string | undefined {
  const spliced = headerText.replace(/\\\r?\n/g, " ");
  const pattern = new RegExp(`^[ \\t]*#[ \\t]*define[ \\t]+(${name})\\(([^)]*)\\)([^\\n]*)`, "m");
  const match = spliced.match(pattern);
  if (!match) return undefined;
  const parameters = match[2]!.replace(/\s+/g, "");
  const body = match[3]!
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${name}(${parameters.split(",").join(",")}) ${body}`.trim();
}

function normalizeExpected(definition: string): string {
  const match = definition.match(/^(\w+)\(([^)]*)\)\s*([\s\S]*)$/);
  if (!match) return definition.replace(/\s+/g, " ").trim();
  const parameters = match[2]!.replace(/\s+/g, "");
  const body = match[3]!.replace(/\s+/g, " ").trim();
  return `${match[1]}(${parameters}) ${body}`;
}

export function bodyConstants(definition: string): number[] {
  const body = definition.slice(definition.indexOf(")") + 1);
  return [...new Set([...body.matchAll(/\b0x[0-9a-f]+\b|\b\d+\b/gi)]
    .map((match) => Number(match[0]))
    .filter((value) => Number.isFinite(value)))].sort((left, right) => left - right);
}

export interface MacroComponent {
  macro: string;
  argTexts: string[];
  statement: string;
}

/**
 * Split a composite registered macro into its registered component calls,
 * derived entirely from the verified definition text. The body must be a
 * top-level comma list of `name(args)` calls where every name is itself an
 * active registry entry and every argument is either a parameter of the
 * composite (substituted with the caller's argument text) or a literal
 * constant token. Anything else (nested unregistered calls such as
 * `getaddr(ot)`, raw casts, word stores) refuses the split.
 */
export function splitComponents(
  macro: ActiveMacro,
  argTexts: string[],
  registry: MacroRegistry,
): MacroComponent[] | undefined {
  const match = macro.expectedDefinition.match(/^\w+\(([^)]*)\)\s*([\s\S]*)$/);
  if (!match) return undefined;
  const parameters = match[1]!.split(",").map((name) => name.trim()).filter((name) => name.length > 0);
  if (parameters.length !== argTexts.length) return undefined;
  const substitution = new Map(parameters.map((name, index) => [name, argTexts[index]!]));
  const body = match[2]!.trim();

  const pieces: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < body.length; index++) {
    const character = body[index]!;
    if (character === "(") depth++;
    else if (character === ")") depth--;
    else if (character === "," && depth === 0) {
      pieces.push(body.slice(start, index).trim());
      start = index + 1;
    }
  }
  pieces.push(body.slice(start).trim());
  if (pieces.length < 2) return undefined;

  const components: MacroComponent[] = [];
  for (const piece of pieces) {
    const call = piece.match(/^([A-Za-z_]\w*)\(([^()]*)\)$/);
    if (!call) return undefined;
    const component = registry.active.get(call[1]!);
    if (!component) return undefined;
    const componentArgs = call[2]!.split(",").map((argument) => argument.trim());
    if (componentArgs.length !== component.argCount) return undefined;
    const substituted: string[] = [];
    for (const argument of componentArgs) {
      if (substitution.has(argument)) substituted.push(substitution.get(argument)!);
      else if (/^(?:0x[0-9a-fA-F]+|\d+)$/.test(argument)) substituted.push(argument);
      else return undefined;
    }
    components.push({
      macro: component.name,
      argTexts: substituted,
      statement: `${component.name}(${substituted.join(", ")});`,
    });
  }
  return components;
}

export function loadMacroRegistry(root: string = ROOT): MacroRegistry {
  const active = new Map<string, ActiveMacro>();
  const inactive: Array<{ name: string; reason: string }> = [];
  const headerCache = new Map<string, string | undefined>();
  for (const entry of REGISTRY) {
    if (!headerCache.has(entry.header)) {
      const path = join(root, entry.header);
      headerCache.set(entry.header, existsSync(path) ? readFileSync(path, "utf8") : undefined);
    }
    const headerText = headerCache.get(entry.header);
    if (headerText === undefined) {
      inactive.push({ name: entry.name, reason: `configured header ${entry.header} not found` });
      continue;
    }
    const current = extractMacroDefinition(headerText, entry.name);
    if (!current) {
      inactive.push({ name: entry.name, reason: `definition not found in ${entry.header}` });
      continue;
    }
    const expected = normalizeExpected(entry.expectedDefinition);
    if (current !== expected) {
      inactive.push({
        name: entry.name,
        reason: `definition in ${entry.header} differs from the verified text; effects deactivated`,
      });
      continue;
    }
    active.set(entry.name, {
      ...entry,
      expectedDefinition: expected,
      definitionHash: sha256(expected),
      bodyConstants: bodyConstants(expected),
    });
  }
  return { active, inactive };
}
