/** Bounded, compiler-measured record views for affine reads. No inferred C ABI. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { compileSource } from "./decompToolchain.js";
import { elf32Sections } from "../lib/elfSections.js";
import { parseC, walk, field, namedChildren, declaratorName, type Node } from "./residual-source-search/tree-sitter-c.js";
import { analyzeCSource, applyCSourceEdits } from "./cSourceGuard.js";
import type { HoistSite } from "./hoist-knob-sites.js";

interface Member { name: string; type: string; count?: string }
interface Structure { name: string; members: Member[] }
export interface RecordView { type: string; array: string; record: string; member: string; scalar: string }
export interface RecordNormalization {
  source: string; view: RecordView; root: string; counter: string;
  layout: { stride: number; arrayOffset: number; memberOffset: number; count: number };
  reads: Array<{ line: number; start: number; end: number; before: string; after: string; minIndex: number; maxIndex: number;
    counterRange: [number, number]; byteAffine: { a: number; b: number }; recordIndex: { a: number; b: number } }>;
  equalStores: number;
}
export interface ViewDiscovery { expressions: string[]; views: RecordView[] }
const unwrap = (node: Node): Node => {
  let n = node; while (n.type === "parenthesized_expression") n = namedChildren(n)[0]!; return n;
};
function integer(node: Node | undefined): number | undefined {
  if (!node) return undefined;
  const n = unwrap(node);
  if (n.type === "number_literal") {
    let text = n.text;
    while (text.length && "uUlL".includes(text.charAt(text.length - 1))) text = text.slice(0, -1);
    try {
      if (text.length > 1 && text[0] === "0" && !["x", "X"].includes(text[1]!)) text = `0o${text.slice(1)}`;
      const value = Number(BigInt(text));
      return Number.isSafeInteger(value) && value <= 0x7fffffff ? value : undefined;
    } catch { return undefined; }
  }
  const op = field(n, "operator")?.text;
  if (n.type === "unary_expression" && ["+", "-"].includes(op ?? "")) {
    const a = integer(field(n, "argument")); return a === undefined ? undefined : op === "-" ? -a : a;
  }
  if (n.type === "binary_expression") {
    const a = integer(field(n, "left")), b = integer(field(n, "right"));
    if (a === undefined || b === undefined) return undefined;
    const value = op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b
      : op === "/" && b !== 0 ? Math.trunc(a / b) : undefined;
    return value !== undefined && Number.isSafeInteger(value) && Math.abs(value) <= 0x7fffffff ? value : undefined;
  }
  return undefined;
}
const offsetOf = (type: string, member: string): string => `(unsigned int) &(((${type} *) 0)->${member})`;
const sizeOf = (type: string): string => `sizeof(${type})`;

/** Catalogue only named, flat, non-volatile typedef structs already in scope. */
function structures(root: Node): Map<string, Structure> {
  const result = new Map<string, Structure>();
  walk(root, node => {
    if (node.type === "function_definition") return false;
    if (node.type !== "type_definition") return true;
    const type = field(node, "type"), name = field(node, "declarator");
    const body = type && field(type, "body");
    if (type?.type !== "struct_specifier" || !body || name?.type !== "type_identifier") return false;
    const members: Member[] = []; let supported = true;
    for (const declaration of namedChildren(body)) {
      if (declaration.type === "comment") continue;
      const memberType = field(declaration, "type");
      if (declaration.type !== "field_declaration" || !memberType || namedChildren(declaration).some(child => child.type === "type_qualifier")) { supported = false; break; }
      for (const declarator of namedChildren(declaration).filter(child => ["field_identifier", "array_declarator"].includes(child.type))) {
        const memberName = declaratorName(declarator);
        if (!memberName || namedChildren(declaration).some(child => child.type === "bitfield_clause")) { supported = false; break; }
        const count = declarator.type === "array_declarator" ? field(declarator, "size")?.text : undefined;
        if (declarator.type === "array_declarator" && (!count || field(declarator, "declarator")?.type !== "field_identifier")) { supported = false; break; }
        members.push({ name: memberName.text, type: memberType.text, ...(count === undefined ? {} : { count }) });
      }
      if (!members.length) supported = false;
    }
    if (supported) result.set(name.text, { name: name.text, members });
    return false;
  });
  return result;
}
function functionOf(root: Node, name: string): Node | undefined {
  let found: Node | undefined;
  walk(root, node => { if (node.type === "function_definition" && declaratorName(field(node, "declarator"))?.text === name) found = node; return !found; });
  return found;
}
interface Local { type: string; pointer: boolean; rhs?: Node }
function localsOf(fn: Node): Map<string, Local> {
  const locals = new Map<string, Local>();
  walk(fn, node => {
    if (node.type === "declaration") {
      const type = field(node, "type");
      if (!type || namedChildren(node).some(child => child.type === "type_qualifier")) return false;
      for (const child of namedChildren(node)) {
        const declaration = child.type === "init_declarator" ? field(child, "declarator")! : child;
        if (!["identifier", "pointer_declarator"].includes(declaration.type)) continue;
        const name = declaratorName(declaration); if (!name) continue;
        locals.set(name.text, { type: type.text, pointer: declaration.type === "pointer_declarator", ...(field(child, "value") ? { rhs: field(child, "value")! } : {}) });
      }
      return false;
    }
    if (node.type === "assignment_expression") {
      const left = field(node, "left");
      const rhs = field(node, "right");
      if (rhs && left?.type === "identifier" && field(node, "operator")?.text === "=" && locals.has(left.text)) locals.get(left.text)!.rhs = rhs;
    }
    return true;
  });
  return locals;
}
interface Address { root: string; offset: string; unit?: string }
/** Preserve pointer arithmetic units in compiler constant expressions. */
function addressOf(node: Node | undefined): Address | undefined {
  if (!node) return undefined;
  const n = unwrap(node);
  if (n.type === "identifier") return { root: n.text, offset: "0" };
  if (n.type === "cast_expression") {
    const descriptor = field(n, "type"), declarator = descriptor && field(descriptor, "declarator");
    const type = descriptor && field(descriptor, "type");
    if (!type || declarator?.type !== "abstract_pointer_declarator" || namedChildren(declarator).length > 0) return undefined;
    const base = addressOf(field(n, "value")); return base ? { ...base, unit: type.text } : undefined;
  }
  if (n.type === "binary_expression") {
    const op = field(n, "operator")?.text, a = field(n, "left"), b = field(n, "right");
    const value = integer(b), base = addressOf(a);
    if ((op === "+" || op === "-") && value !== undefined && base?.unit) return { ...base, offset: `(${base.offset} ${op} (${value}) * ${sizeOf(base.unit)})` };
  }
  return undefined;
}

