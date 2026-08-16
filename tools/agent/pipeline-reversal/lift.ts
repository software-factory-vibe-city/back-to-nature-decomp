/**
 * Lifter — relocated machine words to the common IR.
 *
 * Both sides of a comparison enter the backward chain through this function,
 * so the original bytes and a candidate object are described by exactly the
 * same construction: nothing about a waypoint difference can come from the two
 * sides having been read differently.
 *
 * Input is `RenderedWord[]` from the oracle, which has already applied
 * relocations and placed both streams at their original addresses. That is the
 * only sound starting point: a pre-link object encodes `jal` with a zero field
 * and a relocation record, and a lifter reading those bytes would see calls to
 * one address.
 */

import type { RenderedWord } from "../../lib/functionOracle.js";
import { loadSymbolIndex, resolveAddress, type SymbolIndex } from "../../lib/symbolIndex.js";
import { defUse, shapeKey } from "../webAnalysis.js";
import type { MirBlock, MirInsn, MirProgram } from "./types.js";

const NOP_TEXTS = new Set(["nop", "move zero,zero", "sll zero,zero,0x0"]);

/** Branches whose delay slot always executes and whose target is PC-relative. */
const CONDITIONAL_BRANCHES = new Set([
  "beq", "bne", "beqz", "bnez", "bgez", "bgtz", "blez", "bltz",
  "bgezal", "bltzal", "beql", "bnel", "bgezl", "bgtzl", "blezl", "bltzl",
]);
const UNCONDITIONAL_JUMPS = new Set(["b", "j", "jr"]);
const CALLS = new Set(["jal", "jalr", "bal"]);

export interface LiftOptions {
  functionName: string;
  words: RenderedWord[];
  index?: SymbolIndex;
}

/**
 * objdump prints hard register 30 as `$s8`; the compiler's own naming, and the
 * shared register table every analysis here uses, call it `$fp`. Left
 * unnormalized the register is simply invisible: nothing matches it, so a frame
 * pointer's definitions and uses vanish from the webs.
 */
function normalizeRegisterNames(text: string): string {
  return text.replace(/(^|[^A-Za-z0-9_$])s8(?=$|[^A-Za-z0-9_])/g, "$1fp");
}

function splitText(rawText: string): { mnemonic: string; operands: string[] } {
  const text = normalizeRegisterNames(rawText);
  const trimmed = text.trim();
  const space = trimmed.indexOf(" ");
  if (space < 0) return { mnemonic: trimmed.toLowerCase(), operands: [] };
  const mnemonic = trimmed.slice(0, space).toLowerCase();
  const rest = trimmed.slice(space + 1).trim();
  const operands: string[] = [];
  let depth = 0;
  let start = 0;
  for (let position = 0; position < rest.length; position++) {
    const char = rest[position];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      operands.push(rest.slice(start, position).trim());
      start = position + 1;
    }
  }
  const tail = rest.slice(start).trim();
  if (tail) operands.push(tail);
  return { mnemonic, operands };
}

/** Instructions that combine a register with a signed 16-bit field — the only
 *  shapes that can hold the low half of a split address. */
const LOW_HALF_CONSUMERS = new Set([
  "addiu", "addi", "ori", "lw", "sw", "lb", "lbu", "lh", "lhu", "sb", "sh",
  "lwl", "lwr", "swl", "swr", "lwc2", "swc2",
]);

/** A register-to-register copy, which propagates a HIGH without consuming it. */
function copyDestination(insn: MirInsn, register: string): string | undefined {
  if (insn.mnemonic === "move" && insn.uses[0] === register) return insn.defs[0];
  if ((insn.mnemonic === "addu" || insn.mnemonic === "or") &&
      insn.operands.length === 3 &&
      insn.operands[2] === "zero" &&
      insn.operands[1] === register) {
    return insn.defs[0];
  }
  return undefined;
}

/**
 * Attribute every split-address half to the symbol it materializes.
 *
 * `-msplit-addresses` is on for this toolchain, so `HIGH` and `LO_SUM` are
 * separate RTL instructions and need not be adjacent — pairing follows the
 * value, not the layout, and steps through copies, because a HIGH copied into a
 * callee-saved register is how one base serves several dispatch arms. The
 * address comes from the relocated words, so it is exact; the name is only a
 * rendering of the nearest table entry.
 */
