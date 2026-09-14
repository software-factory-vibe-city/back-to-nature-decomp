/**
 * R3000 integer-subset decoder over raw words.
 *
 * The engine works from original bytes (plan §3: target facts), so it decodes
 * the words itself rather than parsing rendered disassembly — a renderer's
 * symbolization choices must not leak into the facts. Anything outside the
 * subset decodes to `unknown`, which consumers treat as an explicit unsupported
 * case, never as a skippable line.
 */

export const REGISTER_NAMES = [
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra",
] as const;

export type DecodedOp =
  /* arithmetic and logic */
  | "addu" | "subu" | "and" | "or" | "xor" | "nor" | "slt" | "sltu"
  | "sll" | "srl" | "sra" | "sllv" | "srlv" | "srav"
  | "addiu" | "addi" | "slti" | "sltiu" | "andi" | "ori" | "xori" | "lui"
  /* multiply / divide */
  | "mult" | "multu" | "div" | "divu" | "mfhi" | "mflo"
  /* memory */
  | "lb" | "lbu" | "lh" | "lhu" | "lw"
  | "sb" | "sh" | "sw"
  /* control */
  | "beq" | "bne" | "blez" | "bgtz" | "bltz" | "bgez"
  | "j" | "jal" | "jr" | "jalr"
  /* exceptional exit — the compiler's divide guard emits one of these */
  | "break"
  /* unaligned word access: the backend's expansion of an unaligned load/store */
  | "lwl" | "lwr" | "swl" | "swr"
  | "nop"
  | "unknown";

export interface DecodedInsn {
  vram: number;
  word: number;
  op: DecodedOp;
  /** Register indices; meaning depends on `op`'s format. */
  rs: number;
  rt: number;
  rd: number;
  shamt: number;
  /** Sign-extended 16-bit immediate. */
  simm: number;
  /** Zero-extended 16-bit immediate. */
  uimm: number;
  /** Absolute target for j/jal, branch target for branches. */
  target?: number;
  /** The 20-bit code field of a `break`. */
  code?: number;
}

const LOAD_OPS = new Set<DecodedOp>(["lb", "lbu", "lh", "lhu", "lw"]);
const STORE_OPS = new Set<DecodedOp>(["sb", "sh", "sw"]);
/** The backend's unaligned-access pair; each half is one instruction. */
const UNALIGNED_OPS = new Set<DecodedOp>(["lwl", "lwr", "swl", "swr"]);

export const isUnaligned = (op: DecodedOp): boolean => UNALIGNED_OPS.has(op);
export const isUnalignedLoad = (op: DecodedOp): boolean => op === "lwl" || op === "lwr";
export const isUnalignedStore = (op: DecodedOp): boolean => op === "swl" || op === "swr";
const BRANCH_OPS = new Set<DecodedOp>(["beq", "bne", "blez", "bgtz", "bltz", "bgez"]);

export const isLoad = (op: DecodedOp): boolean => LOAD_OPS.has(op);
export const isStore = (op: DecodedOp): boolean => STORE_OPS.has(op);
export const isBranch = (op: DecodedOp): boolean => BRANCH_OPS.has(op);

export function loadWidth(op: DecodedOp): 1 | 2 | 4 {
  return op === "lw" ? 4 : op === "lh" || op === "lhu" ? 2 : 1;
}

/**
 * The general-purpose register an instruction writes, or null when it writes
 * none. `"unknown"` answers `"unknown"`, because an undecoded word may write
 * anything and a caller must not read "writes nothing" from "we cannot tell".
 *
 * A recogniser that follows register *names* — "the value stored came from the
 * register this load filled" — is only sound if nothing redefined that register
 * in between, and answering that needs the whole vocabulary rather than the
 * handful of opcodes a given recogniser expects. The switch is exhaustive over
 * `DecodedOp` on purpose: adding an opcode without deciding what it writes is
 * a type error here, not a silent "writes nothing" elsewhere.
 */
