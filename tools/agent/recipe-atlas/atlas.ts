/**
 * The recipe atlas — compiled evidence about what this toolchain emits.
 *
 * Every recipe is compiled by the *production* compiler under the *production*
 * flags, and the words it produces are indexed by the same shape signature the
 * family index uses on target functions. That shared key is the whole design:
 * a target's shape and a recipe's shape are the same kind of thing, so looking
 * a target up in the atlas is one map read, and a hit comes back with source
 * that is known to produce those words under this toolchain.
 *
 * Two properties the plan insists on, and both are load-bearing:
 *
 *   - **Coincident outputs are both kept.** Two recipes whose words agree are
 *     stored as two entries under one shape. Identical final words do not
 *     prove identical earlier compiler state, and the entry that matters for
 *     the next function may be the one that was not first.
 *   - **A hit is a hypothesis.** The atlas says "this construction produces
 *     this shape under these flags"; it never says the original was written
 *     that way. Only the relocated-byte oracle promotes anything, and that is
 *     a different tool.
 *
 * The atlas is per flag column, because the answer depends on it: an overlay's
 * `-G0` and the executable's `-G8` are different experiments, and one index
 * over both would answer neither.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT,
  compileSource,
  configuredCc1FlagsForContainer,
  runTool,
} from "../decompToolchain.js";
import { ensureArtifact, stamped } from "../provenance.js";
import { decodeFunction, type DecodedInsn } from "../matching-reconstruction/decode.js";
import { signatureOf, type FamilySignature, type SignatureTier } from "../family-transfer/signature.js";
import { buildCfg } from "../machine-ir/cfg.js";
import { computeDominators, findNaturalLoops } from "../machine-ir/dominance.js";
import { allRecipes, type Recipe } from "./recipes.js";

export const RECIPE_ATLAS_SCHEMA_VERSION = 1 as const;

/**
 * One indexed span of a recipe's output.
 *
 * Whole functions and loop bodies are indexed separately, because they answer
 * different questions. A whole-function hit says "this function is that
 * construction"; a loop hit says "the loop in this function is that loop",
 * which is the question a partly-recovered function actually has. Loop bodies
 * come from the machine IR's own loop analysis, so the spans are the same ones
 * every other tool here talks about.
 */
export interface AtlasRegion {
  kind: "function" | "loop";
  /** Instruction range within the recipe's output, inclusive of `from`. */
  from: number;
  to: number;
  strictShape: string;
  flexibleShape: string;
  /**
   * Shape-tier tokens: immediates as holes and scratch registers renumbered.
   *
   * This is the key a window search uses. Keeping the allocator's register
   * choice would make every recipe match only a target that happened to be
   * allocated identically, which is a coincidence rather than a construction.
   */
  tokens: string[];
  holes: FamilySignature["holes"];
}

export interface AtlasEntry {
  recipeId: string;
  family: string;
  parameters: Recipe["parameters"];
  note: string;
  /** Words the production compiler produced, as hex. */
  words: string[];
  /** Shape keys at both tiers, so a query can ask either question. */
  strictShape: string;
  flexibleShape: string;
  /** Holes the flexible signature found, with this recipe's own values. */
  holes: FamilySignature["holes"];
  /** Indexed spans: the whole function, and each loop body it contains. */
  regions: AtlasRegion[];
}

export interface RecipeAtlas {
  schemaVersion: typeof RECIPE_ATLAS_SCHEMA_VERSION;
  containerKind: "exe" | "overlay";
  cc1Flags: string[];
  entries: AtlasEntry[];
  /** Recipes that did not compile, with the compiler's own words. */
  failures: Array<{ recipeId: string; error: string }>;
}

/* ---- compiling one recipe ---------------------------------------------------- */

const OBJDUMP = "mips-linux-gnu-objdump";

/**
 * The words one object's named function occupies.
 *
 * Read from `objdump -d`, which prints the raw word beside each instruction.
 * Reading the section bytes directly would need an ELF parser; the disassembly
 * already carries exactly the bytes, and parsing it is one regular expression
 * over lines the tool itself produced.
 */
export function objectFunctionWords(objectPath: string, functionName: string): DecodedInsn[] {
  const dump = runTool(OBJDUMP, ["-d", objectPath]);
  const words: Array<{ raw: number; vram: number }> = [];
  let inside = false;
  for (const line of dump.split("\n")) {
    const label = line.match(/^([0-9a-f]+)\s+<([^>]+)>:\s*$/i);
    if (label) {
      inside = label[2] === functionName;
      continue;
    }
    if (!inside) continue;
    const instruction = line.match(/^\s*([0-9a-f]+):\s+([0-9a-f]{8})\s/i);
    if (!instruction) {
      /* A blank line ends the symbol's listing. */
      if (line.trim() === "") inside = false;
      continue;
    }
    words.push({ raw: parseInt(instruction[2]!, 16) >>> 0, vram: parseInt(instruction[1]!, 16) });
  }
  return decodeFunction(words);
}

