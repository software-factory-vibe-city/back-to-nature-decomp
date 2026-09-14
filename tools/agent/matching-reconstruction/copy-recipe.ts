/**
 * Aggregate-copy recognition — reading a block move back out of the backend's
 * expansion of it.
 *
 * A structure assignment, or a `memcpy` of a known size, does not survive into
 * the object as a call. GCC expands it inline, and at this target's word size
 * the expansion has a recognisable geometry: a runtime test of the two
 * pointers' combined low bits, an unaligned path built from `lwl`/`lwr` and
 * `swl`/`swr` pairs, an aligned path built from `lw`/`sw`, both advancing by a
 * fixed number of bytes per iteration, and a tail that moves the remainder
 * without a loop.
 *
 * Classifying those words as handwritten assembly is the error this replaces.
 * They are ordinary compiler output; what is missing is not a decoder for
 * `lwl` but a recogniser for the *operation*. The product here is therefore
 * the operation — "these 628 bytes move N bytes from this pointer to that
 * one, with a runtime alignment test" — and never a hand-translation of the
 * instruction expansion, which would be a different program that happens to
 * compute the same bytes.
 *
 * Nothing here decides a source spelling. A block move can be a structure
 * assignment, an array copy, or a library call, and which one it was depends
 * on types this module does not have. It reports the operation and its
 * geometry; choosing the spelling is the constructor's job, and the byte
 * oracle's to judge.
 */

import { definedRegister, isUnalignedLoad, isUnalignedStore, type DecodedInsn } from "./decode.js";

/** One load or store the recogniser has normalised into a single word move. */
interface WordAccess {
  index: number;
  vram: number;
  kind: "load" | "store";
  /** Register holding the base address. */
  base: number;
  /** Register the value passes through. */
  value: number;
  offset: number;
  unaligned: boolean;
  /** Instruction indices this access occupies (two for an unaligned pair). */
  span: [number, number];
}

export interface CopyRun {
  /** Instruction range, inclusive. */
  fromVram: number;
  toVram: number;
  sourceRegister: number;
  destRegister: number;
  /** Bytes this run moves in one pass. */
  bytes: number;
  unaligned: boolean;
  /** Present when the run is a loop body: the advance applied per iteration. */
  loopStride?: number;
}

export interface CopyRecipe {
  kind: "aggregate-copy";
  /** The runs that make up the operation, in program order. */
  runs: CopyRun[];
  /** The test `((src | dst) & 3) == 0` that selects between the two paths. */
  alignmentTested: boolean;
  /** Bytes moved per loop iteration, when the runs agree on one. */
  bytesPerIteration?: number;
  /** What a reader needs to check the claim. */
  evidence: string[];
}

/* ---- normalisation --------------------------------------------------------- */

/**
 * Fold `lwl`/`lwr` and `swl`/`swr` pairs into single unaligned word accesses.
 *
 * On a little-endian target the pair is `lwl rt, k+3(rs)` and `lwr rt, k(rs)`,
 * in either order; together they move the word at `k`. Treating the halves
 * separately is what makes the expansion look like something other than a
 * word move.
 */
function wordAccesses(insns: DecodedInsn[]): WordAccess[] {
  const accesses: WordAccess[] = [];
  const used = new Set<number>();

  for (let index = 0; index < insns.length; index++) {
    if (used.has(index)) continue;
    const insn = insns[index]!;
    const unalignedLoad = isUnalignedLoad(insn.op);
    const unalignedStore = isUnalignedStore(insn.op);
    if (unalignedLoad || unalignedStore) {
      /* The partner is normally the next instruction, but a scheduler may put
       * one instruction between them, so a small window is searched. */
      let partner = -1;
      for (let ahead = index + 1; ahead < Math.min(index + 4, insns.length); ahead++) {
        if (used.has(ahead)) continue;
        const candidate = insns[ahead]!;
        const sameFamily = unalignedLoad ? isUnalignedLoad(candidate.op) : isUnalignedStore(candidate.op);
        if (!sameFamily) continue;
        if (candidate.rt !== insn.rt || candidate.rs !== insn.rs) continue;
        if (Math.abs(candidate.simm - insn.simm) !== 3) continue;
        partner = ahead;
        break;
      }
      if (partner < 0) continue;
      used.add(index);
      used.add(partner);
      accesses.push({
        index,
        vram: insn.vram,
        kind: unalignedLoad ? "load" : "store",
        base: insn.rs,
        value: insn.rt,
        offset: Math.min(insn.simm, insns[partner]!.simm),
        unaligned: true,
        span: [index, partner],
      });
      continue;
    }
    if (insn.op === "lw") {
      accesses.push({ index, vram: insn.vram, kind: "load", base: insn.rs, value: insn.rt, offset: insn.simm, unaligned: false, span: [index, index] });
    } else if (insn.op === "sw") {
      accesses.push({ index, vram: insn.vram, kind: "store", base: insn.rs, value: insn.rt, offset: insn.simm, unaligned: false, span: [index, index] });
    }
  }
  return accesses.sort((left, right) => left.index - right.index);
}

