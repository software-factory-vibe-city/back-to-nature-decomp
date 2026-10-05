import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cachedPreprocess, dependencyPaths } from "./preprocessedCache.js";

test("depfile paths handle continuations, escaped spaces and phony header rules", () => {
  assert.deepEqual(dependencyPaths("x.o: x.c a\\ b.h \\\n c.h\na\\ b.h:\n", "/root"), ["/root/x.c", "/root/a b.h", "/root/c.h"]);
  assert.throws(() => dependencyPaths("not a rule", "/root"));
});
test("real cpp reuse preserves conditional semantics, relevant includes and newly available shadows", (t) => {
  const root = mkdtempSync(join(tmpdir(), "cpp-cache-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["src", "include", "fallback"]) mkdirSync(join(root, dir));
  const source = join(root, "src/f.c"), header = join(root, "fallback/value.h");
  writeFileSync(source, '#include "value.h"\n#if FEATURE\nint f(void) {return VALUE;}\n#else\nint f(void) {return 0;}\n#endif\n');
  writeFileSync(header, "#define VALUE 7\n");
  const flags = ["-Iinclude", "-Ifallback", "-DFEATURE=1", "-undef"];
  const cold = cachedPreprocess(source, root, flags); assert.equal(cold.cache, "miss"); assert.match(cold.text, /return 7/);
  assert.equal(cachedPreprocess(source, root, flags).cache, "hit");
  writeFileSync(join(root, "src/unrelated.c"), "void unused(void) {}\n");
  cachedPreprocess(source, root, flags); /* membership change, but no semantic change */
  writeFileSync(join(root, "src/unrelated.c"), "void unused(void) { }\n");
  assert.equal(cachedPreprocess(source, root, flags).cache, "hit");
  writeFileSync(header, "#define VALUE 9\n"); const changed = cachedPreprocess(source, root, flags);
  assert.equal(changed.cache, "miss"); assert.match(changed.text, /return 9/);
  writeFileSync(join(root, "include/value.h"), "#define VALUE 11\n"); const shadow = cachedPreprocess(source, root, flags);
  assert.equal(shadow.cache, "miss"); assert.match(shadow.text, /return 11/);
  assert.match(cachedPreprocess(source, root, ["-Iinclude", "-DFEATURE=0", "-undef"]).text, /return 0/);
});
test("absent macro includes with nonstandard extensions invalidate when available", (t) => {
  const root = mkdtempSync(join(tmpdir(), "cpp-optional-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src")); mkdirSync(join(root, "include"));
  const source = join(root, "src/f.c"), flags = ["-Iinclude", "-undef"];
  writeFileSync(source, '#define HEADER "optional.fixture"\n#if __has_include(HEADER)\n#include HEADER\n#else\n#define VALUE 0\n#endif\nint f(void) {return VALUE;}\n');
  assert.match(cachedPreprocess(source, root, flags).text, /return 0/); assert.equal(cachedPreprocess(source, root, flags).cache, "hit");
  writeFileSync(join(root, "include/optional.fixture"), "#define VALUE 3\n");
  const changed = cachedPreprocess(source, root, flags); assert.equal(changed.cache, "miss"); assert.match(changed.text, /return 3/);
});
test("forced external includes and interrupted records are safely rediscovered", (t) => {
  const root = mkdtempSync(join(tmpdir(), "cpp-forced-")), other = mkdtempSync(join(tmpdir(), "cpp-external-"));
  t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(other, { recursive: true, force: true }); });
  mkdirSync(join(root, "src")); const source = join(root, "src/f.c"), header = join(other, "forced");
  writeFileSync(source, "int f(void) {return FORCED;}\n"); writeFileSync(header, "#define FORCED 1\n");
  const flags = ["-include", header, "-undef"], a = cachedPreprocess(source, root, flags);
  assert.match(a.text, /return 1/); assert.equal(cachedPreprocess(source, root, flags).cache, "hit");
  writeFileSync(header, "#define FORCED 2\n"); assert.match(cachedPreprocess(source, root, flags).text, /return 2/);
  rmSync(join(root, "build/cache"), { recursive: true }); assert.equal(cachedPreprocess(source, root, flags).cache, "miss");
});
