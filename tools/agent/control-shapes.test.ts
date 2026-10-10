import { strict as assert } from "node:assert";
import { test } from "node:test";
import { controlShapes, decisionTailSite } from "./control-shapes.js";
import { field, namedChildren, parseC, type Node } from "./residual-source-search/tree-sitter-c.js";

/* Tiny AST interpreter for the admitted grammar, NOT a C source rewriter.
   It records reads to check evaluation count/order as well as return values. */
function execute(source: string, input: Record<string, number>) {
  const tree = parseC(source), reads: string[] = [], locals = new Map<string, number>();
  function expression(n: Node): number {
    if (n.type === "parenthesized_expression") return expression(namedChildren(n)[0]!);
    if (n.type === "number_literal") return Number(n.text);
    if (n.type === "identifier") { if (locals.has(n.text)) return locals.get(n.text)!; reads.push(n.text); return input[n.text]!; }
    if (n.type === "unary_expression" && field(n, "operator")?.text === "!") return Number(!expression(field(n, "argument")!));
    if (n.type === "binary_expression") {
      const a = expression(field(n, "left")!), op = field(n, "operator")!.text;
      if (op === "&&") return a ? Number(!!expression(field(n, "right")!)) : 0;
      if (op === "||") return a ? 1 : Number(!!expression(field(n, "right")!));
      const b = expression(field(n, "right")!);
      if (op === "==") return Number(a === b);
      if (op === "!=") return Number(a !== b);
    }
    throw new Error(`unsupported expression ${n.type}: ${n.text}`);
  }
  function statement(n: Node): number | undefined {
    if (n.type === "compound_statement") { for (const child of namedChildren(n)) { const result = statement(child); if (result !== undefined) return result; } return; }
    if (n.type === "else_clause") return statement(namedChildren(n)[0]!);
    if (n.type === "declaration") return;
    if (n.type === "return_statement") return expression(namedChildren(n)[0]!);
    if (n.type === "expression_statement") {
      const a = namedChildren(n)[0]!; locals.set(field(a, "left")!.text, expression(field(a, "right")!)); return;
    }
    if (n.type === "if_statement") {
      const arm = field(n, expression(field(n, "condition")!) ? "consequence" : "alternative");
      return arm ? statement(arm) : undefined;
    }
    if (n.type === "switch_statement") {
      const v = expression(field(n, "condition")!), cases = namedChildren(field(n, "body")!);
      const chosen = cases.find(c => field(c, "value") && expression(field(c, "value")!) === v) ?? cases.find(c => !field(c, "value"));
      assert.ok(chosen);
      for (const child of namedChildren(chosen).filter(c => c.startIndex !== field(chosen, "value")?.startIndex)) {
        if (child.type === "break_statement") break;
        const result = statement(child); if (result !== undefined) return result;
      }
      return;
    }
    throw new Error(`unsupported statement ${n.type}`);
  }
  try {
    const fn = namedChildren(tree.rootNode).find(n => n.type === "function_definition")!;
    return { value: statement(field(fn, "body")!), reads };
  } finally { tree.delete(); }
}

test("all shapes preserve the Boolean table, single reads, and short-circuit order", () => {
  for (const source of [
    "int f(int a,int b) { if (a == 6 && b != 0) { return 1; } return 0; }",
    "int f(int a,int b) { if (a != 6 || b) { return 0; } return 1; }",
    "int f(int a,int b) { if (a == 6) { if (b) return 1; else return 2; } else { return 0; } }",
    "int f(int a,int b,int c) { if (a) { if (b) { return 1; } else { return 2; } } else { if (c) { return 3; } } return 0; }",
    "int f(int a,int b) { int r; r = 0; if (a == 6) { if (b) { r = 1; } } return r; }",
  ]) {
    const shapes = controlShapes(source, "f");
    assert.ok(shapes.variants.some(v => v.form === "result-variable-inverted"));
    for (const a of [0, 6, 9]) for (const b of [0, 1]) for (const c of [0, 1]) {
      const expected = execute(source, { a, b, c });
      for (const variant of shapes.variants) assert.deepEqual(execute(variant.source, { a, b, c }), expected, variant.form);
    }
  }
});
test("maximal suffix leaves the effectful prefix intact, duplicate arms include the outer level", () => {
  const source = "int f(int a,int b) { int x; x = 3; if (a) { if (b) return 1; } return 0; }";
  const grammar = controlShapes(source, "f");
  assert.ok(grammar.variants.every(v => v.source.startsWith(source.slice(0, grammar.site.start))));
  assert.ok(grammar.variants.some(v => v.form === "nested-duplicate-1" && /else \{\nreturn 0;\n\}\nreturn 0;/.test(v.source)));
  assert.equal(controlShapes(source, "f", 2).exhaustive, false);
  assert.equal(controlShapes(source, "f", 2).variants.length, 2);
  assert.throws(() => controlShapes(source, "f", 0), /max must/);
});
test("effects, preprocessor damage, escaped/narrow/static result locals and result-dependent tests are refused", () => {
  for (const source of [
    "int f(int a) { if (g(a)) return 1; return 0; }",
    "int f(int a) { if (a++) return 1; return 0; }",
    "int f(int a) { if ((a=2)) return 1; return 0; }",
    "int f(int a) { if ((a,2)) return 1; return 0; }",
    "int f(int a) { if (a) { g(); return 1; } return 0; }",
    "int f(int a) { if (a) return 1; return 0; ",
    "int f(int a) {\n#if 1\nif (a) return 1;\n#endif\nreturn 0; }",
    "int f(int a) { volatile int r; r=0; if (a) r=1; return r; }",
    "int f(int a) { static int r; r=0; if (a) r=1; return r; }",
    "int f(int a) { short r; r=0; if (a) r=1; return r; }",
    "int f(int a) { int r; g(&r); r=0; if (a) r=1; return r; }",
    "int f(int a) { int r; r=0; if (r) r=1; return r; }",
  ]) assert.throws(() => decisionTailSite(source, "f"), Error, source);
});