function attributeSplitAddresses(
  words: RenderedWord[],
  insns: MirInsn[],
  index: SymbolIndex,
): void {
  /* register → high half currently in it, and the instructions that carry it. */
  const held = new Map<string, { high: number; carriers: number[] }>();

  const name = (address: number): string => {
    const resolved = resolveAddress(index, address);
    if (!resolved) return `0x${address.toString(16).toUpperCase()}`;
    return resolved.offset === 0 ? resolved.symbol : `${resolved.symbol}+0x${resolved.offset.toString(16)}`;
  };

  insns.forEach((insn, position) => {
    /* Uses come first: `addiu $r,$r,%lo(S)` both consumes and redefines. */
    for (const register of insn.uses) {
      const value = held.get(register);
      if (!value) continue;
      if (!LOW_HALF_CONSUMERS.has(insn.mnemonic)) continue;
      const low = words[position].raw & 0xffff;
      const signed = low >= 0x8000 ? low - 0x10000 : low;
      const address = (value.high + signed) >>> 0;
      const symbol = name(address);
      for (const carrier of [...value.carriers, position]) {
        insns[carrier].symbol = symbol;
        insns[carrier].symbolAddress = address;
      }
      break;
    }

    if (insn.mnemonic === "lui") {
      const register = insn.defs[0];
      if (register) held.set(register, { high: ((words[position].raw & 0xffff) << 16) >>> 0, carriers: [position] });
      return;
    }
    for (const register of insn.defs) {
      const source = insn.uses.find((used) => held.has(used));
      const copied = source ? copyDestination(insn, source) : undefined;
      if (copied === register && source) {
        const value = held.get(source)!;
        held.set(register, { high: value.high, carriers: [...value.carriers, position] });
      } else held.delete(register);
    }
    if (insn.isCall) {
      /* A call clobbers the caller-saved registers, so anything they held is
       * no longer a live half. */
      for (const register of ["v0", "v1", "a0", "a1", "a2", "a3", "t0", "t1", "t2",
        "t3", "t4", "t5", "t6", "t7", "t8", "t9", "ra"]) held.delete(register);
    }
  });

  /* A HIGH whose LO_SUM sits in a block the linear scan cannot reach — an arm
   * of an indirect dispatch — is attributed by its half value instead. That is
   * sound exactly when one symbol in the function has that half. */
  const byHalf = new Map<number, Set<string>>();
  insns.forEach((insn, position) => {
    if (insn.symbolAddress === undefined) return;
    const half = (words[position].raw & 0xffff) << 16 >>> 0;
    if (insn.mnemonic !== "lui") return;
    const names = byHalf.get(half) ?? new Set<string>();
    names.add(`${insn.symbolAddress}|${insn.symbol}`);
    byHalf.set(half, names);
  });
  insns.forEach((insn, position) => {
    if (insn.mnemonic !== "lui" || insn.symbol !== undefined) return;
    const half = ((words[position].raw & 0xffff) << 16) >>> 0;
    const names = byHalf.get(half);
    if (!names || names.size !== 1) return;
    const [address, symbol] = [...names][0].split("|");
    insn.symbolAddress = Number(address);
    insn.symbol = symbol;
  });
}

/** Instruction index a local branch or jump reaches, when it stays inside. */
function localTargetIndex(insn: MirInsn, byVram: Map<number, number>): number | undefined {
  if (!insn.isBranch && !insn.isJump) return undefined;
  if (insn.mnemonic === "jr" || insn.mnemonic === "jalr") return undefined;
  const last = insn.operands[insn.operands.length - 1];
  if (!last) return undefined;
  /* The oracle renders a local target as `<function>` or `<function>+0xNN`. */
  const relative = last.match(/\+0x([0-9a-f]+)$/i);
  const base = insn.vram === undefined ? undefined : insn.vram;
  if (base === undefined) return undefined;
  const functionStart = [...byVram.keys()].reduce((low, value) => Math.min(low, value), Infinity);
  if (relative) {
    const target = functionStart + parseInt(relative[1], 16);
    return byVram.get(target);
  }
  if (/^0x[0-9a-f]+$/i.test(last)) return byVram.get(parseInt(last, 16));
  /* A bare function name with no offset is the function's own entry. */
  return byVram.get(functionStart);
}

/**
 * Basic blocks over the machine stream.
 *
 * A delay slot belongs to the block of its branch: it executes unconditionally
 * with the branch, so making it a leader would model control flow that the
 * machine does not have.
 */
