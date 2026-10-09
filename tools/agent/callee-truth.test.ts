import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "./decompToolchain.js";
import {
  callResultUsed,
  callArgumentCounts,
  adjudicateCallee,
  parameterWitnesses,
  callSiteWrites,
  targetWitness,
  targetReadEvidence,
  renderTruthReport,
  contradictionsAgainst,
  prototypesIn,
  scopeFromPreprocessed,
  type Prototype,
  type Witness,
} from "./calleeTruth.js";

import type { DisassembledInstruction } from "./decompToolchain.js";
import { decodeFunction } from "./matching-reconstruction/decode.js";
import { assemble } from "./matching-reconstruction/fixture-asm.js";

const projectTest = existsSync(join(ROOT, "configs/splat")) ? test : test.skip;

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

const TWO_READS: Witness = { kind: "target", where: "f (target code)", callee: "f", reads: [0, 1], arity: { min: 2, max: 4 } };
const THREE_DEF: Witness = { kind: "definition", where: "callee.c", prototype: only("int f(int a, int b, int phantom) { return a + b; }", "f") };

test("two agreeing reconstructions cannot corroborate a passed unread parameter", () => {
  const declared = only("int f(int, int, int);", "f");
  const item = adjudicateCallee("f", declared, [THREE_DEF, TWO_READS], "void caller(void) { f(1, 2, 3); }");
  assert.equal(item.status, "unread-argument");
  assert.equal(item.unreadArguments[0]!.material, true);
  assert.equal(item.parameters[2]!.status, "unread");
  assert.match(item.unreadArguments[0]!.message, /writes \$a2.*never reads/);
  assert.match(renderTruthReport({ function: "caller", source: "caller.c", callees: [item], indirectCalls: 0 }), /read set \[0, 1\]/);
});

test("an unavailable or implicitly forwarded read set is not corroborated by a reconstruction", () => {
  const p = only("int f(int, int, int);", "f");
  const item = adjudicateCallee("f", p, [THREE_DEF, { ...TWO_READS, readsComplete: false }], "void c(void) { f(1, 2, 3); }");
  assert.equal(item.status, "unwitnessed");
  assert.equal(item.parameters[2]!.status, "undetermined");
  const variadic = only("int f(int, ...);", "f");
  assert.equal(adjudicateCallee("f", variadic, [{ kind: "sdk", where: "sdk.h", prototype: variadic }], "void c(void) { f(1, 2, 3); }").status, "corroborated");
});

test("a corrected definition gives the same material finding for the old caller", () => {
  const definition = { ...THREE_DEF, prototype: only("int f(int a, int b) { return a + b; }", "f") };
  assert.equal(adjudicateCallee("f", only("int f(int, int, int);", "f"), [definition, TWO_READS], "void c(void) { f(1, 2, 3); }").status, "unread-argument");
});

test("a two-argument caller is corroborated with hygiene on the longer definition", () => {
  const item = adjudicateCallee("f", only("int f(int, int);", "f"), [THREE_DEF, TWO_READS], "void c(void) { f(1, 2); }");
  assert.equal(item.status, "corroborated");
  assert.equal(item.unreadArguments.length, 0);
  assert.ok(item.hygiene.some((note) => note.includes("parameter 2")));
});

test("later reads witness interior holes; SDK and unknown layouts retain their own authority", () => {
  assert.deepEqual(parameterWitnesses(only("int f(int, int, int);", "f"), [{ ...TWO_READS, reads: [2] }]).map((p) => p.status), ["witnessed", "witnessed", "witnessed"]);
  assert.deepEqual(parameterWitnesses(DECLARED, [SDK, TWO_READS]).map((p) => p.status), ["witnessed", "witnessed", "unread"]);
  assert.equal(parameterWitnesses(only("int f(UnknownRecord r, int x);", "f"), [TWO_READS])[1]!.status, "undetermined");
  assert.equal(parameterWitnesses(only("int f(int);", "f"), [THREE_DEF])[0]!.status, "undetermined");
  assert.equal(adjudicateCallee("f", only("int f(int, ...);", "f"), [TWO_READS], "void c(void) { f(1, 2); }").unreadArguments.length, 0);
});

test("wide parameters are ABI slots, not scalar parameter counts", () => {
  const item = adjudicateCallee("f", only("int f(int, double, int);", "f"), [{ ...TWO_READS, reads: [0, 2, 3] }], "void c(void) { f(1, 2.0, 3); }");
  assert.equal(item.parameters[2]!.slot, 4);
  assert.match(item.unreadArguments[0]!.message, /stack slot sp\+0x10/);
});

test("actual call counts come from AST, including multiple calls but not comments or strings", () => {
  assert.deepEqual(callArgumentCounts('void c(void) { /* f(1,2,3); */ char *s="f(1)"; f(1,2); f(1,2,3); }', "f"), [2, 3]);
});

test("same-block call-site census includes delay slots and is not reaching-definition proof", () => {
  const insns = decodeFunction(assemble([
    ["addu", "a2", "a0", "zero"], ["beq", "a0", "zero", "next"], ["nop"],
    ["jal", 0x80020000], ["nop"], ["label", "next"], ["jal", 0x80020000], ["addu", "a2", "a1", "zero"],
    ["jr", "ra"], ["nop"],
  ], 0x80010000));
  assert.deepEqual(callSiteWrites(insns, 0x80020000, 2), [false, true]);
});

