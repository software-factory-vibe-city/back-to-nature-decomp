import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  compileSource,
  splitOperands,
  type CompileArtifacts,
  type DisassembledInstruction,
} from "../decompToolchain.js";
import { preserveSource, writeStableJson } from "./artifacts.js";
import { loadPassSnapshots } from "./pass-diff.js";
import type {
  NormalizedInstruction,
  PassSnapshot,
  PassStage,
  ResolvedVariantHypothesis,
} from "./types.js";

const HARD_REGISTER_NAMES = [
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra",
];

function canonicalNumbers(operand: string): string {
  return operand.replace(/(?<![A-Za-z0-9_])-?(0x[0-9a-f]+|\d+)/gi, (match) => String(Number(match)));
}

function canonicalSymbol(symbol: string): string {
  const normalized = symbol.toLowerCase().replace(/\s*[+-]\s*0x[0-9a-f]+$/, "");
  const address = normalized.match(/([0-9a-f]{8})$/);
  return address ? address[1] : normalized;
}

function normalizeBranch(mnemonic: string, operands: string[]): { mnemonic: string; operands: string[] } {
  let normalizedMnemonic = mnemonic;
  let normalizedOperands = [...operands];
  if ((mnemonic === "beq" || mnemonic === "bne") && normalizedOperands[1] === "zero") {
    normalizedMnemonic = mnemonic === "beq" ? "beqz" : "bnez";
    normalizedOperands.splice(1, 1);
  }
  const conditional = new Set([
    "beq", "beqz", "bne", "bnez", "bgez", "bgtz", "blez", "bltz", "bgezal", "bltzal",
  ]);
  if ((conditional.has(normalizedMnemonic) || normalizedMnemonic === "b" || normalizedMnemonic === "j") && normalizedOperands.length > 0) {
    normalizedOperands[normalizedOperands.length - 1] = "<branch-target>";
  }
  return { mnemonic: normalizedMnemonic, operands: normalizedOperands };
}

/* cc1 spells negation as the base instruction (`subu $t0,$zero,$a1`) while the
 * disassembler prints the alias (`negu t0,a1`) for the identical encoding, so a
 * byte-exact candidate reads as a divergence unless both sides collapse. Only
 * aliases with exactly one encoding belong here: `negu`/`neg` qualify, `move`
 * does not (it is `addu` or `or`, which are different words). */
function normalizeAlias(mnemonic: string, operands: string[]): { mnemonic: string; operands: string[] } {
  if ((mnemonic === "subu" || mnemonic === "sub") && operands.length === 3 && operands[1] === "zero") {
    return { mnemonic: mnemonic === "subu" ? "negu" : "neg", operands: [operands[0], operands[2]] };
  }
  return { mnemonic, operands };
}

export function parseCc1Assembly(path: string): NormalizedInstruction[] {
  const instructions: NormalizedInstruction[] = [];
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line || line.startsWith(".") || line.endsWith(":")) continue;
    const match = line.match(/^([a-z][a-z0-9.]*)\s*(.*?)\s*$/i);
    if (!match) continue;
    let mnemonic = match[1].toLowerCase();
    let operands = (match[2] ? splitOperands(match[2]) : []).map((operand) =>
      operand.toLowerCase().replace(/\s+/g, "").replace(/\$(\d+|[a-z][a-z0-9]*)/g, (_whole, register: string) =>
        /^\d+$/.test(register) ? HARD_REGISTER_NAMES[Number(register)] ?? `$${register}` : register,
      ),
    );
    if (mnemonic === "j" && operands.length === 1 && operands[0] === "ra") mnemonic = "jr";
    if ((mnemonic === "sll" || mnemonic === "srl" || mnemonic === "sra") &&
        operands.length === 3 && HARD_REGISTER_NAMES.includes(operands[2])) mnemonic = `${mnemonic}v`;
    if ((mnemonic === "addu" || mnemonic === "add") && operands.length === 3 && /^-?(?:0x[0-9a-f]+|\d+)$/i.test(operands[2])) {
      mnemonic = "addiu";
    }
    if ((mnemonic === "sltu" || mnemonic === "slt") && operands.length === 3 && /^-?(?:0x[0-9a-f]+|\d+)$/i.test(operands[2])) {
      mnemonic = mnemonic === "sltu" ? "sltiu" : "slti";
    }
    operands = operands.map((operand) => {
      const relocation = operand.match(/^%(hi|lo)\((.+)\)$/);
      return relocation ? `%${relocation[1]}(${canonicalSymbol(relocation[2])})` : canonicalNumbers(operand);
    });
    const branch = normalizeBranch(mnemonic, operands);
    const alias = normalizeAlias(branch.mnemonic, branch.operands);
    mnemonic = alias.mnemonic;
    operands = alias.operands;
    if (mnemonic === "li" && operands.length === 2 && /^-?\d+$/.test(operands[1])) {
      const value = Number(operands[1]);
      if (value < -32768 || value > 65535) {
        const unsigned = value >>> 0;
        const upper = unsigned >>> 16;
        const lower = unsigned & 0xffff;
        const luiOperands = [operands[0], String(upper)];
        instructions.push({ mnemonic: "lui", operands: luiOperands, canonical: `lui ${luiOperands.join(",")}` });
        if (lower !== 0) {
          const oriOperands = [operands[0], operands[0], String(lower)];
          instructions.push({ mnemonic: "ori", operands: oriOperands, canonical: `ori ${oriOperands.join(",")}` });
        }
        continue;
      }
    }
    instructions.push({ mnemonic, operands, canonical: `${mnemonic} ${operands.join(",")}` });
  }
  return instructions;
}

