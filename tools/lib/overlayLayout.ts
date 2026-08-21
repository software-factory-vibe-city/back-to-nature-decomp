/**
 * overlayLayout.ts — where an overlay member's code starts and ends.
 *
 * Deliverable 6/7 of plans/overlay-decompilation-enablement.md, and the most
 * likely cause of a failed round trip. An overlay has no header to declare its
 * sections. What it does have is the same PSYLINK section order the PS-X EXE
 * was linked with — `.rodata`, `.text`, `.data` — so there is exactly one code
 * region, and both of its edges are witnessed by the code itself:
 *
 *   - the trailing edge by the last `jr ra`, because a function cannot end
 *     without one and nothing after `.text` contains one on purpose;
 *   - the leading edge by the first function entry past the member's leading
 *     absolute-pointer table, where a function entry is a `jal` target, a
 *     stack prologue, or the seam two words after a `jr ra`.
 *
 * The derivation reports its evidence and its residuals. A `jr ra` outside the
 * derived range is a contradiction worth seeing, not a number to round away.
 */

import { isDecodableInstruction, isJrRa, isStackPrologue, isValidRamAddress } from "./mips.js";
import { collectSelfReferences, type BaseSolverInput } from "./overlayBase.js";

export interface OverlayLayout {
  /** Byte offsets within the member. Half-open ranges. */
  rodataStart: number;
  textStart: number;
  dataStart: number;
  fileEnd: number;
  evidence: string[];
  /** Contradictions the derivation could not account for. */
  residuals: string[];
}

/** End of the leading run of absolute RAM pointers that opens most members. */
export function headPointerRunEnd(bytes: Buffer): number {
  const words = Math.floor(bytes.length / 4);
  let end = 4; // the leading word is the overlay id, never a pointer
  for (let i = 1; i < words; i++) {
    if (!isValidRamAddress(bytes.readUInt32LE(i * 4))) break;
    end = (i + 1) * 4;
  }
  return end;
}

/** Every offset in the member that is shaped like the first instruction of a function. */
export function functionEntryOffsets(bytes: Buffer, callTargetOffsets: readonly number[]): number[] {
  const words = Math.floor(bytes.length / 4);
  const entries = new Set<number>(callTargetOffsets.filter((o) => o >= 0 && o < bytes.length && o % 4 === 0));
  for (let i = 0; i < words; i++) {
    const word = bytes.readUInt32LE(i * 4);
    if (isStackPrologue(word)) entries.add(i * 4);
    /* The function before this one ended with `jr ra` and its delay slot, so
       two words past a return is a function seam. This is what finds leaf
       functions, which have no frame to recognise. */
    if (i >= 2 && isJrRa(bytes.readUInt32LE((i - 2) * 4)) && isDecodableInstruction(word)) entries.add(i * 4);
  }
  return [...entries].sort((a, b) => a - b);
}

/**
 * A word that is four printable-or-extended bytes with no control byte.
 *
 * Shift-JIS text decodes as instructions often enough that decodability alone
 * cannot stop a backward walk out of `.text` and into the string pool ahead of
 * it. This is the stop condition, and it is deliberately narrow: a real
 * instruction almost always carries a small field byte.
 */
function looksLikeText(word: number): boolean {
  for (let shift = 0; shift < 32; shift += 8) {
    const byte = (word >>> shift) & 0xff;
    if (byte < 0x20) return false;
  }
  return true;
}

/**
 * Pull `.text` back to cover a `jr ra` that fell outside it.
 *
 * A return before the derived start is a contradiction: the function holding it
 * is code, so `.text` starts at or before it. The first function of a member
 * can be a leaf with no prologue and no caller inside the member, which is
 * exactly the case no entry rule sees.
 */
