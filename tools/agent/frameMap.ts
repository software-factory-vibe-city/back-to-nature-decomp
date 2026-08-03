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

import { rmSync } from "fs";
import { join } from "path";
import {
  ROOT,
  type DisassembledInstruction,
  assembleTarget,
  disassembleObject,
  normalizeFunctionName,
} from "./decompToolchain.js";
import { defUse } from "./webAnalysis.js";

const ARG_REGISTERS = ["a0", "a1", "a2", "a3"];

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

export interface FrameMap {
  frameSize: number;
  /** Outgoing argument area, derived from pre-call argument stores. */
  argAreaSize: number;
  /** Locals + spills, between the argument area and the first save slot. */
  varsSize: number | null;
  saveSlots: { offset: number; register: string }[];
  /** Parameters 5+ read from the incoming argument region. */
  incoming: IncomingArgument[];
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
    registerTypes,
    homeSpills: [...homeSpills].sort((a, b) => a - b),
    addressTaken: addressTaken.sort((a, b) => a.offset - b.offset),
    outgoingArgs: hasCall ? argSlotRange(argAreaSize) : "none (leaf — makes no calls)",
  };
}

export function hex(value: number): string {
  return `${value < 0 ? "-" : ""}0x${Math.abs(value).toString(16).toUpperCase()}`;
}

/** Minimum parameter count implied by the incoming stack loads. */
export function minimumArity(map: FrameMap): number {
  return map.incoming.length === 0
    ? 4
    : Math.max(...map.incoming.map((argument) => argument.index)) + 1;
}

/**
 * A starter signature. Register parameters keep `s32` unless the entry
 * narrowing proves otherwise; stack parameters are exact, because their load
 * width and signedness are visible.
 */
export function renderSignature(name: string, map: FrameMap): string {
  const parameters: string[] = [];
  const arity = minimumArity(map);
  for (let index = 0; index < arity; index++) {
    if (index < 4) {
      const narrowed = map.registerTypes.get(ARG_REGISTERS[index]);
      parameters.push(`${narrowed ? narrowed.type : "s32"} arg${index}`);
    } else {
      const found = map.incoming.find((argument) => argument.index === index);
      parameters.push(`${found ? found.type : "s32"} arg${index}`);
    }
  }
  return `s32 ${name}(${parameters.join(", ")});`;
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
  if (json) {
    console.log(JSON.stringify({
      ...map,
      registerTypes: Object.fromEntries(map.registerTypes),
      signature: renderSignature(name, map),
    }, null, 2));
    return;
  }

  console.log(`frameMap ${name}\n`);
  for (const line of renderMap(name, map)) console.log(`  ${line}`);
  console.log(`\nsignature (stack parameters are exact; register parameters default to s32):`);
  console.log(`  ${renderSignature(name, map)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
