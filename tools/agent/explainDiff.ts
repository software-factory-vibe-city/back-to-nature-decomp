#!/usr/bin/env npx tsx
/**
 * explainDiff.ts — classify a function diff by compiler-relevant structure.
 *
 * Usage:
 *   npx tsx tools/agent/explainDiff.ts func_80024578
 *   npx tsx tools/agent/explainDiff.ts func_8001AF44 --src notes/scratch/func_8001AF44-candidate.c
 *   npx tsx tools/agent/explainDiff.ts func_8001AF44 --json
 *   npx tsx tools/agent/explainDiff.ts --self-test
 */

import { rmSync } from "fs";
import { join, relative } from "path";
import {
  ROOT,
  type DisassembledInstruction,
  assembleTarget,
  compileSource,
  disassembleObject,
  normalizeFunctionName,
  resolveSource,
} from "./decompToolchain.js";
import {
  alignByShape,
  bagDelta,
  compareWebs,
  computeWebs,
  formatBagDelta,
  provenanceAudit,
  summarizeWeb,
} from "./webAnalysis.js";

export type DiffCategory =
  | "exact"
  | "register-allocation"
  | "operand-order"
  | "relocation-or-immediate"
  | "scheduling"
  | "scheduling-and-operands"
  | "instruction-selection"
  | "mixed-operands";

export interface InstructionDifference {
  index: number;
  target: string;
  compiled: string;
  kind: string;
}

export interface WebParitySummary {
  parity: boolean;
  matched: number;
  targetOnly: string[];
  compiledOnly: string[];
  looseMatches: string[];
  entryOnlyTarget: string[];
  entryOnlyCompiled: string[];
}

export interface ProvenanceFinding {
  targetIndex: number;
  compiledIndex: number;
  register: string;
  reason: string;
  detail: string;
}

export interface StructuralDiffReport {
  category: DiffCategory;
  summary: string;
  targetCount: number;
  compiledCount: number;
  exactMatches: number;
  opcodeMatches: number;
  opcodeLcs: number;
  registerMap: Record<string, string>;
  nonIdentityRegisterMap: Record<string, string>;
  webMap: Record<string, string>;
  nonIdentityWebMap: Record<string, string>;
  commutativeSwaps: number;
  independentOrderInversions: number;
  dependentOrderInversions: number;
  differences: InstructionDifference[];
  evidence: string[];
  /* Semantic gates (see webAnalysis.ts): a failing web parity or any
     provenance divergence means source semantics differ from the target;
     allocator/scheduler work is premature until both are clean. */
  webParity: WebParitySummary;
  provenanceDivergences: ProvenanceFinding[];
  structuralDelta: string[];
}

interface RegisterUse {
  defs: Set<string>;
  uses: Set<string>;
  memory: boolean;
  control: boolean;
}

const REGISTER_NAMES = [
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra",
];
const REGISTER_SET = new Set(REGISTER_NAMES);
const FIXED_REGISTERS = new Set(["zero", "sp", "gp", "fp", "ra"]);
const REGISTER_PATTERN = new RegExp(
  `(^|[^A-Za-z0-9_])\\$?(${REGISTER_NAMES.join("|")})(?=$|[^A-Za-z0-9_])`,
  "gi",
);

const DESTINATION_FIRST = new Set([
  "add", "addu", "addiu", "sub", "subu", "and", "andi", "or", "ori",
  "xor", "xori", "nor", "slt", "sltu", "slti", "sltiu", "sll", "sllv",
  "sra", "srav", "srl", "srlv", "lui", "li", "la", "move", "mfhi",
  "mflo", "lbu", "lb", "lhu", "lh", "lw", "lwl", "lwr",
]);
const LOADS = new Set(["lbu", "lb", "lhu", "lh", "lw", "lwl", "lwr"]);
const STORES = new Set(["sb", "sh", "sw", "swl", "swr"]);
const BRANCHES = new Set([
  "b", "beq", "beqz", "bne", "bnez", "bgez", "bgtz", "blez", "bltz",
  "bgezal", "bltzal", "j", "jal", "jr", "jalr",
]);
const COMMUTATIVE = new Map<string, [number, number]>([
  ["add", [1, 2]], ["addu", [1, 2]], ["and", [1, 2]], ["or", [1, 2]],
  ["xor", [1, 2]], ["mult", [0, 1]], ["multu", [0, 1]],
  ["beq", [0, 1]], ["bne", [0, 1]],
]);

function registersIn(text: string): string[] {
  const result: string[] = [];
  REGISTER_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(REGISTER_PATTERN)) result.push(match[2].toLowerCase());
  return result;
}

function replaceRegisters(text: string, mapping: Map<string, string>): string {
  REGISTER_PATTERN.lastIndex = 0;
  return text.replace(REGISTER_PATTERN, (_whole, prefix: string, register: string) => {
    const normalized = register.toLowerCase();
    return `${prefix}${mapping.get(normalized) || normalized}`;
  });
}

function normalizeOperand(operand: string, mapping: Map<string, string> = new Map()): string {
  return replaceRegisters(operand.toLowerCase().replace(/\s+/g, ""), mapping)
    .replace(/\$([a-z][a-z0-9]*)/g, "$1");
}

