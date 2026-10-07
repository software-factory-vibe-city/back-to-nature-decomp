/** Raw-word vocabulary shared by macro recognition and recurrence mining.
 * Registers in COP2 operands are NOT general-purpose registers. Unknown words
 * are barriers, never instructions a matcher is allowed to skip. */
import { decodeWord } from "../agent/matching-reconstruction/decode.js";

export type AtomKind = "gpr" | "cop" | "imm" | "word" | "address";
export interface Atom { kind: AtomKind; value: number }
export interface MacroInstruction {
  vram: number;
  word: number;
  op: string;
  args: Atom[];
  reads: number[];
  writes: number[];
  control: boolean;
  memory: boolean;
  target: number | null;
}
export const hex = (n: number): string => `0x${(n >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
const g = (value: number): Atom => ({ kind: "gpr", value });
const c = (value: number): Atom => ({ kind: "cop", value });
const i = (value: number): Atom => ({ kind: "imm", value });
export const isCop2 = (insn: MacroInstruction): boolean => /^(?:[cm][ft]c2|[ls]wc2|cop2|bc2)$/.test(insn.op);
/** Architectural GTE function vocabulary, not SDK macro expansions. Keep the
 * complete command word as the match atom; mnemonic alone is not an identity. */
export function cop2Mnemonic(insn: MacroInstruction): string {
  if (insn.op !== "cop2") return insn.op;
  const functions: Record<number, string> = { 0x01: "rtps", 0x06: "nclip", 0x0c: "op", 0x10: "dpcs", 0x11: "intpl", 0x12: "mvmva", 0x13: "ncds", 0x14: "cdp", 0x16: "ncdt", 0x1b: "nccs", 0x1c: "cc", 0x1e: "ncs", 0x20: "nct", 0x28: "sqr", 0x29: "dcpl", 0x2a: "dpct", 0x2d: "avsz3", 0x2e: "avsz4", 0x30: "rtpt", 0x3d: "gpf", 0x3e: "gpl", 0x3f: "ncct" };
  return functions[insn.word & 63] ?? "cop2";
}
export const instructionKey = (insn: Pick<MacroInstruction, "op" | "args">): string =>
  `${insn.op} ${insn.args.map(a => `${a.kind}:${a.value}`).join(",")}`;

export function decodeMacroInstruction(word: number, vram: number): MacroInstruction {
  const d = decodeWord(word, vram);
  const op = word >>> 26;
  const rs = d.rs, rt = d.rt, rd = d.rd;
  const result: MacroInstruction = { vram, word, op: d.op, args: [], reads: [], writes: [], control: false, memory: false, target: d.target ?? null };
  if (op === 0x12) {
    if (rs >= 16) {
      result.op = "cop2";
      result.args = [{ kind: "word", value: word >>> 0 }];
    } else if ([0, 2, 4, 6].includes(rs) && (word & 0x7ff) === 0) {
      result.op = ({ 0: "mfc2", 2: "cfc2", 4: "mtc2", 6: "ctc2" } as Record<number, string>)[rs]!;
      result.args = [g(rt), c(rd)];
      if (rs < 4) result.writes = [rt]; else result.reads = [rt];
    } else if (rs === 8) {
      result.op = "bc2";
      result.control = true;
      result.target = (vram + 4 + d.simm * 4) >>> 0;
      result.args = [i(rt), { kind: "address", value: result.target }];
    }
    return result;
  }
  if (op === 0x32 || op === 0x3a) {
    return { ...result, op: op === 0x32 ? "lwc2" : "swc2", args: [c(rt), i(d.simm), g(rs)], reads: [rs], memory: true };
  }
  if (result.op === "unknown") return { ...result, args: [{ kind: "word", value: word >>> 0 }] };
  if (/^(?:lb|lbu|lh|lhu|lw|lwl|lwr|sb|sh|sw|swl|swr)$/.test(d.op)) {
    result.memory = true;
    result.args = [g(rt), i(d.simm), g(rs)];
    if (d.op.startsWith("l")) { result.reads = [rs]; result.writes = [rt]; }
    else result.reads = [rt, rs];
  } else if (/^(?:sll|srl|sra)$/.test(d.op)) {
    result.args = [g(rd), g(rt), i(d.shamt)]; result.reads = [rt]; result.writes = [rd];
  } else if (/^(?:sllv|srlv|srav)$/.test(d.op)) {
    result.args = [g(rd), g(rt), g(rs)]; result.reads = [rt, rs]; result.writes = [rd];
  } else if (/^(?:addu|subu|and|or|xor|nor|slt|sltu)$/.test(d.op)) {
    if ((word & 63) === 0x20) result.op = "add";
    if ((word & 63) === 0x22) result.op = "sub";
    result.args = [g(rd), g(rs), g(rt)]; result.reads = [rs, rt]; result.writes = [rd];
  } else if (/^(?:addiu|addi|slti|sltiu|andi|ori|xori)$/.test(d.op)) {
    result.args = [g(rt), g(rs), i(/^(?:andi|ori|xori)$/.test(d.op) ? d.uimm : d.simm)]; result.reads = [rs]; result.writes = [rt];
  } else if (d.op === "lui") { result.args = [g(rt), i(d.uimm)]; result.writes = [rt]; }
  else if (d.op === "mfhi" || d.op === "mflo") { result.args = [g(rd)]; result.writes = [rd]; }
  else if (/^(?:mult|multu|div|divu)$/.test(d.op)) { result.args = [g(rs), g(rt)]; result.reads = [rs, rt]; }
  else if (/^(?:beq|bne|blez|bgtz|bltz|bgez)$/.test(d.op)) {
    result.control = true;
    result.reads = d.op === "beq" || d.op === "bne" ? [rs, rt] : [rs];
    result.args = [...result.reads.map(g), { kind: "address", value: d.target! }];
  } else if (d.op === "j" || d.op === "jal") {
    result.control = true; result.args = [{ kind: "address", value: d.target! }];
    if (d.op === "jal") result.writes = [31];
  } else if (d.op === "jr" || d.op === "jalr") {
    result.control = true; result.reads = [rs]; result.args = d.op === "jr" ? [g(rs)] : [g(rd), g(rs)];
    if (d.op === "jalr") result.writes = [rd];
  } else if (d.op === "break") { result.args = [i(d.code!)]; result.control = true; }
  return result;
}

export function decodeMacroBytes(bytes: Buffer, vram: number): MacroInstruction[] {
  if (bytes.length % 4 !== 0 || vram % 4 !== 0) throw new Error("Macro code must be word-aligned");
  const result: MacroInstruction[] = [];
  for (let offset = 0; offset < bytes.length; offset += 4) result.push(decodeMacroInstruction(bytes.readUInt32LE(offset), vram + offset));
  return result;
}

export const REGISTER_NAMES = ["zero", "at", "v0", "v1", "a0", "a1", "a2", "a3", "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra"];
export function registerNumber(text: string): number | null {
  const value = text.replace(/^\$/, "").trim();
  if (/^\d+$/.test(value) && Number(value) < 32) return Number(value);
  const index = REGISTER_NAMES.indexOf(value === "s8" ? "fp" : value);
  return index < 0 ? null : index;
}
