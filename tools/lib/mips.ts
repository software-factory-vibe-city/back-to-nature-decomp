/**
 * mips.ts — MIPS I / R3000 instruction primitives shared by the container tools.
 *
 * Scans over raw container bytes cannot assume they are looking at code, so
 * every helper here is total: it decodes a word or reports that the word is not
 * that instruction. The RAM-range check exists because embedded data words
 * whose top six bits happen to be opcode 3 look exactly like `jal`, and the
 * measured false-positive floor is around 1% of all `jal`-shaped words.
 */

/** PS1 main RAM, KSEG0. Two megabytes at 0x80000000. */
export const RAM_START = 0x80000000;
export const RAM_END = 0x80200000;

export function isValidRamAddress(address: number): boolean {
  return address >= RAM_START && address < RAM_END;
}

/** A code address must additionally be word-aligned. */
export function isPlausibleCodeAddress(address: number): boolean {
  return isValidRamAddress(address) && (address & 3) === 0;
}

export const OP = {
  SPECIAL: 0x00,
  REGIMM: 0x01,
  J: 0x02,
  JAL: 0x03,
  BEQ: 0x04,
  BNE: 0x05,
  BLEZ: 0x06,
  BGTZ: 0x07,
  ADDI: 0x08,
  ADDIU: 0x09,
  LUI: 0x0f,
  COP0: 0x10,
  COP2: 0x12,
  LWC2: 0x32,
  SWC2: 0x3a,
} as const;

export const REG_ZERO = 0;
export const REG_SP = 29;
export const REG_GP = 28;
export const REG_RA = 31;

export function opcodeOf(word: number): number {
  return (word >>> 26) & 0x3f;
}
export function rsOf(word: number): number {
  return (word >>> 21) & 0x1f;
}
export function rtOf(word: number): number {
  return (word >>> 16) & 0x1f;
}
export function rdOf(word: number): number {
  return (word >>> 11) & 0x1f;
}
export function functOf(word: number): number {
  return word & 0x3f;
}
export function immOf(word: number): number {
  return word & 0xffff;
}
export function signedImmOf(word: number): number {
  const imm = word & 0xffff;
  return imm >= 0x8000 ? imm - 0x10000 : imm;
}

/** `jal` target: the top four PC bits with the 26-bit index shifted left two. */
export function jalTarget(word: number, pc: number): number | null {
  if (opcodeOf(word) !== OP.JAL) return null;
  return (((pc & 0xf0000000) >>> 0) | ((word & 0x03ffffff) << 2)) >>> 0;
}

/** `j` target, same encoding as `jal`. */
export function jTarget(word: number, pc: number): number | null {
  if (opcodeOf(word) !== OP.J) return null;
  return (((pc & 0xf0000000) >>> 0) | ((word & 0x03ffffff) << 2)) >>> 0;
}

export function isJrRa(word: number): boolean {
  return opcodeOf(word) === OP.SPECIAL && functOf(word) === 0x08 && rsOf(word) === REG_RA && (word & 0x001fffc0) === 0;
}

/** `addiu $sp, $sp, -N` — the stack-frame prologue every non-leaf function opens with. */
export function isStackPrologue(word: number): boolean {
  return (
    opcodeOf(word) === OP.ADDIU && rsOf(word) === REG_SP && rtOf(word) === REG_SP && signedImmOf(word) < 0
  );
}

/** `lui $rt, imm`. */
export function luiTarget(word: number): { reg: number; hi: number } | null {
  if (opcodeOf(word) !== OP.LUI || rsOf(word) !== 0) return null;
  return { reg: rtOf(word), hi: immOf(word) };
}

const SPECIAL_FUNCTS = new Set([
  0x00, 0x02, 0x03, 0x04, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x10, 0x11, 0x12, 0x13,
  0x18, 0x19, 0x1a, 0x1b, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x2a, 0x2b,
]);

const REGIMM_RTS = new Set([0x00, 0x01, 0x10, 0x11]);

/* Opcodes MIPS I defines outside SPECIAL/REGIMM/COPz. Anything else is not an
   instruction on an R3000, which is the point: the ratio of decodable words is
   what separates a code member from a data member. */