function normalizedOperands(
  instruction: DisassembledInstruction,
  mapping: Map<string, string> = new Map(),
): string[] {
  return instruction.operands.map((operand) => normalizeOperand(operand, mapping));
}

function normalizeRelocationSymbol(symbol: string): string {
  const normalized = symbol.toLowerCase().replace(/\s*[+-]\s*0x[0-9a-f]+$/, "");
  /* Splat may name one address T_..., D_..., or .L... in different objects. */
  const address = normalized.match(/([0-9a-f]{8})$/);
  return address ? address[1] : normalized;
}

function canonical(
  instruction: DisassembledInstruction,
  mapping: Map<string, string> = new Map(),
): string {
  const relocation = instruction.relocation
    ? `|${instruction.relocation.type.toLowerCase()}:${normalizeRelocationSymbol(instruction.relocation.symbol)}`
    : "";
  return `${instruction.mnemonic} ${normalizedOperands(instruction, mapping).join(",")}${relocation}`;
}

function display(instruction: DisassembledInstruction | undefined): string {
  if (!instruction) return "<missing>";
  const relocation = instruction.relocation
    ? ` [${instruction.relocation.type} ${instruction.relocation.symbol}]`
    : "";
  return `${instruction.mnemonic}${instruction.operandText ? ` ${instruction.operandText}` : ""}${relocation}`;
}

function addWeight(
  weights: Map<string, Map<string, number>>,
  target: string,
  compiled: string,
  amount: number,
): void {
  if (!REGISTER_SET.has(target) || !REGISTER_SET.has(compiled)) return;
  const row = weights.get(target) || new Map<string, number>();
  row.set(compiled, (row.get(compiled) || 0) + amount);
  weights.set(target, row);
}

/** Infer a one-to-one target→compiled hard-register mapping from aligned opcodes. */
function inferRegisterMap(
  target: DisassembledInstruction[],
  compiled: DisassembledInstruction[],
): Map<string, string> {
  const weights = new Map<string, Map<string, number>>();
  const count = Math.min(target.length, compiled.length);

  for (let index = 0; index < count; index++) {
    const left = target[index];
    const right = compiled[index];
    if (left.mnemonic !== right.mnemonic) continue;
    const operandCount = Math.min(left.operands.length, right.operands.length);
    for (let operand = 0; operand < operandCount; operand++) {
      const leftRegisters = registersIn(left.operands[operand]);
      const rightRegisters = registersIn(right.operands[operand]);
      for (let occurrence = 0; occurrence < Math.min(leftRegisters.length, rightRegisters.length); occurrence++) {
        addWeight(weights, leftRegisters[occurrence], rightRegisters[occurrence], 2);
      }
    }
  }

  const result = new Map<string, string>();
  const usedCompiled = new Set<string>();
  for (const register of FIXED_REGISTERS) {
    result.set(register, register);
    usedCompiled.add(register);
  }

  const candidates: Array<{ target: string; compiled: string; weight: number }> = [];
  for (const [targetRegister, row] of weights) {
    for (const [compiledRegister, weight] of row) {
      const identityBonus = targetRegister === compiledRegister ? 1 : 0;
      candidates.push({ target: targetRegister, compiled: compiledRegister, weight: weight + identityBonus });
    }
  }
  candidates.sort((a, b) => b.weight - a.weight || a.target.localeCompare(b.target));

  for (const candidate of candidates) {
    if (result.has(candidate.target) || usedCompiled.has(candidate.compiled)) continue;
    result.set(candidate.target, candidate.compiled);
    usedCompiled.add(candidate.compiled);
  }

  for (const register of REGISTER_NAMES) {
    if (!result.has(register) && !usedCompiled.has(register)) {
      result.set(register, register);
      usedCompiled.add(register);
    }
  }
  return result;
}

interface WebAnnotatedInstruction {
  instruction: DisassembledInstruction;
  operands: string[];
  canonical: string;
}

function annotateRegisterWebs(instructions: DisassembledInstruction[]): WebAnnotatedInstruction[] {
  const versions = new Map<string, number>();
  const result: WebAnnotatedInstruction[] = [];

  for (const instruction of instructions) {
    const destination = DESTINATION_FIRST.has(instruction.mnemonic) && instruction.operands.length > 0
      ? registersIn(instruction.operands[0])[0]
      : undefined;
    const destinationVersion = destination ? (versions.get(destination) || 0) + 1 : undefined;

    const operands = instruction.operands.map((rawOperand, operandIndex) => {
      const operand = rawOperand.toLowerCase().replace(/\s+/g, "");
      REGISTER_PATTERN.lastIndex = 0;
      return operand.replace(REGISTER_PATTERN, (_whole, prefix: string, register: string) => {
        const normalized = register.toLowerCase();
        const version = operandIndex === 0 && normalized === destination
          ? destinationVersion!
          : (versions.get(normalized) || 0);
        return `${prefix}@${normalized}#${version}`;
      });
    });
    if (destination && destinationVersion !== undefined) versions.set(destination, destinationVersion);

    const relocation = instruction.relocation
      ? `|${instruction.relocation.type.toLowerCase()}:${normalizeRelocationSymbol(instruction.relocation.symbol)}`
      : "";
    result.push({
      instruction,
      operands,
      canonical: `${instruction.mnemonic} ${operands.join(",")}${relocation}`,
    });
  }
  return result;
}

