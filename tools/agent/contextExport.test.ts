import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectTypedefs,
  extractPrototypesFromSource,
  extractSignaturesFromSource,
  harvestTypedefs,
  renderSdkTypesHeader,
  resolveTypes,
  typeNamesIn,
} from "./sdkTypes.js";
import { parseContextExportArgs, verifyContextParses, writeContext } from "./contextExport.js";

const REPO = new URL("../..", import.meta.url).pathname;

/* A minimal function body. Fixtures are written inline rather than read from
 * build/asm, which is gitignored — a fixture pointing there passes locally and
 * fails on a clean checkout. */
const PROBE_ASM = [
  ".set noat",
  ".set noreorder",
  "",
  "glabel test_fn",
  "    /* 0000 80000000 0800E003 */  jr         $ra",
  "    /* 0004 80000004 00000000 */   nop",
  "",
].join("\n");

function scratchRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ctxexport-"));
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "include/psyq"), { recursive: true });
  return root;
}

/** A scratch root wired up well enough to run the real m2c against. */
function probeRoot(): string {
  const root = scratchRoot();
  /* m2c.py is invoked relative to the root, so the real tools/ tree has to be
   * reachable from it. */
  symlinkSync(join(REPO, "tools"), join(root, "tools"));
  const asmDir = join(root, "build/asm/nonmatchings/test_fn");
  mkdirSync(asmDir, { recursive: true });
  writeFileSync(join(asmDir, "test_fn.s"), PROBE_ASM);
  return root;
}

/* ------------------------------------------------------------------ */
/* Harvest                                                             */
/* ------------------------------------------------------------------ */

test("collectTypedefs registers the declared name, not the type it aliases", () => {
  const defs = new Map<string, string>();
  collectTypedefs("typedef u_short DECDCTTAB[34816];", defs);

  assert.ok(defs.has("DECDCTTAB"), "the declared name must be registered");
  assert.ok(
    !defs.has("u_short"),
    "the aliased type must not be registered — doing so maps u_short onto an " +
    "unrelated definition and emits it twice, which is itself a parse error",
  );
});

test("collectTypedefs captures a nested struct intact", () => {
  /* The regex this replaced was non-nesting (`[^}]*`) and truncated at the
   * first inner brace, silently emitting a broken definition. */
  const source = [
    "typedef struct {",
    "    struct { short a, b; } inner;",
    "    union { int i; float f; } either;",
    "    short trailing;",
    "} Nested;",
  ].join("\n");
  const defs = new Map<string, string>();
  collectTypedefs(source, defs);

  const def = defs.get("Nested");
  assert.ok(def, "a nested type must still be extracted");
  assert.ok(def!.includes("trailing"), "the definition must not be truncated at the inner brace");
  assert.ok(def!.trimEnd().endsWith("} Nested;"), "the definition must be captured whole");
});

test("harvestTypedefs never re-ingests the generated context headers", () => {
  /* Harvesting our own output lets a placeholder emitted once shadow the real
   * definition forever, with no visible symptom. */
  const root = scratchRoot();
  writeFileSync(
    join(root, "include/functions.h"),
    "typedef struct { unsigned long pad[4]; } POLY_FT4;\n",
  );
  writeFileSync(
    join(root, "include/sdk_types.h"),
    "typedef struct { unsigned long pad[9]; } SPRT;\n",
  );
  writeFileSync(
    join(root, "include/psyq/libgpu.h"),
    "typedef struct { unsigned long tag; short x0, y0; } POLY_FT4;\ntypedef struct { unsigned long tag; short x; } SPRT;\n",
  );

  const defs = harvestTypedefs(root);
  assert.ok(!defs.get("POLY_FT4")!.includes("pad[4]"), "the stub in functions.h must not win");
  assert.ok(!defs.get("SPRT")!.includes("pad[9]"), "the stub in sdk_types.h must not win");
  assert.ok(defs.get("POLY_FT4")!.includes("x0"), "the real SDK definition must be the one harvested");
});

