import type { NormalizedInstruction } from "../variant-lab/types.js";
import type { MismatchCategory } from "./types.js";

/**
 * Residual comparison between a linked target and a cc1 stream.
 *
 * The two streams describe the same program at different stages. The target
 * has been through maspsx, the assembler, and the linker; the cc1 stream has
 * not. Comparing them position by position treats every stage-specific
 * difference as a residual, and a single inserted instruction desynchronizes
 * everything after it — which is how a two-instruction difference reads as
 * hundreds. This module closes the stage differences exactly and aligns what
 * is left, so the causal closure is seeded from real differences only.
 */

/** $30 has two names; the disassembler and cc1 disagree on which. */
const REGISTER_ALIASES = new Map([["s8", "fp"]]);

/** Generated symbols carry their address, so a name and an address compare equal. */
function symbolAddress(token: string): string | undefined {
  if (!/^[a-z_][a-z0-9_]*$/.test(token)) return undefined;
  return token.match(/([0-9a-f]{8})$/)?.[1];
}

function canonicalOperandSymbol(token: string): string {
  return symbolAddress(token) ?? token;
}

/**
 * One operand in the form both stages agree on.
 *
 * - a generated symbol reduces to the address its name carries;
 * - `%lo(sym)(gp)` reduces to the symbol, because small-data addressing is a
 *   choice the assembler makes and the cc1 stream does not encode;
 * - an unresolved call target resolves through its own relocation record.
 */
function residualOperand(operand: string, relocation: string | undefined): string {
  const unresolved = operand.match(/^[0-9a-f]+<[^>]*>$/);
  if (unresolved) {
    const symbol = relocation?.match(/^%(?:hi|lo)\((.+)\)$/)?.[1];
    return symbol ? canonicalOperandSymbol(symbol) : operand;
  }
  const smallData = operand.match(/^%lo\(([^)]+)\)\(gp\)$/);
  if (smallData) return canonicalOperandSymbol(smallData[1]!);
  const wrapped = operand.match(/^%(hi|lo)\(([^)]+)\)(\(.+\))?$/);
  if (wrapped) {
    return `%${wrapped[1]}(${canonicalOperandSymbol(wrapped[2]!)})${wrapped[3] ?? ""}`;
  }
  const register = REGISTER_ALIASES.get(operand);
  if (register) return register;
  const based = operand.match(/^(-?\d+|%[a-z]+\([^)]+\))\((\w+)\)$/);
  if (based) {
    const base = REGISTER_ALIASES.get(based[2]!) ?? based[2]!;
    return `${based[1]}(${base})`;
  }
  return canonicalOperandSymbol(operand);
}

/** The comparison form of one instruction, at whichever stage it came from. */
export function residualKey(instruction: NormalizedInstruction): string {
  let mnemonic = instruction.mnemonic;
  let operands = instruction.operands.map((operand) => residualOperand(operand, instruction.relocation));
  /* The assembler rewrites a subtract of a constant as an add of its negation. */
  if ((mnemonic === "subu" || mnemonic === "sub") && operands.length === 3 && /^-?\d+$/.test(operands[2]!)) {
    mnemonic = mnemonic === "subu" ? "addiu" : "addi";
    operands = [operands[0]!, operands[1]!, String(-Number(operands[2]))];
  }
  return `${mnemonic} ${operands.join(",")}`;
}

/** Matched index pairs of the longest common subsequence of two key streams. */
export function lcsPairs(left: string[], right: string[]): Array<[number, number]> {
  const table: Uint32Array[] = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      table[i]![j] = left[i] === right[j]
        ? table[i + 1]![j + 1]! + 1
        : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) pairs.push([i++, j++]);
    else if (table[i + 1]![j]! >= table[i]![j + 1]!) i++;
    else j++;
  }
  return pairs;
}

export interface ResidualComparison {
  /**
   * Target indexes the causal closure seeds from. This is a seed set, not an
   * exactness measure: it holds every unpaired target instruction, plus an
   * anchor for each cc1 instruction the target does not have, so a pure
   * insertion still has somewhere to start from.
   */
  mismatchedTargetIndexes: number[];
  /** Target indexes with no aligned, equal counterpart in the cc1 stream. */
  unpairedTargetIndexes: number[];
  /** cc1 indexes with no aligned, equal counterpart in the target. */
  unpairedCandidateIndexes: number[];
  /** Aligned equal instructions. */
  exact: number;
  /** Instructions the two streams are expected to account for. */
  total: number;
  category: MismatchCategory;
  firstDivergence?: string;
  /** Target instructions the assembler adds and cc1 never emits. */
  assemblerFill: number;
  /** targetIndex -> candidateIndex for every aligned pair. */
  correspondence: Map<number, number>;
}