/* ---- runs ------------------------------------------------------------------ */

/**
 * Whether the value a load put in a register still reaches a later store
 * unchanged.
 *
 * Matching a store's register number to an earlier load's proves the *name* is
 * the same, not the value: `lw t0; addiu t0, t0, 1; sw t0` shares the register
 * and moves nothing. So the window between the two must redefine nothing — and
 * an undecoded word in it means the question cannot be answered, which is not
 * the same as a "yes".
 */
function valueSurvives(insns: DecodedInsn[], from: number, to: number, register: number): boolean {
  if (to <= from) return false;
  for (let index = from + 1; index < to; index++) {
    const written = definedRegister(insns[index]!);
    if (written === "unknown") return false;
    if (written === register) return false;
    /* A call clobbers every caller-saved register; the copy's value registers
     * are among them, and a block move contains no calls anyway. */
    if (insns[index]!.op === "jal" || insns[index]!.op === "jalr") return false;
  }
  return true;
}

/**
 * A copy run: loads from one base, stores of the same values to another, at
 * the same offsets.
 *
 * The values are matched by register rather than by position, so a scheduler
 * that interleaved the loads and stores, or reordered either, is still
 * recognised. What is required is the correspondence itself: every stored
 * value is a value loaded in this run, from the same offset, and reaching the
 * store with nothing written to it on the way.
 */
function runsIn(accesses: WordAccess[], insns: DecodedInsn[]): CopyRun[] {
  const runs: CopyRun[] = [];
  let cursor = 0;

  while (cursor < accesses.length) {
    const loads: WordAccess[] = [];
    const stores: WordAccess[] = [];
    let end = cursor;
    const sourceRegister = accesses[cursor]!.kind === "load" ? accesses[cursor]!.base : -1;
    if (sourceRegister < 0) { cursor++; continue; }

    /* Extend while the accesses keep belonging to one load-base/store-base
     * pair and the instruction stream stays contiguous between them. */
    let destRegister = -1;
    for (let index = cursor; index < accesses.length; index++) {
      const access = accesses[index]!;
      if (index > cursor && access.index - accesses[index - 1]!.index > 3) break;
      if (access.kind === "load") {
        if (access.base !== sourceRegister) break;
        loads.push(access);
      } else {
        if (destRegister < 0) destRegister = access.base;
        else if (access.base !== destRegister) break;
        stores.push(access);
      }
      end = index;
    }

    if (loads.length === 0 || stores.length === 0) { cursor = end + 1; continue; }

    /* Every store must carry a value some load in this run produced, from the
     * same offset, unmodified between the two — otherwise this is computation,
     * not a copy. */
    const loadsByRegister = new Map<number, WordAccess[]>();
    for (const load of loads) loadsByRegister.set(load.value, [...(loadsByRegister.get(load.value) ?? []), load]);
    let matched = 0;
    let unaligned = false;
    const offsets = new Set<number>();
    for (const store of stores) {
      /* The reaching definition is the latest load of that register before the
       * store; an earlier one was overwritten by it. */
      const reaching = (loadsByRegister.get(store.value) ?? [])
        .filter((load) => load.span[1] < store.span[0])
        .sort((left, right) => right.span[1] - left.span[1])[0];
      if (!reaching || reaching.offset !== store.offset) continue;
      if (!valueSurvives(insns, reaching.span[1], store.span[0], store.value)) continue;
      matched++;
      offsets.add(store.offset);
      unaligned ||= store.unaligned || reaching.unaligned;
    }
    if (matched === 0 || matched < stores.length) { cursor = end + 1; continue; }

    const first = accesses[cursor]!;
    const last = accesses[end]!;
    const run: CopyRun = {
      fromVram: first.vram,
      toVram: last.vram,
      sourceRegister,
      destRegister,
      bytes: offsets.size * 4,
      unaligned,
    };
    const stride = loopStrideAfter(insns, last.span[1], sourceRegister, destRegister);
    if (stride !== undefined) run.loopStride = stride;
    runs.push(run);
    cursor = end + 1;
  }
  return runs;
}

