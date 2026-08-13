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
  /**
   * The macro publishes a packet into a list the hardware or a later pass
   * walks. Statements touching a published object are ordered against the
   * publication point by default, so an initializer can never be moved after
   * the call that links its packet in.
   */
  publication?: true;
}

export interface ActiveMacro extends KnownMacroDefinition {
  definitionHash: string;
  bodyConstants: number[];
}

export interface MacroRegistry {
  active: Map<string, ActiveMacro>;
  inactive: Array<{ name: string; reason: string }>;
  /** SHA-256 of each configured header the registry was validated against. */
  headerHashes: Record<string, string>;
}

const GPU = "include/psyq/libgpu.h";

function fieldWrites(argIndex: number, fields: string[]): MacroEffect[] {
  return fields.map((field) => ({ kind: "field-write" as const, argIndex, field }));
}

/** `setXxx(p)` primitive initializers: one entry per (length, code) pair. */
function primitiveInitializer(name: string, len: number, code: string): KnownMacroDefinition {
  return {
    name,
    header: GPU,
    argCount: 1,
    expectedDefinition: `${name}(p) setlen(p, ${len}), setcode(p, ${code})`,
    effects: fieldWrites(0, ["len", "code"]),
    evidence: "Expands to setlen and setcode on the same primitive; writes only len and code.",
  };
}

