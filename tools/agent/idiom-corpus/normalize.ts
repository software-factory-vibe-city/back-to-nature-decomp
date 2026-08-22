/**
 * normalize.ts — three tiers of instruction shape, for retrieval.
 *
 * The query a decompiler actually has on day one is the *target assembly*; the
 * thing it lacks is the C. Raw words are the wrong key — registers, immediates,
 * branch targets and relocations all vary between two instances of one idiom —
 * so retrieval runs over normalized token sequences instead. Which normalization
 * decides everything, and there is no single right answer, so there are three
 * and a hit says which tier produced it.
 *
 *   tier 0 — shape.      `addiu <s>,<s>,<lo16>`
 *                        Survives: same compiler, same flags, same assembler.
 *   tier 1 — op class.   `ADDR_LO`, `LOAD_BYTE`, `CALL`, `BRANCH_EQ`, …
 *                        Survives: assembler macro differences. An ASPSX `la`
 *                        expanding to lui/addiu under -G0 and one addiu under
 *                        -G8 collapse to the same class.
 *   tier 2 — structure.  Control-flow role only, no instruction detail.
 *                        Survives nearly everything, including a different game.
 *
 * Three decisions inside tier 0 decide whether any of this works:
 *
 *  - **Register class, not a bare `<reg>`.** The signal in
 *    `ovl_10_func_800BB264` was that the target held an address in `s0`
 *    (callee-saved, live across a `jal`) where the candidate used `v0`.
 *    Collapse both to `<reg>` and that bit is gone. `MirInsn.shape` does
 *    exactly that, which is why this module does not build on it.
 *  - **Bucket immediates; do not keep them and do not drop them.**
 *    `addiu <s>,<s>,-17844` must match `addiu <s>,<s>,-18324` — the same idiom
 *    over a different global — while `addiu <s>,<s>,1` stays distinct from
 *    `addiu <s>,<s>,16`, because a stride is not an offset. Keeping the literal
 *    makes every global a different idiom; dropping it makes every constant the
 *    same one.
 *  - **Weight by inverse document frequency, later.** Prologue and epilogue
 *    stores, `jal` + `addiu <a>,<hi>` pairs and `lw <ra>,<stkoff>(<sp>)` appear
 *    in nearly every function and carry no information. That belongs to the
 *    index, not to the normalizer, but the normalizer has to keep them
 *    distinguishable for it to down-weight them.
 */

import type { MirInsn } from "../pipeline-reversal/types.js";

export type Tier = 0 | 1 | 2;

/**
 * Register classes, o32.
 *
 * The distinction that matters is caller-saved versus callee-saved versus
 * argument versus return, because that is what a source-level lifetime decides.
 * Individual register numbers within a class are the allocator's business and
 * vary between two correct programs.
 */
export function registerClass(register: string): string {
  const name = register.replace(/^\$/, "");
  if (name === "zero" || name === "0") return "<zero>";
  if (name === "sp") return "<sp>";
  if (name === "ra") return "<ra>";
  if (name === "fp" || name === "s8") return "<s>";
  if (name === "gp") return "<gp>";
  if (name === "at") return "<at>";
  if (/^v[01]$/.test(name)) return "<v>";
  if (/^a[0-3]$/.test(name)) return "<a>";
  if (/^t[0-9]$/.test(name)) return "<t>";
  if (/^s[0-7]$/.test(name)) return "<s>";
  if (/^k[01]$/.test(name)) return "<k>";
  if (/^f\d+$/.test(name)) return "<f>";
  return "<reg>";
}

/**
 * A register operand.
 *
 * The numeric form (`$4`) requires the `$`. Without that requirement a bare
 * immediate of `1` or `16` reads as register 1 or 16, and every small constant
 * in the corpus — a loop stride, a shift amount, a stack displacement — is
 * indexed as a register. That silently destroys the immediate buckets, which
 * are half of what tier 0 is for.
 */
const REGISTER = /^(?:\$(?:zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|s8|k[01]|gp|sp|fp|ra|\d{1,2})|zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|s8|k[01]|gp|sp|fp|ra)$/;

/**
 * Immediate buckets.
 *
 * `<stkoff>` is deliberately separate from `<small>`: a stack displacement is a
 * frame fact, and two functions with different frames use different numbers for
 * the same idiom. It is only recognisable in context (the base register is
 * `$sp`), so the caller passes that in.
 */
export function bucketImmediate(value: number, options: { stackRelative?: boolean } = {}): string {
  if (options.stackRelative) return "<stkoff>";
  if (value === 0) return "0";
  if (value === 1) return "1";
  if (value === -1) return "-1";
  const magnitude = Math.abs(value);
  if (magnitude === 0xff || magnitude === 0xf0 || magnitude === 0x7f || magnitude === 0xf ||
      magnitude === 0xffff || magnitude === 0x80) {
    return "<mask>";
  }
  if (magnitude < 16) return "<small>";
  if ((magnitude & (magnitude - 1)) === 0) return "<pow2>";
  /* A 16-bit-signed immediate is a %lo or a small constant; anything wider was
     built by a lui and is a high half. */
  if (value >= -0x8000 && value <= 0x7fff) return "<lo16>";
  return "<hi16>";
}

function parseImmediate(token: string): number | undefined {
  if (/^-?0x[0-9a-f]+$/i.test(token)) return Number.parseInt(token, 16);
  if (/^-?\d+$/.test(token)) return Number.parseInt(token, 10);
  return undefined;
}

