import type { NormalizedInstruction } from "../variant-lab/types.js";
import type {
  InstructionCorrespondence,
  MachineInstructionRef,
  RegisterRoleMap,
} from "./types.js";

const REGISTERS = new Set([
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra",
]);

function registers(operand: string): string[] {
  return [...operand.matchAll(/(?:^|[^a-z0-9_])(zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|fp|ra)(?=$|[^a-z0-9_])/gi)]
    .map((match) => match[1]!.toLowerCase());
}

function roleOperand(operand: string): string {
  return operand.toLowerCase().replace(/(?:^|(?<=[^a-z0-9_]))(?:zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|fp|ra)(?=$|[^a-z0-9_])/g, "<reg>");
}

export function machineRefs(instructions: NormalizedInstruction[]): MachineInstructionRef[] {
  return instructions.map((instruction, index) => {
    const result: MachineInstructionRef = {
      index,
      canonical: instruction.canonical,
      mnemonic: instruction.mnemonic,
      operands: instruction.operands,
    };
    if (instruction.relocation) result.relocation = instruction.relocation;
    return result;
  });
}

function lcsPairs(target: MachineInstructionRef[], candidate: MachineInstructionRef[]): Array<[number, number]> {
  const rows = target.length + 1;
  const cols = candidate.length + 1;
  const table = Array.from({ length: rows }, () => new Uint16Array(cols));
  for (let left = target.length - 1; left >= 0; left--) {
    for (let right = candidate.length - 1; right >= 0; right--) {
      table[left]![right] = target[left]!.canonical === candidate[right]!.canonical
        ? table[left + 1]![right + 1]! + 1
        : Math.max(table[left + 1]![right]!, table[left]![right + 1]!);
    }
  }
  const result: Array<[number, number]> = [];
  let left = 0;
  let right = 0;
  while (left < target.length && right < candidate.length) {
    if (target[left]!.canonical === candidate[right]!.canonical) {
      result.push([left++, right++]);
    } else if (table[left + 1]![right]! >= table[left]![right + 1]!) left++;
    else right++;
  }
  return result;
}

function inferRegisterMap(
  target: MachineInstructionRef[],
  candidate: MachineInstructionRef[],
  pairs: Array<[number, number]>,
): Map<string, string> {
  const weights = new Map<string, Map<string, number>>();
  const allPairs = [...pairs];
  const count = Math.min(target.length, candidate.length);
  for (let index = 0; index < count; index++) {
    if (target[index]!.mnemonic === candidate[index]!.mnemonic) allPairs.push([index, index]);
  }
  for (const [leftIndex, rightIndex] of allPairs) {
    const left = target[leftIndex]!;
    const right = candidate[rightIndex]!;
    if (left.mnemonic !== right.mnemonic) continue;
    for (let operand = 0; operand < Math.min(left.operands.length, right.operands.length); operand++) {
      const a = registers(left.operands[operand]!);
      const b = registers(right.operands[operand]!);
      for (let occurrence = 0; occurrence < Math.min(a.length, b.length); occurrence++) {
        const row = weights.get(a[occurrence]!) || new Map<string, number>();
        row.set(b[occurrence]!, (row.get(b[occurrence]!) || 0) + (leftIndex === rightIndex ? 2 : 1));
        weights.set(a[occurrence]!, row);
      }
    }
  }
  const choices: Array<{ left: string; right: string; weight: number }> = [];
  for (const [left, row] of weights) {
    for (const [right, weight] of row) choices.push({ left, right, weight: weight + (left === right ? 1 : 0) });
  }
  choices.sort((a, b) => b.weight - a.weight || a.left.localeCompare(b.left) || a.right.localeCompare(b.right));
  const result = new Map<string, string>();
  const used = new Set<string>();
  for (const choice of choices) {
    if (result.has(choice.left) || used.has(choice.right)) continue;
    result.set(choice.left, choice.right);
    used.add(choice.right);
  }
  return result;
}

function mapRegisters(value: string, mapping: Map<string, string>): string {
  return value.replace(/(?:^|(?<=[^a-z0-9_]))(zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|fp|ra)(?=$|[^a-z0-9_])/gi,
    (register) => mapping.get(register.toLowerCase()) || register.toLowerCase());
}

function similarity(left: MachineInstructionRef, right: MachineInstructionRef, mapping: Map<string, string>): number {
  if (left.canonical === right.canonical) return 100;
  if (left.mnemonic !== right.mnemonic || left.operands.length !== right.operands.length) return 0;
  const mapped = `${left.mnemonic} ${left.operands.map((operand) => mapRegisters(operand, mapping)).join(",")}`;
  if (mapped === right.canonical) return 90;
  if (left.operands.every((operand, index) => roleOperand(operand) === roleOperand(right.operands[index]!))) return 70;
  let matchingOperands = 0;
  for (let index = 0; index < left.operands.length; index++) {
    if (roleOperand(left.operands[index]!) === roleOperand(right.operands[index]!)) matchingOperands++;
  }
  return 40 + Math.floor(20 * matchingOperands / Math.max(1, left.operands.length));
}

export interface MachineAlignment {
  correspondence: InstructionCorrespondence[];
  registerRoles: RegisterRoleMap[];
  registerMap: Map<string, string>;
}

