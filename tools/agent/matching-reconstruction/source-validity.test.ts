/**
 * A zero exit status is not acceptance.
 *
 * GCC 2.95 diagnoses a C89 constraint violation — a `return` with a value in a
 * function declared `void`, an argument converted between a pointer and an
 * integer without a cast — and then compiles the program anyway. The generated
 * words are the same either way, so a candidate that violates the constraint
 * reaches the byte oracle, matches, and is filed as recovered source. The
 * oracle compares machine output and cannot see a source defect; the only
 * place that can is the stream the compile helper used to discard.
 *
 * These tests hold both halves of the fix: the classifier that tells a
 * constraint violation from a remark, and the constructors that no longer
 * produce either one — a mixed-return function takes the valued type rather
 * than a `void` signature it then returns values from, and an argument crossing
 * the pointer boundary carries the cast that makes it legal.
 */

import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { ROOT, classifyDiagnostics, compileSource, rejectionFromDiagnostics } from "../decompToolchain.js";
import { reconstructFunction } from "./engine.js";

const configured = existsSync(join(ROOT, "configs/splat"));
const projectTest = configured ? test : test.skip;

/* ---- the classifier -------------------------------------------------------- */

test("a constraint violation is rejecting and a remark is advisory", () => {
  const stderr = [
    "x.c: In function `f':",
    "x.c:3: warning: `return' with a value, in function returning void",
    "x.c:4: warning: comparison is always true due to limited range of data type",
  ].join("\n");
  const classified = classifyDiagnostics(stderr);
  assert.equal(classified.length, 2, "the file-and-function heading is not a diagnostic");
  assert.equal(classified[0]!.severity, "rejecting");
  assert.equal(classified[1]!.severity, "advisory", "valid code the compiler remarks on stays a candidate");
});

test("the rejection names the first violation and counts the rest", () => {
  const stderr = [
    "x.c:3: warning: passing arg 1 of `g' makes pointer from integer without a cast",
    "x.c:5: warning: passing arg 2 of `g' makes integer from pointer without a cast",
  ].join("\n");
  const rejection = rejectionFromDiagnostics(stderr);
  assert.match(rejection!, /makes pointer from integer/);
  assert.match(rejection!, /\+1 more/);
});

test("silence, and advice alone, are not rejections", () => {
  assert.equal(rejectionFromDiagnostics(""), null);
  assert.equal(rejectionFromDiagnostics("x.c:1: warning: decimal constant is so large that it is unsigned"), null);
});

/* ---- the compiler actually says it ----------------------------------------- */

projectTest("the compile helper keeps what the front end said while succeeding", () => {
  const directory = join(ROOT, "build/sourceValidity");
  const source = join(directory, "voidReturn.c");
  writeFixture(source, [
    "void probe(void);",
    "void probe(void) {",
    "    return 1;",
    "}",
    "",
  ]);
  const compiled = compileSource(source, directory, "probe", { containerKind: "exe" });
  assert.match(compiled.diagnostics, /in function returning void/,
    "the diagnostic exists; discarding it is what made a zero exit status look like acceptance");
  assert.ok(rejectionFromDiagnostics(compiled.diagnostics), "and the gate reads it as a rejection");
});

projectTest("a clean unit produces no rejection", () => {
  const directory = join(ROOT, "build/sourceValidity");
  const source = join(directory, "clean.c");
  writeFixture(source, [
    "int probe(int value);",
    "int probe(int value) {",
    "    return value + 1;",
    "}",
    "",
  ]);
  const compiled = compileSource(source, directory, "probe", { containerKind: "exe" });
  assert.equal(rejectionFromDiagnostics(compiled.diagnostics), null, compiled.diagnostics);
});

/* ---- the constructors no longer produce one -------------------------------- */

projectTest("no candidate returns a value from a function it declares void", () => {
  /* A DAG with both valued and value-less leaves used to take the `void`
   * signature while its valued leaves still emitted `return expr;`. The
   * value-less leaf falls off the end instead, which is what its path does. */
  const result = reconstructFunction({ functionName: "ovl_11_func_8011F5BC", notify: () => {} });
  const sources = result.candidates
    .map((candidate) => readFileSync(candidate.sourcePath, "utf-8"))
    .filter((source) => /\bvoid ovl_11_func_8011F5BC\(/.test(source));
  for (const source of sources) {
    const body = source.slice(source.indexOf("void ovl_11_func_8011F5BC("));
    assert.ok(!/\breturn\s+[^;\s]/.test(body), "a void signature over a valued return is not valid C89");
  }
});

projectTest("no candidate is accepted while the front end is diagnosing it", () => {
  const result = reconstructFunction({ functionName: "ovl_11_func_800C6E0C", notify: () => {} });
  assert.ok(result.compiles > 0, `expected compiling candidates; ${result.unresolved?.detail}`);
  for (const candidate of result.candidates) {
    assert.ok(!/invalid C accepted by the front end/.test(candidate.compileError ?? ""),
      `${candidate.id}: ${candidate.compileError}`);
  }
});

function writeFixture(path: string, lines: string[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, lines.join("\n"));
}