function buildBlocks(insns: MirInsn[]): MirBlock[] {
  const leaders = new Set<number>([0]);
  for (const insn of insns) {
    if (!insn.isBranch && !insn.isJump && !insn.isCall) continue;
    if (insn.branchTargetIndex !== undefined) leaders.add(insn.branchTargetIndex);
    /* The instruction after the delay slot starts a block for anything that
     * can fall through or that ends the block outright. */
    if (insn.index + 2 < insns.length && !insn.isCall) leaders.add(insn.index + 2);
  }
  const starts = [...leaders].filter((value) => value < insns.length).sort((left, right) => left - right);
  const blockOf = new Map<number, number>();
  const blocks: MirBlock[] = [];
  for (let position = 0; position < starts.length; position++) {
    const start = starts[position];
    const end = (position + 1 < starts.length ? starts[position + 1] : insns.length) - 1;
    if (end < start) continue;
    const members: number[] = [];
    for (let index = start; index <= end; index++) {
      insns[index].block = blocks.length;
      blockOf.set(index, blocks.length);
      members.push(insns[index].id);
    }
    const block: MirBlock = {
      index: blocks.length,
      insns: members,
      successors: [],
      predecessors: [],
    };
    const vram = insns[start].vram;
    if (vram !== undefined) block.vram = vram;
    blocks.push(block);
  }

  for (const block of blocks) {
    const lastIndex = block.insns.length - 1;
    if (lastIndex < 0) continue;
    const startIndex = insns.findIndex((insn) => insn.id === block.insns[0]);
    const endIndex = startIndex + lastIndex;
    /* The terminator is the branch whose delay slot ends the block. */
    let terminator = -1;
    for (let index = startIndex; index <= endIndex; index++) {
      const insn = insns[index];
      if ((insn.isBranch || insn.isJump) && !insn.isCall) terminator = index;
    }
    const successors = new Set<number>();
    if (terminator >= 0 && terminator >= endIndex - 1) {
      const insn = insns[terminator];
      if (insn.branchTargetIndex !== undefined) {
        const target = blocks.find((entry) => entry.insns[0] === insns[insn.branchTargetIndex!].id);
        if (target) successors.add(target.index);
      }
      const unconditional = UNCONDITIONAL_JUMPS.has(insn.mnemonic);
      if (!unconditional && endIndex + 1 < insns.length) successors.add(blocks[block.index + 1]?.index ?? -1);
    } else if (endIndex + 1 < insns.length) {
      successors.add(blocks[block.index + 1]?.index ?? -1);
    }
    block.successors = [...successors].filter((value) => value >= 0);
  }
  for (const block of blocks) {
    for (const successor of block.successors) blocks[successor].predecessors.push(block.index);
  }
  return blocks;
}

/**
 * A block reachable only through the indirect dispatch, marked so the web
 * builder does not fuse values across arms of a `switch` that never flow into
 * one another.
 */
function markDispatchTargets(insns: MirInsn[], blocks: MirBlock[]): void {
  const hasIndirect = insns.some((insn) => insn.mnemonic === "jr" && insn.uses[0] !== "ra");
  if (!hasIndirect) return;
  for (const block of blocks) {
    if (block.index === 0) continue;
    if (block.predecessors.length === 0) block.dispatchTarget = true;
  }
}

export function liftWords(options: LiftOptions): MirProgram {
  const index = options.index ?? loadSymbolIndex();
  const words = options.words;
  const caveats: string[] = [];
  const insns: MirInsn[] = [];
  const byVram = new Map<number, number>();

  words.forEach((word, position) => {
    const { mnemonic, operands } = splitText(word.text);
    const usage = defUse({ mnemonic, operands });
    const insn: MirInsn = {
      index: position,
      id: position,
      vram: word.vram,
      word: word.raw,
      mnemonic,
      operands,
      text: normalizeRegisterNames(word.text).replace(/\s+/g, " ").trim(),
      shape: shapeKey({ mnemonic, operands }),
      defs: [...new Set(usage.defs)],
      uses: [...new Set(usage.uses)].filter((register) => register !== "zero"),
      isCall: CALLS.has(mnemonic),
      isBranch: CONDITIONAL_BRANCHES.has(mnemonic),
      isJump: UNCONDITIONAL_JUMPS.has(mnemonic),
      isLoad: usage.isLoad,
      isStore: usage.isStore,
      isNop: NOP_TEXTS.has(`${mnemonic}${operands.length ? ` ${operands.join(",")}` : ""}`),
      block: 0,
    };
    insns.push(insn);
    byVram.set(word.vram, position);
  });

  for (const insn of insns) {
    const target = localTargetIndex(insn, byVram);
    if (target !== undefined) insn.branchTargetIndex = target;
    else if ((insn.isBranch || insn.isJump) && insn.mnemonic !== "jr") {
      caveats.push(`branch at 0x${insn.vram?.toString(16)} leaves the function or could not be resolved`);
    }
  }

  /* Symbols: gp-relative accesses carry the name already; split addresses are
   * recovered by pairing each HIGH with the LO_SUM that consumes it. */
  attributeSplitAddresses(words, insns, index);
  for (const insn of insns) {
    const gpRelative = insn.text.match(/%gp_rel\(([^)]+)\)/);
    if (gpRelative) {
      insn.symbol = gpRelative[1];
      continue;
    }
    if (insn.isCall && insn.mnemonic === "jal") {
      const last = insn.operands[insn.operands.length - 1];
      if (last && !/^0x/.test(last)) insn.symbol = last;
    }
  }

  /* Delay-slot membership: the instruction after any branch, jump or call. */
  for (const insn of insns) {
    if (!insn.isBranch && !insn.isJump && !insn.isCall) continue;
    const slot = insns[insn.index + 1];
    if (slot) slot.delaySlotOf = insn.id;
  }

  const blocks = buildBlocks(insns);
  markDispatchTargets(insns, blocks);

  return {
    waypoint: "machine",
    functionName: options.functionName,
    insns,
    blocks,
    caveats,
  };
}

/** Index lookup by instruction id, for waypoints whose order is a permutation. */
export function indexById(program: MirProgram): Map<number, MirInsn> {
  return new Map(program.insns.map((insn) => [insn.id, insn]));
}
