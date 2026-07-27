import type { DisassembledInstruction } from "../decompToolchain.js";
import type {
  PseudoProvenance,
  RegisterRecurrenceHint,
  RtlInstruction,
} from "./types.js";
import { hardRegisterName } from "./rtl-parser.js";

const DESTINATION_FIRST = new Set([
  "add", "addu", "addiu", "sub", "subu", "and", "andi", "or", "ori",
  "xor", "xori", "nor", "slt", "sltu", "slti", "sltiu", "sll", "sllv",
  "sra", "srav", "srl", "srlv", "lui", "move", "mfhi", "mflo",
  "lbu", "lb", "lhu", "lh", "lw", "lwl", "lwr",
]);

const REGISTER_NUMBERS = new Map<string, number>([
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra",
].map((name, index) => [name, index]));

function destinationRegister(instruction: DisassembledInstruction): string | undefined {
  if (!DESTINATION_FIRST.has(instruction.mnemonic) || instruction.operands.length === 0) return undefined;
  const operand = instruction.operands[0].toLowerCase();
  const named = operand.match(/\$?([a-z][a-z0-9]*)/);
  if (named && REGISTER_NUMBERS.has(named[1])) return named[1];
  const numeric = operand.match(/\$(\d+)/);
  if (numeric) return hardRegisterName(parseInt(numeric[1], 10));
  return undefined;
}

function lcsPairs<T, U>(
  left: T[],
  right: U[],
  equal: (left: T, right: U) => boolean,
): Array<[number, number]> {
  const lengths = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      lengths[i]![j] = equal(left[i]!, right[j]!)
        ? lengths[i + 1]![j + 1]! + 1
        : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
    }
  }
  const result: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (equal(left[i]!, right[j]!)) {
      result.push([i++, j++]);
    } else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  return result;
}