/**
 * One instruction at tier 0.
 *
 * Built from the mnemonic and the rendered operands rather than from
 * `MirInsn.shape`, which masks every register to `<reg>` and keeps every
 * immediate literally — the opposite of what retrieval needs on both counts.
 */
export function tier0(insn: MirInsn): string {
  const operands = insn.operands.map((operand) => normalizeOperand(operand, insn));
  return operands.length > 0 ? `${insn.mnemonic} ${operands.join(",")}` : insn.mnemonic;
}

function normalizeOperand(operand: string, insn: MirInsn): string {
  const token = operand.trim();

  /* `disp(base)` — a memory reference. The stack is its own bucket. */
  const memory = token.match(/^(-?(?:0x)?[0-9a-fA-F]+)\((\$?\w+)\)$/);
  if (memory) {
    const base = registerClass(memory[2]!);
    const value = parseImmediate(memory[1]!) ?? 0;
    return `${bucketImmediate(value, { stackRelative: base === "<sp>" })}(${base})`;
  }

  if (REGISTER.test(token)) return registerClass(token);

  const immediate = parseImmediate(token);
  if (immediate !== undefined) return bucketImmediate(immediate);

  /* A branch or jump target, a symbol, a relocation. Where the instruction
     names a symbol, say whether it is this function's own code or somebody
     else's data — a local branch and a call to another translation unit are
     different idioms, and the name itself never transfers. */
  if (insn.isBranch || insn.isJump) return "<label>";
  if (insn.isCall) return "<call>";
  return "<sym>";
}

/**
 * Operation classes — tier 1.
 *
 * Coarse enough that an assembler macro expanding differently under a different
 * `-G` threshold, or a different ASPSX version, collapses to the same token.
 */
export function tier1(insn: MirInsn): string {
  const mnemonic = insn.mnemonic;
  if (insn.isNop) return "NOP";
  if (insn.isCall) return "CALL";
  if (insn.isBranch) {
    if (/^b(eq|eqz)/.test(mnemonic)) return "BRANCH_EQ";
    if (/^b(ne|nez)/.test(mnemonic)) return "BRANCH_NE";
    if (/^b(gez|gtz|lez|ltz)/.test(mnemonic)) return "BRANCH_CMP0";
    return "BRANCH";
  }
  if (insn.isJump) return mnemonic === "jr" ? "RETURN_OR_TABLEJUMP" : "JUMP";
  if (insn.isLoad) {
    if (/^lb/.test(mnemonic)) return "LOAD_BYTE";
    if (/^lh/.test(mnemonic)) return "LOAD_HALF";
    return "LOAD_WORD";
  }
  if (insn.isStore) {
    if (mnemonic === "sb") return "STORE_BYTE";
    if (mnemonic === "sh") return "STORE_HALF";
    return "STORE_WORD";
  }
  if (mnemonic === "lui") return "ADDR_HI";
  /* `addiu <reg>,<reg>,<lo16>` after a lui is the low half of an address; the
     same encoding with a small constant is arithmetic. The symbol decides. */
  if (mnemonic === "addiu" && insn.symbol) return "ADDR_LO";
  if (mnemonic === "move" || mnemonic === "li") return "COPY";
  if (/^(add|addu|addiu|sub|subu)$/.test(mnemonic)) return "ADD";
  if (/^(and|andi|or|ori|xor|xori|nor)$/.test(mnemonic)) return "LOGIC";
  if (/^(sll|srl|sra|sllv|srlv|srav)$/.test(mnemonic)) return "SHIFT";
  if (/^(slt|sltu|slti|sltiu)$/.test(mnemonic)) return "COMPARE";
  if (/^(mult|multu|div|divu|mfhi|mflo|mthi|mtlo)$/.test(mnemonic)) return "MULDIV";
  return "OTHER";
}

/**
 * Structural role — tier 2.
 *
 * No instruction detail at all: what the block does in the control-flow graph
 * and how many operations of each broad kind it holds. This is the tier that is
 * worth anything to a different game on day one, because it survives a
 * different compiler as well as a different author.
 */
export function tier2(insns: readonly MirInsn[]): string {
  const calls = insns.filter((insn) => insn.isCall).length;
  const loads = insns.filter((insn) => insn.isLoad).length;
  const stores = insns.filter((insn) => insn.isStore).length;
  const branches = insns.filter((insn) => insn.isBranch).length;
  return `blk(n=${bucketCount(insns.length)},call=${bucketCount(calls)},ld=${bucketCount(loads)},st=${bucketCount(stores)},br=${bucketCount(branches)})`;
}

function bucketCount(value: number): string {
  if (value === 0) return "0";
  if (value === 1) return "1";
  if (value <= 3) return "2-3";
  if (value <= 7) return "4-7";
  if (value <= 15) return "8-15";
  return "16+";
}

/** Every tier's token sequence for one run of instructions. */
export interface NormalizedRegion {
  tier0: string[];
  tier1: string[];
  tier2: string;
}

export function normalize(insns: readonly MirInsn[]): NormalizedRegion {
  return {
    tier0: insns.map(tier0),
    tier1: insns.map(tier1),
    tier2: tier2(insns),
  };
}

/** Tokens at one tier, for callers that only want one. */
export function tokensAt(insns: readonly MirInsn[], tier: Tier): string[] {
  if (tier === 0) return insns.map(tier0);
  if (tier === 1) return insns.map(tier1);
  return [tier2(insns)];
}
