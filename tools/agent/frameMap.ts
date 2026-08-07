#!/usr/bin/env npx tsx
/**
 * frameMap.ts — decompose a target function's stack frame and read its
 * signature off the ABI.
 *
 * Everything here is transcription, not inference: the O32 frame layout and
 * the load widths at the incoming argument slots determine the parameter list
 * exactly. A model doing this by hand gets a type wrong and pays for it for
 * the rest of the session (func_80016B7C: a whole missing parameter;
 * func_80016C08: a frame size reported two different ways in one report).
 *
 * Frame layout emitted by GCC 2.95 for MIPS O32:
 *
 *     sp+0x00  outgoing argument area   (>=16 bytes, multiple of 8,
 *                                        sized by the WIDEST outgoing call)
 *     sp+A     locals / spills
 *     sp+V     saved registers
 *     sp+F     <- caller's sp;  F+0x00..F+0x0C are the home slots for
 *                 $a0-$a3, F+0x10 and up are incoming stack arguments
 *
 * The outgoing area cannot be read off the lowest save slot when the function
 * has locals (that yields A+V). It is derived here from the argument stores
 * GCC emits just before each `jal`, which is exact.
 *
 * Usage:
 *   npx tsx tools/agent/frameMap.ts func_80016C08
 *   npx tsx tools/agent/frameMap.ts func_80016C08 --json
 */

import { existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import {
  ROOT,
  type DisassembledInstruction,
  assembleTarget,
  disassembleObject,
  normalizeFunctionName,
} from "./decompToolchain.js";
import { BRANCH_MNEMONICS, buildBlocks, defUse } from "./webAnalysis.js";

const ARG_REGISTERS = ["a0", "a1", "a2", "a3"];

/** Caller-saved registers a call destroys, so a read after one is not a read
 *  of the incoming argument. */
const CALL_CLOBBERED = new Set([
  "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "hi", "lo",
]);

/** Registers a callee must preserve — the only ones a prologue saves. */
const CALLEE_SAVED = new Set([
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "fp", "gp", "ra",
]);

/** Widths and signedness implied by each load mnemonic. */
const LOAD_TYPES: Record<string, string> = {
  lw: "s32", lh: "s16", lhu: "u16", lb: "s8", lbu: "u8",
};

export interface IncomingArgument {
  /** Zero-based parameter index, matching the repo's argN naming. */
  index: number;
  /** Offset within the caller's frame. */
  callerOffset: number;
  type: string;
  evidence: string;
}

/**
 * An argument register proven to carry an incoming value: it is read on some
 * path from entry with no intervening definition and no intervening call.
 * Proof is one-directional — an unused parameter leaves no trace at all — so
 * the absence of an entry here is not evidence that the parameter is absent.
 */
export interface RegisterParameter {
  index: number;
  register: string;
  type: string;
  evidence: string;
}

export interface FrameMap {
  frameSize: number;
  /** Outgoing argument area, derived from pre-call argument stores. */
  argAreaSize: number;
  /** Locals + spills, between the argument area and the first save slot. */
  varsSize: number | null;
  saveSlots: { offset: number; register: string }[];
  /** Parameters 5+ read from the incoming argument region. */
  incoming: IncomingArgument[];
  /** $a0-$a3 proven to carry incoming values (a lower bound — see above). */
  registerParameters: RegisterParameter[];
  /** Register parameters narrowed at entry — a hard type signal. */
  registerTypes: Map<string, { type: string; evidence: string }>;
  /** Home slots the function spills its own register parameters into. */
  homeSpills: number[];
  /** `addiu rX, sp, N` — a local whose address is taken (array or by-ref). */
  addressTaken: { offset: number; evidence: string }[];
  /** Widest outgoing call, as a range (GCC rounds the area up to 8). */
  outgoingArgs: string;
}

function parseImmediate(text: string): number | null {
  const m = text.trim().match(/^(-?)(?:0x([0-9a-fA-F]+)|(\d+))$/);
  if (!m) return null;
  const value = m[2] !== undefined ? parseInt(m[2], 16) : parseInt(m[3], 10);
  return m[1] === "-" ? -value : value;
}

function memoryOperand(operand: string): { offset: number; base: string } | null {
  const m = operand.trim().match(/^(-?(?:0x)?[0-9a-fA-F]+)?\(\$?(\w+)\)$/);
  if (!m) return null;
  return { offset: m[1] ? parseImmediate(m[1]) ?? 0 : 0, base: m[2] };
}

function registerOf(operand: string): string | null {
  const m = operand.trim().match(/^\$?(\w+)$/);
  return m && !/^\d+$/.test(m[1]) ? m[1] : null;
}

/**
 * GCC rounds the outgoing area up to a multiple of 8 and never emits less
 * than 16, so an area of A bytes is consistent with a widest call of n
 * arguments for n in (A/4 - 2, A/4].
 */
export function argSlotRange(areaBytes: number): string {
  const high = Math.floor(areaBytes / 4);
  const low = Math.max(1, high - 1);
  return areaBytes <= 16 ? `up to ${high}` : `${low}-${high}`;
}

/**
 * Instruction index a branch transfers to. objdump spells the target as
 * `34 <func+0x34>`; the `<` is required so that `jr a0` is not misread as a
 * jump to 0xa0 (register names are valid hex digits).
 */
function makeBranchTargetOf(
  instructions: DisassembledInstruction[],
): (index: number) => number | undefined {
  const indexOfAddress = new Map<number, number>();
  instructions.forEach((insn, index) => indexOfAddress.set(insn.address, index));
  return (index) => {
    const insn = instructions[index];
    if (!insn || !BRANCH_MNEMONICS.has(insn.mnemonic.toLowerCase())) return undefined;
    const last = insn.operands[insn.operands.length - 1];
    const target = last?.trim().match(/^(?:0x)?([0-9a-f]+)\s+</i);
    return target ? indexOfAddress.get(parseInt(target[1], 16)) : undefined;
  };
}

/**
 * Which of $a0-$a3 the function actually reads as inputs.
 *
 * A forward MAY dataflow over real basic blocks: a register "holds incoming"
 * until it is written or a call destroys it, and any read while it still holds
 * incoming proves a parameter. Union meet is deliberate — `f(int a){ if (c) a
 * = 5; return a; }` redefines $a0 on one path only, and the read is still a
 * read of the parameter on the other.
 *
 * Two details are load-bearing and both are easy to get wrong by inspection:
 * the delay slot of a `jal` executes BEFORE the call transfers (so argument
 * setup there precedes the clobber), and a call destroys $a0-$a3 outright (so
 * a read after one is reading garbage, never the incoming value).
 */
export function analyzeRegisterParameters(
  instructions: DisassembledInstruction[],
  registerTypes: Map<string, { type: string; evidence: string }>,
): RegisterParameter[] {
  const blocks = buildBlocks(instructions, makeBranchTargetOf(instructions));
  if (blocks.length === 0) return [];

  const blockOfStart = new Map(blocks.map((block, index) => [block.start, index]));
  const proven = new Map<string, number>();

  /* Walk one block, threading `holds` (the argument registers still carrying
   * their entry value) and recording every read that lands while it does. */
  const transfer = (holds: Set<string>, block: { start: number; end: number }): Set<string> => {
    const state = new Set(holds);
    const apply = (index: number): void => {
      const { defs, uses } = defUse(instructions[index]);
      for (const register of uses) {
        if (!state.has(register)) continue;
        const previous = proven.get(register);
        if (previous === undefined || previous > index) proven.set(register, index);
      }
      for (const register of defs) state.delete(register);
    };
    for (let index = block.start; index <= block.end; index++) {
      const { isCall } = defUse(instructions[index]);
      apply(index);
      if (isCall) {
        if (index + 1 <= block.end) apply(++index);
        for (const register of CALL_CLOBBERED) state.delete(register);
      }
    }
    return state;
  };

  /* Absent = not yet reached. Unreachable blocks never gain an entry state
   * and so contribute no proofs, which is the correct reading of dead code. */
  const inState = new Map<number, Set<string>>([[0, new Set(ARG_REGISTERS)]]);

  let changed = true;
  let iterations = 0;
  while (changed && iterations++ < blocks.length * 4 + 16) {
    changed = false;
    blocks.forEach((block, index) => {
      const entry = inState.get(index);
      if (entry === undefined) return;
      const exit = transfer(entry, block);
      for (const successorStart of block.successors) {
        const successor = blockOfStart.get(successorStart);
        if (successor === undefined) continue;
        const existing = inState.get(successor);
        if (existing === undefined) {
          inState.set(successor, new Set(exit));
          changed = true;
          continue;
        }
        for (const register of exit) {
          if (!existing.has(register)) { existing.add(register); changed = true; }
        }
      }
    });
  }

  return [...proven.entries()]
    .map(([register, index]) => ({
      index: ARG_REGISTERS.indexOf(register),
      register,
      type: registerTypes.get(register)?.type ?? "s32",
      evidence: instructions[index].raw.trim(),
    }))
    .sort((a, b) => a.index - b.index);
}

export function analyzeFrame(instructions: DisassembledInstruction[]): FrameMap {
  let frameSize = 0;
  for (const insn of instructions) {
    if (insn.mnemonic.toLowerCase() !== "addiu") continue;
    if (registerOf(insn.operands[0] ?? "") !== "sp") continue;
    if (registerOf(insn.operands[1] ?? "") !== "sp") continue;
    const value = parseImmediate(insn.operands[2] ?? "");
    if (value !== null && value < 0) { frameSize = -value; break; }
  }

  /* A save slot needs three properties at once. Any one of them alone
   * misfires: the round-trip alone catches parameter spills that happen to
   * reload into the same register, and the register class alone catches
   * outgoing argument stores made from a callee-saved register. */
  const firstBranch = instructions.findIndex((insn) => {
    const { isBranch, isCall } = defUse(insn);
    return isBranch || isCall;
  });
  const prologueEnd = firstBranch < 0 ? instructions.length : firstBranch;
  const epilogueStart = Math.max(0, instructions.length - 24);

  const stores = new Map<string, number>();
  const prologueStores = new Set<string>();
  const loads = new Set<string>();
  const epilogueLoads = new Set<string>();
  const incomingLoads = new Map<number, { mnemonic: string; raw: string }>();
  const homeSpills = new Set<number>();
  const addressTaken: FrameMap["addressTaken"] = [];

  instructions.forEach((insn, index) => {
    const mnemonic = insn.mnemonic.toLowerCase();
    const { isLoad, isStore } = defUse(insn);
    const register = registerOf(insn.operands[0] ?? "");
    const memory = memoryOperand(insn.operands[insn.operands.length - 1] ?? "");

    if (mnemonic === "addiu" && registerOf(insn.operands[1] ?? "") === "sp") {
      const offset = parseImmediate(insn.operands[2] ?? "");
      if (offset !== null && offset > 0 && (frameSize === 0 || offset < frameSize)) {
        addressTaken.push({ offset, evidence: insn.raw.trim() });
      }
    }

    if (!memory || memory.base !== "sp" || !register) return;
    if (isStore) {
      stores.set(`${register}@${memory.offset}`, memory.offset);
      if (index < prologueEnd) prologueStores.add(`${register}@${memory.offset}`);
      if (frameSize > 0 && memory.offset >= frameSize &&
          memory.offset < frameSize + 0x10 && ARG_REGISTERS.includes(register)) {
        homeSpills.add(memory.offset - frameSize);
      }
    }
    if (isLoad) {
      loads.add(`${register}@${memory.offset}`);
      if (index >= epilogueStart) epilogueLoads.add(`${register}@${memory.offset}`);
      if (frameSize > 0 && memory.offset >= frameSize && !incomingLoads.has(memory.offset)) {
        incomingLoads.set(memory.offset, { mnemonic, raw: insn.raw.trim() });
      }
    }
  });

  const saveSlots: FrameMap["saveSlots"] = [];
  for (const [key, offset] of stores) {
    const register = key.split("@")[0];
    if (!CALLEE_SAVED.has(register)) continue;
    if (!loads.has(key)) continue;
    /* Prologue store or epilogue reload — a mid-function spill is neither. */
    if (!prologueStores.has(key) && !epilogueLoads.has(key)) continue;
    saveSlots.push({ offset, register });
  }
  saveSlots.sort((a, b) => a.offset - b.offset);

  /* Outgoing argument stores: written just before the call, commonly in the
   * delay slot, and — the discriminating property — never read back by this
   * function, because it is the callee that reads them. A local spilled near
   * the same call is always reloaded somewhere, so it cannot be confused for
   * one. Argument slots are dense from 0x10, so take the contiguous run. */
  const loadedOffsets = new Set([...loads].map((key) => Number(key.split("@")[1])));
  const outgoing = new Set<number>();
  let previousCall = -1;
  instructions.forEach((insn, index) => {
    if (!defUse(insn).isCall) return;
    const start = Math.max(previousCall + 1, index - 12);
    for (let scan = start; scan <= index + 1 && scan < instructions.length; scan++) {
      const candidate = instructions[scan];
      if (!defUse(candidate).isStore) continue;
      const memory = memoryOperand(candidate.operands[candidate.operands.length - 1] ?? "");
      if (!memory || memory.base !== "sp") continue;
      if (memory.offset >= 0x10 && !loadedOffsets.has(memory.offset)) {
        outgoing.add(memory.offset);
      }
    }
    previousCall = index;
  });

  let lastOutgoing = 0x0c;
  while (outgoing.has(lastOutgoing + 4)) lastOutgoing += 4;

  const hasCall = instructions.some((insn) => defUse(insn).isCall);
  const argAreaSize = !hasCall
    ? 0
    : Math.max(16, Math.ceil((lastOutgoing + 4) / 8) * 8);

  const firstSave = saveSlots.length > 0 ? saveSlots[0].offset : null;
  const varsSize = firstSave === null ? null : firstSave - argAreaSize;

  const incoming: IncomingArgument[] = [];
  for (const [offset, load] of [...incomingLoads.entries()].sort((a, b) => a[0] - b[0])) {
    const callerOffset = offset - frameSize;
    if (callerOffset < 0x10) continue; /* home slot, not a stack parameter */
    incoming.push({
      index: callerOffset / 4,
      callerOffset,
      type: LOAD_TYPES[load.mnemonic] ?? "s32",
      evidence: load.raw,
    });
  }

  /* Entry narrowing of an argument register is a hard type signal:
   * `sll aN,aN,16; sra aN,aN,16` is a short parameter, `andi aN,aN,0xffff`
   * an unsigned short. */
  const registerTypes = new Map<string, { type: string; evidence: string }>();
  instructions.forEach((insn, index) => {
    const mnemonic = insn.mnemonic.toLowerCase();
    const dest = registerOf(insn.operands[0] ?? "");
    const source = registerOf(insn.operands[1] ?? "");
    if (!dest || !ARG_REGISTERS.includes(dest) || dest !== source) return;
    if (registerTypes.has(dest)) return;

    if (mnemonic === "sll" && parseImmediate(insn.operands[2] ?? "") === 16) {
      const next = instructions[index + 1];
      if (next && next.mnemonic.toLowerCase() === "sra" &&
          registerOf(next.operands[0] ?? "") === dest &&
          parseImmediate(next.operands[2] ?? "") === 16) {
        registerTypes.set(dest, { type: "s16", evidence: `${insn.raw.trim()} ; ${next.raw.trim()}` });
      }
    }
    if (mnemonic === "andi" && parseImmediate(insn.operands[2] ?? "") === 0xffff) {
      registerTypes.set(dest, { type: "u16", evidence: insn.raw.trim() });
    }
  });

  return {
    frameSize,
    argAreaSize,
    varsSize,
    saveSlots,
    incoming,
    registerParameters: analyzeRegisterParameters(instructions, registerTypes),
    registerTypes,
    homeSpills: [...homeSpills].sort((a, b) => a - b),
    addressTaken: addressTaken.sort((a, b) => a.offset - b.offset),
    outgoingArgs: hasCall ? argSlotRange(argAreaSize) : "none (leaf — makes no calls)",
  };
}

export function hex(value: number): string {
  return `${value < 0 ? "-" : ""}0x${Math.abs(value).toString(16).toUpperCase()}`;
}

/* --- return type --- */

export interface ReturnValue {
  type: "void" | "s32" | "unknown";
  /** How the type was reached. `proven` is callee-local and absolute. */
  basis: "proven" | "callers" | "unknown";
  evidence: string[];
}

interface SplatInstruction {
  mnemonic: string;
  operands: string[];
  text: string;
  labelTarget?: string;
}

function parseSplatAsm(content: string): { insns: SplatInstruction[]; labels: Map<string, number> } {
  const insns: SplatInstruction[] = [];
  const labels = new Map<string, number>();
  for (const line of content.split("\n")) {
    const label = line.match(/^\s*(\.L[0-9A-Fa-f]+):/);
    if (label) { labels.set(label[1], insns.length); continue; }
    const match = line.match(/^\s*\/\*\s*\S+\s+(\S+)\s+\S+\s*\*\/\s+(\S+)\s*(.*)$/);
    if (!match) continue;
    const operandText = match[3].trim();
    const operands = operandText.length > 0 ? operandText.split(",").map((o) => o.trim()) : [];
    const entry: SplatInstruction = {
      mnemonic: match[2].toLowerCase(),
      operands,
      text: `${match[2].toLowerCase()} ${operandText}`.trim(),
    };
    const target = operands.find((o) => /^\.L[0-9A-Fa-f]+$/.test(o));
    if (target) entry.labelTarget = target;
    insns.push(entry);
  }
  return { insns, labels };
}

function resolveAsm(name: string): string | null {
  const candidates = [
    join(ROOT, "build/asm/nonmatchings", name, `${name}.s`),
    join(ROOT, "build/functions", `${name}.s`),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

type CallSiteVerdict = "consumed" | "ignored" | "propagated" | "inconclusive";

/**
 * Does this caller read $v0 after calling `callee`? The delay slot executes
 * before the transfer, so the scan starts one past it.
 *
 * Reaching `jr $ra` with $v0 untouched looks like `return callee();` but is
 * not: GCC merges exit paths onto one epilogue, so an unconditional jump to
 * the shared `jr $ra` is the ordinary way a void caller ends. Distinguishing
 * the two needs the caller's own return type, which is the question we are
 * answering one level up. It is reported as `propagated` and settles nothing.
 */
function scanCallSites(callee: string, content: string): CallSiteVerdict[] {
  const { insns, labels } = parseSplatAsm(content);
  const verdicts: CallSiteVerdict[] = [];

  insns.forEach((insn, callIndex) => {
    if (insn.mnemonic !== "jal" || insn.operands[0] !== callee) return;
    const seen = new Set<number>();
    let index = callIndex + 2; /* past the delay slot */
    for (let steps = 0; steps < 64; steps++) {
      if (index >= insns.length || seen.has(index)) { verdicts.push("inconclusive"); return; }
      seen.add(index);
      const current = insns[index];
      const { defs, uses, isCall } = defUse(current);
      if (uses.includes("v0")) { verdicts.push("consumed"); return; }
      if (defs.includes("v0")) { verdicts.push("ignored"); return; }
      if (isCall) { verdicts.push("ignored"); return; } /* the call clobbers $v0 */
      if (current.mnemonic === "jr" && current.operands[0] === "$ra") {
        verdicts.push("propagated");
        return;
      }
      if (current.mnemonic === "j" || current.mnemonic === "b") {
        const target = current.labelTarget !== undefined ? labels.get(current.labelTarget) : undefined;
        if (target === undefined) { verdicts.push("inconclusive"); return; }
        index = target;
        continue;
      }
      if (BRANCH_MNEMONICS.has(current.mnemonic)) { verdicts.push("inconclusive"); return; }
      index++;
    }
    verdicts.push("inconclusive");
  });
  return verdicts;
}

function callersOf(name: string): string[] {
  const path = join(ROOT, "build/callGraph.json");
  if (!existsSync(path)) return [];
  try {
    const graph = JSON.parse(readFileSync(path, "utf-8"));
    return graph.functions?.find((f: { name: string }) => f.name === name)?.calledBy ?? [];
  } catch { return []; }
}

/**
 * The return type is the one part of a signature the callee cannot settle
 * alone: a void function is free to leave junk in $v0, so "something writes
 * $v0" proves nothing. Only the never-written case is decidable locally. The
 * rest is answered where the evidence actually lives — in the callers.
 *
 * Even a unanimous "no caller reads it" is not proof, because the original C
 * may return a value every caller discards. It is reported as caller evidence,
 * never as proof.
 */
export function analyzeReturnValue(name: string, instructions: DisassembledInstruction[]): ReturnValue {
  const definesV0 = instructions.some((insn) => defUse(insn).defs.includes("v0"));
  if (!definesV0) {
    return {
      type: "void",
      basis: "proven",
      evidence: ["no instruction in the function writes $v0 — nothing can be returned"],
    };
  }

  const callers = callersOf(name);
  if (callers.length === 0) {
    return {
      type: "unknown",
      basis: "unknown",
      evidence: [
        "$v0 is written, which a void function may also do — not decidable from this function",
        "no callers recorded in build/callGraph.json to settle it",
      ],
    };
  }

  const tally: Record<CallSiteVerdict, string[]> =
    { consumed: [], ignored: [], propagated: [], inconclusive: [] };
  const unreadable: string[] = [];
  for (const caller of callers) {
    const path = resolveAsm(caller);
    if (!path) { unreadable.push(caller); continue; }
    const verdicts = scanCallSites(name, readFileSync(path, "utf-8"));
    if (verdicts.length === 0) { unreadable.push(caller); continue; }
    /* One consuming site is enough to make the whole function non-void; short
     * of that, the least conclusive site is what this caller can support. */
    const verdict: CallSiteVerdict = verdicts.includes("consumed")
      ? "consumed"
      : verdicts.includes("inconclusive")
        ? "inconclusive"
        : verdicts.includes("propagated") ? "propagated" : "ignored";
    tally[verdict].push(caller);
  }

  const evidence = [
    `$v0 is written, so void is not decidable here; consulted ${callers.length} caller(s)`,
    ...(tally.consumed.length > 0 ? [`reads the result: ${tally.consumed.join(", ")}`] : []),
    ...(tally.ignored.length > 0 ? [`discards the result: ${tally.ignored.join(", ")}`] : []),
    ...(tally.propagated.length > 0
      ? [`falls through to its own jr $ra with $v0 untouched, which settles nothing ` +
         `unless that caller is itself non-void: ${tally.propagated.join(", ")}`]
      : []),
    ...(tally.inconclusive.length > 0 ? [`inconclusive (path split): ${tally.inconclusive.join(", ")}`] : []),
    ...(unreadable.length > 0 ? [`no assembly available: ${unreadable.join(", ")}`] : []),
  ];

  if (tally.consumed.length > 0) {
    return { type: "s32", basis: "callers", evidence };
  }
  const undecided = tally.propagated.length + tally.inconclusive.length + unreadable.length;
  if (tally.ignored.length > 0 && undecided === 0) {
    return {
      type: "void",
      basis: "callers",
      evidence: [...evidence, "no caller reads $v0 — void, unless the original returned a value all callers discard"],
    };
  }
  return { type: "unknown", basis: "unknown", evidence };
}

/**
 * Lower bound on the parameter count, and a true one: every parameter counted
 * here is backed by a read of its incoming value.
 *
 * A stack argument at index N implies N+1 parameters outright, because the
 * four register slots below it must be occupied to reach the stack at all.
 * With no stack arguments the bound comes from the argument registers actually
 * read — which may be none.
 */
export function minimumArity(map: FrameMap): number {
  const stack = map.incoming.length > 0
    ? Math.max(...map.incoming.map((argument) => argument.index)) + 1
    : 0;
  const registers = map.registerParameters.length > 0
    ? Math.max(...map.registerParameters.map((parameter) => parameter.index)) + 1
    : 0;
  return Math.max(stack, registers);
}

/**
 * Upper bound. Trailing parameters that are never read leave no trace, so the
 * ceiling is the last stack argument if there is one and the full register
 * file otherwise.
 */
export function maximumArity(map: FrameMap): number {
  return map.incoming.length > 0 ? minimumArity(map) : 4;
}

/**
 * A starter signature containing only what the binary establishes.
 *
 * Stack parameters are exact (load width and signedness are visible) and
 * register parameters keep `s32` unless entry narrowing proves otherwise. The
 * arity is a lower bound and the return type may be undetermined; both are
 * marked in the trailing comment rather than papered over with a default,
 * because a fabricated parameter list propagates into callers and a guessed
 * return type is indistinguishable from a derived one once it is pasted in.
 */
export function renderSignature(name: string, map: FrameMap, returnValue?: ReturnValue): string {
  const parameters: string[] = [];
  const arity = minimumArity(map);
  for (let index = 0; index < arity; index++) {
    if (index < 4) {
      const proven = map.registerParameters.find((parameter) => parameter.index === index);
      const narrowed = map.registerTypes.get(ARG_REGISTERS[index]);
      /* A gap below a proven higher parameter: unread, but it must exist. */
      parameters.push(`${proven?.type ?? narrowed?.type ?? "s32"} arg${index}`);
    } else {
      const found = map.incoming.find((argument) => argument.index === index);
      parameters.push(`${found ? found.type : "s32"} arg${index}`);
    }
  }

  const returnType = returnValue?.type === "unknown" || returnValue === undefined
    ? "/* return type undetermined */"
    : returnValue.type;
  const maximum = maximumArity(map);
  const caveats: string[] = [];
  if (maximum > arity) {
    caveats.push(`arity is a lower bound: ${arity} proven, up to ${maximum} possible ` +
      "(an unused parameter is invisible in the binary)");
  }
  if (returnValue?.basis === "callers") caveats.push("return type from caller evidence, not proof");

  return `${returnType} ${name}(${parameters.length > 0 ? parameters.join(", ") : "void"});` +
    (caveats.length > 0 ? `   /* ${caveats.join("; ")} */` : "");
}

export function renderMap(name: string, map: FrameMap): string[] {
  const lines: string[] = [];
  lines.push(`frame ${hex(map.frameSize)} = args ${hex(map.argAreaSize)}` +
    ` + vars ${map.varsSize === null ? "?" : hex(map.varsSize)}` +
    ` + saves ${hex(map.saveSlots.length * 4)} (${map.saveSlots.length} registers)`);
  lines.push(map.argAreaSize === 0
    ? `widest outgoing call: ${map.outgoingArgs}`
    : `widest outgoing call: ${map.outgoingArgs} argument slots`);
  lines.push("");
  if (map.argAreaSize > 0) {
    lines.push(`${hex(0)}..${hex(map.argAreaSize - 1)}  outgoing arguments`);
  }
  if (map.varsSize !== null && map.varsSize > 0) {
    lines.push(`${hex(map.argAreaSize)}..${hex(map.argAreaSize + map.varsSize - 1)}  locals and spills (${map.varsSize} bytes)`);
  }
  if (map.saveSlots.length > 0) {
    lines.push(`${hex(map.saveSlots[0].offset)}..${hex(map.saveSlots[map.saveSlots.length - 1].offset + 3)}  saved: ` +
      map.saveSlots.map((slot) => `$${slot.register}`).join(" "));
  }
  for (const local of map.addressTaken) {
    lines.push(`${hex(local.offset)}  address taken -> array or by-reference local   [${local.evidence}]`);
  }
  for (const offset of map.homeSpills) {
    lines.push(`${hex(map.frameSize + offset)}  home slot of arg${offset / 4} (the function spills its own register parameter here)`);
  }
  for (const argument of map.incoming) {
    lines.push(`${hex(map.frameSize + argument.callerOffset)}  arg${argument.index} : ${argument.type}   [${argument.evidence}]`);
  }
  lines.push("");
  if (map.registerParameters.length === 0) {
    lines.push("register parameters: none proven — no read of $a0-$a3 reaches from entry");
  } else {
    for (const parameter of map.registerParameters) {
      lines.push(`$${parameter.register}  arg${parameter.index} : ${parameter.type}   [${parameter.evidence}]`);
    }
  }
  const unread = ARG_REGISTERS
    .map((register, index) => ({ register, index }))
    .filter(({ index }) => index < maximumArity(map) &&
      !map.registerParameters.some((parameter) => parameter.index === index));
  if (unread.length > 0) {
    lines.push(`unread: ${unread.map((u) => `$${u.register}`).join(" ")} — ` +
      "written before any read, or never referenced; each is either not a parameter or an unused one");
  }
  return lines;
}

/* --- CLI --- */

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const positional = args.filter((a) => !a.startsWith("--"));
  if (positional.length !== 1) {
    console.error("Usage: npx tsx tools/agent/frameMap.ts <func_name> [--json]");
    process.exit(1);
  }

  const name = normalizeFunctionName(positional[0]);
  const scratch = join(ROOT, "build/triage", `${name}-frame`);
  let instructions: DisassembledInstruction[];
  try {
    instructions = disassembleObject(assembleTarget(name, scratch));
  } catch (error) {
    console.error(`frameMap: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  const map = analyzeFrame(instructions);
  const returnValue = analyzeReturnValue(name, instructions);
  if (json) {
    console.log(JSON.stringify({
      ...map,
      registerTypes: Object.fromEntries(map.registerTypes),
      minimumArity: minimumArity(map),
      maximumArity: maximumArity(map),
      returnValue,
      signature: renderSignature(name, map, returnValue),
    }, null, 2));
    return;
  }

  console.log(`frameMap ${name}\n`);
  for (const line of renderMap(name, map)) console.log(`  ${line}`);
  console.log(`\nreturn value (${returnValue.basis}):`);
  for (const line of returnValue.evidence) console.log(`  ${line}`);
  console.log(`\nsignature (only what the binary establishes; see the caveats it carries):`);
  console.log(`  ${renderSignature(name, map, returnValue)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
