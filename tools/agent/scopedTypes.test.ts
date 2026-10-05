import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { filesUnder, scopedTypeCatalog } from "./scopedTypes.js";

test("per-file type caching preserves conflicts, forwards, conditionals and private identities", (t) => {
  const root = mkdtempSync(join(tmpdir(), "scoped-type-cache-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "include")); mkdirSync(join(root, "src"));
  writeFileSync(join(root, "include/a.h"), "typedef int Public; struct Forward;\n#if __GNUC__ == 2\ntypedef short Conditional;\n#else\ntypedef int Conditional;\n#endif\n");
  writeFileSync(join(root, "include/b.h"), "typedef short Clash;\n"); writeFileSync(join(root, "include/c.h"), "typedef int Clash;\n");
  for (const name of ["one", "two"]) writeFileSync(join(root, `src/${name}.c`), `#include "a.h"\ntypedef struct { int value; } Private;\nvoid ${name}(Private *p) {p->value = 1;}\n`);
  writeFileSync(join(root, "include/functions.h"), "typedef int NotAnIndependentWitness;\n");
  const cold = scopedTypeCatalog(root);
  assert.equal(cold.defs.get("Conditional"), "typedef short Conditional;");
  assert.equal(cold.defs.has("Clash"), false); assert.ok(cold.conflicts.some((c) => c.name === "Clash"));
  assert.equal(cold.defs.has("NotAnIndependentWitness"), false);
  assert.notEqual(cold.byFunction.get("one")!.get("Private"), cold.byFunction.get("two")!.get("Private"));
  const paths = filesUnder(join(root, "build/cache/scoped-types"), ".json"), times = paths.map((p) => statSync(p).mtimeMs);
  assert.deepEqual(scopedTypeCatalog(root), cold); assert.deepEqual(paths.map((p) => statSync(p).mtimeMs), times);
  writeFileSync(join(root, "include/a.h"), "typedef unsigned int Public;\n");
  const changed = scopedTypeCatalog(root); assert.equal(changed.defs.get("Public"), "typedef unsigned int Public;");
  assert.equal(changed.defs.has("Conditional"), false);
});
