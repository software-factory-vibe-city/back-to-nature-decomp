import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fileScopeDeclarations } from "./classifyGlobals.js";

test("a tentative definition names the global's type, not only an extern", () => {
  /* The file that owns a global defines it — that is how gp-relative addressing
     is expressed here — and the type appears nowhere else in tracked source. */
  const declared = fileScopeDeclarations([
    "#include \"common.h\"",
    "extern u16 D_80000001;",
    "s16 D_80000002;",
    "void f(void) { D_80000002 = 1; }",
  ].join("\n"));
  assert.equal(declared.get("D_80000001"), "u16");
  assert.equal(declared.get("D_80000002"), "s16");
});

test("declarations inside a function body are not file-scope declarations", () => {
  /* The reason this is parsed rather than matched: a regex sees the same text
     either way, and the generated header is built from the answer. */
  const declared = fileScopeDeclarations([
    "void f(void) {",
    "    s16 D_80000003;",
    "    D_80000003 = 1;",
    "}",
  ].join("\n"));
  assert.equal(declared.has("D_80000003"), false);
});

test("text inside a comment or a disabled block is not a declaration", () => {
  const declared = fileScopeDeclarations([
    "/* s16 D_80000004; */",
    "#if 0",
    "s16 D_80000005;",
    "#endif",
    "s16 D_80000006;",
  ].join("\n"));
  assert.equal(declared.has("D_80000004"), false);
  assert.equal(declared.has("D_80000005"), false);
  assert.equal(declared.get("D_80000006"), "s16");
});

test("pointers and arrays are left to the other inference passes", () => {
  /* They are a different declaration than the scalar the generated header
     emits, so typing them as the scalar they are built from would be wrong. */
  const declared = fileScopeDeclarations([
    "s16 *D_80000007;",
    "s16 D_80000008[4];",
    "s32 D_80000009;",
  ].join("\n"));
  assert.equal(declared.has("D_80000007"), false);
  assert.equal(declared.has("D_80000008"), false);
  assert.equal(declared.get("D_80000009"), "s32");
});
