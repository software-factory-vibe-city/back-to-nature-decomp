/** AST-only, read-only decision-tail grammar. Each execution path tests each
 * original condition at most once and in its original short-circuit order. */
import { children, declaratorName, field, namedChildren, parseC, walk, type Node } from "./residual-source-search/tree-sitter-c.js";
export type DecisionTail = { kind: "return"; value: string } | { kind: "test"; condition: string; yes: DecisionTail; no: DecisionTail; switchValue?: string; switchConstant?: string; switchEqual?: boolean };
export interface ControlShape { id: string; source: string; form: string; }
export interface TailSite { start: number; end: number; line: number; tree: DecisionTail; resultVariable?: string; }
function unwrap(node: Node): Node {
  while (node.type === "parenthesized_expression") { const inner = namedChildren(node)[0]; if (!inner) break; node = inner; }
  return node;
}
function integer(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  node = unwrap(node);
  if (node.type === "number_literal") {
    /* Deliberately bounded integer constants; no floating point, suffix/type
       conversions or implementation-defined large unsigned returns. */
    const raw = node.text;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n <= 0x7fffffff) return raw;
  }
  if (node.type === "unary_expression" && field(node, "operator")?.text === "-") {
    const child = integer(field(node, "argument")); if (child && Number(child) <= 0x7fffffff) return `-${child}`;
  }
  return undefined;
}
function pure(node: Node): boolean {
  let allowed = true;
  walk(node, item => {
    if (["call_expression", "assignment_expression", "update_expression", "comma_expression", "statement_expression", "ERROR"].includes(item.type) || item.isMissing || item.type.startsWith("preproc")) allowed = false;
    return allowed;
  });
  return allowed;
}
function test(condition: Node, yes: DecisionTail, no: DecisionTail): DecisionTail {
  const node = unwrap(condition), op = field(node, "operator")?.text;
  const left = field(node, "left"), right = field(node, "right");
  if (node.type === "binary_expression" && left && right) {
    if (op === "&&") return test(left, test(right, yes, no), no);
    if (op === "||") return test(left, yes, test(right, yes, no));
  }
  if (node.type === "unary_expression" && op === "!") return test(field(node, "argument")!, no, yes);
  const constant = integer(right);
  return { kind: "test", condition: node.text, yes, no,
    ...(node.type === "binary_expression" && left && constant !== undefined && ["==", "!="].includes(op!)
      ? { switchValue: left.text, switchConstant: constant, switchEqual: op === "==" } : {}) };
}
function statements(node: Node): Node[] {
  if (node.type === "else_clause") return statements(namedChildren(node).find(n => n.type !== "comment")!);
  return node.type === "compound_statement" ? namedChildren(node).filter(n => n.type !== "comment") : [node];
}
function sequence(nodes: Node[], fallback: DecisionTail | undefined, result?: string): DecisionTail | undefined {
  let next = fallback;
  for (const node of [...nodes].reverse()) {
    if (node.type === "return_statement") {
      const value = integer(namedChildren(node)[0]); if (value === undefined) return undefined;
      next = { kind: "return", value };
    } else if (node.type === "expression_statement" && result) {
      const assignment = namedChildren(node)[0];
      if (assignment?.type !== "assignment_expression" || field(assignment, "operator")?.text !== "=" || field(assignment, "left")?.text !== result) return undefined;
      const value = integer(field(assignment, "right")); if (value === undefined || !next) return undefined;
      const fill = (tail: DecisionTail): DecisionTail => tail.kind === "return"
        ? tail.value === result ? { kind: "return", value } : tail
        : { ...tail, yes: fill(tail.yes), no: fill(tail.no) };
      next = fill(next);
    } else if (node.type === "if_statement") {
      const condition = field(node, "condition"), arm = field(node, "consequence"), alternative = field(node, "alternative");
      if (!condition || !arm || !pure(condition)) return undefined;
      /* Direct-return forms remove the result assignments. A later condition
         reading that local would no longer observe the same value. */
      let readsResult = false;
      if (result) walk(condition, n => { if (n.type === "identifier" && n.text === result) readsResult = true; return true; });
      if (readsResult) return undefined;
      const yes = sequence(statements(arm), next, result);
      const no = alternative ? sequence(statements(alternative), next, result) : next;
      if (!yes || !no) return undefined;
      next = test(condition, yes, no);
    } else return undefined;
  }
  return next;
}
function checkTree(node: Node): void {
  /* Anonymous missing tokens (including #endif) matter to source surgery. */
  if (node.isMissing || node.type === "ERROR") throw new Error("source contains a parse error or missing token");
  for (const child of children(node)) checkTree(child);
}
export function decisionTailSite(source: string, functionName: string): TailSite {
  const parsed = parseC(source);
  try {
    checkTree(parsed.rootNode);
    const functions: Node[] = [];
    walk(parsed.rootNode, node => {
      if (node.type === "function_definition" && declaratorName(field(node, "declarator"))?.text === functionName) functions.push(node);
      return node.type !== "function_definition";
    });
    if (functions.length !== 1) throw new Error("need exactly one raw function definition");
    const fn = functions[0]!, body = field(fn, "body")!;
    if (fn.startPosition.row !== fn.endPosition.row && namedChildren(body).some(n => n.type.startsWith("preproc"))) throw new Error("conditional preprocessing inside the body is unsupported");
    /* Conditions may read memory, but no unknown macro can hide a write/call.
       Raw macro identifiers in expressions are rejected; cpp token parity is
       additionally checked by the sweep before measuring the grammar. */
    const nodes = namedChildren(body).filter(n => n.type !== "comment"), last = nodes.at(-1);
    if (!last || !["return_statement", "if_statement"].includes(last.type)) throw new Error("no constant/result-valued return tail");
    const terminalIf = last.type === "if_statement";
    const expr = terminalIf ? undefined : namedChildren(last)[0]; let result: string | undefined;
    let fallback: DecisionTail | undefined;
    if (terminalIf) { /* Both arms must terminate without a fallback. */ }
    else if (integer(expr) !== undefined) fallback = { kind: "return", value: integer(expr)! };
    else if (expr?.type === "identifier") {
      result = expr.text;
      const declarations = nodes.filter(n => n.type === "declaration");
      const declaration = declarations.find(n => namedChildren(n).some(child => declaratorName(child)?.text === result));
      if (!declaration || namedChildren(declaration).some(n => n.type === "pointer_declarator" || n.type === "array_declarator" || n.type === "type_qualifier" || n.type === "storage_class_specifier") || !["int", "s32", "u32"].includes(field(declaration, "type")?.text ?? "")) throw new Error("result must be an unescaped local integer scalar");
      let escaped = false;
      walk(body, n => { if (["unary_expression", "pointer_expression"].includes(n.type) && field(n, "operator")?.text === "&" && field(n, "argument")?.text === result) escaped = true; return true; });
      if (escaped) throw new Error("result variable's address escapes");
      fallback = { kind: "return", value: result };
    } else throw new Error("return is not a supported integer constant or result variable");
    let winner: TailSite | undefined;
    for (let start = nodes.length - (terminalIf ? 1 : 2); start >= 0; start--) {
      const tail = sequence(terminalIf ? nodes.slice(start) : nodes.slice(start, -1), fallback, result);
      if (!tail) break;
      const resolved = (t: DecisionTail): boolean => t.kind === "return" ? t.value !== result : resolved(t.yes) && resolved(t.no);
      if (tail.kind === "test" && resolved(tail)) winner = { start: nodes[start]!.startIndex, end: last.endIndex, line: nodes[start]!.startPosition.row + 1, tree: tail, ...(result ? { resultVariable: result } : {}) };
    }
    if (!winner) throw new Error("no side-effect-free decision suffix");
    return winner;
  } finally { parsed.delete(); }
}
function flip(condition: string): string { return `!(${condition})`; }
function leaf(value: string, variable?: string): string { return variable ? `${variable} = ${value};` : `return ${value};`; }
function full(tree: DecisionTail, invert = false, variable?: string, depth = 0): string {
  if (depth > 16) throw new Error("decision tail exceeds the 16-level construction bound");
  if (tree.kind === "return") return leaf(tree.value, variable);
  return `if (${invert ? flip(tree.condition) : tree.condition}) {\n${full(invert ? tree.no : tree.yes, invert, variable, depth + 1)}\n} else {\n${full(invert ? tree.yes : tree.no, invert, variable, depth + 1)}\n}`;
}
interface Spine { tests: string[]; fallback: string; success: string; }
function spines(tree: DecisionTail): Spine[] {
  const leaves = new Set<string>();
  function visit(t: DecisionTail) { if (t.kind === "return") leaves.add(t.value); else { visit(t.yes); visit(t.no); } }
  visit(tree); if (leaves.size !== 2) return [];
  return [...leaves].flatMap(fallback => {
    const tests: string[] = []; let cursor = tree;
    while (cursor.kind === "test") {
      if (cursor.no.kind === "return" && cursor.no.value === fallback) { tests.push(cursor.condition); cursor = cursor.yes; }
      else if (cursor.yes.kind === "return" && cursor.yes.value === fallback) { tests.push(flip(cursor.condition)); cursor = cursor.no; }
      else return [];
    }
    return cursor.value !== fallback ? [{ tests, fallback, success: cursor.value }] : [];
  });
}
function nested(spine: Spine, mask: bigint, level = 0): string {
  if (level === spine.tests.length) return `return ${spine.success};`;
  return `if (${spine.tests[level]}) {\n${nested(spine, mask, level + 1)}\n}` + ((mask & (1n << BigInt(level))) !== 0n ? ` else {\nreturn ${spine.fallback};\n}` : "");
}
export function controlShapes(source: string, functionName: string, max = 64): { site: TailSite; variants: ControlShape[]; total: number; exhaustive: boolean } {
  if (!Number.isSafeInteger(max) || max < 1 || max > 4096) throw new Error("max must be 1..4096");
  const site = decisionTailSite(source, functionName), candidates: Array<{ form: string; tail: string }> = [];
  const add = (form: string, tail: string) => candidates.push({ form, tail });
  for (const spine of spines(site.tree)) {
    if (spine.tests.length > 10) throw new Error("duplicate-arm grammar exceeds 10 levels");
    add("early-returns", `${spine.tests.map(c => `if (${flip(c)}) { return ${spine.fallback}; }`).join("\n")}\nreturn ${spine.success};`);
    add("early-returns-inverted", `${spine.tests.map(c => `if (${c}) { } else { return ${spine.fallback}; }`).join("\n")}\nreturn ${spine.success};`);
    add("and", `if (${spine.tests.map(c => `(${c})`).join(" && ")}) { return ${spine.success}; }\nreturn ${spine.fallback};`);
    add("or-inverted", `if (${spine.tests.map(c => `(${flip(c)})`).join(" || ")}) { return ${spine.fallback}; }\nreturn ${spine.success};`);
    for (let mask = 0n; mask < (1n << BigInt(spine.tests.length)); mask++) add(`nested-duplicate-${mask}`, `${nested(spine, mask)}\nreturn ${spine.fallback};`);
  }
  add("full-nested", full(site.tree)); add("full-nested-inverted", full(site.tree, true));
  /* A nested block keeps declarations C89 and makes the fresh result invisible
     to the prefix. int conversions are safe under the admitted constant bound. */
  let variable = "control_shape_result";
  while (source.includes(variable)) variable += "_";
  add("result-variable", `{\nint ${variable};\n${full(site.tree, false, variable)}\nreturn ${variable};\n}`);
  add("result-variable-inverted", `{\nint ${variable};\n${full(site.tree, true, variable)}\nreturn ${variable};\n}`);
  if (site.tree.kind === "test" && site.tree.switchValue && site.tree.switchConstant !== undefined) {
    const t = site.tree;
    add("switch-first-test", `switch (${t.switchValue}) {\ncase ${t.switchConstant}:\n${full(t.switchEqual ? t.yes : t.no)}\nbreak;\ndefault:\n${full(t.switchEqual ? t.no : t.yes)}\nbreak;\n}`);
  }
  const seen = new Set<string>();
  const variants = candidates.flatMap(({ form, tail }) => {
    const text = source.slice(0, site.start) + tail + source.slice(site.end);
    if (seen.has(text)) return []; seen.add(text);
    return [{ id: `v${String(seen.size).padStart(3, "0")}`, source: text, form }];
  });
  return { site, variants: variants.slice(0, max), total: variants.length, exhaustive: variants.length <= max };
}