/** Expressions are measured by the actual compiler, including every offsetof. */
export function discoverRecordViews(preprocessed: string, source: string, functionName: string): ViewDiscovery {
  const cpp = parseC(preprocessed), raw = parseC(source);
  try {
    const structs = structures(cpp.rootNode), views: RecordView[] = [], expressions = new Set<string>();
    for (const structure of structs.values()) for (const member of structure.members) {
      const record = member.count && structs.get(member.type);
      if (!record) continue;
      for (const scalar of record.members) if (!scalar.count && !structs.has(scalar.type)) {
        views.push({ type: structure.name, array: member.name, record: record.name, member: scalar.name, scalar: scalar.type });
        expressions.add(sizeOf(record.name)); expressions.add(sizeOf(scalar.type));
        expressions.add(offsetOf(structure.name, member.name)); expressions.add(offsetOf(record.name, scalar.name));
        expressions.add(`sizeof(((${structure.name} *) 0)->${member.name}) / ${sizeOf(record.name)}`);
      }
    }
    const fn = functionOf(raw.rootNode, functionName);
    if (fn) for (const local of localsOf(fn).values()) {
      expressions.add(sizeOf(local.type));
      if (local.pointer) {
        const address = addressOf(local.rhs); if (address) expressions.add(address.offset);
        const structure = structs.get(local.type);
        if (structure) for (const member of structure.members) if (!member.count) {
          expressions.add(offsetOf(local.type, member.name)); expressions.add(sizeOf(member.type));
        }
      }
    }
    return { views, expressions: [...expressions] };
  } finally { cpp.delete(); raw.delete(); }
}

