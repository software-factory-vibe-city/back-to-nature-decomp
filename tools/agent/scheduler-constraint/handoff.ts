import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import { validateSourceShapeSpec } from "../source-shape-search/schema.js";
import { deriveSynthesisPlan, sourceShapeSpec } from "../source-shape-synthesis/planner.js";
import { buildSourceModel } from "../source-shape-synthesis/source-model.js";
import type { SynthesisPlan } from "../source-shape-synthesis/types.js";
import type { SchedulerConstraintInput, SchedulerConstraintResult } from "./types.js";

export interface SchedulerSourceHandoff {
  plan: SynthesisPlan;
  searchSpec: ReturnType<typeof validateSourceShapeSpec>;
  evidence: string[];
}

/**
 * Translate a SAT witness into the existing clean-C synthesis vocabulary.
 * This function only filters recipes already admitted by the conservative
 * source model; it never invents edits or weakens source policy.
 */
export function deriveSchedulerSourceHandoff(
  input: SchedulerConstraintInput,
  result: SchedulerConstraintResult,
  analysis: TargetScheduleAnalysis,
  sourcePath: string,
): SchedulerSourceHandoff | undefined {
  if (result.status !== "sat" || !result.witness) return undefined;
  const absoluteSourcePath = isAbsolute(sourcePath) ? sourcePath : join(ROOT, sourcePath);
  const modelSourcePath = isAbsolute(sourcePath) ? absoluteSourcePath.slice(ROOT.length + 1).replace(/\\/g, "/") : sourcePath;
  const source = readFileSync(absoluteSourcePath, "utf8");
  const model = buildSourceModel(input.model.function, modelSourcePath, source);
  const original = deriveSynthesisPlan({
    functionName: input.model.function,
    sourcePath: modelSourcePath,
    source,
    analysisPath: analysis.outputDirectory ? `${analysis.outputDirectory}/analysis.json` : `build/targetSchedule/${input.model.function}/analysis.json`,
    analysis,
    maxVariants: 256,
    maxDepth: 3,
  }, model);

  const needsPhantomCopy = result.witness.phantoms.length > 0;
  const mechanismSet = new Set(result.witness.sourceRequirements.map((item) => item.mechanism));
  const allowedRecipes = new Set(original.recipes.filter((recipe) =>
    recipe.mechanisms.some((mechanism) => mechanismSet.has(mechanism)) || recipe.id === "recipe-statement-order"
  ).map((recipe) => recipe.id));
  if (needsPhantomCopy) allowedRecipes.add("recipe-parameter-local-copy");

  const alternatives = original.alternatives.filter((alternative) => {
    if (needsPhantomCopy && !alternative.recipeIds.includes("recipe-parameter-local-copy")) return false;
    return alternative.recipeIds.some((id) => allowedRecipes.has(id));
  });
  if (alternatives.length === 0) return undefined;
  const usedRecipes = new Set(alternatives.flatMap((alternative) => alternative.recipeIds));
  const plan: SynthesisPlan = {
    ...original,
    maxVariants: alternatives.length + 1,
    recipes: original.recipes.filter((recipe) => usedRecipes.has(recipe.id)),
    alternatives,
    caveats: [
      ...original.caveats,
      "This handoff is filtered by a scheduler-constraint SAT witness; it contains only existing proof-admitted source recipes related to the witness mechanisms.",
      "A scheduler witness is not semantic evidence for a source edit. Every generated alternative still carries the synthesizer's ordinary local safety obligations.",
    ],
  };
  const spec = validateSourceShapeSpec(sourceShapeSpec(plan, /__asm__\s+volatile\s*\(\s*""\s*:::\s*"memory"\s*\)/.test(source)), input.model.function);
  return {
    plan,
    searchSpec: spec,
    evidence: [
      `${alternatives.length} existing proof-admitted clean-C shape(s) target the SAT witness mechanisms.`,
      needsPhantomCopy ? "Every emitted shape contains the synthesizer's typed parameter-local-copy recipe." : "No phantom-copy recipe was required by the witness.",
    ],
  };
}
