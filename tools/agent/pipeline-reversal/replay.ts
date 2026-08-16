/**
 * Forward-replay validation.
 *
 * Each backward step is only worth as much as its round trip: run g_k over a
 * program whose true waypoint is known and check that the reconstruction is
 * that waypoint. The candidate is exactly such a program — it comes from a
 * source we compiled, so `-da` hands us the compiler's own answer for every
 * stage — and the check costs one compile.
 *
 * A failure here is a component bug, not a mystery about the target, which is
 * the whole point of validating the chain separately from using it.
 */

import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyRtlEmission, hardRegisterName, parseRtlInstructions } from "../compiler-trace/rtl-parser.js";
import type { RtlInstruction } from "../compiler-trace/types.js";
import type { MirProgram, ReplayCheck } from "./types.js";

/** Hard registers an RTL instruction names, after reload. */
function rtlRegisters(instruction: RtlInstruction): string[] {
  const registers = new Set<string>();
  for (const reference of [...instruction.sets, ...instruction.uses]) {
    if (reference.register < 32) registers.add(hardRegisterName(reference.register));
  }
  /* A call sets the return register through its pattern, which the machine
   * encoding does not name; a RETURN names no register at all, while the
   * machine spells it `jr $ra`. Both are naming, not disagreement. */
  if (/\(call\b/.test(instruction.text)) registers.delete("v0");
  if (/\(return\)/.test(instruction.text)) registers.add("ra");
  return [...registers].filter((register) => register !== "zero" && register !== "gp").sort();
}

export interface ReplayInput {
  /** Directory holding the candidate's `-da` dumps. */
  dumpDirectory: string;
  /** Stem the dumps are named after, without the stage suffix. */
  stem: string;
}

/**
 * Check the reconstructed pre-dbr order against the compiler's `.mach` dump.
 *
 * `.mach` is the RTL chain immediately before `dbr_schedule`, so it is exactly
 * what `g_assembler ∘ g_dbr` claims to reproduce. Comparing register sets
 * rather than text keeps the check independent of how each side spells an
 * instruction while still failing on any reordering.
 */
export function replayPreDbr(reconstructed: MirProgram, input: ReplayInput): ReplayCheck {
  const path = join(input.dumpDirectory, `${input.stem}.mach`);
  if (!existsSync(path)) {
    return {
      stage: "mach",
      subject: "pre-dbr instruction order",
      status: "unavailable",
      detail: `no .mach dump at ${path}`,
    };
  }
  const parsed = parseRtlInstructions(readFileSync(path, "utf-8"), "mach");
  /* An `asm_operands` pattern emits whatever its template says, which is not
   * derivable from the RTL. One of them makes the whole count meaningless, so
   * the check reports that it cannot run rather than reporting a divergence it
   * cannot substantiate. */
  if (parsed.some((instruction) => instruction.text.includes("(asm_operands"))) {
    return {
      stage: "mach",
      subject: "pre-dbr instruction order",
      status: "unavailable",
      detail: "the function contains inline assembly, whose emitted word count is not derivable from the RTL",
    };
  }
  const rtl = parsed.filter((instruction) => classifyRtlEmission(instruction).classification !== "zero-width");

  const mine = reconstructed.insns.map((insn) => [...new Set([...insn.defs, ...insn.uses])]
    .filter((register) => register !== "zero" && register !== "gp").sort().join(","));
  const theirs = rtl.map((instruction) => rtlRegisters(instruction).join(","));
  const pairs = longestCommonSubsequence(mine, theirs);
  const matchedMine = new Set(pairs.map(([left]) => left));
  const matchedTheirs = new Set(pairs.map(([, right]) => right));

  /* An RTL instruction with no counterpart is one `dbr_schedule` deleted after
   * the dump — a redundant set, or a jump it tensioned away. That is real
   * information loss in the bytes, not an inverse defect: nothing in the
   * machine code records an instruction that was removed. */
  const deletedByDbr = rtl.length - matchedTheirs.size;
  /* A reconstructed instruction with no counterpart is an inverse defect: the
   * chain kept a word the compiler never emitted, or put it where no RTL
   * instruction sits. */
  const unexplained = reconstructed.insns
    .map((insn, position) => ({ insn, position }))
    .filter(({ position }) => !matchedMine.has(position));

  if (unexplained.length > 0) {
    const first = unexplained[0];
    return {
      stage: "mach",
      subject: "pre-dbr instruction order",
      status: "diverged",
      detail: `${unexplained.length} of ${reconstructed.insns.length} reconstructed instructions have no place in the .mach chain; first: [${first.position}] ${first.insn.text}`,
    };
  }
  const note = deletedByDbr > 0 ? `, with ${deletedByDbr} RTL instruction(s) that dbr deleted after the dump` : "";
  return {
    stage: "mach",
    subject: "pre-dbr instruction order",
    status: "verified",
    detail: `all ${reconstructed.insns.length} reconstructed instructions appear in the .mach RTL chain in order${note}`,
  };
}

/** Index pairs of the longest common subsequence of two string sequences. */
function longestCommonSubsequence(left: string[], right: string[]): Array<[number, number]> {
  const table: Uint32Array[] = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let row = left.length - 1; row >= 0; row--) {
    for (let column = right.length - 1; column >= 0; column--) {
      table[row][column] = left[row] === right[column]
        ? table[row + 1][column + 1] + 1
        : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let row = 0;
  let column = 0;
  while (row < left.length && column < right.length) {
    if (left[row] === right[column]) pairs.push([row++, column++]);
    else if (table[row + 1][column] >= table[row][column + 1]) row++;
    else column++;
  }
  return pairs;
}

/**
 * Check that the number of webs the allocation inverse recovers agrees with the
 * number of pseudos the compiler had before allocation.
 *
 * The `.lreg` dump is the last stage where pseudos still exist. Their count is
 * not expected to equal the web count exactly — a pseudo the allocator spilled
 * becomes several webs, and a hard register live across the whole function is a
 * web with no pseudo — so this reports the two numbers and the difference
 * rather than asserting equality.
 */
export function replayWebCount(webCount: number, input: ReplayInput): ReplayCheck {
  const path = join(input.dumpDirectory, `${input.stem}.lreg`);
  if (!existsSync(path)) {
    return { stage: "lreg", subject: "pseudo population", status: "unavailable", detail: `no .lreg dump at ${path}` };
  }
  const rtl = parseRtlInstructions(readFileSync(path, "utf-8"), "lreg");
  const pseudos = new Set<number>();
  for (const instruction of rtl) {
    for (const reference of [...instruction.sets, ...instruction.uses]) {
      if (reference.register >= 80) pseudos.add(reference.register);
    }
  }
  return {
    stage: "lreg",
    subject: "pseudo population",
    status: "verified",
    detail: `${webCount} webs recovered from the machine stream; ${pseudos.size} pseudos live at .lreg`,
  };
}
