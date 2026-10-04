import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emptyDeclarationIndex, indexDeclarations, projectDeclarations, globalViews } from "./declarationContext.js";
import { scopedTypeCatalog, projectScopedSignatures } from "./scopedTypes.js";
import { extractPrototypesFromSource, renderSdkTypesHeader } from "./sdkTypes.js";
import { resolveContextTypes } from "./contextExport.js";
import { prototypesIn, sdkPrototypes } from "./calleeTruth.js";

const model = (source: string) => { const m = emptyDeclarationIndex(); indexDeclarations(m, source, "header.h", "public", "public-header"); return m; };
test("qualifiers, callback/array parameters, return pointers and variadics survive", () => {
  const source = "typedef unsigned long Word; const volatile Word *f(const Word *p, void (*cb)(int), Word grid[4], ...); void unspecified(); void zero(void);";
  const m = model(source); const p = projectDeclarations(m, ["f", "unspecified", "zero"], "public");
  assert.deepEqual(p.unknown, []);
  const signatures = extractPrototypesFromSource(p.text);
  assert.match(signatures.find((x) => x.name === "f")!.signature, /^const volatile Word \*f\(const Word \*p, void \(\*cb\)\(int\), Word grid\[4\], \.\.\.\);$/);
  assert.equal(signatures.find((x) => x.name === "unspecified")!.signature, "void unspecified();");
  const oracle = prototypesIn(source, "header.h").find((x) => x.name === "f")!;
  assert.equal(oracle.returnType, "const volatile Word *"); assert.equal(oracle.variadic, true);
  assert.deepEqual(oracle.paramTypes, ["const Word *", "void (*)(int)", "Word [4]"]);
});
test("functions returning callbacks remain functions, not silently omitted pointer variables", () => {
  const source = "void (*CdDataCallback(void (*func)()))(); extern void (*callbackVariable)(int);";
  const declarations = extractPrototypesFromSource(source);
  assert.deepEqual(declarations.map((d) => d.name), ["CdDataCallback"]);
  assert.match(declarations[0]!.signature, /^void \(\*CdDataCallback\(void \(\*func\)\(\)\)\)\(\);$/);
  const truth = prototypesIn(source, "sdk.h")[0]!;
  assert.equal(truth.returnsVoid, false); assert.equal(truth.parameters, 1);
  assert.match(truth.returnType!, /\*/);
  assert.equal(sdkPrototypes().get("CdDataCallback")!.returnsVoid, false);
});
test("recursive tagged types render with legal forwards and no invented layout", () => {
  const m = model("typedef struct A { struct B *b; } A; typedef struct B { A *a; } B; extern A records[8];");
  const p = projectDeclarations(m, ["records"], "public");
  assert.deepEqual(p.unknown, []); assert.match(p.text, /struct A;/); assert.match(p.text, /struct B;/);
  assert.ok(p.text.indexOf("typedef struct A A;") < p.text.indexOf("struct A {"));
  assert.match(p.text, /extern A records\[8\];/);
});
test("conflicting public definitions expose both origins instead of precedence", () => {
  const m = model("typedef struct { int x; } View;");
  indexDeclarations(m, "typedef struct { short y; } View;", "other.h", "public", "public-header");
  assert.deepEqual(projectDeclarations(m, ["View"], "public").unknown, ["View"]);
  assert.deepEqual(m.conflicts[0]!.origins, ["header.h", "other.h"]);
});
test("ownership and extern declarations remain separate from scope-local definitions", () => {
  const m = model("extern int D_80000000;");
  indexDeclarations(m, "int D_80000000;", "owner.c", "owner.c", "source-local");
  assert.equal(projectDeclarations(m, ["D_80000000"], "public").selected[0]!.ownership, "extern");
  assert.equal(projectDeclarations(m, ["D_80000000"], "owner.c").selected[0]!.ownership, "definition");
});
test("aliased backing arrays, pointer-to-array views and byte-biased views retain geometry", () => {
  const result = globalViews(`extern unsigned char raw[128] asm("D_80000000");
#define D_80000000 raw
#define D_80000004 (*((unsigned short (*)[4])raw))
#define D_80000010 (*((Record *)((unsigned char *)&raw + 16)))
#define D_80000020 (*((Record *)(raw + 32)))
#define D_80000030 compute(raw)
`, "overrides.h");
  assert.equal(result.views.length, 4);
  assert.match(result.views[0]!.declaration, /unsigned char D_80000000\[128\]/);
  assert.match(result.views[1]!.declaration, /unsigned short D_80000004\[4\]/);
  assert.equal(result.views[2]!.baseOffset, 16); assert.equal(result.views[2]!.backing, "raw");
  assert.equal(result.views[3]!.baseOffset, 32, "the backing byte array witnesses its stride");
  assert.equal(result.unsupported.length, 1);
});
test("private recursive tags remain scoped through context export", (t) => {
  const root = mkdtempSync(join(tmpdir(), "scoped-tags-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "include")); mkdirSync(join(root, "src/overlays/o"), { recursive: true });
  writeFileSync(join(root, "src/a.c"), "typedef struct Node { struct Node *next; int x; } Local; void a(Local *p) {}\n");
  writeFileSync(join(root, "src/overlays/o/b.c"), "typedef struct Node { struct Node *next; short y; } Local; void b(Local *p) {}\n");
  const signatures = new Map([["a", "void a(Local *p);"], ["b", "void b(Local *p);"]]);
  const result = resolveContextTypes(root, signatures);
  assert.deepEqual(result.resolution.unresolved, []);
  const header = renderSdkTypesHeader(result.resolution, result.defs);
  assert.match(header, /int x/); assert.match(header, /short y/);
  assert.doesNotMatch(header, /struct Node\b/);
  assert.equal(new Set(header.match(/struct M2C_\w+_Node;/g)).size, 2);
});
test("nested overlay local names are distinct and target preprocessing selects effective definitions", (t) => {
  const root = mkdtempSync(join(tmpdir(), "scoped-context-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "include")); mkdirSync(join(root, "src/overlays/ovl_1"), { recursive: true });
  writeFileSync(join(root, "include/shared.h"), "#define COUNT 7\ntypedef struct { int slots[COUNT]; } Shared;\n");
  writeFileSync(join(root, "src/a.c"), '#include "shared.h"\ntypedef struct { Shared *s; } Local;\nvoid a(Local *p) {}\n');
  writeFileSync(join(root, "src/overlays/ovl_1/b.c"), "#if 0\ntypedef int Local;\n#else\ntypedef struct { short field; } Local;\n#endif\nvoid b(Local *p) {}\n");
  const c = scopedTypeCatalog(root);
  const sigs = new Map([["a", "void a(Local *p);"], ["b", "void b(Local *p);"]]); projectScopedSignatures(sigs, c);
  assert.notEqual(c.byFunction.get("a")!.get("Local"), c.byFunction.get("b")!.get("Local"));
  assert.match(c.defs.get("Shared")!, /slots\[7\]/);
  assert.match(c.defs.get(c.byFunction.get("b")!.get("Local")!)!, /short field/);
  assert.match(sigs.get("a")!, /M2C_\w+_Local/);
});