/** `setXY*`/`setUV*`/`setRGB*` point and colour setters: named field writes. */
function pointSetter(
  name: string,
  parameters: string[],
  body: string,
  fields: string[],
  what: string,
): KnownMacroDefinition {
  return {
    name,
    header: GPU,
    argCount: parameters.length + 1,
    expectedDefinition: `${name}(p,${parameters.join(",")}) ${body}`,
    effects: fieldWrites(0, fields),
    evidence: `Writes only the ${what} of its pointer argument.`,
  };
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
  primitiveInitializer("setSprt", 4, "0x64"),
  primitiveInitializer("setSprt8", 3, "0x74"),
  primitiveInitializer("setSprt16", 3, "0x7c"),
  primitiveInitializer("setPolyF3", 4, "0x20"),
  primitiveInitializer("setPolyFT3", 7, "0x24"),
  primitiveInitializer("setPolyG3", 6, "0x30"),
  primitiveInitializer("setPolyGT3", 9, "0x34"),
  primitiveInitializer("setPolyF4", 5, "0x28"),
  primitiveInitializer("setPolyFT4", 9, "0x2c"),
  primitiveInitializer("setPolyG4", 8, "0x38"),
  primitiveInitializer("setPolyGT4", 12, "0x3c"),
  primitiveInitializer("setTile", 3, "0x60"),
  primitiveInitializer("setTile1", 2, "0x68"),
  primitiveInitializer("setTile8", 2, "0x70"),
  primitiveInitializer("setTile16", 2, "0x78"),
  primitiveInitializer("setLineF2", 3, "0x40"),
  primitiveInitializer("setLineG2", 4, "0x50"),
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
  pointSetter("setRGB1", ["_r1", "_g1", "_b1"],
    "(p)->r1 = _r1,(p)->g1 = _g1,(p)->b1 = _b1", ["r1", "g1", "b1"], "second colour triple"),
  pointSetter("setRGB2", ["_r2", "_g2", "_b2"],
    "(p)->r2 = _r2,(p)->g2 = _g2,(p)->b2 = _b2", ["r2", "g2", "b2"], "third colour triple"),
  pointSetter("setRGB3", ["_r3", "_g3", "_b3"],
    "(p)->r3 = _r3,(p)->g3 = _g3,(p)->b3 = _b3", ["r3", "g3", "b3"], "fourth colour triple"),
  {
    name: "setXY0",
    header: GPU,
    argCount: 3,
    expectedDefinition: "setXY0(p,_x0,_y0) (p)->x0 = (_x0), (p)->y0 = (_y0)",
    effects: fieldWrites(0, ["x0", "y0"]),
    evidence: "Writes only the first screen point of its pointer argument.",
  },
  pointSetter("setXY2", ["_x0", "_y0", "_x1", "_y1"],
    "(p)->x0 = (_x0), (p)->y0 = (_y0), (p)->x1 = (_x1), (p)->y1 = (_y1)",
    ["x0", "y0", "x1", "y1"], "first two screen points"),
  pointSetter("setXY3", ["_x0", "_y0", "_x1", "_y1", "_x2", "_y2"],
    "(p)->x0 = (_x0), (p)->y0 = (_y0), (p)->x1 = (_x1), (p)->y1 = (_y1), (p)->x2 = (_x2), (p)->y2 = (_y2)",
    ["x0", "y0", "x1", "y1", "x2", "y2"], "first three screen points"),
  pointSetter("setXY4", ["_x0", "_y0", "_x1", "_y1", "_x2", "_y2", "_x3", "_y3"],
    "(p)->x0 = (_x0), (p)->y0 = (_y0), (p)->x1 = (_x1), (p)->y1 = (_y1), (p)->x2 = (_x2), (p)->y2 = (_y2), (p)->x3 = (_x3), (p)->y3 = (_y3)",
    ["x0", "y0", "x1", "y1", "x2", "y2", "x3", "y3"], "four screen points"),
  pointSetter("setXYWH", ["_x0", "_y0", "_w", "_h"],
    "(p)->x0 = (_x0), (p)->y0 = (_y0), (p)->x1 = (_x0)+(_w), (p)->y1 = (_y0), (p)->x2 = (_x0), (p)->y2 = (_y0)+(_h), (p)->x3 = (_x0)+(_w), (p)->y3 = (_y0)+(_h)",
    ["x0", "y0", "x1", "y1", "x2", "y2", "x3", "y3"], "four screen points of a rectangle"),
  pointSetter("setUV3", ["_u0", "_v0", "_u1", "_v1", "_u2", "_v2"],
    "(p)->u0 = (_u0), (p)->v0 = (_v0), (p)->u1 = (_u1), (p)->v1 = (_v1), (p)->u2 = (_u2), (p)->v2 = (_v2)",
    ["u0", "v0", "u1", "v1", "u2", "v2"], "first three texture points"),
  pointSetter("setUV4", ["_u0", "_v0", "_u1", "_v1", "_u2", "_v2", "_u3", "_v3"],
    "(p)->u0 = (_u0), (p)->v0 = (_v0), (p)->u1 = (_u1), (p)->v1 = (_v1), (p)->u2 = (_u2), (p)->v2 = (_v2), (p)->u3 = (_u3), (p)->v3 = (_v3)",
    ["u0", "v0", "u1", "v1", "u2", "v2", "u3", "v3"], "four texture points"),
  pointSetter("setUVWH", ["_u0", "_v0", "_w", "_h"],
    "(p)->u0 = (_u0), (p)->v0 = (_v0), (p)->u1 = (_u0)+(_w), (p)->v1 = (_v0), (p)->u2 = (_u0), (p)->v2 = (_v0)+(_h), (p)->u3 = (_u0)+(_w), (p)->v3 = (_v0)+(_h)",
    ["u0", "v0", "u1", "v1", "u2", "v2", "u3", "v3"], "four texture points of a rectangle"),
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
    publication: true,
  },
  {
    name: "addPrims",
    header: GPU,
    argCount: 3,
    expectedDefinition: "addPrims(ot,p0,p1) setaddr(p1, getaddr(ot)),setaddr(ot, p0)",
    effects: [
      { kind: "field-read", argIndex: 0, field: "addr" },
      { kind: "field-write", argIndex: 0, field: "addr" },
      { kind: "field-write", argIndex: 2, field: "addr" },
    ],
    evidence: "Links a chain of primitives into the ordering-table entry: reads and writes the table tag and the last packet's tag.",
    publication: true,
  },
  {
    name: "catPrim",
    header: GPU,
    argCount: 2,
    expectedDefinition: "catPrim(p0, p1) setaddr(p0, p1)",
    effects: fieldWrites(0, ["addr"]),
    evidence: "Writes only the tag address bitfield of its first pointer argument.",
    publication: true,
  },
  {
    name: "termPrim",
    header: GPU,
    argCount: 1,
    expectedDefinition: "termPrim(p) setaddr(p, 0xffffffff)",
    effects: fieldWrites(0, ["addr"]),
    evidence: "Writes only the tag address bitfield of its pointer argument.",
    publication: true,
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
  {
    name: "setDrawMode",
    header: GPU,
    argCount: 5,
    expectedDefinition: "setDrawMode(p,dfe,dtd,tpage,tw) setlen(p, 2), ((u_long *)p)[1] = _get_mode(dfe, dtd, tpage), ((u_long *)p)[2] = _get_tw((RECT *)tw)",
    effects: [
      { kind: "field-write", argIndex: 0, field: "len" },
      { kind: "whole-object-write", argIndex: 0 },
    ],
    evidence: "Writes the tag length and two raw words addressed past the named fields, so it is ordered against every other access to the same object.",
  },
  {
    name: "setTexWindow",
    header: GPU,
    argCount: 2,
    expectedDefinition: "setTexWindow(p,tw) setlen(p, 2), ((u_long *)(p))[1] = _get_tw(tw), ((u_long *)(p))[2] = 0",
    effects: [
      { kind: "field-write", argIndex: 0, field: "len" },
      { kind: "whole-object-write", argIndex: 0 },
    ],
    evidence: "Writes the tag length and two raw words addressed past the named fields, so it is ordered against every other access to the same object.",
  },
  {
    name: "setDrawStp",
    header: GPU,
    argCount: 2,
    expectedDefinition: "setDrawStp(p,pbw) setlen(p, 2), ((u_long *)p)[1] = 0xe6000000|(pbw?0x01:0), ((u_long *)p)[2] = 0",
    effects: [
      { kind: "field-write", argIndex: 0, field: "len" },
      { kind: "whole-object-write", argIndex: 0 },
    ],
    evidence: "Writes the tag length and two raw words addressed past the named fields, so it is ordered against every other access to the same object.",
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
  const headerHashes: Record<string, string> = {};
  for (const entry of REGISTRY) {
    if (!headerCache.has(entry.header)) {
      const path = join(root, entry.header);
      const text = existsSync(path) ? readFileSync(path, "utf8") : undefined;
      headerCache.set(entry.header, text);
      if (text !== undefined) headerHashes[entry.header] = sha256(text);
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
  return { active, inactive, headerHashes };
}

/** Macros that link a packet into a list a later stage walks. */
export function isPublicationMacro(registry: MacroRegistry, name: string | undefined): boolean {
  return name !== undefined && registry.active.get(name)?.publication === true;
}
