import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ROOT } from "./decompToolchain.js";
import {
  callResultUsed,
  contradictionsAgainst,
  prototypesIn,
  scopeFromPreprocessed,
  type Prototype,
  type Witness,
} from "./calleeTruth.js";

function only(source: string, name: string): Prototype {
  const found = prototypesIn(source, "t.c").find((item) => item.name === name);
  assert.ok(found, `no prototype for ${name} in:\n${source}`);
  return found;
}

test("an empty parameter list declares nothing, and (void) declares zero", () => {
  assert.equal(only("void f();", "f").parameters, null);
  assert.equal(only("void f(void);", "f").parameters, 0);
  assert.equal(only("void f(int a, int b);", "f").parameters, 2);
});

test("a variadic list bounds only its fixed parameters", () => {
  const printf = only("int printf(const char *fmt, ...);", "printf");
  assert.equal(printf.variadic, true);
  assert.equal(printf.parameters, 1);
});

test("a definition is distinguished from a declaration of the same function", () => {
  assert.equal(only("void f(int a);", "f").kind, "declaration");
  assert.equal(only("void f(int a) { a++; }", "f").kind, "definition");
});

test("a pointer return type is not read as void", () => {
  const g = only("void *g(int a);", "g");
  assert.equal(g.returnsVoid, false);
  assert.equal(only("void g(int a);", "g").returnsVoid, true);
});

const SDK: Witness = {
  kind: "sdk",
  where: "include/psyq/libsnd.h",
  prototype: {
    name: "SsVabOpenHead",
    signature: "short SsVabOpenHead(unsigned char *, short);",
    parameters: 2,
    variadic: false,
    returnsVoid: false,
    kind: "declaration",
    where: "include/psyq/libsnd.h",
    line: 186,
  },
};

const DECLARED: Prototype = {
  name: "SsVabOpenHead",
  signature: "s32 SsVabOpenHead(s32, s32, s32);",
  parameters: 3,
  variadic: false,
  returnsVoid: false,
  kind: "declaration",
  where: "src/f.c",
  line: 26,
};

test("a vendored header settles an arity disagreement outright", () => {
  const found = contradictionsAgainst(DECLARED, SDK, false);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.proven, true);
  assert.match(found[0]!.message, /declares 2/);
});

test("another reconstruction does not settle an arity disagreement", () => {
  const definition: Witness = {
    ...SDK,
    kind: "definition",
    where: "src/g.c",
    prototype: { ...SDK.prototype!, kind: "definition", where: "src/g.c" },
  };
  const found = contradictionsAgainst(DECLARED, definition, false);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.proven, false);
  assert.match(found[0]!.message, /either reconstruction could be the wrong one/);
});

test("an unread trailing parameter is never refutable from the machine code", () => {
  /* The callee reads two incoming arguments; a five-parameter declaration is
   * unusual but nothing in the disassembly contradicts it. */
  const target: Witness = { kind: "target", where: "f (target code)", callee: "f", arity: { min: 2, max: 4 } };
  assert.deepEqual(contradictionsAgainst({ ...DECLARED, parameters: 5 }, target, false), []);
});

test("a declaration shorter than what the callee reads is refuted", () => {
  const target: Witness = { kind: "target", where: "f (target code)", callee: "f", arity: { min: 3, max: 4 } };
  const found = contradictionsAgainst({ ...DECLARED, parameters: 2 }, target, false);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.proven, true);
  assert.match(found[0]!.message, /at least 3/);
});

test("a wrong return type is proven only where the result is consumed", () => {
  const target: Witness = {
    kind: "target",
    where: "f (target code)",
    callee: "f",
    returns: { type: "void", basis: "proven" },
  };
  const discarded = contradictionsAgainst(DECLARED, target, false);
  assert.equal(discarded.length, 1);
  assert.equal(discarded[0]!.proven, false);
  assert.match(discarded[0]!.message, /same either way/);

  const consumed = contradictionsAgainst(DECLARED, target, true);
  assert.equal(consumed[0]!.proven, true);
  assert.match(consumed[0]!.message, /\$v0 the target never sets/);
});

test("caller-derived voidness never refutes a declaration", () => {
  /* A void function may leave junk in $v0 and every caller may discard a real
   * return value, so neither direction is decidable from the callers alone. */
  const target: Witness = {
    kind: "target",
    where: "f (target code)",
    callee: "f",
    returns: { type: "void", basis: "callers" },
  };
  assert.deepEqual(contradictionsAgainst(DECLARED, target, true), []);
});

test("a discarded call is told apart from a consumed one", () => {
  assert.equal(callResultUsed("void g(void) { f(1); }", "f"), false);
  assert.equal(callResultUsed("void g(void) { x = f(1); }", "f"), true);
  assert.equal(callResultUsed("void g(void) { int y = f(1); }", "f"), true);
  assert.equal(callResultUsed("void g(void) { if (f(1)) return; }", "f"), true);
  assert.equal(callResultUsed("void g(void) { h(f(1)); }", "f"), true);
});

test("a declaration in preprocessed text is traced back to the header it came from", () => {
  const preprocessed = [
    '# 1 "src/f.c"',
    'void local(void);',
    `# 186 "${ROOT}/include/psyq/libsnd.h" 1`,
    'extern short SsVabOpenHead(unsigned char *, short);',
    '# 3 "src/f.c" 2',
    'void after(void);',
  ].join("\n");

  const { source, lineOf } = scopeFromPreprocessed(preprocessed);
  /* The markers are blanked rather than removed, so rows still line up. */
  assert.equal(source.split("\n").length, 6);
  const found = prototypesIn(source, "src/f.c", lineOf);
  const sdk = found.find((item) => item.name === "SsVabOpenHead");
  assert.ok(sdk);
  assert.equal(sdk.where, "include/psyq/libsnd.h");
  assert.equal(sdk.line, 186);
  assert.equal(found.find((item) => item.name === "after")?.line, 3);
});

test("a header outside the repository keeps its absolute path", () => {
  const { source, lineOf } = scopeFromPreprocessed([
    '# 9 "/opt/toolchain/stdio.h" 1',
    "int puts(const char *);",
  ].join("\n"));
  assert.equal(prototypesIn(source, "src/f.c", lineOf)[0]!.where, "/opt/toolchain/stdio.h");
});
