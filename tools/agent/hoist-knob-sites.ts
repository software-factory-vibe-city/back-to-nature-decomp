/** AST-only access-route knobs. Refuse escapes, shadowing and mutable pointer bases. */
import { parseC, walk, field, namedChildren, declaratorName, declaratorIsPointer, declaratorIsArray, type Node } from "./residual-source-search/tree-sitter-c.js";
import { analyzeCSource, applyCSourceEdits } from "./cSourceGuard.js";
import type { HoistWindow } from "./loop-emission/desirability.js";

export interface HoistSite {
  start: number;
  end: number;
  line: number;
  local: string;
  global: string;
  alias: string;
  current: "local" | "global";
}
const unwrap = (node: Node): Node => {
  let result = node;
  while (result.type === "parenthesized_expression") result = namedChildren(result)[0]!;
  return result;
};
interface InvariantAddress {
  root: string;
  /** Set only for a bare &object, where object.field is an equivalent route. */
  object?: string;
}

/* No value folding or byte/element-unit guesses: copy the original expression
   verbatim. This recognises only a fixed address, never a pointer load, index
   variable, call, VLA cast or other computation with run-time inputs. */
function staticCast(node: Node): boolean {
  const type = field(node, "type");
  if (!type || type.type !== "type_descriptor") return false;
  const base = field(type, "type");
  if (!base || !["primitive_type", "sized_type_specifier", "type_identifier", "struct_specifier", "union_specifier", "enum_specifier"].includes(base.type)) return false;
  if (field(base, "body")) return false;
  let dynamic = false;
  walk(type, (child) => {
    if (child.type.includes("array_declarator") || child.type.includes("function_declarator") || child.type === "typeof_expression") dynamic = true;
    return true;
  });
  return !dynamic;
}
function integerConstant(node: Node): boolean {
  const n = unwrap(node);
  if (n.type === "number_literal") {
    let text = n.text;
    while ("uUlL".includes(text.charAt(text.length - 1)) && text.length > 0) text = text.slice(0, -1);
    try { BigInt(text); return text.length > 0; } catch { return false; }
  }
  if (n.type === "char_literal") return true;
  if (n.type === "cast_expression") return staticCast(n) && integerConstant(field(n, "value")!);
  const op = field(n, "operator")?.text;
  if (n.type === "unary_expression" && op && ["+", "-", "~", "!"].includes(op)) return integerConstant(field(n, "argument")!);
  if (n.type === "binary_expression" && op && ["+", "-", "*", "/", "%", "<<", ">>", "&", "|", "^"].includes(op)) {
    return integerConstant(field(n, "left")!) && integerConstant(field(n, "right")!);
  }
  return false;
}
function invariantAddress(node: Node, arrays: Set<string>, objects: Set<string>): InvariantAddress | undefined {
  const n = unwrap(node);
  if (n.type === "identifier" && arrays.has(n.text)) return { root: n.text };
  if (n.type === "cast_expression" && staticCast(n)) return invariantAddress(field(n, "value")!, arrays, objects);
  if (n.type === "pointer_expression" && field(n, "operator")?.text === "&") {
    const argument = unwrap(field(n, "argument")!);
    if (argument.type === "identifier" && objects.has(argument.text)) return { root: argument.text, object: argument.text };
  }
  if (n.type === "binary_expression") {
    const op = field(n, "operator")?.text;
    const left = field(n, "left")!; const right = field(n, "right")!;
    if ((op === "+" || op === "-") && integerConstant(right)) {
      const base = invariantAddress(left, arrays, objects);
      if (base) return { root: base.root };
    }
    if (op === "+" && integerConstant(left)) {
      const base = invariantAddress(right, arrays, objects);
      if (base) return { root: base.root };
    }
  }
  return undefined;
}
function shape(node: Node): string {
  const n = unwrap(node);
  return n.childCount === 0 ? `${n.type}:${n.text}` : `${n.type}(${Array.from({ length: n.childCount }, (_, i) => n.child(i)!).filter(c => c.type !== "comment").map(shape).join(",")})`;
}
function declarations(root: Node): Map<string, { count: number; array: boolean; pointer: boolean; node: Node }> {
  const result = new Map<string, { count: number; array: boolean; pointer: boolean; node: Node }>();
  walk(root, (node) => {
    if (node.type === "declaration" || node.type === "parameter_declaration") {
      for (const child of namedChildren(node)) {
        if (!child.type.includes("declarator") && child.type !== "identifier") continue;
        const name = declaratorName(child)?.text;
        if (!name) continue;
        const previous = result.get(name);
        result.set(name, { count: (previous?.count ?? 0) + 1, array: declaratorIsArray(child), pointer: declaratorIsPointer(child), node: child });
      }
    }
    return true;
  });
  return result;
}
export function invariantGlobals(preprocessed: string, addressOfObject = false): Set<string> {
  const tree = parseC(preprocessed);
  try {
    const result = new Set<string>();
    walk(tree.rootNode, (node) => {
      if (node.type === "function_definition") return false;
      if (node.type !== "declaration") return true;
      const volatile = namedChildren(node).some((child) => child.type === "type_qualifier" && child.text === "volatile");
      if (!volatile) for (const child of namedChildren(node)) {
        let functionDeclarator = false;
        walk(child, (item) => { if (item.type === "function_declarator") functionDeclarator = true; return true; });
        if (declaratorIsArray(child) || addressOfObject && !functionDeclarator && (child.type.includes("declarator") || child.type === "identifier")) {
          const name = declaratorName(child)?.text; if (name) result.add(name);
        }
      }
      return false;
    });
    return result;
  } finally { tree.delete(); }
}

