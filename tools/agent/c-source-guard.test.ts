import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCSource } from "./cSourceGuard.ts";

const STUB = '#include "common.h"\n#include "include_asm.h"\n\nINCLUDE_ASM("build/asm/nonmatchings/func_X", func_X);\n';

test("an INCLUDE_ASM placeholder is read off the call expression", () => {
  const report = analyzeCSource(STUB);
  assert.equal(report.parses, true);
  assert.equal(report.embeddable, true);
  assert.deepEqual(report.includeAsm, [{ folder: "build/asm/nonmatchings/func_X", symbol: "func_X" }]);
});

test("INCLUDE_ASM named in a comment or a string is not a declaration", () => {
  const report = analyzeCSource('/* INCLUDE_ASM("a", func_X); */\nconst char *s = "INCLUDE_ASM(\\"a\\", func_X);";\n');
  assert.deepEqual(report.includeAsm, []);
});

test("clean C is embeddable", () => {
  const report = analyzeCSource("int f(int a) {\n    return a + 1;\n}\n");
  assert.equal(report.embeddable, true);
  assert.deepEqual(report.reasons, []);
});

test("a dangling #endif is refused — it would close the wrapper early", () => {
  const report = analyzeCSource("#endif\nint live(void) { return 0; }\n");
  assert.equal(report.parses, true);
  assert.equal(report.embeddable, false);
  assert.match(report.reasons.join("\n"), /dangling #endif/);
});

test("a dangling #else is refused for the same reason", () => {
  const report = analyzeCSource("#else\nint live(void) { return 0; }\n");
  assert.equal(report.embeddable, false);
  assert.match(report.reasons.join("\n"), /dangling #else/);
});

test("an unterminated #if is refused — it would swallow the wrapper's #endif", () => {
  const report = analyzeCSource("#if 1\nint g(void) { return 0; }\n");
  assert.equal(report.parses, false);
  assert.equal(report.embeddable, false);
  assert.match(report.reasons.join("\n"), /unterminated conditional/);
});

test("an unterminated #ifdef is refused", () => {
  const report = analyzeCSource("#ifdef FOO\nint g(void);\n");
  assert.equal(report.embeddable, false);
  assert.match(report.reasons.join("\n"), /unterminated conditional/);
});

test("a balanced conditional is fine", () => {
  const report = analyzeCSource("#if 1\nint g(void) { return 0; }\n#endif\n");
  assert.equal(report.parses, true);
  assert.equal(report.embeddable, true);
});

test("an unterminated string literal is refused", () => {
  const report = analyzeCSource('const char *s = "oops;\nint h(void) { return 0; }\n');
  assert.equal(report.embeddable, false);
  assert.match(report.reasons.join("\n"), /not terminated on its own line|missing token/);
});

test("an unterminated block comment is refused", () => {
  const report = analyzeCSource("int f(void) { return 0; } /* oops\n");
  assert.equal(report.parses, false);
  assert.equal(report.embeddable, false);
});

test("a real decompiled translation unit parses and is embeddable", () => {
  const report = analyzeCSource(
    '#include "common.h"\n#include "psyq/libgte.h"\n\ns32 func_X(s32 a, s32 b) {\n    s32 v;\n\n    v = a & 0xFF;\n    if (v < b) {\n        return 0;\n    }\n    return v;\n}\n',
  );
  assert.equal(report.parses, true);
  assert.equal(report.embeddable, true);
});