function extendTextStartBackwards(
  bytes: Buffer,
  returns: readonly number[],
  headEnd: number,
  textStart: number,
  evidence: string[]
): number {
  let start = textStart;
  for (let guard = 0; guard < 64; guard++) {
    const stray = [...returns].filter((offset) => offset < start).pop();
    if (stray === undefined) break;
    let cursor = stray;
    while (cursor - 4 >= headEnd) {
      const previous = bytes.readUInt32LE(cursor - 4);
      if (!isDecodableInstruction(previous) || looksLikeText(previous)) break;
      cursor -= 4;
    }
    if (cursor >= start) break;
    evidence.push(
      `a jr ra at 0x${stray.toString(16)} precedes the first entry, so .text is pulled back to 0x${cursor.toString(16)}`
    );
    start = cursor;
  }
  return start;
}

/**
 * Derive the section boundaries of a raw member.
 *
 * `base` is optional. Internal `jal` targets are a *supporting* signal — they
 * confirm entries the prologue and seam rules already find — so the extent can
 * be derived before any load address is known. That ordering matters: whether a
 * member holds code at all has to be decidable before the base solver runs, and
 * a base solved for a member that turns out to be data would be a confident
 * wrong answer.
 */
export function deriveOverlayLayout(input: BaseSolverInput, base?: number): OverlayLayout {
  const bytes = input.bytes;
  const words = Math.floor(bytes.length / 4);
  const refs = collectSelfReferences(input);
  const callOffsets = base === undefined ? [] : refs.calls.map((target) => target - base);
  const entries = functionEntryOffsets(bytes, callOffsets);

  const returns: number[] = [];
  for (let i = 0; i < words; i++) if (isJrRa(bytes.readUInt32LE(i * 4))) returns.push(i * 4);

  const headEnd = headPointerRunEnd(bytes);
  const evidence: string[] = [
    `${refs.headPointers.length} leading absolute pointers, so data runs to at least 0x${headEnd.toString(16)}`,
    `${entries.length} function-entry-shaped offsets, ${returns.length} jr ra`,
  ];
  const residuals: string[] = [];

  if (returns.length === 0) {
    return {
      rodataStart: 0,
      textStart: bytes.length,
      dataStart: bytes.length,
      fileEnd: bytes.length,
      evidence: [...evidence, "no jr ra anywhere: the member holds no function"],
      residuals: ["no code region could be derived"],
    };
  }

  /* `jr ra` plus its delay slot closes the last function. */
  const textEnd = returns[returns.length - 1]! + 8;
  const candidates = entries.filter((offset) => offset >= headEnd && offset < textEnd);
  const firstEntry = candidates.length > 0 ? candidates[0]! : headEnd;

  evidence.push(`last jr ra at 0x${returns[returns.length - 1]!.toString(16)}, so .text ends at 0x${textEnd.toString(16)}`);
  evidence.push(
    candidates.length > 0
      ? `first function entry past the leading pointer table is 0x${firstEntry.toString(16)}`
      : `no function entry past the leading pointer table; .text is taken to start at 0x${headEnd.toString(16)}`
  );

  const textStart = extendTextStartBackwards(bytes, returns, headEnd, firstEntry, evidence);

  const strayReturns = returns.filter((offset) => offset < textStart || offset >= textEnd);
  if (strayReturns.length > 0) {
    residuals.push(
      `${strayReturns.length} jr ra outside the derived .text, first at 0x${strayReturns[0]!.toString(16)}`
    );
  }
  const strayCalls = callOffsets.filter((offset) => offset >= 0 && (offset < textStart || offset >= textEnd));
  if (strayCalls.length > 0) {
    residuals.push(
      `${strayCalls.length} internal jal target outside the derived .text, first at 0x${strayCalls[0]!.toString(16)}`
    );
  }

  return {
    rodataStart: 0,
    textStart,
    dataStart: textEnd,
    fileEnd: bytes.length,
    evidence,
    residuals,
  };
}

/** Function entries inside the derived `.text`, as addresses. */
export function textFunctionAddresses(
  input: BaseSolverInput,
  base: number,
  layout: OverlayLayout
): number[] {
  const refs = collectSelfReferences(input);
  const callOffsets = refs.calls.map((target) => target - base);
  return functionEntryOffsets(input.bytes, callOffsets)
    .filter((offset) => offset >= layout.textStart && offset < layout.dataStart)
    .map((offset) => base + offset);
}