export function invariantAddressLocals(preprocessed: string, functionName: string, arrays: Set<string>, objects: Set<string>): Set<string> {
  const tree = parseC(preprocessed);
  try {
    const writes = new Map<string, { count: number; pure: boolean }>();
    const unsafe = new Set<string>();
    walk(tree.rootNode, (node) => {
      if (node.type === "function_definition") {
        if (declaratorName(field(node, "declarator"))?.text !== functionName) return false;
        const decls = declarations(node);
        for (const [name, declaration] of decls) if (declaration.count !== 1) unsafe.add(name);
        walk(field(node, "body")!, (item) => {
          const left = item.type === "assignment_expression" ? field(item, "left") : undefined;
          const name = left && unwrap(left).type === "identifier" ? unwrap(left).text
            : item.type === "init_declarator" ? declaratorName(item)?.text : undefined;
          const value = item.type === "assignment_expression" ? field(item, "right") : item.type === "init_declarator" ? field(item, "value") : undefined;
          if (name && value) {
            const address = invariantAddress(value, arrays, objects);
            const pure = address !== undefined && !decls.has(address.root)
              && (item.type !== "assignment_expression" || field(item, "operator")?.text === "=");
            const previous = writes.get(name);
            writes.set(name, { count: (previous?.count ?? 0) + 1, pure: pure && (previous?.pure ?? true) });
          }
          if (item.type === "identifier") {
            let parent = item.parent;
            while (parent?.type === "parenthesized_expression") parent = parent.parent;
            if (parent?.type === "update_expression" || parent?.type === "pointer_expression" && field(parent, "operator")?.text === "&") unsafe.add(item.text);
          }
          return true;
        });
        return false;
      }
      return true;
    });
    return new Set([...writes].filter(([name, value]) => value.count === 1 && value.pure && !unsafe.has(name)).map(([name]) => name));
  } finally { tree.delete(); }
}

