import { readFileSync } from "node:fs";
import { join } from "node:path";
import { disassembleObject, runTool } from "../decompToolchain.js";
import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import { scheduleDeltaRank } from "../target-schedule/compare-profiles.js";
import { compareNormalized } from "../variant-lab/compile.js";
import type { NormalizedInstruction } from "../variant-lab/types.js";
import type { RequirementResult, SearchVariantResult, SourceShapeSearchSpec } from "./types.js";

function exactAt(target: NormalizedInstruction[], candidate: NormalizedInstruction[], indexes: number[]): boolean | undefined {
  if (indexes.some((index) => !target[index] || !candidate[index])) return undefined;
  return indexes.every((index) => target[index]!.canonical === candidate[index]!.canonical);
}

export function evaluateRequirements(
  analysis: TargetScheduleAnalysis | undefined,
  target: NormalizedInstruction[],
  compiled: NormalizedInstruction[],
): RequirementResult[] {
  if (!analysis) return [];
  return analysis.requirements.map((requirement) => {
    const baseline = exactAt(target, analysis.candidate, requirement.targetIndexes);
    const variant = exactAt(target, compiled, requirement.targetIndexes);
    if (variant === undefined) return {
      requirementId: requirement.id,
      status: "ambiguous" as const,
      evidence: ["Variant instruction stream does not cover every target index in this requirement."],
    };
    if (variant) return {
      requirementId: requirement.id,
      status: "satisfied" as const,
      evidence: [`Target indexes ${requirement.targetIndexes.join(", ")} match exactly.`],
    };
    if (baseline) return {
      requirementId: requirement.id,
      status: "regressed" as const,
      evidence: ["The baseline target indexes were exact and this variant changed at least one."],
    };
    return {
      requirementId: requirement.id,
      status: "unchanged" as const,
      evidence: ["The requirement remains unsatisfied at final assembly."],
    };
  });
}

export function evaluateAssembly(options: {
  variantId: string;
  productIndex: number;
  sourceHash: string;
  artifacts: string;
  spec: SourceShapeSearchSpec;
  analysis?: TargetScheduleAnalysis;
  target: NormalizedInstruction[];
  compiled: NormalizedInstruction[];
}): SearchVariantResult {
  const comparison = compareNormalized(options.target, options.compiled);
  const preservedRanges = options.spec.constraints.preserveTargetRanges.map(([start, end]) => ({
    start,
    end,
    exact: exactAt(options.target, options.compiled, Array.from({ length: end - start + 1 }, (_unused, offset) => start + offset)) === true,
  }));
  const requirementResults = evaluateRequirements(options.analysis, options.target, options.compiled);
  const opcodeStreamExact = options.target.length === options.compiled.length && options.target.every((instruction, index) => instruction.mnemonic === options.compiled[index]!.mnemonic);
  const instructionCountExact = options.target.length === options.compiled.length;
  const hardConstraintsPassed = preservedRanges.every((range) => range.exact) &&
    (!options.spec.constraints.preserveOpcodeStream || opcodeStreamExact) &&
    (!options.spec.constraints.forbidInstructionCountGrowth || options.compiled.length <= options.target.length);
  return {
    variantId: options.variantId,
    productIndex: options.productIndex,
    sourceHash: options.sourceHash,
    policyPassed: true,
    compiled: true,
    requirementResults,
    mechanismVerdicts: [],
    preservedRanges,
    hardConstraintsPassed,
    opcodeStreamExact,
    instructionCountExact,
    cc1Exact: comparison.exact === comparison.total && instructionCountExact,
    exactInstructions: comparison.exact,
    totalInstructions: comparison.total,
    fullObjectExact: false,
    promotionEligible: false,
    artifacts: options.artifacts,
  };
}

function canonicalRelocationSymbol(symbol: string): string {
  const normalized = symbol.toLowerCase().replace(/\s*[+-]\s*0x[0-9a-f]+$/, "");
  return normalized.match(/([0-9a-f]{8})$/)?.[1] || normalized;
}

export function functionObjectsEqual(left: string, right: string, scratchDirectory: string): boolean {
  const leftBinary = join(scratchDirectory, "target.text.bin");
  const rightBinary = join(scratchDirectory, "candidate.text.bin");
  runTool("mips-linux-gnu-objcopy", ["-O", "binary", "-j", ".text", left, leftBinary]);
  runTool("mips-linux-gnu-objcopy", ["-O", "binary", "-j", ".text", right, rightBinary]);
  if (!readFileSync(leftBinary).equals(readFileSync(rightBinary))) return false;
  const relocations = (path: string) => disassembleObject(path)
    .filter((instruction) => instruction.relocation)
    .map((instruction) => `${instruction.address}:${instruction.relocation!.type}:${canonicalRelocationSymbol(instruction.relocation!.symbol)}`);
  return JSON.stringify(relocations(left)) === JSON.stringify(relocations(right));
}

/** Lexicographic on the staged residual; a missing reading never outranks one. */
function residualRank(left: SearchVariantResult, right: SearchVariantResult): number {
  const a = left.residual?.key;
  const b = right.residual?.key;
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function rankSearchResults(results: SearchVariantResult[]): SearchVariantResult[] {
  const requirementScore = (result: SearchVariantResult): number => result.requirementResults.reduce((score, item) =>
    score + (item.status === "satisfied" ? 3 : item.status === "unchanged" ? 1 : item.status === "ambiguous" ? 0 : -5), 0);
  const verdictScore = (result: SearchVariantResult): number => result.mechanismVerdicts.reduce((score, item) =>
    score + (item.verdict === "confirmed" ? 3 : item.verdict === "partially-confirmed" ? 2 : item.verdict === "inconclusive" ? 0 : -1), 0);
  return [...results].sort((left, right) =>
    Number(right.policyPassed) - Number(left.policyPassed) ||
    Number(right.hardConstraintsPassed) - Number(left.hardConstraintsPassed) ||
    requirementScore(right) - requirementScore(left) ||
    scheduleDeltaRank(right.scheduleDelta) - scheduleDeltaRank(left.scheduleDelta) ||
    /* Measured, staged, and decomposable — it belongs with the other causal
     * evidence, above the mechanism verdicts and well above the raw count. */
    residualRank(left, right) ||
    verdictScore(right) - verdictScore(left) ||
    Number(right.opcodeStreamExact) - Number(left.opcodeStreamExact) ||
    Number(right.instructionCountExact) - Number(left.instructionCountExact) ||
    right.exactInstructions - left.exactInstructions ||
    Number(right.fullObjectExact) - Number(left.fullObjectExact) ||
    left.variantId.localeCompare(right.variantId),
  );
}