function websIn(text: string): string[] {
  return [...text.matchAll(/@([a-z0-9]+#\d+)/g)].map((match) => match[1]);
}

function inferWebMap(
  target: WebAnnotatedInstruction[],
  compiled: WebAnnotatedInstruction[],
): Map<string, string> {
  const weights = new Map<string, Map<string, number>>();
  const count = Math.min(target.length, compiled.length);
  for (let index = 0; index < count; index++) {
    if (target[index].instruction.mnemonic !== compiled[index].instruction.mnemonic) continue;
    const operandCount = Math.min(target[index].operands.length, compiled[index].operands.length);
    for (let operand = 0; operand < operandCount; operand++) {
      const left = websIn(target[index].operands[operand]);
      const right = websIn(compiled[index].operands[operand]);
      for (let occurrence = 0; occurrence < Math.min(left.length, right.length); occurrence++) {
        const row = weights.get(left[occurrence]) || new Map<string, number>();
        row.set(right[occurrence], (row.get(right[occurrence]) || 0) + 2);
        weights.set(left[occurrence], row);
      }
    }
  }

  const candidates: Array<{ target: string; compiled: string; weight: number }> = [];
  for (const [targetWeb, row] of weights) {
    for (const [compiledWeb, weight] of row) {
      candidates.push({
        target: targetWeb,
        compiled: compiledWeb,
        weight: weight + (targetWeb === compiledWeb ? 1 : 0),
      });
    }
  }
  candidates.sort((a, b) => b.weight - a.weight || a.target.localeCompare(b.target));

  const result = new Map<string, string>();
  const usedCompiled = new Set<string>();
  for (const candidate of candidates) {
    if (result.has(candidate.target) || usedCompiled.has(candidate.compiled)) continue;
    result.set(candidate.target, candidate.compiled);
    usedCompiled.add(candidate.compiled);
  }
  return result;
}

function mapWebCanonical(value: string, mapping: Map<string, string>): string {
  return value.replace(/@([a-z0-9]+#\d+)/g, (_whole, web: string) => `@${mapping.get(web) || web}`);
}

function opcodesEqual(target: DisassembledInstruction[], compiled: DisassembledInstruction[]): boolean {
  return target.length === compiled.length && target.every((instruction, index) =>
    instruction.mnemonic === compiled[index].mnemonic
  );
}

function lcsLength(left: string[], right: string[]): number {
  const previous = new Uint16Array(right.length + 1);
  const current = new Uint16Array(right.length + 1);
  for (let i = 1; i <= left.length; i++) {
    current.fill(0);
    for (let j = 1; j <= right.length; j++) {
      current[j] = left[i - 1] === right[j - 1]
        ? previous[j - 1] + 1
        : Math.max(previous[j], current[j - 1]);
    }
    previous.set(current);
  }
  return previous[right.length];
}

function sameMultiset(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const counts = new Map<string, number>();
  for (const item of left) counts.set(item, (counts.get(item) || 0) + 1);
  for (const item of right) {
    const count = counts.get(item) || 0;
    if (count === 0) return false;
    if (count === 1) counts.delete(item);
    else counts.set(item, count - 1);
  }
  return counts.size === 0;
}

function isCommutativeSwap(
  target: DisassembledInstruction,
  compiled: DisassembledInstruction,
  mapping: Map<string, string>,
): boolean {
  if (target.mnemonic !== compiled.mnemonic) return false;
  const indices = COMMUTATIVE.get(target.mnemonic);
  if (!indices) return false;
  const left = normalizedOperands(target, mapping);
  const right = normalizedOperands(compiled);
  if (left.length !== right.length || indices[1] >= left.length) return false;
  [left[indices[0]], left[indices[1]]] = [left[indices[1]], left[indices[0]]];
  return left.every((operand, index) => operand === right[index]);
}

function stripImmediateNoise(value: string): string {
  return value
    .replace(/(^|[^A-Za-z0-9_])-?(?:0x[0-9a-f]+|\d+)/gi, "$1#")
    .replace(/R_MIPS_[A-Z0-9_]+/gi, "R_MIPS_#");
}

function onlyImmediateOrRelocationDifference(
  target: DisassembledInstruction[],
  compiled: DisassembledInstruction[],
  mapping: Map<string, string>,
): boolean {
  if (!opcodesEqual(target, compiled)) return false;
  let foundDifference = false;
  for (let index = 0; index < target.length; index++) {
    const left = canonical(target[index], mapping);
    const right = canonical(compiled[index]);
    if (left === right) continue;
    foundDifference = true;
    if (stripImmediateNoise(left) !== stripImmediateNoise(right)) return false;
  }
  return foundDifference;
}

function registerUse(instruction: DisassembledInstruction): RegisterUse {
  const all = new Set(registersIn(instruction.operandText));
  const defs = new Set<string>();
  const uses = new Set(all);
  const mnemonic = instruction.mnemonic;

  if (DESTINATION_FIRST.has(mnemonic) && instruction.operands.length > 0) {
    const destination = registersIn(instruction.operands[0])[0];
    if (destination) {
      defs.add(destination);
      uses.delete(destination);
    }
  }
  if (mnemonic === "jal" || mnemonic === "bal") defs.add("ra");
  if (mnemonic === "mult" || mnemonic === "multu" || mnemonic === "div" || mnemonic === "divu") {
    defs.add("hi");
    defs.add("lo");
  }
  if (mnemonic === "mfhi") uses.add("hi");
  if (mnemonic === "mflo") uses.add("lo");

  return {
    defs,
    uses,
    memory: LOADS.has(mnemonic) || STORES.has(mnemonic),
    control: BRANCHES.has(mnemonic) || mnemonic === "bal",
  };
}

function intersects(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

function independent(left: DisassembledInstruction, right: DisassembledInstruction): boolean {
  const a = registerUse(left);
  const b = registerUse(right);
  if (a.control || b.control || (a.memory && b.memory)) return false;
  return !intersects(a.defs, b.uses) && !intersects(b.defs, a.uses) && !intersects(a.defs, b.defs);
}

function constantZeroReturn(instruction: DisassembledInstruction): boolean {
  const operands = normalizedOperands(instruction);
  if (instruction.mnemonic === "move") return operands[0] === "v0" && operands[1] === "zero";
  if (instruction.mnemonic === "addu" || instruction.mnemonic === "or") {
    return operands[0] === "v0" && operands[1] === "zero" && operands[2] === "zero";
  }
  if (instruction.mnemonic === "li") return operands[0] === "v0" && /^(?:0x)?0$/.test(operands[1] || "");
  if (instruction.mnemonic === "addiu") {
    return operands[0] === "v0" && operands[1] === "zero" && /^(?:0x)?0$/.test(operands[2] || "");
  }
  return false;
}

function stackRestore(instruction: DisassembledInstruction): boolean {
  if (instruction.mnemonic !== "lw") return false;
  const operands = normalizedOperands(instruction);
  return /^(?:ra|fp|s[0-7])$/.test(operands[0] || "") && (operands[1] || "").includes("(sp)");
}

/** A tiny post-reload rotation often comes from CFG/join provenance, not a
 * scheduler mechanism that should be modelled deeply. Source-level guard and
 * return placement changes can preserve semantics and every body instruction
 * while changing the zero-width notes and basic-block partition seen by
 * sched2. */
function epilogueReturnJoinHint(
  target: DisassembledInstruction[],
  compiled: DisassembledInstruction[],
): string | undefined {
  const targetZero = target.findIndex(constantZeroReturn);
  const compiledZero = compiled.findIndex(constantZeroReturn);
  if (targetZero < 0 || compiledZero < 0) return undefined;

  const targetRestoresAfter = new Set(
    target.slice(targetZero + 1).filter(stackRestore).map((instruction) => canonical(instruction)),
  );
  const crossedRestore = compiled.slice(0, compiledZero)
    .filter(stackRestore)
    .some((instruction) => targetRestoresAfter.has(canonical(instruction)));
  if (!crossedRestore) return undefined;

  const targetReturns = target.slice(targetZero + 1).some((instruction) =>
    instruction.mnemonic === "jr" && normalizedOperands(instruction)[0] === "ra");
  const compiledReturns = compiled.slice(compiledZero + 1).some((instruction) =>
    instruction.mnemonic === "jr" && normalizedOperands(instruction)[0] === "ra");
  if (!targetReturns || !compiledReturns) return undefined;

  return "EPILOGUE RETURN/JOIN SIGNATURE: the target places its constant-zero return before stack restores, " +
    "while the candidate schedules the same return after them. Before deep scheduler-state work, batch a few " +
    "semantics-equivalent CFG forms: invert the predicate into an early-return guard, return from each predecessor, " +
    "and vary whether the common return sits inside or after the conditional. Preserve the target's branch senses " +
    "and body semantics; named constant locals are a separate birth-site experiment and often compile identically.";
}

function orderInversions(
  target: DisassembledInstruction[],
  compiled: DisassembledInstruction[],
  targetKeys: string[],
  compiledKeys: string[],
): { independent: number; dependent: number } {
  const positions = new Map<string, number[]>();
  compiledKeys.forEach((key, index) => {
    const list = positions.get(key) || [];
    list.push(index);
    positions.set(key, list);
  });

  const used = new Map<string, number>();
  const mappedPositions: number[] = [];
  const mappedInstructions: DisassembledInstruction[] = [];
  for (let index = 0; index < targetKeys.length; index++) {
    const key = targetKeys[index];
    const occurrence = used.get(key) || 0;
    const position = positions.get(key)?.[occurrence];
    used.set(key, occurrence + 1);
    if (position === undefined) continue;
    mappedPositions.push(position);
    mappedInstructions.push(target[index]);
  }

  let independentCount = 0;
  let dependentCount = 0;
  for (let left = 0; left < mappedPositions.length; left++) {
    for (let right = left + 1; right < mappedPositions.length; right++) {
      if (mappedPositions[left] <= mappedPositions[right]) continue;
      if (independent(mappedInstructions[left], mappedInstructions[right])) independentCount++;
      else dependentCount++;
    }
  }
  return { independent: independentCount, dependent: dependentCount };
}

function mapToObject(mapping: Map<string, string>, nonIdentityOnly: boolean): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [left, right] of mapping) {
    if (!nonIdentityOnly || left !== right) result[left] = right;
  }
  return result;
}

export function analyzeInstructionSets(
  target: DisassembledInstruction[],
  compiled: DisassembledInstruction[],
): StructuralDiffReport {
  const registerMap = inferRegisterMap(target, compiled);
  const exactMatches = target.filter((instruction, index) =>
    compiled[index] !== undefined && canonical(instruction) === canonical(compiled[index])
  ).length;
  const opcodeMatches = target.filter((instruction, index) =>
    compiled[index] !== undefined && instruction.mnemonic === compiled[index].mnemonic
  ).length;
  const opcodeLcs = lcsLength(
    target.map((instruction) => instruction.mnemonic),
    compiled.map((instruction) => instruction.mnemonic),
  );

  const mappedTarget = target.map((instruction) => canonical(instruction, registerMap));
  const compiledCanonical = compiled.map((instruction) => canonical(instruction));
  const targetIdentity = target.map((instruction) => canonical(instruction));
  const targetWebs = annotateRegisterWebs(target);
  const compiledWebs = annotateRegisterWebs(compiled);
  const webMap = inferWebMap(targetWebs, compiledWebs);
  const mappedTargetWebs = targetWebs.map((item) => mapWebCanonical(item.canonical, webMap));
  const compiledWebCanonical = compiledWebs.map((item) => item.canonical);
  const sameOpcodes = opcodesEqual(target, compiled);
  const moduloRegisters = sameOpcodes && mappedTarget.every((value, index) => value === compiledCanonical[index]);
  const moduloWebs = sameOpcodes && mappedTargetWebs.every((value, index) => value === compiledWebCanonical[index]);
  const exact = targetIdentity.length === compiledCanonical.length &&
    targetIdentity.every((value, index) => value === compiledCanonical[index]);

  let commutativeSwaps = 0;
  const differences: InstructionDifference[] = [];
  const count = Math.max(target.length, compiled.length);
  for (let index = 0; index < count; index++) {
    const left = target[index];
    const right = compiled[index];
    if (left && right && canonical(left) === canonical(right)) continue;
    let kind = "different";
    if (!left || !right) kind = "missing/extra instruction";
    else if (left.mnemonic !== right.mnemonic) kind = "opcode";
    else if (isCommutativeSwap(left, right, registerMap)) {
      kind = "commutative operand order";
      commutativeSwaps++;
    } else if (canonical(left, registerMap) === canonical(right) ||
        mapWebCanonical(targetWebs[index].canonical, webMap) === compiledWebs[index].canonical) {
      kind = "register allocation/live range";
    } else if (stripImmediateNoise(canonical(left, registerMap)) === stripImmediateNoise(canonical(right))) {
      kind = "immediate/relocation";
    } else kind = "operands/registers";
    if (differences.length < 12) {
      differences.push({ index, target: display(left), compiled: display(right), kind });
    }
  }

  const mappedMultiset = sameMultiset(mappedTarget, compiledCanonical);
  const identityMultiset = sameMultiset(targetIdentity, compiledCanonical);
  const webMultiset = sameMultiset(mappedTargetWebs, compiledWebCanonical);
  const opcodeMultiset = sameMultiset(
    target.map((instruction) => instruction.mnemonic),
    compiled.map((instruction) => instruction.mnemonic),
  );
  let inversionTargetKeys: string[] | null = null;
  let inversionCompiledKeys: string[] | null = null;
  if (webMultiset) {
    inversionTargetKeys = mappedTargetWebs;
    inversionCompiledKeys = compiledWebCanonical;
  } else if (mappedMultiset) {
    inversionTargetKeys = mappedTarget;
    inversionCompiledKeys = compiledCanonical;
  } else if (identityMultiset) {
    inversionTargetKeys = targetIdentity;
    inversionCompiledKeys = compiledCanonical;
  }
  const inversions = inversionTargetKeys && inversionCompiledKeys
    ? orderInversions(target, compiled, inversionTargetKeys, inversionCompiledKeys)
    : { independent: 0, dependent: 0 };

  let category: DiffCategory;
  let summary: string;
  if (exact) {
    category = "exact";
    summary = "Instruction streams are byte-structurally identical at object disassembly level.";
  } else if (moduloRegisters || moduloWebs) {
    category = "register-allocation";
    summary = moduloRegisters
      ? "Opcode, operand, and relocation streams match under a consistent hard-register renaming."
      : "Opcode, operand, and relocation streams match when hard-register live ranges are treated as distinct webs.";
  } else if (sameOpcodes && commutativeSwaps > 0 &&
      differences.every((difference) => difference.kind === "commutative operand order" || difference.kind.startsWith("register allocation"))) {
    category = "operand-order";
    summary = "Instruction selection and order match; remaining differences are commutative operand order and register allocation.";
  } else if (onlyImmediateOrRelocationDifference(target, compiled, registerMap)) {
    category = "relocation-or-immediate";
    summary = "Instruction and register structure match; only immediates or relocation annotations differ.";
  } else if (webMultiset || mappedMultiset || identityMultiset) {
    category = "scheduling";
    summary = webMultiset
      ? "The same instructions and register-web roles are present in a different order."
      : "The same normalized instructions are present in a different order.";
  } else if (opcodeMultiset) {
    category = "scheduling-and-operands";
    summary = "Opcode multiset matches, but instruction order and operand/register structure both differ.";
  } else if (sameOpcodes) {
    category = "mixed-operands";
    summary = "Opcode sequence matches, but operand differences are not explained by register webs or commutative swaps.";
  } else {
    category = "instruction-selection";
    summary = "Opcode sequence differs; investigate types, idioms, control flow, or pass-level allocation/reload effects.";
  }

  /* Semantic gates: web parity and value provenance (webAnalysis.ts). */
  const parity = compareWebs(computeWebs(target), computeWebs(compiled));
  const webParity: WebParitySummary = {
    parity: parity.parity,
    matched: parity.matchedCount,
    targetOnly: parity.targetOnly.map(summarizeWeb),
    compiledOnly: parity.compiledOnly.map(summarizeWeb),
    looseMatches: parity.looseMatches.map((pair) =>
      `${summarizeWeb(pair.target)} ~ ${summarizeWeb(pair.compiled)}`),
    entryOnlyTarget: parity.entryOnlyTarget.map(summarizeWeb),
    entryOnlyCompiled: parity.entryOnlyCompiled.map(summarizeWeb),
  };
  const shapePairs = alignByShape(target, compiled);
  const provenanceDivergences: ProvenanceFinding[] = provenanceAudit(target, compiled, shapePairs)
    .slice(0, 8)
    .map((finding) => ({
      targetIndex: finding.targetIndex,
      compiledIndex: finding.compiledIndex,
      register: finding.register,
      reason: finding.reason,
      detail: `at target[${finding.targetIndex}] ${finding.targetText} ~ compiled[${finding.compiledIndex}] ` +
        `${finding.compiledText}: $${finding.register} last def target=[${finding.targetDefIndex < 0 ? "entry" : finding.targetDefIndex}] ` +
        `${finding.targetDefText} vs compiled=[${finding.compiledDefIndex < 0 ? "entry" : finding.compiledDefIndex}] ${finding.compiledDefText}`,
    }));
  const structuralDelta = target.length !== compiled.length
    ? formatBagDelta(bagDelta(target, compiled))
    : [];

  if (!webParity.parity && (category === "scheduling" || category === "scheduling-and-operands" ||
      category === "mixed-operands" || category === "instruction-selection")) {
    summary += " WEB-PARITY FAILURE: the register-web sets differ — the source pseudo population does not" +
      " match the target. Fix source semantics (missing/extra temporaries, wrong value provenance) before" +
      " any allocator or scheduler work.";
  }

  const evidence = [
    `${exactMatches}/${Math.max(target.length, compiled.length)} instructions match exactly by index.`,
    `${opcodeMatches}/${Math.max(target.length, compiled.length)} opcodes match by index; opcode LCS is ${opcodeLcs}.`,
  ];
  if (structuralDelta.length > 0) {
    evidence.push(`STRUCTURAL DELTA (count ${target.length} vs ${compiled.length}): ${structuralDelta.join(" | ")}`);
  }
  if (!webParity.parity) {
    const parts: string[] = [];
    if (webParity.targetOnly.length > 0) parts.push(`${webParity.targetOnly.length} target-only web(s): ${webParity.targetOnly.slice(0, 4).join("; ")}`);
    if (webParity.compiledOnly.length > 0) parts.push(`${webParity.compiledOnly.length} compiled-only web(s): ${webParity.compiledOnly.slice(0, 4).join("; ")}`);
    if (webParity.entryOnlyTarget.length > 0) parts.push(`entry-liveness only in target: ${webParity.entryOnlyTarget.join("; ")}`);
    if (webParity.entryOnlyCompiled.length > 0) parts.push(`entry-liveness only in compiled: ${webParity.entryOnlyCompiled.join("; ")}`);
    evidence.push(`WEB-PARITY FAILURE: ${parts.join(" — ")}.`);
  }
  for (const finding of provenanceDivergences.slice(0, 3)) {
    evidence.push(`PROVENANCE (${finding.reason}): ${finding.detail}.`);
  }
  if (provenanceDivergences.length > 3) {
    evidence.push(`PROVENANCE: ${provenanceDivergences.length - 3} further divergence(s); see provenanceDivergences.`);
  }
  const nonIdentity = mapToObject(registerMap, true);
  const nonIdentityWebs = mapToObject(webMap, true);
  if (Object.keys(nonIdentity).length > 0) {
    evidence.push(`Inferred target→compiled register map: ${Object.entries(nonIdentity).map(([a, b]) => `${a}→${b}`).join(", ")}.`);
  }
  if (Object.keys(nonIdentityWebs).length > 0) {
    const mappings = Object.entries(nonIdentityWebs);
    evidence.push(`Inferred ${mappings.length} target→compiled live-range mappings: ${mappings.slice(0, 8).map(([a, b]) => `${a}→${b}`).join(", ")}${mappings.length > 8 ? ", …" : ""}.`);
  }
  if (commutativeSwaps > 0) evidence.push(`${commutativeSwaps} aligned differences are commutative operand swaps.`);
  if (!exact && inversionTargetKeys) {
    evidence.push(`${inversions.independent} reordered pairs appear register-independent; ${inversions.dependent} are conservatively dependent or memory/control related.`);
  }
  if (category === "scheduling" && webParity.parity) {
    const hint = epilogueReturnJoinHint(target, compiled);
    if (hint) evidence.push(hint);
  }

  return {
    category,
    summary,
    targetCount: target.length,
    compiledCount: compiled.length,
    exactMatches,
    opcodeMatches,
    opcodeLcs,
    registerMap: mapToObject(registerMap, false),
    nonIdentityRegisterMap: nonIdentity,
    webMap: mapToObject(webMap, false),
    nonIdentityWebMap: nonIdentityWebs,
    commutativeSwaps,
    independentOrderInversions: inversions.independent,
    dependentOrderInversions: inversions.dependent,
    differences,
    evidence,
    webParity,
    provenanceDivergences,
    structuralDelta,
  };
}

function printHuman(funcName: string, source: string, report: StructuralDiffReport, artifacts: string): void {
  console.log(`Structural diff: ${funcName}`);
  console.log(`source:      ${source}`);
  console.log(`artifacts:   ${artifacts}`);
  console.log(`target:      ${report.targetCount} instructions`);
  console.log(`compiled:    ${report.compiledCount} instructions\n`);
  console.log(`Classification: ${report.category}`);
  console.log(report.summary);
  for (const item of report.evidence) console.log(`  - ${item}`);

  console.log(`\nWeb parity: ${report.webParity.parity ? "OK" : "FAIL"} (${report.webParity.matched} webs matched)`);
  if (!report.webParity.parity) {
    for (const web of report.webParity.targetOnly) console.log(`  target-only:    ${web}`);
    for (const web of report.webParity.compiledOnly) console.log(`  compiled-only:  ${web}`);
    for (const web of report.webParity.entryOnlyTarget) console.log(`  entry-liveness only in target:   ${web}`);
    for (const web of report.webParity.entryOnlyCompiled) console.log(`  entry-liveness only in compiled: ${web}`);
    console.log("  Unmatched webs mean the source pseudo set differs from the target;");
    console.log("  fix source semantics before allocator/scheduler work.");
  }
  if (report.webParity.looseMatches.length > 0) {
    console.log("  loose matches (same def shape, different use count):");
    for (const pair of report.webParity.looseMatches.slice(0, 4)) console.log(`    ${pair}`);
  }

  if (report.provenanceDivergences.length > 0) {
    console.log("\nValue-provenance divergences (same slot, different defining instruction):");
    for (const finding of report.provenanceDivergences) {
      console.log(`  [${finding.reason}] ${finding.detail}`);
    }
    console.log("  A register NAME matching while its defining instruction differs means the");
    console.log("  compared values are different — re-derive the source expression at that site.");
  }

  if (report.differences.length > 0) {
    console.log("\nFirst differences:");
    for (const difference of report.differences) {
      console.log(`  [${difference.index}] ${difference.kind}`);
      console.log(`    target:   ${difference.target}`);
      console.log(`    compiled: ${difference.compiled}`);
    }
  }
}

function synthetic(mnemonic: string, operands: string[]): DisassembledInstruction {
  return {
    address: 0,
    mnemonic,
    operands,
    operandText: operands.join(","),
    raw: `${mnemonic} ${operands.join(",")}`,
  };
}

function selfTest(): void {
  const exact = [synthetic("addu", ["v0", "a0", "a1"]), synthetic("jr", ["ra"]), synthetic("nop", [])];
  if (analyzeInstructionSets(exact, exact).category !== "exact") throw new Error("exact classification failed");

  const regTarget = [synthetic("lw", ["v0", "0(a0)"]), synthetic("addu", ["v1", "v0", "a1"]), synthetic("jr", ["ra"])];
  const regOurs = [synthetic("lw", ["v1", "0(a0)"]), synthetic("addu", ["v0", "v1", "a1"]), synthetic("jr", ["ra"])];
  if (analyzeInstructionSets(regTarget, regOurs).category !== "register-allocation") {
    throw new Error("register-allocation classification failed");
  }

  const operandTarget = [
    synthetic("sll", ["v0", "a0", "2"]),
    synthetic("addu", ["v1", "v1", "v0"]),
    synthetic("lw", ["v0", "0(v1)"]),
  ];
  const operandOurs = [
    synthetic("sll", ["v0", "a0", "2"]),
    synthetic("addu", ["v1", "v0", "v1"]),
    synthetic("lw", ["v0", "0(v1)"]),
  ];
  if (analyzeInstructionSets(operandTarget, operandOurs).category !== "operand-order") {
    throw new Error("operand-order classification failed");
  }

  const scheduleTarget = [synthetic("lui", ["v0", "0x8006"]), synthetic("sll", ["a0", "a0", "2"]), synthetic("jr", ["ra"])];
  const scheduleOurs = [synthetic("sll", ["a0", "a0", "2"]), synthetic("lui", ["v0", "0x8006"]), synthetic("jr", ["ra"])];
  if (analyzeInstructionSets(scheduleTarget, scheduleOurs).category !== "scheduling") {
    throw new Error("scheduling classification failed");
  }

  const epilogueTarget = [
    synthetic("move", ["v0", "zero"]),
    synthetic("lw", ["ra", "44(sp)"]),
    synthetic("lw", ["s0", "40(sp)"]),
    synthetic("jr", ["ra"]),
  ];
  const epilogueOurs = [
    synthetic("lw", ["ra", "44(sp)"]),
    synthetic("lw", ["s0", "40(sp)"]),
    synthetic("move", ["v0", "zero"]),
    synthetic("jr", ["ra"]),
  ];
  const epilogueReport = analyzeInstructionSets(epilogueTarget, epilogueOurs);
  if (epilogueReport.category !== "scheduling" ||
      !epilogueReport.evidence.some((item) => item.includes("EPILOGUE RETURN/JOIN SIGNATURE"))) {
    throw new Error("epilogue return/join scheduling hint failed");
  }

  /* Web parity + provenance: the func_800241EC signature in miniature.
     Target masks a value into $a1 before using it; the compiled side uses the
     stale entry $a1 — same register name, different defining instruction. */
  const provenanceTarget = [
    synthetic("lw", ["v1", "0(sp)"]),
    synthetic("andi", ["a1", "v1", "0xffff"]),
    synthetic("addu", ["v0", "a2", "a1"]),
    synthetic("jr", ["ra"]),
  ];
  const provenanceOurs = [
    synthetic("lw", ["v1", "0(sp)"]),
    synthetic("addu", ["v0", "a2", "a1"]),
    synthetic("jr", ["ra"]),
  ];
  const provenanceReport = analyzeInstructionSets(provenanceTarget, provenanceOurs);
  if (provenanceReport.webParity.parity) throw new Error("web parity should fail on a missing andi web");
  if (!provenanceReport.webParity.targetOnly.some((web) => web.includes("andi"))) {
    throw new Error("web parity should name the target-only andi web");
  }
  if (!provenanceReport.provenanceDivergences.some((finding) =>
    finding.register === "a1" && finding.reason === "entry-vs-defined")) {
    throw new Error("provenance audit should flag $a1 entry-vs-defined divergence");
  }
  if (provenanceReport.structuralDelta.length === 0) {
    throw new Error("structural delta should decompose the count mismatch");
  }

  const cleanReport = analyzeInstructionSets(provenanceTarget, provenanceTarget);
  if (!cleanReport.webParity.parity || cleanReport.provenanceDivergences.length > 0) {
    throw new Error("identical streams must have clean web parity and provenance");
  }

  /* A pure allocation rotation must NOT trip either gate. */
  const rotationTarget = [
    synthetic("andi", ["a1", "v1", "0xffff"]),
    synthetic("addu", ["v0", "a2", "a1"]),
    synthetic("jr", ["ra"]),
  ];
  const rotationOurs = [
    synthetic("andi", ["t0", "v1", "0xffff"]),
    synthetic("addu", ["v0", "a2", "t0"]),
    synthetic("jr", ["ra"]),
  ];
  const rotationReport = analyzeInstructionSets(rotationTarget, rotationOurs);
  if (!rotationReport.webParity.parity) throw new Error("allocation rotation must keep web parity");
  if (rotationReport.provenanceDivergences.length > 0) {
    throw new Error("allocation rotation must not trip the provenance audit");
  }
  console.log("explainDiff self-test: OK");
}

function usage(): never {
  console.error("Usage: npx tsx tools/agent/explainDiff.ts <func> [--src <file>] [--json] [--no-overrides]");
  console.error("       npx tsx tools/agent/explainDiff.ts --self-test");
  process.exit(1);
}

const isCLI = process.argv[1]?.endsWith("explainDiff.ts");
if (isCLI) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    selfTest();
  } else {
    const sourceIndex = args.indexOf("--src");
    const requestedSource = sourceIndex >= 0 ? args[sourceIndex + 1] : undefined;
    const positional = args.filter((arg, index) =>
      !arg.startsWith("--") && (sourceIndex < 0 || index !== sourceIndex + 1)
    );
    if (positional.length !== 1) usage();

    const funcName = normalizeFunctionName(positional[0]);
    try {
      const source = resolveSource(funcName, requestedSource);
      const outputDirectory = join(ROOT, "build/explainDiff", funcName);
      rmSync(outputDirectory, { recursive: true, force: true });
      const compiled = compileSource(source, outputDirectory, funcName, {
        assemble: true,
        useOverrides: !args.includes("--no-overrides"),
      });
      const targetObject = assembleTarget(funcName, outputDirectory);
      const report = analyzeInstructionSets(
        disassembleObject(targetObject),
        disassembleObject(compiled.object!),
      );
      if (args.includes("--json")) {
        console.log(JSON.stringify({
          function: funcName,
          source: relative(ROOT, source),
          artifacts: relative(ROOT, outputDirectory),
          ...report,
        }, null, 2));
      } else {
        printHuman(funcName, relative(ROOT, source), report, relative(ROOT, outputDirectory));
      }
    } catch (error: any) {
      console.error(`explainDiff: ${error.message}`);
      process.exit(1);
    }
  }
}
