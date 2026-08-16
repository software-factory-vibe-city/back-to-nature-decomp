/**
 * g_assembler — machine words back to the instruction stream cc1 emitted.
 *
 * The assembler layer adds three kinds of word that no RTL instruction owns:
 * hazard `nop`s the MIPS-1 load delay forces, `nop`s filling a delay slot the
 * compiler left empty, and the second half of a macro the compiler wrote as one
 * operation. Removing them is near-bijective: each addition leaves a syntactic
 * witness, so the preimage is a function rather than a fiber, and the count of
 * the result is directly checkable against the compiler's own `.mach` dump.
 *
 * Split addresses are *not* macros here. `-msplit-addresses` is enabled for
 * this toolchain, so `HIGH` and `LO_SUM` are two separate RTL instructions that
 * the scheduler may separate; folding them would delete a real scheduling
 * decision.
 */

import type { FiberSite, MirInsn, MirProgram } from "./types.js";

export interface AssemblerInverseResult {
  program: MirProgram;
  /** Machine indexes removed, with the reason each was an assembler artifact. */
  removed: Array<{ index: number; vram?: number; reason: string }>;
  /** Machine index pairs folded into one instruction. */
  merged: Array<{ indexes: number[]; text: string }>;
  sites: FiberSite[];
}

/** Registers the MIPS-1 load delay makes unreadable in the next slot. */
function loadDelayHazard(previous: MirInsn | undefined, next: MirInsn | undefined): boolean {
  if (!previous || !next) return false;
  if (!previous.isLoad) return false;
  const loaded = previous.defs[0];
  if (!loaded) return false;
  return next.uses.includes(loaded);
}

export function inverseAssembler(machine: MirProgram): AssemblerInverseResult {
  const removed: AssemblerInverseResult["removed"] = [];
  const merged: AssemblerInverseResult["merged"] = [];
  const sites: FiberSite[] = [];
  const kept: MirInsn[] = [];
  const source = machine.insns;

  for (let position = 0; position < source.length; position++) {
    const insn = source[position];

    if (insn.isNop) {
      const previous = source[position - 1];
      const reason = insn.delaySlotOf !== undefined
        ? "unfilled delay slot"
        : loadDelayHazard(source[position - 2], source[position - 1]) || loadDelayHazard(previous, source[position + 1])
          ? "load-delay hazard"
          : "assembler-inserted";
      const entry: AssemblerInverseResult["removed"][number] = { index: insn.index, reason };
      if (insn.vram !== undefined) entry.vram = insn.vram;
      removed.push(entry);
      continue;
    }

    /* A direct access to a global the small-data window does not cover is one
     * compiler line, `lw $d,SYM`, that the assembler expands into a pair. The
     * expansion is recognizable because gas has no scratch register to spare:
     * for a load it reuses the destination, so all three register slots are the
     * same, and for a store it uses `$at`, which the compiler never touches.
     *
     * `-msplit-addresses` produces a superficially similar pair, and the two
     * must not be confused: there the HIGH is a real RTL instruction the
     * scheduler may move, and folding it would delete a scheduling decision.
     * The register identity is what separates them. */
    const next = source[position + 1];
    const macroLoad = insn.mnemonic === "lui" && next !== undefined &&
      (next.isLoad || next.isStore) &&
      insn.symbolAddress !== undefined && next.symbolAddress === insn.symbolAddress &&
      next.uses.includes(insn.defs[0]!) &&
      (insn.defs[0] === "at" || (next.isLoad && next.defs[0] === insn.defs[0]));
    if (macroLoad) {
      const folded: MirInsn = {
        ...next,
        index: insn.index,
        id: insn.id,
        text: `${next.mnemonic} ${next.defs[0] ?? next.uses[0]},${insn.symbol}`,
        shape: `${next.mnemonic} <reg>,${insn.symbol}`,
        uses: next.uses.filter((register) => register !== insn.defs[0]),
      };
      if (insn.vram !== undefined) folded.vram = insn.vram;
      merged.push({ indexes: [insn.index, next.index], text: folded.text });
      kept.push(folded);
      position++;
      continue;
    }

    kept.push({ ...insn });
  }

  /* Re-index; ids are preserved so later stages can describe a reordering as a
   * permutation of the same instructions. */
  const idToPosition = new Map<number, number>();
  kept.forEach((insn, position) => {
    insn.index = position;
    idToPosition.set(insn.id, position);
  });
  for (const insn of kept) {
    if (insn.delaySlotOf !== undefined && !idToPosition.has(insn.delaySlotOf)) delete insn.delaySlotOf;
    if (insn.branchTargetIndex !== undefined) {
      const targetId = machine.insns[insn.branchTargetIndex]?.id;
      const mapped = targetId === undefined ? undefined : idToPosition.get(targetId);
      if (mapped === undefined) delete insn.branchTargetIndex;
      else insn.branchTargetIndex = mapped;
    }
  }

  const blocks = machine.blocks.map((block) => ({
    ...block,
    insns: block.insns.filter((id) => idToPosition.has(id)),
  }));
  kept.forEach((insn) => {
    const owner = blocks.find((block) => block.insns.includes(insn.id));
    if (owner) insn.block = owner.index;
  });

  return {
    program: {
      waypoint: "dbr",
      functionName: machine.functionName,
      insns: kept,
      blocks,
      caveats: machine.caveats.slice(),
    },
    removed,
    merged,
    sites,
  };
}
