import assert from "node:assert/strict";
import test from "node:test";
import { filterNewChanges, splitTargets } from "./workspace.ts";

test("filterNewChanges separates pre-existing dirt from new changes", () => {
  const changed = ["src/a.c", ".pi/extensions/psx-decomp/index.ts", "include/functions.h", "tools/vendor/x/README.md"];
  const baseline = new Set([".pi/extensions/psx-decomp/index.ts", "tools/vendor/x/README.md"]);
  const { newFiles, preExisting } = filterNewChanges(changed, baseline);
  assert.deepEqual(newFiles, ["src/a.c", "include/functions.h"]);
  assert.deepEqual(preExisting, [".pi/extensions/psx-decomp/index.ts", "tools/vendor/x/README.md"]);
});

test("filterNewChanges with an empty baseline keeps strict behavior", () => {
  const changed = [".gitignore", "src/a.c"];
  const { newFiles, preExisting } = filterNewChanges(changed, []);
  assert.deepEqual(newFiles, changed);
  assert.deepEqual(preExisting, []);
});

test("filterNewChanges accepts any iterable and preserves order", () => {
  const { newFiles, preExisting } = filterNewChanges(["b.c", "a.c"], ["a.c"]);
  assert.deepEqual(newFiles, ["b.c"]);
  assert.deepEqual(preExisting, ["a.c"]);
});

test("a workspace splits the executable plus whatever the run can reach", () => {
  /* The executable is always split — every overlay links against its symbol
     export — and an unpinned run needs every container, because a project-wide
     refinement may touch any of them. Splitting only the executable leaves an
     overlay with no assembly to include and a link that fails on a symbol the
     workspace never saw. */
  assert.deepEqual(splitTargets(null), ["split-all"]);
  assert.deepEqual(splitTargets(["ovl_31"]), ["split", "split-ovl_31"]);
  assert.deepEqual(splitTargets(["exe"]), ["split"]);
  assert.deepEqual(splitTargets(["exe", "ovl_11", "ovl_30"]), ["split", "split-ovl_11", "split-ovl_30"]);
});