test("project definitions win name collisions against the SDK", () => {
  const root = scratchRoot();
  writeFileSync(join(root, "src/a.c"), "typedef struct { short project_field; } Shared;\n");
  writeFileSync(join(root, "include/psyq/libgpu.h"), "typedef struct { short sdk_field; } Shared;\n");

  assert.ok(harvestTypedefs(root).get("Shared")!.includes("project_field"));
});

/* ------------------------------------------------------------------ */
/* Signature extraction                                                */
/* ------------------------------------------------------------------ */

test("a function pointer parameter does not swallow the signature", () => {
  /* The regex matched parameters with `[^)]*`, so the inner `)` of a function
   * pointer ended the list early and the definition failed to match at all —
   * publishing nothing for the entire file, silently. */
  const sigs = extractSignaturesFromSource("void f(void (*cb)(int), s32 n) {\n}\n");
  assert.deepEqual(sigs.map((s) => s.signature), ["void f(void (*cb)(int), s32 n);"]);
});

test("a comment containing a paren does not swallow the signature", () => {
  const sigs = extractSignaturesFromSource("void g(s32 a /* count ) here */, s32 b) {\n}\n");
  assert.deepEqual(sigs.map((s) => s.signature), ["void g(s32 a, s32 b);"]);
});

test("a multi-line parameter list is normalized to one line", () => {
  const sigs = extractSignaturesFromSource("TILE *h(TILE *p,\n    u_long *ot,\n    s16 x) {\n}\n");
  assert.deepEqual(sigs.map((s) => s.signature), ["TILE * h(TILE *p, u_long *ot, s16 x);"]);
});

test("a body the grammar rejects still yields its signature", () => {
  /* `register s32 x asm("$16")` is a GCC extension the grammar flags as an
   * error. The signature is fully determined by the declaration, so a body
   * that fails to parse must not discard it. */
  const sigs = extractSignaturesFromSource('void p(void) {\n register s32 x asm("$16") = 1;\n}\n');
  assert.deepEqual(sigs.map((s) => s.signature), ["void p(void);"]);
});

test("an empty parameter list is published as (void)", () => {
  assert.equal(extractSignaturesFromSource("void m() {\n}\n")[0].signature, "void m(void);");
});

test("what the emitter writes, the reader can read back", () => {
  /* An emitter more capable than its reader drops the signatures only it can
   * produce, on the next incremental export. */
  const source = [
    "void with_fnptr(void (*cb)(int), s32 n) {\n}\n",
    "TILE *with_pointer(TILE *p, u_long *ot) {\n}\n",
    "void plain(void) {\n}\n",
    "void with_array(s32 grid[4]) {\n}\n",
  ].join("");

  const emitted = extractSignaturesFromSource(source);
  assert.equal(emitted.length, 4);

  const readBack = extractPrototypesFromSource(emitted.map((s) => s.signature).join("\n"));
  assert.deepEqual(
    readBack.map((s) => s.signature),
    emitted.map((s) => s.signature),
    "every emitted prototype must survive a round trip",
  );
});

test("reading prototypes does not pick up definitions", () => {
  const found = extractPrototypesFromSource("void declared(s32 a);\nvoid defined(s32 b) {\n}\n");
  assert.deepEqual(found.map((s) => s.name), ["declared"]);
});

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

test("typeNamesIn reads type positions, not parameter names", () => {
  const names = typeNamesIn("s32 func_8001C1C0(SVECTOR *arg0);");
  assert.ok(names.has("SVECTOR"));
  assert.ok(!names.has("arg0"), "a parameter name is not a type");
  assert.ok(!names.has("func_8001C1C0"), "the function name is not a type");
});