/**
 * Align a linked target against a cc1 stream and report what really differs.
 *
 * Target nops the alignment cannot pair are the assembler's delay-slot fills,
 * which cc1 does not emit; they are counted separately rather than charged to
 * the source. Anything else left unpaired is a real difference.
 */
export function compareResidual(
  target: NormalizedInstruction[],
  candidate: NormalizedInstruction[],
): ResidualComparison {
  const targetKeys = target.map(residualKey);
  const candidateKeys = candidate.map(residualKey);
  const pairs = lcsPairs(targetKeys, candidateKeys);
  const correspondence = new Map(pairs);

  const unpairedTargetIndexes: number[] = [];
  let assemblerFill = 0;
  for (let index = 0; index < target.length; index++) {
    if (correspondence.has(index)) continue;
    if (target[index]!.mnemonic === "nop") {
      assemblerFill++;
      continue;
    }
    unpairedTargetIndexes.push(index);
  }
  const pairedCandidates = new Set(pairs.map(([, right]) => right));
  const unpairedCandidateIndexes: number[] = [];
  for (let index = 0; index < candidate.length; index++) {
    if (!pairedCandidates.has(index)) unpairedCandidateIndexes.push(index);
  }

  /* A cc1 instruction the target does not have is a difference too. When an
   * unpaired target instruction already sits in the same gap the two are one
   * substitution and the target side seeds it; otherwise the cc1 stream really
   * did add something, and it anchors to the target position it sits at. */
  const seeds = new Set(unpairedTargetIndexes);
  for (const index of unpairedCandidateIndexes) {
    const before = pairs.filter(([, right]) => right < index).pop()?.[0] ?? -1;
    const after = pairs.find(([, right]) => right > index)?.[0] ?? target.length;
    if (unpairedTargetIndexes.some((position) => position > before && position < after)) continue;
    const anchor = after < target.length ? after : target.length - 1;
    if (anchor >= 0) seeds.add(anchor);
  }
  const mismatchedTargetIndexes = [...seeds].sort((left, right) => left - right);

  const total = Math.max(target.length - assemblerFill, candidate.length);
  const exact = pairs.length;
  let firstDivergence: string | undefined;
  const first = unpairedTargetIndexes[0] ?? mismatchedTargetIndexes[0];
  if (first !== undefined) {
    const counterpart = candidate[unpairedCandidateIndexes[0] ?? -1];
    firstDivergence = `[${first}] ${target[first]?.canonical ?? "<missing>"} vs ${counterpart?.canonical ?? "<missing>"}`;
  }

  return {
    mismatchedTargetIndexes,
    unpairedTargetIndexes,
    unpairedCandidateIndexes,
    exact,
    total,
    category: classifyResidual(
      unpairedTargetIndexes.map((index) => target[index]!),
      unpairedCandidateIndexes.map((index) => candidate[index]!),
    ),
    ...(firstDivergence !== undefined ? { firstDivergence } : {}),
    assemblerFill,
    correspondence,
  };
}

/** Classify what the two streams disagree about, from the unpaired sides only. */
function classifyResidual(left: NormalizedInstruction[], right: NormalizedInstruction[]): MismatchCategory {
  if (left.length === 0 && right.length === 0) return "exact";
  if (left.length !== right.length) return "instruction-count";
  const multiset = (items: NormalizedInstruction[], pick: (item: NormalizedInstruction) => string): string =>
    items.map(pick).sort().join("\n");
  if (multiset(left, residualKey) === multiset(right, residualKey)) return "scheduling-permutation";
  if (left.every((item, index) => item.mnemonic === right[index]!.mnemonic)) return "allocation-or-operands";
  if (multiset(left, (item) => item.mnemonic) === multiset(right, (item) => item.mnemonic)) {
    return "scheduling-and-operands";
  }
  return "mixed";
}

/** True when the cc1 stream accounts for every target instruction the assembler did not add. */
export function residualIsExact(comparison: ResidualComparison): boolean {
  return comparison.unpairedTargetIndexes.length === 0 &&
    comparison.unpairedCandidateIndexes.length === 0 &&
    comparison.exact === comparison.total;
}