/** One compile, one named constant object. Never reads a guessed assembly offset. */
export function measureViewExpressions(functionName: string, preprocessed: string, expressions: string[], directory: string): Map<string, number> {
  if (!expressions.length) return new Map();
  mkdirSync(directory, { recursive: true });
  const symbol = "__psx_hoist_view_measurements";
  const text = `${preprocessed}\nunsigned int ${symbol}[] = {\n${expressions.join(",\n")}\n};\n`;
  const path = join(directory, "measure.c"); writeFileSync(path, text);
  const artifacts = compileSource(path, directory, functionName, { preprocessedText: text, assemble: true });
  const bytes = readFileSync(artifacts.object!), sections = elf32Sections(bytes);
  const symbols = sections.get(".symtab");
  if (!symbols || symbols.entsize !== 16 || bytes[5] !== 1) throw new Error("unsupported view measurement object");
  const strings = [...sections.values()].find(section => section.index === symbols.link);
  if (!strings) throw new Error("measurement object lacks symbol strings");
  for (let at = 0; at < symbols.size; at += 16) {
    const offset = symbols.data.readUInt32LE(at), end = strings.data.indexOf(0, offset);
    if (strings.data.toString("utf8", offset, end) !== symbol) continue;
    const value = symbols.data.readUInt32LE(at + 4), size = symbols.data.readUInt32LE(at + 8), index = symbols.data.readUInt16LE(at + 14);
    const data = [...sections.values()].find(section => section.index === index);
    const expectedSize = expressions.length * 4;
    /* ASPSX-compatible output omits object .size, so st_size may be zero. */
    if (!data || size !== 0 && size !== expectedSize || value + expectedSize > data.data.length) throw new Error("invalid view measurement extent");
    /* Null-based field addresses must fold to constants, never relocations. */
    for (const section of sections.values()) if (section.type === 9 && section.info === index) {
      for (let r = 0; r < section.size; r += section.entsize || 8) {
        const address = section.data.readUInt32LE(r);
        if (address >= value && address < value + expectedSize) throw new Error("unresolved relocation in view measurements");
      }
    }
    return new Map(expressions.map((expression, i) => [expression, data.data.readUInt32LE(value + i * 4)]));
  }
  throw new Error("view measurement constant object not found");
}