export function normalizeDisassembly(instructions: DisassembledInstruction[]): NormalizedInstruction[] {
  return instructions.map((instruction) => {
    let operands = instruction.operands.map((operand) => operand.toLowerCase().replace(/\s+/g, "").replace(/\$/g, ""));
    let relocation: string | undefined;
    if (instruction.relocation) {
      const kind = /hi/i.test(instruction.relocation.type) ? "hi" : "lo";
      const symbol = canonicalSymbol(instruction.relocation.symbol);
      relocation = `%${kind}(${symbol})`;
      operands = operands.map((operand) =>
        /^-?(0x[0-9a-f]+|\d+)(\(.+\))?$/.test(operand)
          ? operand.replace(/^-?(0x[0-9a-f]+|\d+)/, relocation!)
          : operand,
      );
    }
    operands = operands.map((operand) => operand.startsWith("%") ? operand : canonicalNumbers(operand));
    const branch = normalizeBranch(instruction.mnemonic, operands);
    const alias = normalizeAlias(branch.mnemonic, branch.operands);
    return {
      mnemonic: alias.mnemonic,
      operands: alias.operands,
      relocation,
      canonical: `${alias.mnemonic} ${alias.operands.join(",")}`,
    };
  });
}

export function compareNormalized(target: NormalizedInstruction[], compiled: NormalizedInstruction[]): {
  exact: number;
  total: number;
  category: string;
  firstDivergence?: string;
} {
  const total = Math.max(target.length, compiled.length);
  let exact = 0;
  let firstDivergence: string | undefined;
  let category = "exact";
  for (let index = 0; index < total; index++) {
    const left = target[index];
    const right = compiled[index];
    if (left && right && left.canonical === right.canonical) {
      exact++;
      continue;
    }
    if (!firstDivergence) {
      firstDivergence = `[${index}] ${left?.canonical ?? "<missing>"} vs ${right?.canonical ?? "<missing>"}`;
      category = !left || !right ? "instruction-selection"
        : left.mnemonic !== right.mnemonic ? "scheduling/selection"
        : "operands";
    }
  }
  return { exact, total, category, firstDivergence };
}

export interface CompiledVariant {
  artifacts: CompileArtifacts;
  passes?: Map<PassStage, PassSnapshot>;
  normalizedAssembly: NormalizedInstruction[];
}

export function compileVariant(options: {
  functionName: string;
  hypothesis: ResolvedVariantHypothesis;
  outputDirectory: string;
  cc1Only: boolean;
  tracePasses: boolean;
}): CompiledVariant {
  mkdirSync(options.outputDirectory, { recursive: true });
  preserveSource(options.hypothesis.absoluteSourcePath, join(options.outputDirectory, "source.c"));
  const artifacts = compileSource(
    options.hypothesis.absoluteSourcePath,
    options.outputDirectory,
    options.functionName,
    { dumps: options.tracePasses, assemble: !options.cc1Only },
  );
  const normalizedAssembly = parseCc1Assembly(artifacts.assembly);
  const result: CompiledVariant = { artifacts, normalizedAssembly };
  if (options.tracePasses) result.passes = loadPassSnapshots(options.outputDirectory, options.functionName);
  return result;
}

export function writeNormalizedComparison(
  outputDirectory: string,
  target: NormalizedInstruction[],
  compiled: NormalizedInstruction[],
): void {
  writeStableJson(join(outputDirectory, "comparison.json"), { target, compiled });
}