export function enumerateHoistSites(source: string, functionName: string, windows: HoistWindow[], globals: Set<string>, objects = globals, provenLocals?: Set<string>): HoistSite[] {
  const guard = analyzeCSource(source);
  if (!guard.parses) throw new Error("source does not parse; no access-route rewrite is licensed");
  const tree = parseC(source);
  try {
    let fn: Node | undefined;
    walk(tree.rootNode, (node) => {
      if (node.type === "function_definition" && declaratorName(field(node, "declarator"))?.text === functionName) fn = node;
      return !fn;
    });
    if (!fn) throw new Error(`no AST definition of ${functionName}`);
    const body = field(fn, "body")!;
    const macroNames = new Set<string>();
    walk(tree.rootNode, (node) => {
      if (node.type === "preproc_def" || node.type === "preproc_function_def") {
        const name = field(node, "name")?.text; if (name) macroNames.add(name);
      }
      return true;
    });
    let conditionalBody = false;
    walk(body, (node) => { if (node.type.startsWith("preproc")) conditionalBody = true; return true; });
    if (conditionalBody) return [];
    const decls = declarations(fn);
    const loops: Node[] = [];
    walk(body, (node) => { if (["for_statement", "while_statement", "do_statement"].includes(node.type)) loops.push(node); return true; });
    const sites: HoistSite[] = [];
    for (const window of windows) {
      if (window.endLine === undefined) throw new Error("window has no verified source-line map; refusing to guess its sites");
      const matching = loops.filter((node) => node.startPosition.row + 1 <= (window.startLine ?? window.endLine!) && node.endPosition.row + 1 >= window.endLine!);
      const loop = matching.sort((a, b) => (a.endIndex - a.startIndex) - (b.endIndex - b.startIndex))[0];
      if (!loop || loop.parent?.type !== "compound_statement") continue;
      /* A condition's constant is born on its header line; its controlled
         read belongs to that site even when written on the following line. */
      let endAccessLine = window.endLine;
      walk(loop, (node) => {
        const condition = field(node, "condition");
        if (node.type === "if_statement" && condition && condition.startPosition.row + 1 <= window.endLine!
          && condition.endPosition.row + 1 >= window.endLine!) {
          endAccessLine = Math.max(endAccessLine, (field(node, "consequence") ?? node).endPosition.row + 1);
        }
        return true;
      });
      const aliases: Array<{ name: string; rhs: Node; global: string; object?: string }> = [];
      for (const [name, declaration] of decls) {
        if (declaration.count !== 1 || !declaration.pointer || declaration.array || provenLocals && !provenLocals.has(name)) continue;
        const writes: Array<{ rhs: Node; statement: Node }> = [];
        let unsafe = false;
        walk(body, (node) => {
          const left = node.type === "assignment_expression" ? field(node, "left") : undefined;
          if (left && unwrap(left).type === "identifier" && unwrap(left).text === name) {
            const rhs = field(node, "right");
            const statement = node.parent;
            if (!rhs || statement?.type !== "expression_statement" || field(node, "operator")?.text !== "=") unsafe = true;
            else writes.push({ rhs, statement });
          }
          if (node.type === "init_declarator" && declaratorName(node)?.text === name) {
            const rhs = field(node, "value"); if (rhs) writes.push({ rhs, statement: node.parent! });
          }
          if (node.type === "identifier" && node.text === name) {
            let parent = node.parent;
            while (parent?.type === "parenthesized_expression") parent = parent.parent;
            if (parent?.type === "update_expression") unsafe = true;
            if (parent?.type === "pointer_expression" && field(parent, "operator")?.text === "&") unsafe = true;
          }
          return true;
        });
        if (unsafe || writes.length !== 1) continue;
        const write = writes[0]!;
        let qualified = false;
        walk(declaration.node.parent!, (node) => { if (node.type === "type_qualifier" && node.text === "volatile") qualified = true; return true; });
        if (qualified) continue;
        if (write.statement.parent?.id !== loop.parent.id || write.statement.endIndex >= loop.startIndex) continue;
        const address = invariantAddress(write.rhs, globals, objects);
        if (!address) continue;
        const object = address.object;
        /* A function-local declaration with this name may shadow the global
           at either the binding or a read. Refuse rather than resolve scopes. */
        if (decls.has(address.root)) continue;
        /* Preserve the assignment's implicit pointer conversion too. A cast
           to u8* assigned to a u16* local must still index as u16*, not u8*. */
        const declared = declaration.node.type === "init_declarator" ? field(declaration.node, "declarator")! : declaration.node;
        const nameNode = declaratorName(declared)!;
        const type = field(declaration.node.parent!, "type");
        if (!type || declared.type !== "pointer_declarator") continue;
        const pointerType = `${type.text} ${declared.text.slice(0, nameNode.startIndex - declared.startIndex)}${declared.text.slice(nameNode.endIndex - declared.startIndex)}`.trim();
        const global = `(${pointerType}) (${write.rhs.text})`;
        /* A macro/preprocessor branch can change binding without being a C write. */
        let conditional = false;
        walk(write.rhs, (node) => { if (node.type.startsWith("preproc") || node.type === "type_qualifier" && node.text === "volatile"
          || node.type === "identifier" && macroNames.has(node.text)) conditional = true; return true; });
        if (!conditional) aliases.push({ name, rhs: write.rhs, global, ...(object ? { object } : {}) });
      }
      walk(loop, (node) => {
        if (node.type.startsWith("preproc")) return false;
        if (node.type !== "field_expression" && node.type !== "subscript_expression") return true;
        const base = field(node, "argument");
        if (!base || base.startPosition.row + 1 > endAccessLine) return true;
        for (const alias of aliases) {
          const local = unwrap(base).type === "identifier" && unwrap(base).text === alias.name;
          const objectAccess = alias.object && unwrap(base).type === "identifier" && unwrap(base).text === alias.object
            && node.type === "field_expression" && field(node, "operator")?.text === ".";
          const direct = shape(base) === shape(alias.rhs) || objectAccess;
          if (!local && !direct) continue;
          if (sites.some((site) => site.start === base.startIndex)) break;
          sites.push({ start: base.startIndex, end: base.endIndex, line: base.startPosition.row + 1,
            local: objectAccess ? `(*${alias.name})` : alias.name,
            global: objectAccess ? alias.object! : `(${alias.global})`, alias: alias.name, current: local ? "local" : "global" });
          break;
        }
        return true;
      });
    }
    return sites.sort((a, b) => a.start - b.start);
  } finally { tree.delete(); }
}
export function hoistVariant(source: string, sites: HoistSite[], mask: bigint): string {
  return applyCSourceEdits(source, sites.map((site, index) => ({ start: site.start, end: site.end,
    text: (mask & (1n << BigInt(index))) === 0n ? site.local : site.global })));
}
/** Deterministic spread over the product; sampled never means exhausted. */
export function hoistMasks(siteCount: number, max: number): { total: bigint; exhaustive: boolean; masks: bigint[] } {
  if (!Number.isSafeInteger(max) || max < 1) throw new Error("max must be a positive safe integer");
  const total = 1n << BigInt(siteCount);
  const count = Number(total < BigInt(max) ? total : BigInt(max));
  const exhaustive = BigInt(count) === total;
  return { total, exhaustive, masks: Array.from({ length: count }, (_, i) => exhaustive ? BigInt(i) : count === 1 ? 0n : BigInt(i) * (total - 1n) / BigInt(count - 1)) };
}