export function definedRegister(insn: DecodedInsn): number | "unknown" | null {
  const nonZero = (register: number): number | null => (register === 0 ? null : register);
  switch (insn.op) {
    case "addu": case "subu": case "and": case "or": case "xor": case "nor":
    case "slt": case "sltu": case "sll": case "srl": case "sra":
    case "sllv": case "srlv": case "srav": case "mfhi": case "mflo":
      return nonZero(insn.rd);
    case "addiu": case "addi": case "slti": case "sltiu":
    case "andi": case "ori": case "xori": case "lui":
    case "lb": case "lbu": case "lh": case "lhu": case "lw":
    case "lwl": case "lwr":
      return nonZero(insn.rt);
    case "jalr":
      return nonZero(insn.rd === 0 ? 31 : insn.rd);
    case "jal":
      return 31;
    /* A call clobbers the caller-saved set; `jal`/`jalr` above name only the
     * link register, so callers that care about clobbers must consult the ABI.
     * Everything below writes no general-purpose register. */
    case "sb": case "sh": case "sw": case "swl": case "swr":
    case "beq": case "bne": case "blez": case "bgtz": case "bltz": case "bgez":
    case "j": case "jr": case "break": case "nop":
    case "mult": case "multu": case "div": case "divu":
      return null;
    case "unknown":
      return "unknown";
  }
}

export function loadSigned(op: DecodedOp): boolean {
  return op === "lb" || op === "lh" || op === "lw";
}

const SPECIAL_FUNCTS: Record<number, DecodedOp> = {
  0x00: "sll", 0x02: "srl", 0x03: "sra",
  0x04: "sllv", 0x06: "srlv", 0x07: "srav",
  0x08: "jr", 0x09: "jalr",
  0x0d: "break",
  0x10: "mfhi", 0x12: "mflo",
  0x18: "mult", 0x19: "multu", 0x1a: "div", 0x1b: "divu",
  0x21: "addu", 0x23: "subu",
  0x24: "and", 0x25: "or", 0x26: "xor", 0x27: "nor",
  0x2a: "slt", 0x2b: "sltu",
  /* `addu`/`subu` and their trapping twins encode the same operation here. */
  0x20: "addu", 0x22: "subu",
};

const OPCODE_OPS: Record<number, DecodedOp> = {
  0x02: "j", 0x03: "jal",
  0x04: "beq", 0x05: "bne", 0x06: "blez", 0x07: "bgtz",
  0x08: "addi", 0x09: "addiu", 0x0a: "slti", 0x0b: "sltiu",
  0x0c: "andi", 0x0d: "ori", 0x0e: "xori", 0x0f: "lui",
  0x20: "lb", 0x21: "lh", 0x22: "lwl", 0x23: "lw", 0x24: "lbu", 0x25: "lhu", 0x26: "lwr",
  0x28: "sb", 0x29: "sh", 0x2a: "swl", 0x2b: "sw", 0x2e: "swr",
};

export function decodeWord(word: number, vram: number): DecodedInsn {
  const opcode = (word >>> 26) & 0x3f;
  const rs = (word >>> 21) & 0x1f;
  const rt = (word >>> 16) & 0x1f;
  const rd = (word >>> 11) & 0x1f;
  const shamt = (word >>> 6) & 0x1f;
  const uimm = word & 0xffff;
  const simm = uimm & 0x8000 ? uimm - 0x10000 : uimm;

  const base: DecodedInsn = { vram, word, op: "unknown", rs, rt, rd, shamt, simm, uimm };

  if (word === 0) return { ...base, op: "nop" };

  if (opcode === 0) {
    const funct = word & 0x3f;
    const op = SPECIAL_FUNCTS[funct];
    if (op === "break") return { ...base, op, code: (word >>> 6) & 0xfffff };
    return op ? { ...base, op } : base;
  }

  if (opcode === 1) {
    /* REGIMM: only the plain, non-linking zero comparisons. */
    if (rt === 0x00) return { ...base, op: "bltz", target: vram + 4 + (simm << 2) };
    if (rt === 0x01) return { ...base, op: "bgez", target: vram + 4 + (simm << 2) };
    return base;
  }

  const op = OPCODE_OPS[opcode];
  if (!op) return base;

  if (op === "j" || op === "jal") {
    const target = ((vram + 4) & 0xf0000000) | ((word & 0x03ffffff) << 2);
    return { ...base, op, target: target >>> 0 };
  }
  if (isBranch(op)) return { ...base, op, target: vram + 4 + (simm << 2) };
  return { ...base, op };
}

export function decodeFunction(words: Array<{ raw: number; vram: number }>): DecodedInsn[] {
  return words.map((word) => decodeWord(word.raw, word.vram));
}