test("frameless stack reads and implicit argument forwarding cannot become false unread findings", () => {
  const code = (lines: string[]): DisassembledInstruction[] => lines.map((raw, i) => {
    const [mnemonic, rest = ""] = raw.split(/\s+(.*)/);
    return { address: i * 4, mnemonic: mnemonic!, operands: rest.split(",").map((s) => s.trim()).filter(Boolean), operandText: rest, raw };
  });
  const leaf = targetReadEvidence(code(["lw v0, 16(sp)", "jr ra", "nop"]));
  assert.deepEqual(leaf.reads, [4]);
  const forwarding = targetReadEvidence(code(["addiu sp, sp, -24", "jal callee", "move a1, zero", "jr ra", "addiu sp, sp, 24"]));
  assert.ok(forwarding.undeterminedReads!.includes(0));
  assert.ok(!forwarding.undeterminedReads!.includes(1), "delay-slot overwrite happens before the call");
  const resolved = targetReadEvidence(code(["addiu sp, sp, -24", "jal callee", "move a1, zero", "jr ra", "addiu sp, sp, 24"]),
    () => ({ reads: [0], unknown: [] }));
  assert.deepEqual(resolved.reads, [0]);
  assert.deepEqual(resolved.undeterminedReads, []);
  assert.equal(parameterWitnesses(only("int f(int, int);", "f"), [{ kind: "target", where: "original", ...resolved }])[1]!.status, "unread");
  const local = code(["j 8 <f+8>", "nop", "jr ra", "nop"]);
  local[0]!.relocation = { type: "R_MIPS_26", symbol: ".text" };
  assert.equal(targetReadEvidence(local).readsComplete, true, "a local jump relocation does not escape the function");
  const witnesses = [{ kind: "target" as const, where: "original", ...forwarding }];
  assert.equal(adjudicateCallee("f", only("int f(int, int);", "f"), witnesses, "void c(void) { f(1, 2); }").unreadArguments.length, 0);
  const fragment = { kind: "target" as const, where: "fragment", ...targetReadEvidence(code(["j callee", "nop"])) };
  assert.equal(parameterWitnesses(only("int f(int);", "f"), [fragment])[0]!.status, "undetermined");
});

projectTest("original callee exposes its reads, irrespective of its definition's arity", () => {
  const scratch = join(ROOT, "build/calleeReadSetTest");
  try {
    assert.deepEqual(targetWitness("ovl_11_func_800F5888", scratch)?.reads, [0, 1]);
    assert.deepEqual(targetWitness("func_8001719C", scratch)?.reads, [0], "implicit forwarding reads the incoming a0");
    assert.ok(targetWitness("func_8001526C", scratch)?.reads?.includes(5), "frameless leaf stack reads are still parameters");
  }
  finally { rmSync(scratch, { recursive: true, force: true }); }
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

/* ---- the witness is the same answer no matter what else is running -------- */

/**
 * `targetWitness` assembles the callee's own code into a scratch directory, and
 * that directory is shared: a census runs several worker processes over one of
 * them. When two workers reach the same callee, they used to write the same
 * `<callee>.target.s` and `<callee>.target.o` — one assembling a file the other
 * was mid-write — and the witness came back with a different arity, or with
 * nothing at all. A signature that depends on what else happened to be running
 * makes every measurement taken under it unreproducible, which is exactly how
 * one census winner failed to reproduce on a later retry.
 *
 * The processes are real ones because the defect is a file-system race; two
 * calls inside one process could never have exposed it.
 */
projectTest("concurrent processes witness the same callee identically", () => {
  const scratch = join(ROOT, "build/witnessDeterminism");
  rmSync(scratch, { recursive: true, force: true });
  const probe = join(scratch, "probe.ts");
  mkdirSync(scratch, { recursive: true });
  writeFileSync(probe, [
    `import { targetWitness } from ${JSON.stringify(join(ROOT, "tools/agent/calleeTruth.ts"))};`,
    `const scratch = ${JSON.stringify(join(scratch, "shared"))};`,
    "const seen = new Set();",
    "for (let attempt = 0; attempt < 20; attempt++) {",
    "  const witness = targetWitness(process.argv[2], scratch);",
    "  seen.add(JSON.stringify(witness?.arity ?? null));",
    "}",
    "process.stdout.write([...seen].join(\"\\u0000\"));",
    "",
  ].join("\n"));

  const runs = [0, 1, 2, 3].map(() =>
    spawnSync("npx", ["tsx", probe, "SquareRoot0"], { cwd: ROOT, encoding: "utf-8" }));
  const answers = new Set<string>();
  for (const run of runs) {
    assert.equal(run.status, 0, run.stderr);
    for (const answer of run.stdout.split("\u0000")) answers.add(answer);
  }
  assert.deepEqual([...answers].sort(), [JSON.stringify({ min: 1, max: 4 })],
    "four processes, twenty witnesses each, and exactly one answer between them");
});