/**
 * The advance a loop applies after a run, when the run is a loop body.
 *
 * The shape is `addiu src, src, N` … `bne src, limit, head` … `addiu dst, dst,
 * N`: both pointers step by the same amount and the branch closes back over
 * the run. A run with no such closure is the operation's straight-line tail.
 */
function loopStrideAfter(insns: DecodedInsn[], lastIndex: number, source: number, dest: number): number | undefined {
  let sourceStep: number | undefined;
  let destStep: number | undefined;
  let closes = false;
  for (let index = lastIndex + 1; index < Math.min(lastIndex + 8, insns.length); index++) {
    const insn = insns[index]!;
    if (insn.op === "addiu" && insn.rt === insn.rs) {
      if (insn.rs === source) sourceStep = insn.simm;
      else if (insn.rs === dest) destStep = insn.simm;
      continue;
    }
    if ((insn.op === "bne" || insn.op === "beq") && insn.target !== undefined && insn.target <= insn.vram) {
      closes = true;
    }
  }
  if (!closes || sourceStep === undefined || destStep === undefined) return undefined;
  return sourceStep === destStep ? sourceStep : undefined;
}

/* ---- the alignment test ---------------------------------------------------- */

/**
 * Whether the words contain the combined-alignment test.
 *
 * `or rX, src, dst; andi rX, rX, 3; beq rX, zero, aligned` asks whether both
 * pointers are word-aligned at once, which is the test GCC emits to choose
 * between its two expansions. Its presence is the strongest single signal
 * that the region is a compiler-generated block move rather than
 * hand-written work.
 */
export function hasAlignmentTest(insns: DecodedInsn[]): boolean {
  for (let index = 0; index + 2 < insns.length; index++) {
    const combine = insns[index]!;
    if (combine.op !== "or") continue;
    const mask = insns[index + 1]!;
    if (mask.op !== "andi" || mask.rs !== combine.rd || (mask.uimm & 3) !== 3) continue;
    const branch = insns[index + 2]!;
    if (branch.op !== "beq" && branch.op !== "bne") continue;
    if (branch.rs !== mask.rt && branch.rt !== mask.rt) continue;
    return true;
  }
  return false;
}

/* ---- the recipe ------------------------------------------------------------ */

/**
 * Recognise the aggregate-copy operation in one function's words, if it has one.
 *
 * Returns null rather than a low-confidence guess: a run of two word moves is
 * not evidence of a block copy, and reporting it as one would make the
 * category useless for exactly the population it exists to describe.
 */
export function recognizeCopyRecipe(insns: DecodedInsn[]): CopyRecipe | null {
  const accesses = wordAccesses(insns);
  if (accesses.length === 0) return null;
  const runs = runsIn(accesses, insns);
  const substantial = runs.filter((run) => run.bytes >= 8);
  if (substantial.length === 0) return null;

  const alignmentTested = hasAlignmentTest(insns);
  const strides = new Set(substantial.map((run) => run.loopStride).filter((stride): stride is number => stride !== undefined));
  const bytesPerIteration = strides.size === 1 ? [...strides][0] : undefined;

  /* One short run with no loop and no alignment test is not a block move. */
  const loops = substantial.filter((run) => run.loopStride !== undefined);
  if (!alignmentTested && loops.length === 0 && substantial.every((run) => run.bytes < 16)) return null;

  const evidence: string[] = [];
  evidence.push(`${substantial.length} copy run(s) over ${accesses.length} word access(es)`);
  if (alignmentTested) evidence.push("the combined-alignment test ((src | dst) & 3) selects between an aligned and an unaligned expansion");
  for (const run of substantial) {
    evidence.push(
      `0x${run.fromVram.toString(16)}–0x${run.toVram.toString(16)}: ${run.bytes} byte(s) ` +
      `${run.unaligned ? "unaligned" : "aligned"}${run.loopStride !== undefined ? `, looping by ${run.loopStride}` : ", straight-line tail"}`,
    );
  }

  return {
    kind: "aggregate-copy",
    runs: substantial,
    alignmentTested,
    ...(bytesPerIteration !== undefined ? { bytesPerIteration } : {}),
    evidence,
  };
}

/** One line summarising the operation, for a census row or a bundle heading. */
export function describeCopyRecipe(recipe: CopyRecipe): string {
  const loops = recipe.runs.filter((run) => run.loopStride !== undefined).length;
  const tails = recipe.runs.length - loops;
  return (
    `aggregate copy: ${loops} loop(s) + ${tails} tail(s)` +
    `${recipe.bytesPerIteration !== undefined ? `, ${recipe.bytesPerIteration} bytes per iteration` : ""}` +
    `${recipe.alignmentTested ? ", runtime alignment test" : ""}`
  );
}
