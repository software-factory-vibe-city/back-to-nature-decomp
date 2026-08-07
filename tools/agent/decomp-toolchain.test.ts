import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseImplicitDeclarationWarnings } from "./decompToolchain.js";

test("extracts each undeclared callee once from cc1 -Wimplicit stderr", () => {
  const stderr = [
    "probe.c: In function `func_80022738':",
    "probe.c:4: warning: implicit declaration of function `SetVal8005E2BC'",
    "probe.c:5: warning: implicit declaration of function `SetVal8005E334'",
    "probe.c:7: warning: implicit declaration of function `SetVal8005E334'",
  ].join("\n");
  assert.deepEqual(parseImplicitDeclarationWarnings(stderr), [
    "SetVal8005E2BC",
    "SetVal8005E334",
  ]);
});

test("ignores other -Wimplicit forms and unrelated diagnostics", () => {
  const stderr = [
    "probe.c:3: warning: type defaults to `int' in declaration of `x'",
    "probe.c:9: warning: unused variable `p'",
    "",
  ].join("\n");
  assert.deepEqual(parseImplicitDeclarationWarnings(stderr), []);
});

test("empty stderr means every callee is declared", () => {
  assert.deepEqual(parseImplicitDeclarationWarnings(""), []);
});
