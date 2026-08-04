import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findEmptyMemoryBarriers, findGeneratedGlobalDefinitions, validateVariantSource } from "../variant-lab/manifest.js";
import { applyExactEdits } from "../variant-lab/transformations.js";
import { writeStableJson } from "../variant-lab/artifacts.js";
import type { SourceShapeSearchSpec, VariantLineage } from "./types.js";

export interface GeneratedVariant {
  id: string;
  productIndex: number;
  source: string;
  sourceHash: string;
  sourcePath: string;
  lineage: VariantLineage;
  policyPassed: boolean;
  policyError?: string;
  sourceEquivalentTo?: string;
}

export function totalProducts(spec: SourceShapeSearchSpec): number {
  return spec.dimensions.reduce((total, dimension) => total * dimension.alternatives.length, 1);
}

function choicesAt(spec: SourceShapeSearchSpec, productIndex: number) {
  const result = new Array(spec.dimensions.length);
  let cursor = productIndex;
  for (let index = spec.dimensions.length - 1; index >= 0; index--) {
    const dimension = spec.dimensions[index]!;
    result[index] = dimension.alternatives[cursor % dimension.alternatives.length]!;
    cursor = Math.floor(cursor / dimension.alternatives.length);
  }
  return result as SourceShapeSearchSpec["dimensions"][number]["alternatives"];
}

function choiceKeys(spec: SourceShapeSearchSpec, alternatives: ReturnType<typeof choicesAt>): string[] {
  return alternatives.map((alternative, index) => `${spec.dimensions[index]!.id}:${alternative.id}`);
}

function allowed(spec: SourceShapeSearchSpec, alternatives: ReturnType<typeof choicesAt>): boolean {
  const selected = new Set(choiceKeys(spec, alternatives));
  if (spec.constraints.requiredAlternatives.some((choice) => !selected.has(choice))) return false;
  return !spec.constraints.incompatibleAlternatives.some((constraint) => constraint.choices.every((choice) => selected.has(choice)));
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function changedSpan(base: string, source: string): number {
  let prefix = 0;
  while (prefix < base.length && prefix < source.length && base[prefix] === source[prefix]) prefix++;
  let suffix = 0;
  while (suffix < base.length - prefix && suffix < source.length - prefix && base[base.length - 1 - suffix] === source[source.length - 1 - suffix]) suffix++;
  return Math.max(base.length, source.length) - prefix - suffix;
}

function variantId(index: number, spec: SourceShapeSearchSpec, alternatives: ReturnType<typeof choicesAt>): string {
  const suffix = alternatives.map((alternative, dimension) => `${spec.dimensions[dimension]!.id}-${alternative.id}`).join("__");
  return `v${String(index).padStart(6, "0")}__${suffix}`;
}

export function generateVariantBatch(options: {
  spec: SourceShapeSearchSpec;
  baseSource: string;
  baseHash: string;
  outputRoot: string;
  startProductIndex: number;
  budget: number;
}): { variants: GeneratedVariant[]; nextProductIndex: number; totalProducts: number } {
  const total = totalProducts(options.spec);
  const variants: GeneratedVariant[] = [];
  const sourceRepresentatives = new Map<string, string>();
  const preserveBarriers = options.spec.constraints.preserveExistingEmptyMemoryBarriers;
  const baselineBarriers = preserveBarriers ? findEmptyMemoryBarriers(options.baseSource) : [];
  const inheritedGeneratedGlobals = findGeneratedGlobalDefinitions(options.baseSource).map((definition) => definition.symbol);
  let productIndex = options.startProductIndex;
  while (productIndex < total && variants.length < options.budget) {
    const alternatives = choicesAt(options.spec, productIndex);
    if (!allowed(options.spec, alternatives)) {
      productIndex++;
      continue;
    }
    const id = variantId(productIndex, options.spec, alternatives);
    let source = options.baseSource;
    let policyPassed = true;
    let policyError: string | undefined;
    try {
      for (const alternative of alternatives) {
        if (alternative.edits) {
          if (preserveBarriers && alternative.edits.some((edit) => /\b(?:__asm__|__asm|asm)\b/.test(`${edit.find}\n${edit.replace}`))) {
            throw new Error("edits may not add, remove, move, or modify a protected empty memory barrier");
          }
          source = applyExactEdits(source, alternative.edits);
        }
      }
      if (preserveBarriers) {
        const candidateBarriers = findEmptyMemoryBarriers(source);
        if (candidateBarriers.length !== baselineBarriers.length || candidateBarriers.some((barrier, index) =>
          barrier.normalized !== baselineBarriers[index]?.normalized
        )) {
          throw new Error("candidate did not preserve the baseline empty memory barriers exactly and in order");
        }
      }
      const findings = validateVariantSource(source, { allowEmptyMemoryBarriers: preserveBarriers, inheritedGeneratedGlobals });
      if (findings.length > 0) {
        policyPassed = false;
        policyError = `line ${findings[0]!.line}: ${findings[0]!.message}`;
      }
    } catch (error) {
      policyPassed = false;
      policyError = error instanceof Error ? error.message : String(error);
    }
    const sourceHash = hash(source);
    const lineage: VariantLineage = {
      variantId: id,
      productIndex,
      baseSourceHash: options.baseHash,
      sourceHash,
      choices: alternatives.map((alternative, index) => ({
        dimension: options.spec.dimensions[index]!.id,
        alternative: alternative.id,
        mechanism: options.spec.dimensions[index]!.mechanism,
        expectedPass: options.spec.dimensions[index]!.expectedPass,
        expectedEffect: alternative.expectedEffect,
      })),
      invariants: [...new Set(options.spec.dimensions.flatMap((dimension, index) => [
        ...dimension.invariants,
        ...alternatives[index]!.invariants,
      ]))],
      changedDimensions: alternatives.filter((alternative) => !alternative.useBase).length,
      editRegions: alternatives.reduce((count, alternative) => count + (alternative.edits?.length || 0), 0),
      changedSpan: changedSpan(options.baseSource, source),
      naturalPriority: alternatives.reduce((totalPriority, alternative) => totalPriority + (alternative.naturalPriority ?? 100), 0),
    };
    const directory = join(options.outputRoot, "variants", id);
    mkdirSync(directory, { recursive: true });
    const sourcePath = join(directory, "source.c");
    writeFileSync(sourcePath, source);
    writeStableJson(join(directory, "lineage.json"), lineage);
    const variant: GeneratedVariant = { id, productIndex, source, sourceHash, sourcePath, lineage, policyPassed };
    if (policyError) variant.policyError = policyError;
    const representative = sourceRepresentatives.get(sourceHash);
    if (representative) variant.sourceEquivalentTo = representative;
    else sourceRepresentatives.set(sourceHash, id);
    variants.push(variant);
    productIndex++;
  }
  return { variants, nextProductIndex: productIndex, totalProducts: total };
}