export function alignMachineInstructions(
  target: MachineInstructionRef[],
  candidate: MachineInstructionRef[],
  window = 32,
): MachineAlignment {
  const exactPairs = lcsPairs(target, candidate);
  const registerMap = inferRegisterMap(target, candidate, exactPairs);
  const assignedTarget = new Map<number, InstructionCorrespondence>();
  const assignedCandidate = new Set<number>();
  for (const [targetIndex, candidateIndex] of exactPairs) {
    const canonical = target[targetIndex]!.canonical;
    const duplicateTarget = target.filter((item) => item.canonical === canonical).length > 1;
    const duplicateCandidate = candidate.filter((item) => item.canonical === canonical).length > 1;
    const ambiguous = duplicateTarget || duplicateCandidate;
    assignedTarget.set(targetIndex, {
      targetIndex,
      candidateIndex,
      confidence: ambiguous ? "inferred" : "exact",
      evidence: [
        "Exact canonical instruction/relocation match in the order-preserving LCS.",
        ...(ambiguous ? ["The canonical instruction is duplicated in at least one stream; occurrence identity remains ambiguous."] : []),
      ],
    });
    assignedCandidate.add(candidateIndex);
  }

  const candidates: Array<{ targetIndex: number; candidateIndex: number; score: number; distance: number }> = [];
  for (let targetIndex = 0; targetIndex < target.length; targetIndex++) {
    if (assignedTarget.has(targetIndex)) continue;
    for (let candidateIndex = Math.max(0, targetIndex - window); candidateIndex < Math.min(candidate.length, targetIndex + window + 1); candidateIndex++) {
      if (assignedCandidate.has(candidateIndex)) continue;
      const score = similarity(target[targetIndex]!, candidate[candidateIndex]!, registerMap);
      if (score >= 55) candidates.push({ targetIndex, candidateIndex, score, distance: Math.abs(targetIndex - candidateIndex) });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.distance - b.distance || a.targetIndex - b.targetIndex || a.candidateIndex - b.candidateIndex);
  for (const match of candidates) {
    if (assignedTarget.has(match.targetIndex) || assignedCandidate.has(match.candidateIndex)) continue;
    const ties = candidates.filter((other) =>
      other.targetIndex === match.targetIndex && other.score === match.score && other.distance === match.distance &&
      !assignedCandidate.has(other.candidateIndex)
    );
    const ambiguous = ties.length > 1;
    assignedTarget.set(match.targetIndex, {
      targetIndex: match.targetIndex,
      candidateIndex: match.candidateIndex,
      confidence: ambiguous ? "inferred" : match.score >= 90 ? "reconstructed" : "inferred",
      evidence: [
        match.score >= 90
          ? "Opcode/operand roles match under the inferred target-to-candidate hard-register map."
          : "Bounded mismatch-window matching found the same opcode and normalized operand roles.",
        ...(ambiguous ? ["Duplicate candidates have equal score and distance; correspondence is ambiguous."] : []),
      ],
    });
    assignedCandidate.add(match.candidateIndex);
  }

  const correspondence: InstructionCorrespondence[] = target.map((_instruction, targetIndex) =>
    assignedTarget.get(targetIndex) || {
      targetIndex,
      confidence: "inferred",
      evidence: ["No candidate instruction met the bounded correspondence threshold; no mapping was forced."],
    }
  );

  const roleIndexes = new Map<string, { target: number[]; candidate: number[] }>();
  for (const item of correspondence) {
    if (item.candidateIndex === undefined) continue;
    const left = target[item.targetIndex]!;
    const right = candidate[item.candidateIndex]!;
    if (left.mnemonic !== right.mnemonic) continue;
    for (let operand = 0; operand < Math.min(left.operands.length, right.operands.length); operand++) {
      const a = registers(left.operands[operand]!);
      const b = registers(right.operands[operand]!);
      for (let occurrence = 0; occurrence < Math.min(a.length, b.length); occurrence++) {
        const key = `${a[occurrence]}:${b[occurrence]}`;
        const value = roleIndexes.get(key) || { target: [], candidate: [] };
        value.target.push(item.targetIndex);
        value.candidate.push(item.candidateIndex);
        roleIndexes.set(key, value);
      }
    }
  }
  const registerRoles = [...roleIndexes].map(([key, indexes]) => {
    const [targetRegister, candidateRegister] = key.split(":");
    return {
      targetRegister: targetRegister!,
      candidateRegister: candidateRegister!,
      targetIndexes: [...new Set(indexes.target)].sort((a, b) => a - b),
      candidateIndexes: [...new Set(indexes.candidate)].sort((a, b) => a - b),
      pseudos: [],
      confidence: (registerMap.get(targetRegister!) === candidateRegister ? "reconstructed" : "inferred") as "reconstructed" | "inferred",
      evidence: ["Register role reconstructed from corresponding opcode operand positions."],
    } satisfies RegisterRoleMap;
  }).sort((a, b) => a.targetRegister.localeCompare(b.targetRegister) || a.candidateRegister.localeCompare(b.candidateRegister));

  return { correspondence, registerRoles, registerMap };
}