const PRIMARY_OPCODES = new Set([
  0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
  0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x28, 0x29, 0x2a, 0x2b, 0x2e,
  0x31, 0x32, 0x39, 0x3a,
]);

/** Does the word decode as an instruction an R3000 can execute? */
export function isDecodableInstruction(word: number): boolean {
  const op = opcodeOf(word);
  if (op === OP.SPECIAL) return SPECIAL_FUNCTS.has(functOf(word));
  if (op === OP.REGIMM) return REGIMM_RTS.has(rtOf(word));
  if (op === OP.COP0 || op === OP.COP2) return true;
  return PRIMARY_OPCODES.has(op);
}

export interface LuiPair {
  /** File offset of the `lui`. */
  offset: number;
  /** Resolved 32-bit address. */
  address: number;
  /** Instruction that supplied the low half. */
  kind: "addiu" | "load" | "store" | "ori";
}

const LOW_HALF_LOADS = new Set([0x20, 0x21, 0x23, 0x24, 0x25, 0x22, 0x26, 0x31, 0x32]);
const LOW_HALF_STORES = new Set([0x28, 0x29, 0x2b, 0x2a, 0x2e, 0x39, 0x3a]);

/**
 * Reconstruct `lui`+low-half address pairs over a byte range.
 *
 * A `lui` is matched to the first later instruction that consumes its register
 * as a base or source with a 16-bit displacement, within a short window, and
 * the pair is abandoned if anything else redefines the register first. This is
 * the same reconstruction the RAM-map measurement in the plan used.
 */
export function findLuiPairs(bytes: Buffer, windowSize = 8): LuiPair[] {
  const pairs: LuiPair[] = [];
  const words = Math.floor(bytes.length / 4);
  for (let i = 0; i < words; i++) {
    const word = bytes.readUInt32LE(i * 4);
    const lui = luiTarget(word);
    if (!lui) continue;
    for (let j = i + 1; j < Math.min(i + 1 + windowSize, words); j++) {
      const next = bytes.readUInt32LE(j * 4);
      const op = opcodeOf(next);

      if (op === OP.ADDIU && rsOf(next) === lui.reg) {
        pairs.push({ offset: i * 4, address: (((lui.hi << 16) + signedImmOf(next)) >>> 0), kind: "addiu" });
        break;
      }
      if (op === 0x0d && rsOf(next) === lui.reg) {
        pairs.push({ offset: i * 4, address: (((lui.hi << 16) | immOf(next)) >>> 0), kind: "ori" });
        break;
      }
      if (LOW_HALF_LOADS.has(op) && rsOf(next) === lui.reg) {
        pairs.push({ offset: i * 4, address: (((lui.hi << 16) + signedImmOf(next)) >>> 0), kind: "load" });
        break;
      }
      if (LOW_HALF_STORES.has(op) && rsOf(next) === lui.reg) {
        pairs.push({ offset: i * 4, address: (((lui.hi << 16) + signedImmOf(next)) >>> 0), kind: "store" });
        break;
      }

      /* The register was redefined before any low half consumed it, so this
         lui belongs to a pair the window cannot see. Do not guess one. */
      if (definesRegister(next, lui.reg)) break;
    }
  }
  return pairs;
}

/** Does the instruction write the given register? Conservative: unknown encodings say yes. */
function definesRegister(word: number, reg: number): boolean {
  const op = opcodeOf(word);
  if (op === OP.SPECIAL) {
    const funct = functOf(word);
    if (funct === 0x08) return false; // jr
    if (funct === 0x10 || funct === 0x12) return rdOf(word) === reg; // mfhi/mflo
    if (funct === 0x18 || funct === 0x19 || funct === 0x1a || funct === 0x1b) return false; // mult/div
    return rdOf(word) === reg;
  }
  if (op === OP.REGIMM || op === OP.J || op === OP.BEQ || op === OP.BNE || op === OP.BLEZ || op === OP.BGTZ) {
    return false;
  }
  if (op === OP.JAL) return reg === REG_RA;
  if (op >= 0x28 && op <= 0x3f) return false; // stores and coprocessor stores
  return rtOf(word) === reg;
}