interface Affine { a: number; b: number }
function affine(node: Node, counter: string): Affine | undefined {
  const n = unwrap(node), value = integer(n);
  if (value !== undefined) return { a: 0, b: value };
  if (n.type === "identifier" && n.text === counter) return { a: 1, b: 0 };
  if (n.type !== "binary_expression") return undefined;
  const left = affine(field(n, "left")!, counter), right = affine(field(n, "right")!, counter), op = field(n, "operator")?.text;
  if (!left || !right) return undefined;
  if (op === "+" || op === "-") return { a: left.a + (op === "+" ? right.a : -right.a), b: left.b + (op === "+" ? right.b : -right.b) };
  if (op === "*" && (left.a === 0 || right.a === 0)) return { a: left.a * right.b + right.a * left.b, b: left.b * right.b };
  return undefined;
}
/** Refuse macro-induced changes to types, guards, reads or intervening effects. */
function tokens(node: Node): string {
  if (node.type === "comment") return "";
  return node.childCount === 0 ? JSON.stringify([node.type, node.text])
    : Array.from({ length: node.childCount }, (_, i) => tokens(node.child(i)!)).join("");
}
function integerType(type: string, root: Node, seen = new Set<string>()): boolean {
  if (seen.has(type)) return false;
  seen.add(type);
  const tree = parseC(`${type} value;`);
  try {
    const specifier = field(namedChildren(tree.rootNode)[0]!, "type");
    if (specifier && ["primitive_type", "sized_type_specifier"].includes(specifier.type)) {
      return specifier.text.split(" ").every(word => ["signed", "unsigned", "char", "short", "int", "long"].includes(word));
    }
  } finally { tree.delete(); }
  let underlying: string | undefined;
  walk(root, node => {
    if (node.type === "function_definition") return false;
    if (node.type !== "type_definition") return true;
    if (field(node, "declarator")?.text === type && !namedChildren(node).some(child => child.type === "type_qualifier")) underlying = field(node, "type")?.text;
    return false;
  });
  return underlying !== undefined && integerType(underlying, root, seen);
}
interface Bounds { counter: string; limit: number }
function loopBounds(loop: Node, fn: Node, locals: Map<string, Local>): Bounds | undefined {
  const condition = field(loop, "condition"); if (!condition) return undefined;
  const c = unwrap(condition), lhs = field(c, "left"), limit = integer(field(c, "right"));
  if (c.type !== "binary_expression" || field(c, "operator")?.text !== "<" || lhs?.type !== "identifier" || limit === undefined || limit < 1 || limit > 65536) return undefined;
  const counter = lhs.text, local = locals.get(counter);
  if (!local || local.pointer) return undefined;
  let declarations = 0;
  walk(fn, node => {
    if (node.type === "declaration" || node.type === "parameter_declaration") {
      for (const child of namedChildren(node)) if (declaratorName(child)?.text === counter) declarations++;
    }
    return true;
  });
  if (declarations !== 1) return undefined;
  const body = field(loop, "body"); if (!body || body.type !== "compound_statement") return undefined;
  let step: Node | undefined, unsafe = false;
  walk(body, node => {
    if (node.type === "call_expression") unsafe = true;
    const left = field(node, "left"), argument = field(node, "argument");
    if (node.type === "assignment_expression" && left && unwrap(left).text === counter) {
      if (step || field(node, "operator")?.text !== "+=" || integer(field(node, "right")) !== 1) unsafe = true;
      step = node;
    }
    if (node.type === "update_expression" && argument && unwrap(argument).text === counter) {
      if (step || field(node, "operator")?.text !== "++") unsafe = true;
      step = node;
    }
    return true;
  });
  walk(fn, node => {
    if (["goto_statement", "labeled_statement"].includes(node.type)) unsafe = true;
    if (node.type === "identifier" && node.text === counter) {
      let parent = node.parent; while (parent?.type === "parenthesized_expression") parent = parent.parent;
      if (parent?.type === "pointer_expression" && field(parent, "operator")?.text === "&") unsafe = true;
    }
    return true;
  });
  if (unsafe) return undefined;
  if (loop.type === "do_statement") {
    const statements = namedChildren(body).filter(node => node.type !== "comment");
    if (!step || step.parent?.id !== statements.at(-1)?.id || step.parent?.parent?.id !== body.id) return undefined;
    const siblings = namedChildren(loop.parent!); let initialized = false;
    for (const statement of siblings) {
      if (statement.startIndex >= loop.startIndex) break;
      let touchesCounter = false;
      walk(statement, node => { if (node.type === "identifier" && node.text === counter) touchesCounter = true; return true; });
      if (!touchesCounter) continue;
      const assignment = statement.type === "expression_statement" ? namedChildren(statement)[0] : undefined;
      initialized = assignment?.type === "assignment_expression" && field(assignment, "left")?.text === counter
        && field(assignment, "operator")?.text === "=" && integer(field(assignment, "right")) === 0;
    }
    if (!initialized) return undefined;
  } else if (loop.type === "for_statement") {
    const init = field(loop, "initializer"), update = field(loop, "update");
    if (step || init?.type !== "assignment_expression" || field(init, "left")?.text !== counter || integer(field(init, "right")) !== 0 || field(init, "operator")?.text !== "=") return undefined;
    if (update?.type !== "update_expression" || field(update, "argument")?.text !== counter || field(update, "operator")?.text !== "++") return undefined;
  } else return undefined;
  return { counter, limit };
}
function rangeAt(node: Node, loop: Node, bounds: Bounds): [number, number] {
  let lo = 0, hi = bounds.limit - 1;
  for (let child: Node = node, parent = node.parent; parent && parent.id !== loop.id; child = parent, parent = parent.parent) {
    if (parent.type !== "if_statement") continue;
    const condition = field(parent, "condition"); if (!condition) continue;
    const c = unwrap(condition), left = field(c, "left"), value = integer(field(c, "right"));
    if (left?.text !== bounds.counter || value === undefined) continue;
    const op = field(c, "operator")?.text, yes = field(parent, "consequence")?.id === child.id;
    if (op === "<") { if (yes) hi = Math.min(hi, value - 1); else lo = Math.max(lo, value); }
    if (op === "==" && yes) { lo = Math.max(lo, value); hi = Math.min(hi, value); }
  }
  return [lo, hi];
}
function affineText(value: Affine, counter: string): string {
  if (value.a === 0) return String(value.b);
  const base = value.a === 1 ? counter : `(${counter} * ${value.a})`;
  return value.b === 0 ? base : `${base} ${value.b > 0 ? "+" : "-"} ${Math.abs(value.b)}`;
}