/** Compile one recipe and index its words, or report why it did not compile. */
export function indexRecipe(
  recipe: Recipe,
  containerKind: "exe" | "overlay",
  directory: string,
): AtlasEntry | { error: string } {
  const sourcePath = join(directory, `${recipe.id}.c`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(sourcePath, recipe.source);
  try {
    const artifacts = compileSource(sourcePath, join(directory, recipe.id), recipe.functionName, {
      assemble: true,
      /* A generated unit has no per-file override to apply; the flag column is
       * the container's baseline, which is the experiment being indexed. */
      useOverrides: false,
      containerKind,
    });
    const insns = objectFunctionWords(artifacts.object!, recipe.functionName);
    if (insns.length === 0) return { error: "the object defines no words for the recipe's function" };
    const strict = signatureOf(recipe.id, containerKind, insns, "strict");
    const flexible = signatureOf(recipe.id, containerKind, insns, "flexible");
    return {
      recipeId: recipe.id,
      family: recipe.family,
      parameters: recipe.parameters,
      note: recipe.note,
      words: insns.map((insn) => `0x${(insn.word >>> 0).toString(16).padStart(8, "0")}`),
      strictShape: strict.shape,
      flexibleShape: flexible.shape,
      holes: flexible.holes,
      regions: regionsOfRecipe(recipe.id, containerKind, insns, strict, flexible),
    };
  } catch (error) {
    return { error: (error instanceof Error ? error.message : String(error)).slice(0, 400) };
  }
}

/**
 * The spans of one recipe's output worth indexing.
 *
 * The whole function always; then each natural loop body, from the machine
 * IR's loop analysis. A recipe with no loop contributes one span, which costs
 * nothing and keeps the structure uniform.
 */
function regionsOfRecipe(
  recipeId: string,
  containerKind: "exe" | "overlay",
  insns: DecodedInsn[],
  strict: FamilySignature,
  flexible: FamilySignature,
): AtlasRegion[] {
  const shape = signatureOf(recipeId, containerKind, insns, "shape");
  const regions: AtlasRegion[] = [{
    kind: "function",
    from: 0,
    to: insns.length,
    strictShape: strict.shape,
    flexibleShape: flexible.shape,
    tokens: shape.tokens,
    holes: shape.holes,
  }];
  try {
    const cfg = buildCfg(insns);
    for (const loop of findNaturalLoops(cfg, computeDominators(cfg))) {
      /*
       * The repeating span, not the loop's whole address range.
       *
       * `body` is every block that reaches a latch, and in a rotated loop its
       * lowest address can be a peeled first iteration or a guard the loop
       * only executes once. Indexing header-to-latch instead gives the part
       * that actually repeats — which is the part another function's loop can
       * be the same as.
       */
      const header = cfg.blocks[loop.header]!;
      const latchEnds = loop.latches.map((latch) => {
        const block = cfg.blocks[latch]!;
        return block.instructions[block.instructions.length - 1]! + 1;
      });
      const from = header.instructions[0]!;
      const to = Math.max(from + 1, ...latchEnds);
      if (to - from < 4) continue;
      const span = insns.slice(from, to);
      const loopStrict = signatureOf(`${recipeId}#loop${from}`, containerKind, span, "strict");
      const loopFlexible = signatureOf(`${recipeId}#loop${from}`, containerKind, span, "flexible");
      const loopShape = signatureOf(`${recipeId}#loop${from}`, containerKind, span, "shape");
      regions.push({
        kind: "loop",
        from,
        to,
        strictShape: loopStrict.shape,
        flexibleShape: loopFlexible.shape,
        tokens: loopShape.tokens,
        holes: loopShape.holes,
      });
    }
  } catch {
    /* A recipe whose graph cannot be built still contributes its function. */
  }
  return regions;
}

/* ---- building and caching ------------------------------------------------------ */

export function atlasPath(containerKind: "exe" | "overlay"): string {
  return join(ROOT, "build/recipeAtlas", `${containerKind}.json`);
}

/**
 * Build the atlas for one flag column, from cache when the cache still
 * describes this toolchain and these recipes.
 *
 * Freshness is the provenance layer's job, not a timestamp's: the atlas is
 * derived from the compiler binary, the flag set and the generator's own code,
 * and a change to any of them makes every entry a different measurement.
 */
export function buildAtlas(
  containerKind: "exe" | "overlay",
  options: { families?: string[]; onProgress?: ((done: number, total: number, recipeId: string) => void) | undefined } = {},
): RecipeAtlas {
  const recipes = allRecipes().filter((recipe) => !options.families || options.families.includes(recipe.family));
  const path = atlasPath(containerKind);
  const cc1Flags = configuredCc1FlagsForContainer(containerKind);

  const ensured = ensureArtifact<RecipeAtlas>({
    artifactPath: path,
    label: `recipe atlas (${containerKind})`,
    functionName: "*",
    costHint: `${recipes.length} recipes to compile`,
    inputs: {
      values: { containerKind, cc1Flags, families: options.families ?? "all" },
      implementation: ["tools/agent/recipe-atlas", "tools/agent/family-transfer/signature.ts"],
    },
    produce: (provenance) => {
      const scratch = join(ROOT, "build/recipeAtlas", `${containerKind}-work`);
      rmSync(scratch, { recursive: true, force: true });
      const entries: AtlasEntry[] = [];
      const failures: RecipeAtlas["failures"] = [];
      recipes.forEach((recipe, index) => {
        options.onProgress?.(index, recipes.length, recipe.id);
        const indexed = indexRecipe(recipe, containerKind, scratch);
        if ("error" in indexed) failures.push({ recipeId: recipe.id, error: indexed.error });
        else entries.push(indexed);
      });
      const atlas: RecipeAtlas = {
        schemaVersion: RECIPE_ATLAS_SCHEMA_VERSION,
        containerKind,
        cc1Flags,
        entries,
        failures,
      };
      mkdirSync(join(ROOT, "build/recipeAtlas"), { recursive: true });
      writeFileSync(path, JSON.stringify(stamped(atlas as unknown as Record<string, unknown>, provenance), null, 1));
      return atlas;
    },
    read: (stored) => stored as RecipeAtlas,
  });

  return ensured.value;
}

/** Load a previously built atlas without rebuilding it. */
export function loadAtlas(containerKind: "exe" | "overlay"): RecipeAtlas | null {
  try {
    return JSON.parse(readFileSync(atlasPath(containerKind), "utf-8")) as RecipeAtlas;
  } catch {
    return null;
  }
}

/* ---- querying ------------------------------------------------------------------ */

export interface AtlasHit {
  entry: AtlasEntry;
  tier: SignatureTier;
  /** Substitutions that would turn the recipe's words into the query's. */
  differences: Array<{ index: number; kind: string; recipeValue: number; queryValue: number }>;
}

/**
 * Recipes whose words have the query's shape.
 *
 * The strict tier answers "this construction, with these constants"; the
 * flexible tier answers "this construction, with different constants", and
 * returns what those constants would have to be. Both are reported, strict
 * first, because a strict hit is the stronger statement.
 */
export function queryAtlas(atlas: RecipeAtlas, insns: DecodedInsn[]): AtlasHit[] {
  const strict = signatureOf("query", atlas.containerKind, insns, "strict");
  const flexible = signatureOf("query", atlas.containerKind, insns, "flexible");
  const hits: AtlasHit[] = [];

  for (const entry of atlas.entries) {
    if (entry.strictShape === strict.shape) {
      hits.push({ entry, tier: "strict", differences: [] });
      continue;
    }
    if (entry.flexibleShape !== flexible.shape) continue;
    const differences: AtlasHit["differences"] = [];
    for (let index = 0; index < Math.min(entry.holes.length, flexible.holes.length); index++) {
      const recipeHole = entry.holes[index]!;
      const queryHole = flexible.holes[index]!;
      if (recipeHole.value === queryHole.value) continue;
      differences.push({ index, kind: recipeHole.kind, recipeValue: recipeHole.value, queryValue: queryHole.value });
    }
    hits.push({ entry, tier: "flexible", differences });
  }

  return hits.sort((left, right) =>
    (left.tier === "strict" ? 0 : 1) - (right.tier === "strict" ? 0 : 1) ||
    left.differences.length - right.differences.length ||
    left.entry.recipeId.localeCompare(right.entry.recipeId));
}

export interface AtlasRegionHit {
  entry: AtlasEntry;
  region: AtlasRegion;
  /** Where in the query's words the recipe's span aligns. */
  at: { from: number; to: number; vram: number };
  tier: SignatureTier;
  differences: AtlasHit["differences"];
}

/**
 * Recipe spans that appear somewhere inside a target's words.
 *
 * The comparison is over flexible tokens, so a construction whose constants
 * differ still matches and reports what they would have to be. Matching is by
 * token subsequence rather than by recomputing a signature per window: the
 * tokens are already position-independent — branch distances are relative and
 * symbol references are holes — so a window's tokens are a slice.
 *
 * Very short spans are not reported. A four-token run appears in most
 * functions and carries no information; the threshold is what keeps the answer
 * from being "every recipe, everywhere".
 */
export function queryAtlasRegions(
  atlas: RecipeAtlas,
  insns: DecodedInsn[],
  options: { minimumWords?: number } = {},
): AtlasRegionHit[] {
  /* Five words is the shortest span that still names a construction: a loop
   * body carries its load width, both advances, the branch form and the
   * accumulate in that many. Four is a prologue fragment. */
  const minimum = options.minimumWords ?? 5;
  const strict = signatureOf("query", atlas.containerKind, insns, "strict");
  const hits: AtlasRegionHit[] = [];

  /*
   * The shape tier renumbers scratch registers by first use, so a window's
   * tokens have to be produced from the *window*, not sliced out of a
   * whole-function signature: two occurrences of one construction number their
   * registers from their own first use, and a numbering inherited from a
   * different preamble makes identical code look different.
   *
   * Windows are tokenized once per distinct length and reused across every
   * entry of that length, so the cost is (distinct lengths × words), not
   * (entries × words).
   */
  const lengths = new Set<number>();
  for (const entry of atlas.entries) {
    for (const region of entry.regions) {
      if (region.tokens.length >= minimum) lengths.add(region.tokens.length);
    }
  }
  const windowsByLength = new Map<number, Array<{ start: number; signature: FamilySignature }>>();
  for (const length of lengths) {
    const windows: Array<{ start: number; signature: FamilySignature }> = [];
    for (let start = 0; start + length <= insns.length; start++) {
      windows.push({
        start,
        signature: signatureOf("window", atlas.containerKind, insns.slice(start, start + length), "shape"),
      });
    }
    windowsByLength.set(length, windows);
  }

  for (const entry of atlas.entries) {
    for (const region of entry.regions) {
      const length = region.tokens.length;
      if (length < minimum) continue;
      for (const window of windowsByLength.get(length) ?? []) {
        if (window.signature.shape !== digestOfTokens(region.tokens)) continue;

        const differences: AtlasHit["differences"] = [];
        for (let index = 0; index < Math.min(region.holes.length, window.signature.holes.length); index++) {
          const recipeHole = region.holes[index]!;
          const queryHole = window.signature.holes[index]!;
          if (recipeHole.value === queryHole.value) continue;
          differences.push({ index, kind: recipeHole.kind, recipeValue: recipeHole.value, queryValue: queryHole.value });
        }
        const exact = region.kind === "function"
          ? region.strictShape === strict.shape
          : differences.length === 0;
        hits.push({
          entry,
          region,
          at: { from: window.start, to: window.start + length, vram: insns[window.start]?.vram ?? 0 },
          tier: exact ? "strict" : "flexible",
          differences,
        });
      }
    }
  }

  return hits.sort((left, right) =>
    right.region.tokens.length - left.region.tokens.length ||
    left.differences.length - right.differences.length ||
    left.at.from - right.at.from);
}

/**
 * The digest a token list would produce.
 *
 * Stored regions carry their tokens rather than a digest of them, so a query
 * that compares digests has to recompute one. It is the same function the
 * signature builder uses, applied to the same input.
 */
function digestOfTokens(tokens: string[]): string {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x01000193 >>> 0;
  const text = tokens.join("\n");
  for (let index = 0; index < text.length; index++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(index), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + text.charCodeAt(index), 0x85ebca6b) >>> 0;
  }
  return `${tokens.length}:${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/**
 * Shapes several recipes share.
 *
 * This is the atlas's own honesty check, and the number it produces is a
 * finding rather than a defect: where two constructions compile to the same
 * words, a shape lookup cannot distinguish them, and any consumer that treats
 * one hit as "the" answer is overstating what the compiler licensed.
 */
export function coincidentShapes(atlas: RecipeAtlas): Array<{ shape: string; recipes: string[] }> {
  const byShape = new Map<string, string[]>();
  for (const entry of atlas.entries) {
    byShape.set(entry.strictShape, [...(byShape.get(entry.strictShape) ?? []), entry.recipeId]);
  }
  return [...byShape.entries()]
    .filter(([, recipes]) => recipes.length > 1)
    .map(([shape, recipes]) => ({ shape, recipes: recipes.sort() }))
    .sort((left, right) => right.recipes.length - left.recipes.length);
}