test("resolveTypes emits dependencies before their dependents", () => {
  const defs = new Map([
    ["Outer", "typedef struct { Inner slot; } Outer;"],
    ["Inner", "typedef struct { short v; } Inner;"],
  ]);
  const { ordered, unresolved } = resolveTypes(["Outer"], defs);

  assert.deepEqual(unresolved, []);
  assert.ok(ordered.indexOf("Inner") < ordered.indexOf("Outer"), "Inner must be defined first");
});

test("resolveTypes does not treat a substring name as a dependency", () => {
  /* `body.includes(candidate)` made TILE a dependency of TILE_1 purely by
   * name, which drags in unrelated definitions and can invent a cycle. */
  const defs = new Map([
    ["TILE_1", "typedef struct { unsigned long tag; } TILE_1;"],
    ["TILE", "typedef struct { unsigned long tag; } TILE;"],
  ]);
  const { ordered } = resolveTypes(["TILE_1"], defs);

  assert.deepEqual(ordered, ["TILE_1"], "TILE must not be pulled in by name overlap alone");
});

test("an undefined type is reported and backed by a placeholder", () => {
  const { ordered, unresolved } = resolveTypes(["NoSuchType"], new Map());
  assert.deepEqual(ordered, []);
  assert.deepEqual(unresolved, ["NoSuchType"]);

  const header = renderSdkTypesHeader({ ordered, unresolved }, new Map());
  assert.match(header, /typedef struct \{ unsigned long pad\[1\]; \} NoSuchType;/);
});

/* ------------------------------------------------------------------ */
/* Fidelity against the real SDK                                       */
/* ------------------------------------------------------------------ */

test("SDK types resolve to their real layouts, not opaque stubs", () => {
  const defs = harvestTypedefs(REPO);

  /* The stub was `{ unsigned short x; unsigned short y; }` — 4 bytes and
   * unsigned, against libgpu.h's 8-byte signed rectangle. Any m2c output that
   * offsets a RECT under the stub was wrong. */
  const rect = defs.get("RECT");
  assert.ok(rect, "RECT must resolve");
  assert.ok(!rect!.includes("pad["), "RECT must not be an opaque stub");
  assert.match(rect!, /short\s+x,\s*y;/);
  assert.match(rect!, /short\s+w,\s*h;/);

  for (const name of ["TILE_1", "POLY_FT4", "SPRT", "DR_MODE", "LINE_F2", "SVECTOR"]) {
    const def = defs.get(name);
    assert.ok(def, `${name} must resolve from the SDK headers`);
    assert.ok(!def!.includes("pad["), `${name} must resolve to its real layout, not a stub`);
  }
});