function expectedMnemonics(instruction: RtlInstruction): Set<string> {
  if (instruction.control) {
    if (instruction.text.includes("(return)")) return new Set(["jr"]);
    if (instruction.text.includes("(if_then_else")) {
      return new Set(["beq", "bne", "beqz", "bnez", "bgez", "bltz", "bgtz", "blez"]);
    }
    if (instruction.text.includes("(label_ref")) return new Set(["j"]);
  }
  if (instruction.memoryWrite) {
    const mode = instruction.text.match(/\(mem(?:\/[a-z]+)*:(QI|HI|SI)/i)?.[1]?.toUpperCase();
    return new Set([mode === "QI" ? "sb" : mode === "HI" ? "sh" : "sw"]);
  }
  if (instruction.memoryRead) {
    const mode = instruction.text.match(/\(mem(?:\/[a-z]+)*:(QI|HI|SI)/i)?.[1]?.toUpperCase();
    if (mode === "QI") return new Set(instruction.text.includes("zero_extend") ? ["lbu"] : ["lb"]);
    if (mode === "HI") return new Set(instruction.text.includes("zero_extend") ? ["lhu"] : ["lh"]);
    return new Set(["lw"]);
  }
  switch (instruction.operation) {
    case "plus": return new Set(instruction.expression?.includes("const_int") ? ["addiu"] : ["addu"]);
    case "minus": return new Set(["subu"]);
    case "and": return new Set(instruction.expression?.includes("const_int") ? ["andi", "and"] : ["and"]);
    case "ior": return new Set(instruction.expression?.includes("const_int") ? ["ori", "or"] : ["or"]);
    case "xor": return new Set(["xor", "xori"]);
    case "ashift": return new Set(["sll"]);
    case "ashiftrt": return new Set(["sra"]);
    case "lshiftrt": return new Set(["srl"]);
    case "const_int": return new Set(["addiu", "lui", "ori"]);
    case "reg": return new Set(["addu", "or", "move"]);
    default: return new Set();
  }
}

function mapCandidateInstructionsToUids(
  candidate: DisassembledInstruction[],
  finalRtl: RtlInstruction[],
): Map<number, number> {
  const emitted = finalRtl.filter((instruction) => expectedMnemonics(instruction).size > 0);
  const pairs = lcsPairs(emitted, candidate, (rtl, assembly) =>
    expectedMnemonics(rtl).has(assembly.mnemonic)
  );
  return new Map(pairs.map(([rtlIndex, candidateIndex]) => [candidateIndex, emitted[rtlIndex]!.uid]));
}

function nonOverlapping(left: PseudoProvenance, right: PseudoProvenance): boolean {
  if (left.lifetimes.length === 0 || right.lifetimes.length === 0) return false;
  return !left.lifetimes.some((a) => right.lifetimes.some((b) =>
    a.block === b.block && a.birthIndex <= b.deathIndex && b.birthIndex <= a.deathIndex
  ));
}

interface DefinitionEvidence {
  targetIndex: number;
  candidateIndex: number;
  targetRegister: string;
  candidateRegister: string;
  pseudo: number;
  uid: number;
  mnemonic: string;
}

export function findTargetRegisterRecurrences(
  target: DisassembledInstruction[],
  candidate: DisassembledInstruction[],
  finalRtl: RtlInstruction[],
  preAllocationRtl: RtlInstruction[],
  pseudos: PseudoProvenance[],
): RegisterRecurrenceHint[] {
  const candidateToUid = mapCandidateInstructionsToUids(candidate, finalRtl);
  const preAllocationByUid = new Map(preAllocationRtl.map((instruction) => [instruction.uid, instruction]));
  const pseudoByNumber = new Map(pseudos.map((pseudo) => [pseudo.pseudo, pseudo]));
  const aligned = lcsPairs(target, candidate, (left, right) => left.mnemonic === right.mnemonic);
  const definitions: DefinitionEvidence[] = [];

  for (const [targetIndex, candidateIndex] of aligned) {
    const targetRegister = destinationRegister(target[targetIndex]!);
    const candidateRegister = destinationRegister(candidate[candidateIndex]!);
    const uid = candidateToUid.get(candidateIndex);
    if (!targetRegister || !candidateRegister || uid === undefined) continue;
    const pseudo = preAllocationByUid.get(uid)?.sets.find((reference) => reference.register >= 80)?.register;
    if (pseudo === undefined) continue;
    definitions.push({
      targetIndex,
      candidateIndex,
      targetRegister,
      candidateRegister,
      pseudo,
      uid,
      mnemonic: candidate[candidateIndex]!.mnemonic,
    });
  }

  const hints: RegisterRecurrenceHint[] = [];
  const seen = new Set<string>();
  for (let leftIndex = 0; leftIndex < definitions.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < definitions.length; rightIndex++) {
      const left = definitions[leftIndex];
      const right = definitions[rightIndex];
      if (!left || !right || left.targetRegister !== right.targetRegister) continue;
      if (left.pseudo === right.pseudo || left.candidateRegister === right.candidateRegister) continue;
      if (right.targetIndex - left.targetIndex < 3) continue;
      const leftPseudo = pseudoByNumber.get(left.pseudo);
      const rightPseudo = pseudoByNumber.get(right.pseudo);
      if (!leftPseudo || !rightPseudo || !nonOverlapping(leftPseudo, rightPseudo)) continue;
      const key = `${left.targetRegister}:${left.pseudo}:${right.pseudo}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hints.push({
        targetRegister: left.targetRegister,
        firstTargetIndex: left.targetIndex,
        secondTargetIndex: right.targetIndex,
        firstCandidateRegister: left.candidateRegister,
        secondCandidateRegister: right.candidateRegister,
        firstPseudo: left.pseudo,
        secondPseudo: right.pseudo,
        confidence: "inferred",
        message: `Target $${left.targetRegister} recurs at ${left.mnemonic} #${left.targetIndex} and ${right.mnemonic} #${right.targetIndex}, while the candidate uses separate non-overlapping pseudos ${left.pseudo}/${right.pseudo}. Consider testing one shared C variable; this is an experiment, not a conclusion.`,
        evidence: [
          `Candidate hard registers: $${left.candidateRegister} then $${right.candidateRegister}.`,
          `Mapped RTL UIDs: ${left.uid} and ${right.uid}.`,
          "The pseudo mapping uses opcode LCS plus final-RTL UID alignment and is therefore inferred.",
        ],
      });
    }
  }
  const score = (hint: RegisterRecurrenceHint): number => {
    let value = hint.secondTargetIndex - hint.firstTargetIndex;
    if (hint.message.includes("at addu ")) value += 30;
    if (hint.message.includes(" and or ")) value += 80;
    if (pseudoByNumber.get(hint.firstPseudo)?.userVariable) value += 10;
    return value;
  };
  hints.sort((left, right) => score(right) - score(left));
  return hints.slice(0, 12);
}
