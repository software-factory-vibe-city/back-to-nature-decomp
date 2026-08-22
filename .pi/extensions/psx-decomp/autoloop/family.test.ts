import { strict as assert } from "node:assert";
import { test } from "node:test";
import { implicatedByPark } from "./family.ts";

test("parking a function implicates its suspected translation unit", () => {
  /* Read from the project's own grouping ledger, so this test also fails if the
     ledger's member-bullet convention changes under the parser. */
  const implicated = implicatedByPark(process.cwd(), "ovl_10_func_800BB264");
  assert.ok(implicated.includes("ovl_10_func_800BADA4"), "the grid-display twin is implicated");
  assert.ok(implicated.includes("ovl_10_func_800BA394"), "the parked member of the same cluster is implicated");
  assert.equal(implicated.includes("ovl_10_func_800BB264"), false, "a function does not implicate itself");
});

test("prose bullets in a members list are not read as function names", () => {
  /* `notes/file-groupings.md` mixes prose bullets into its member lists — a
     "shared cluster idiom" line, for instance. Taking their first word as a
     symbol would defer functions that do not exist. */
  const implicated = implicatedByPark(process.cwd(), "ovl_10_func_800BB264");
  for (const name of implicated) {
    assert.match(name, /^(func|ovl_\d+_func|[A-Z]\w*)/, `${name} does not look like a symbol`);
  }
  assert.equal(implicated.includes("shared"), false);
});

test("a function in no recorded group implicates nothing", () => {
  assert.deepEqual(implicatedByPark(process.cwd(), "func_does_not_exist_anywhere"), []);
});