test("every type the published signatures name is resolvable", () => {
  /* This is the invariant whose violation broke m2c project-wide, twice. */
  const defs = harvestTypedefs(REPO);
  const header = readFileSync(join(REPO, "include/functions.h"), "utf-8");

  const referenced = new Set<string>();
  for (const line of header.split("\n")) {
    if (!/\bfunc_[0-9A-Fa-f]+\s*\(/.test(line)) continue;
    for (const name of typeNamesIn(line)) referenced.add(name);
  }
  assert.ok(referenced.size > 0, "the fixture must actually reference types");

  const { unresolved } = resolveTypes(referenced, defs);
  assert.deepEqual(unresolved, [], "an unresolved type here means a placeholder shipped");
});

/* ------------------------------------------------------------------ */
/* Self-verification gate                                              */
/* ------------------------------------------------------------------ */

test("the gate accepts a context that parses", () => {
  const root = probeRoot();
  writeFileSync(join(root, "include/sdk_types.h"), "typedef signed int s32;\n");
  writeFileSync(join(root, "include/functions.h"), "s32 some_fn(s32 arg0);\n");

  const result = verifyContextParses(root);
  assert.equal(result.skipped, undefined, "the probe root must be verifiable");
  assert.equal(result.ok, true, result.diagnostic);
});

test("the gate rejects a signature naming an undefined type", () => {
  const root = probeRoot();
  writeFileSync(join(root, "include/sdk_types.h"), "typedef signed int s32;\n");
  writeFileSync(join(root, "include/functions.h"), "s32 some_fn(NoSuchType *arg0);\n");

  const result = verifyContextParses(root);
  assert.equal(result.ok, false, "an undefined type must fail the gate");
  assert.match(result.diagnostic ?? "", /parsing C context/);
});

test("the gate verifies the pair in consumer order, not each file alone", () => {
  /* sdk_types.h parses in isolation whether or not functions.h does, so a
   * per-file check passes on exactly the configuration that is broken. */
  const root = probeRoot();
  writeFileSync(join(root, "include/sdk_types.h"), "typedef signed int s32;\n");
  writeFileSync(join(root, "include/functions.h"), "s32 some_fn(Widget *arg0);\n");
  assert.equal(verifyContextParses(root).ok, false);

  writeFileSync(join(root, "include/sdk_types.h"), "typedef signed int s32;\ntypedef struct { short v; } Widget;\n");
  assert.equal(verifyContextParses(root).ok, true, "defining the type in the earlier file fixes it");
});

test("the gate skips rather than fails when there is nothing to verify against", () => {
  /* build/ is gitignored, so a clean checkout has no .s to probe with. That
   * must not be reported as a broken context. */
  const result = verifyContextParses(scratchRoot());
  assert.equal(result.ok, true);
  assert.ok(result.skipped, "the skip must be reported, not silently passed");
});

test("a context that fails the gate is never left in place", () => {
  const root = probeRoot();
  const sdkPath = join(root, "include/sdk_types.h");
  const funcsPath = join(root, "include/functions.h");
  const goodSdk = "typedef signed int s32;\n";
  const goodFuncs = "s32 previously_good(s32 arg0);\n";
  writeFileSync(sdkPath, goodSdk);
  writeFileSync(funcsPath, goodFuncs);

  /* Malformed C that the backstop cannot rescue: the defect is the syntax of
   * the signature itself, not an undefined type. */
  const signatures = new Map([["bad_fn", "void bad_fn(int 3x);"]]);
  assert.throws(
    () => writeContext(root, signatures),
    /does not parse/,
    "the generator must not report success having written an unparseable context",
  );

  assert.equal(readFileSync(funcsPath, "utf-8"), goodFuncs, "the previous signatures must be restored");
  assert.equal(readFileSync(sdkPath, "utf-8"), goodSdk, "the previous types must be restored");
});

test("a context written where none existed is removed when it fails the gate", () => {
  const root = probeRoot();
  const sdkPath = join(root, "include/sdk_types.h");
  const funcsPath = join(root, "include/functions.h");

  assert.throws(() => writeContext(root, new Map([["bad_fn", "void bad_fn(int 3x);"]])), /does not parse/);

  assert.ok(!existsSync(sdkPath), "no stale types may be left behind");
  assert.ok(!existsSync(funcsPath), "no stale signatures may be left behind");
});

test("the function name survives an argument list with no --container", () => {
  /* Regression: `indexOf` returns -1 for an absent flag, and -1 + 1 named
     argument 0 as the flag's consumed value — so `contextExport.ts <name>`
     found no function name and printed the usage. */
  assert.deepEqual(parseContextExportArgs(["ovl_11_func_800BCF20"]), {
    dryRun: false,
    all: false,
    funcName: "ovl_11_func_800BCF20",
  });
  assert.deepEqual(parseContextExportArgs(["func_80011C24", "--dry-run"]), {
    dryRun: true,
    all: false,
    funcName: "func_80011C24",
  });
});

test("--container consumes exactly its own value", () => {
  assert.deepEqual(parseContextExportArgs(["--container", "ovl_11", "--all"]), {
    dryRun: false,
    all: true,
    containerId: "ovl_11",
  });
  assert.deepEqual(parseContextExportArgs(["--container", "ovl_11", "ovl_11_func_800BCF20"]), {
    dryRun: false,
    all: false,
    containerId: "ovl_11",
    funcName: "ovl_11_func_800BCF20",
  });
});
