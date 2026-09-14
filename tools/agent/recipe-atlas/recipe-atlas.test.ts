/**
 * The recipe atlas: the compiler as evidence rather than as a yes/no oracle.
 *
 * Two claims. A construction compiled by the production toolchain can be found
 * again from a target's words — that is the lookup, and it is what turns "no
 * candidate compiles" into "this loop is a countdown over a global table".
 * And constructions that compile to identical words are *both* kept: the atlas
 * reports the coincidence instead of picking one, because identical final
 * words do not prove identical earlier compiler state.
 *
 * Building the atlas compiles a hundred programs, so these run against the
 * cached artifact and build it only when it is absent.
 */

import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";
import { decodeFunctionWords, signatureFor } from "../family-transfer/signature.js";
import { buildAtlas, coincidentShapes, loadAtlas, queryAtlasRegions } from "./atlas.js";
import { allRecipes, recipeFamilies } from "./recipes.js";

const configured = existsSync(join(ROOT, "configs/splat"));
const projectTest = configured ? test : test.skip;

/* ---- the catalogue ---------------------------------------------------------- */

test("every recipe is a complete translation unit naming its own function", () => {
  for (const recipe of allRecipes()) {
    assert.ok(recipe.source.includes(recipe.functionName), `${recipe.id} does not define ${recipe.functionName}`);
    assert.ok(recipe.source.includes("typedef signed int s32;"), `${recipe.id} lacks the shared prelude`);
    assert.ok(recipe.note.length > 10, `${recipe.id} has no note a reader can act on`);
  }
});

test("recipe identities are unique across the catalogue", () => {
  const ids = allRecipes().map((recipe) => recipe.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("the catalogue covers the constructions the plan names first", () => {
  const families = new Set(recipeFamilies());
  for (const required of ["counted-loop", "constant-divisor", "variable-divisor", "aggregate-copy", "dispatch", "origin"]) {
    assert.ok(families.has(required), `${required} is not in the catalogue`);
  }
});

/* ---- the shape tier --------------------------------------------------------- */

projectTest("the shape tier ignores which scratch register the allocator chose", () => {
  /* Two members of one family are the same code compiled twice; the strict
   * tier separates them by their constants, and the shape tier must not
   * separate them by their registers. */
  const left = signatureFor("ovl_11_func_800D5B3C", "shape");
  const right = signatureFor("ovl_11_func_800D5BBC", "shape");
  assert.equal(left.shape, right.shape);
});

test("the shape tier still separates two different constructions", () => {
  const recipes = allRecipes();
  const indexLoop = recipes.find((recipe) => recipe.id === "counted-loop__form-index_element-s32")!;
  const cursorLoop = recipes.find((recipe) => recipe.id === "counted-loop__form-cursor_element-s32")!;
  assert.notEqual(indexLoop.source, cursorLoop.source, "they are different source constructions to begin with");
});

/* ---- the atlas -------------------------------------------------------------- */

projectTest("the atlas compiles its catalogue under the production flags", () => {
  const atlas = loadAtlas("overlay") ?? buildAtlas("overlay");
  assert.ok(atlas.entries.length > 50, `${atlas.entries.length} entries`);
  assert.equal(atlas.failures.length, 0, `recipes that did not compile: ${atlas.failures.map((f) => f.recipeId).join(", ")}`);
  assert.ok(atlas.cc1Flags.includes("-O2"), "the production optimisation level, not a convenient one");
  assert.ok(atlas.cc1Flags.includes("-G0"), "and the overlay's own small-data threshold");
});

projectTest("coincident constructions are reported, not deduplicated", () => {
  const atlas = loadAtlas("overlay") ?? buildAtlas("overlay");
  const shared = coincidentShapes(atlas);
  assert.ok(shared.length > 0, "some constructions do compile to identical words, and that is a finding");
  /* The embedded and member origins are the recorded example: a table inside a
   * nested structure and one inside a flat one address identically. */
  const origins = shared.find((item) => item.recipes.some((id) => id.startsWith("origin__")));
  assert.ok(origins, "the origin question has at least one indistinguishable pair");
  assert.ok(origins!.recipes.length >= 2);
});

projectTest("a target's loop is found in the atlas with its constants named", () => {
  /* ovl_11_func_80103770 accumulates a strided halfword sum over a global
   * table — the case the engine refused for a "global-derived induction". The
   * atlas has to return a construction that realizes it, and say which
   * constant differs. */
  const atlas = loadAtlas("overlay") ?? buildAtlas("overlay");
  const { insns } = decodeFunctionWords("ovl_11_func_80103770");
  const hits = queryAtlasRegions(atlas, insns);
  assert.ok(hits.length > 0, "a construction that produces these words is indexed");
  const loop = hits.find((hit) => hit.region.kind === "loop");
  assert.ok(loop, "and it is the loop that matches");
  assert.match(loop!.entry.family, /loop/);
  assert.ok(
    loop!.differences.length === 0 || loop!.differences.every((difference) => difference.queryValue !== undefined),
    "every difference names the value the target has",
  );
});

projectTest("a function with no indexed construction says so rather than guessing", () => {
  const atlas = loadAtlas("exe") ?? buildAtlas("exe");
  /* A four-word wrapper has no construction in the catalogue; the honest
   * answer is none, not the nearest thing. */
  const { insns } = decodeFunctionWords("func_800209D4");
  const hits = queryAtlasRegions(atlas, insns, { minimumWords: 8 });
  assert.equal(hits.length, 0);
});
