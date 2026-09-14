/**
 * recipeAtlas.ts — compiled evidence about what this toolchain emits, and a
 * lookup from a target's machine words back to source that produces them.
 *
 * The compiler has been used only to reject guesses: write a candidate,
 * compile it, compare. That is a one-bit channel. Compiling deliberately
 * chosen programs and indexing their output turns the same compiler into
 * training data — ask "what source produces words shaped like this?" and get
 * back a construction that is known to, under this project's own flags.
 *
 * Indexed by the same shape signature the family tools use on target
 * functions, so a target's shape and a recipe's shape are the same kind of
 * thing and a query is one lookup. A hit is a *hypothesis*: it says the
 * construction produces that shape under these flags, never that the original
 * was written that way. Only the byte oracle promotes anything.
 *
 * Coincident shapes — several recipes compiling to identical words — are kept
 * and reported rather than deduplicated. Identical final words do not prove
 * identical earlier compiler state, and the entry that matters for the next
 * function may be the one that was not listed first.
 *
 * Usage:
 *   npx tsx tools/agent/recipeAtlas.ts --build [--kind exe|overlay]
 *   npx tsx tools/agent/recipeAtlas.ts <functionName>        # look a target up
 *   npx tsx tools/agent/recipeAtlas.ts --coincident          # shapes several recipes share
 *   npx tsx tools/agent/recipeAtlas.ts --families            # what is indexed
 *   Options: --json
 */

import { decodeFunctionWords } from "./family-transfer/signature.js";
import { requireFunctionLocation } from "../lib/symbolIndex.js";
import { buildAtlas, coincidentShapes, loadAtlas, queryAtlas, queryAtlasRegions, type RecipeAtlas } from "./recipe-atlas/atlas.js";
import { allRecipes, recipeFamilies } from "./recipe-atlas/recipes.js";

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const kind = (flagValue(args, "--kind") ?? "exe") as "exe" | "overlay";
  if (kind !== "exe" && kind !== "overlay") {
    console.error(`unknown kind ${kind}; use exe or overlay`);
    process.exit(2);
  }

  if (args.includes("--families")) {
    const recipes = allRecipes();
    if (json) {
      console.log(JSON.stringify({ families: recipeFamilies(), recipes: recipes.length }, null, 2));
      return;
    }
    console.log(`${recipes.length} recipe(s) in ${recipeFamilies().length} families:`);
    for (const family of recipeFamilies()) {
      const members = recipes.filter((recipe) => recipe.family === family);
      console.log(`  ${family.padEnd(20)} ${String(members.length).padStart(3)} — ${members[0]!.note}`);
    }
    return;
  }

  if (args.includes("--build")) {
    const atlas = buildAtlas(kind, {
      onProgress: (done, total, recipeId) => {
        if (done % 10 === 0) console.error(`compiling ${done}/${total} (${recipeId})`);
      },
    });
    report(atlas, json);
    return;
  }

  if (args.includes("--coincident")) {
    const atlas = loadAtlas(kind) ?? buildAtlas(kind);
    const shared = coincidentShapes(atlas);
    if (json) {
      console.log(JSON.stringify(shared, null, 2));
      return;
    }
    console.log(`${shared.length} shape(s) that more than one recipe compiles to:`);
    for (const item of shared) {
      console.log(`  ${item.recipes.length} recipes → one shape:`);
      for (const recipe of item.recipes) console.log(`    ${recipe}`);
    }
    if (shared.length === 0) console.log("  (every indexed construction is distinguishable by its words)");
    return;
  }

  const functionName = args.find((argument) => !argument.startsWith("--") && args[args.indexOf(argument) - 1] !== "--kind");
  if (!functionName) {
    console.error("usage: npx tsx tools/agent/recipeAtlas.ts <functionName> | --build | --coincident | --families [--kind exe|overlay] [--json]");
    process.exit(2);
  }

  const location = requireFunctionLocation(functionName);
  const atlas = loadAtlas(location.container.kind) ?? buildAtlas(location.container.kind);
  const { insns } = decodeFunctionWords(functionName);
  const hits = queryAtlas(atlas, insns);
  /* Whole-function hits answer "is this function that construction"; region
   * hits answer "is the loop in it that loop", which is the question a partly
   * recovered function actually has. Both are reported. */
  const regionHits = queryAtlasRegions(atlas, insns).slice(0, 12);

  if (json) {
    console.log(JSON.stringify({ functionName, containerKind: location.container.kind, hits, regionHits }, null, 2));
    return;
  }

  console.log(`${functionName}: ${hits.length} whole-function hit(s), ${regionHits.length} region hit(s) (${location.container.kind} flags)`);
  for (const hit of hits) {
    console.log(`  [${hit.tier}] ${hit.entry.recipeId} — ${hit.entry.note}`);
    for (const difference of hit.differences) {
      console.log(
        `      ${difference.kind} 0x${(difference.recipeValue >>> 0).toString(16)} → ` +
        `0x${(difference.queryValue >>> 0).toString(16)}`,
      );
    }
  }
  for (const hit of regionHits) {
    console.log(
      `  [${hit.tier} ${hit.region.kind}] 0x${hit.at.vram.toString(16)} +${hit.region.tokens.length} word(s): ` +
      `${hit.entry.recipeId} — ${hit.entry.note}`,
    );
    for (const difference of hit.differences.slice(0, 6)) {
      console.log(
        `      ${difference.kind} 0x${(difference.recipeValue >>> 0).toString(16)} → ` +
        `0x${(difference.queryValue >>> 0).toString(16)}`,
      );
    }
  }
  if (hits.length === 0 && regionHits.length === 0) {
    console.log("  no indexed construction produces these words; the atlas covers " +
      `${atlas.entries.length} recipe(s) in ${new Set(atlas.entries.map((entry) => entry.family)).size} families`);
    return;
  }
  console.log("  a hit is a hypothesis: it says this construction produces this shape under these flags,");
  console.log("  never that the original was written that way. The byte oracle decides.");
}

function report(atlas: RecipeAtlas, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({
      containerKind: atlas.containerKind,
      cc1Flags: atlas.cc1Flags,
      entries: atlas.entries.length,
      failures: atlas.failures,
      coincident: coincidentShapes(atlas).length,
    }, null, 2));
    return;
  }
  console.log(`recipe atlas (${atlas.containerKind}): ${atlas.entries.length} indexed, ${atlas.failures.length} did not compile`);
  console.log(`  flags: ${atlas.cc1Flags.join(" ")}`);
  const byFamily = new Map<string, number>();
  for (const entry of atlas.entries) byFamily.set(entry.family, (byFamily.get(entry.family) ?? 0) + 1);
  for (const [family, count] of [...byFamily].sort()) console.log(`  ${family.padEnd(20)} ${count}`);
  const shared = coincidentShapes(atlas);
  if (shared.length > 0) {
    console.log(`  ${shared.length} shape(s) are produced by more than one construction; both are kept`);
  }
  for (const failure of atlas.failures) console.log(`  FAILED ${failure.recipeId}: ${failure.error.split("\n")[0]}`);
}

if (process.argv[1]?.endsWith("recipeAtlas.ts")) main();
