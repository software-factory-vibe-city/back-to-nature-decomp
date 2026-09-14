/**
 * A minimal two-pass assembler for test fixtures: enough MIPS to write
 * synthetic scan functions as data, so the executor and the relation fitter
 * can be exercised across parameterized shapes without touching the tree.
 * Test-support code, not a production assembler.
 */

import { REGISTER_NAMES } from "./decode.js";

export type AsmLine =
  | [op: "label", name: string]
  | [op: string, ...operands: Array<string | number>];

const registerIndex = (name: string): number => {
  const index = (REGISTER_NAMES as readonly string[]).indexOf(name);
  if (index < 0) throw new Error(`unknown register ${name}`);
  return index;
};

/** Assemble to raw words at a base address. Branch operands name labels. */
export function assemble(lines: AsmLine[], baseVram: number): Array<{ raw: number; vram: number }> {
  const labels = new Map<string, number>();
  let vram = baseVram;
  for (const line of lines) {
    if (line[0] === "label") labels.set(line[1] as string, vram);
    else vram += 4;
  }

  const words: Array<{ raw: number; vram: number }> = [];
  vram = baseVram;
  const reg = (value: string | number): number => (typeof value === "number" ? value : registerIndex(value));
  const imm16 = (value: string | number): number => Number(value) & 0xffff;
  const branchOffset = (label: string | number): number => {
    const target = labels.get(String(label));
    if (target === undefined) throw new Error(`unknown label ${label}`);
    return ((target - (vram + 4)) >> 2) & 0xffff;
  };

  for (const line of lines) {
    const [op, ...operands] = line;
    if (op === "label") continue;
    let word: number;
    switch (op) {
      case "nop": word = 0; break;
      case "addu": word = (reg(operands[1]!) << 21) | (reg(operands[2]!) << 16) | (reg(operands[0]!) << 11) | 0x21; break;
      case "or": word = (reg(operands[1]!) << 21) | (reg(operands[2]!) << 16) | (reg(operands[0]!) << 11) | 0x25; break;
      case "subu": word = (reg(operands[1]!) << 21) | (reg(operands[2]!) << 16) | (reg(operands[0]!) << 11) | 0x23; break;
      case "slt": word = (reg(operands[1]!) << 21) | (reg(operands[2]!) << 16) | (reg(operands[0]!) << 11) | 0x2a; break;
      case "sltu": word = (reg(operands[1]!) << 21) | (reg(operands[2]!) << 16) | (reg(operands[0]!) << 11) | 0x2b; break;
      case "mult": word = (reg(operands[0]!) << 21) | (reg(operands[1]!) << 16) | 0x18; break;
      case "multu": word = (reg(operands[0]!) << 21) | (reg(operands[1]!) << 16) | 0x19; break;
      case "div": word = (reg(operands[0]!) << 21) | (reg(operands[1]!) << 16) | 0x1a; break;
      case "divu": word = (reg(operands[0]!) << 21) | (reg(operands[1]!) << 16) | 0x1b; break;
      case "mfhi": word = (reg(operands[0]!) << 11) | 0x10; break;
      case "mflo": word = (reg(operands[0]!) << 11) | 0x12; break;
      case "jr": word = (reg(operands[0]!) << 21) | 0x08; break;
      case "break": word = ((Number(operands[0] ?? 0) & 0xfffff) << 6) | 0x0d; break;
      case "lwl": word = (0x22 << 26) | (reg(operands[2]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "lwr": word = (0x26 << 26) | (reg(operands[2]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "swl": word = (0x2a << 26) | (reg(operands[2]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "swr": word = (0x2e << 26) | (reg(operands[2]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "sll": word = (reg(operands[1]!) << 16) | (reg(operands[0]!) << 11) | ((Number(operands[2]) & 31) << 6); break;
      case "sra": word = (reg(operands[1]!) << 16) | (reg(operands[0]!) << 11) | ((Number(operands[2]) & 31) << 6) | 0x03; break;
      case "addiu": word = (0x09 << 26) | (reg(operands[1]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[2]!); break;
      case "slti": word = (0x0a << 26) | (reg(operands[1]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[2]!); break;
      case "andi": word = (0x0c << 26) | (reg(operands[1]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[2]!); break;
      case "ori": word = (0x0d << 26) | (reg(operands[1]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[2]!); break;
      case "lui": word = (0x0f << 26) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "lb": word = (0x20 << 26) | (reg(operands[2]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "lh": word = (0x21 << 26) | (reg(operands[2]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "lw": word = (0x23 << 26) | (reg(operands[2]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "lbu": word = (0x24 << 26) | (reg(operands[2]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "lhu": word = (0x25 << 26) | (reg(operands[2]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "sh": word = (0x29 << 26) | (reg(operands[2]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "sw": word = (0x2b << 26) | (reg(operands[2]!) << 21) | (reg(operands[0]!) << 16) | imm16(operands[1]!); break;
      case "beq": word = (0x04 << 26) | (reg(operands[0]!) << 21) | (reg(operands[1]!) << 16) | branchOffset(operands[2]!); break;
      case "bne": word = (0x05 << 26) | (reg(operands[0]!) << 21) | (reg(operands[1]!) << 16) | branchOffset(operands[2]!); break;
      case "blez": word = (0x06 << 26) | (reg(operands[0]!) << 21) | branchOffset(operands[1]!); break;
      case "bgtz": word = (0x07 << 26) | (reg(operands[0]!) << 21) | branchOffset(operands[1]!); break;
      case "bltz": word = (0x01 << 26) | (reg(operands[0]!) << 21) | branchOffset(operands[1]!); break;
      case "bgez": word = (0x01 << 26) | (reg(operands[0]!) << 21) | (0x01 << 16) | branchOffset(operands[1]!); break;
      case "jal": word = (0x03 << 26) | ((Number(operands[0]) >>> 2) & 0x03ffffff); break;
      case "j": {
        const target = labels.get(String(operands[0]));
        if (target === undefined) throw new Error(`unknown label ${operands[0]}`);
        word = (0x02 << 26) | ((target >>> 2) & 0x03ffffff);
        break;
      }
      default:
        throw new Error(`fixture assembler does not know ${op}`);
    }
    words.push({ raw: word >>> 0, vram });
    vram += 4;
  }
  return words;
}