/** Every transformed address must agree as a byte-affine relation, within bounds. */
export function normalizeRecordViews(source: string, preprocessed: string, functionName: string, sites: HoistSite[], discovery: ViewDiscovery, measured: Map<string, number>): RecordNormalization[] {
  if (!analyzeCSource(source).parses) return [];
  const raw = parseC(source), cpp = parseC(preprocessed);
  try {
    const fn = functionOf(raw.rootNode, functionName); if (!fn) return [];
    const locals = localsOf(fn), structs = structures(cpp.rootNode);
    const cppFn = functionOf(cpp.rootNode, functionName);
    if (!cppFn || fn.hasError || cppFn.hasError || tokens(fn) !== tokens(cppFn)) return [];
    const rawLoops: Node[] = [], cppLoops: Node[] = [];
    for (const [body, loops] of [[fn, rawLoops], [cppFn, cppLoops]] as const) walk(body, node => {
      if (["do_statement", "for_statement", "while_statement"].includes(node.type)) loops.push(node);
      return true;
    });
    if (rawLoops.length !== cppLoops.length) return [];
    const cppLocals = localsOf(cppFn);
    const reads = sites.map(site => {
      let base: Node | undefined; walk(fn, node => { if (node.startIndex === site.start && node.endIndex === site.end) base = node; return !base; });
      const expression = base?.parent;
      if (!base || !expression || !["subscript_expression", "field_expression"].includes(expression.type)) return undefined;
      const local = locals.get(site.alias), address = addressOf(local?.rhs);
      if (!local?.pointer || !address) return undefined;
      let loop: Node | undefined = expression;
      while (loop && !["do_statement", "for_statement", "while_statement"].includes(loop.type)) loop = loop.parent ?? undefined;
      const bounds = loop && loopBounds(loop, fn, locals);
      if (!loop || !bounds || !integerType(locals.get(bounds.counter)!.type, cpp.rootNode)
        || (measured.get(sizeOf(locals.get(bounds.counter)!.type)) ?? 0) < 4) return undefined;
      const cppLoop = cppLoops[rawLoops.findIndex(candidate => candidate.id === loop!.id)];
      const cppBounds = cppLoop && loopBounds(cppLoop, cppFn, cppLocals);
      if (!cppBounds || cppLoop!.type !== loop.type || cppBounds.counter !== bounds.counter || cppBounds.limit !== bounds.limit) return undefined;
      let scalar = local.type, offset = measured.get(address.offset), index: Affine | undefined;
      if (offset === undefined) return undefined;
      if (expression.type === "subscript_expression") index = affine(field(expression, "index")!, bounds.counter);
      else {
        const member = field(expression, "field")?.text, memberInfo = structs.get(local.type)?.members.find(item => item.name === member);
        if (!member || !memberInfo || memberInfo.count || field(expression, "operator")?.text !== "->") return undefined;
        const fieldOffset = measured.get(offsetOf(local.type, member)); if (fieldOffset === undefined) return undefined;
        offset += fieldOffset; scalar = memberInfo.type; index = { a: 0, b: 0 };
      }
      const size = measured.get(sizeOf(scalar)); if (!index || !size) return undefined;
      /* Site normalization is read-only and cannot conceal address escape. */
      for (let child = expression, parent = expression.parent; parent && parent.id !== loop.id; child = parent, parent = parent.parent) {
        if (parent.type === "update_expression" || parent.type === "pointer_expression" && field(parent, "operator")?.text === "&"
          || parent.type === "assignment_expression" && field(parent, "left")?.id === child.id) return undefined;
      }
      return { expression, local, address, scalar, loop, bounds, byte: { a: index.a * size, b: offset + index.b * size }, range: rangeAt(expression, loop, bounds) };
    });
    if (!reads.length || reads.some(read => !read)) return [];
    const all = reads.filter((read): read is NonNullable<typeof read> => read !== undefined);
    if (new Set(all.map(read => read.loop.id)).size !== 1 || new Set(all.map(read => read.address.root)).size !== 1) return [];
    const root = all[0]!.address.root, loop = all[0]!.loop, bounds = all[0]!.bounds;
    const results: RecordNormalization[] = [];
    for (const view of discovery.views) {
      if (!all.every(read => read.scalar === view.scalar)) continue;
      const stride = measured.get(sizeOf(view.record)), arrayOffset = measured.get(offsetOf(view.type, view.array)), memberOffset = measured.get(offsetOf(view.record, view.member));
      const count = measured.get(`sizeof(((${view.type} *) 0)->${view.array}) / ${sizeOf(view.record)}`);
      if (!stride || arrayOffset === undefined || memberOffset === undefined || !count) continue;
      const indices = all.map(read => ({ a: read.byte.a / stride, b: (read.byte.b - arrayOffset - memberOffset) / stride }));
      if (indices.some((index, i) => !Number.isSafeInteger(index.a) || !Number.isSafeInteger(index.b)
        || all[i]!.range[0] > all[i]!.range[1] || index.a < 0 || index.a * all[i]!.range[0] + index.b < 0 || index.a * all[i]!.range[1] + index.b >= count
        || Math.abs(all[i]!.byte.a) * bounds.limit + Math.abs(all[i]!.byte.b) >= 0x7fffffff)) continue;
      const names = new Set<string>();
      for (const tree of [raw, cpp]) walk(tree.rootNode, node => {
        if (["identifier", "type_identifier", "field_identifier"].includes(node.type)) names.add(node.text);
        return true;
      });
      let alias = "__psx_hoist_view_base";
      while (names.has(alias)) alias += "_";
      const rewritten = all.map((read, i) => ({ line: read.expression.startPosition.row + 1,
        start: read.expression.startIndex, end: read.expression.endIndex, before: read.expression.text,
        after: `${alias}->${view.array}[${affineText(indices[i]!, bounds.counter)}].${view.member}`,
        minIndex: indices[i]!.a * read.range[0] + indices[i]!.b, maxIndex: indices[i]!.a * read.range[1] + indices[i]!.b,
        counterRange: read.range, byteAffine: read.byte, recordIndex: indices[i]! }));
      const edits = all.map((read, i) => ({ start: read.expression.startIndex, end: read.expression.endIndex, text: rewritten[i]!.after }));
      /* Canonicalise a store's constant index only under its proved i==K guard. */
      let equalStores = 0;
      walk(loop, node => {
        if (node.type !== "subscript_expression" || integer(field(node, "index")) === undefined) return true;
        const parent = node.parent;
        if (parent?.type !== "assignment_expression" || field(parent, "left")?.id !== node.id) return true;
        const range = rangeAt(node, loop, bounds), index = integer(field(node, "index"));
        if (range[0] !== range[1] || range[0] !== index) return true;
        const at = field(node, "index")!;
        edits.push({ start: at.startIndex, end: at.endIndex, text: bounds.counter }); equalStores++;
        return true;
      });
      const body = field(fn, "body")!;
      edits.push({ start: body.startIndex + 1, end: body.startIndex + 1, text: `\n    ${view.type} *${alias};` });
      edits.push({ start: loop.startIndex, end: loop.startIndex, text: `${alias} = (${view.type} *) ${root};\n    ` });
      const normalized = applyCSourceEdits(source, edits);
      if (analyzeCSource(normalized).parses) results.push({ source: normalized, view, root, counter: bounds.counter,
        layout: { stride, arrayOffset, memberOffset, count }, reads: rewritten, equalStores });
    }
    return results;
  } finally { raw.delete(); cpp.delete(); }
}
