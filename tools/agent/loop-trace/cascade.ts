/**
 * cascade.ts — the two-stage hoist, joined out of the log.
 *
 * `scan_loop` records movables by walking the loop and asking
 * `loop_reg_used_before_p` about each candidate. That question cannot be asked
 * about an insn a loop pass created: it has no luid, and `scan_loop` skips both
 * it and any register at or above `max_reg_before_loop`. So an insn that
 * **pass 1 hoisted out of an inner loop** is invisible to pass 1's scan of the
 * enclosing loop — and, when pass 2 comes round, it is an ordinary
 * loop-invariant set in the outer loop's body with no history at all.
 *
 * That is a route to a pass-2 movable with no pass-1 decline behind it, and it
 * is the one route the emission model did not have. Without it, a preheader
 * group that the ordering forces past pass 1 reads as a demand that the value
 * *declined* at pass 1 — a demand a forced `%hi`/`%lo` pair provably cannot
 * meet, since `force_movables` sums both halves into one product with a floor
 * of 2x2. Six sessions on one function closed the direction on that floor. The
 * pair never faced the test.
 *
 * The join is arithmetic over UIDs the log already prints: an emission's
 * landing UID from an inner loop in one pass, appearing as the *source* insn of
 * a movable in an enclosing loop in a later pass.
 */

import type { LoopRecord, LoopTrace, PassRecord } from "./types.js";

export interface Cascade {
  /** The pass that made the first hoist, out of the inner loop. */
  firstPass: number;
  /** `from..to` of the inner loop it came out of. */
  inner: string;
  /** The in-loop insn that first pass hoisted. */
  innerInsn: number;
  /** Where it landed — the inner loop's preheader, inside the outer body. */
  landedAt: number;
  /** The pass that re-hoisted it. */
  secondPass: number;
  /** `from..to` of the enclosing loop that re-hoisted it. */
  outer: string;
  /** The UID the second pass names as the movable's insn. */
  reHoisted: number;
  /** Where the second hoist landed — the outer loop's preheader. */
  finalAt?: number;
  /** Symbol the emission materialises, when the RTL named one. */
  symbol?: string;
  /**
   * `exact` when the re-hoisted UID is a landing UID the first pass printed;
   * `bracketed` when it only falls inside that loop's emitted UID range, which
   * is what a paired `%hi`/`%lo` emission looks like — the pass prints one
   * landing UID per movable and the pair occupies two.
   */
  certainty: "exact" | "bracketed";
}

/** Does `inner` sit strictly inside `outer`, by the UID range the log prints? */
function nests(inner: LoopRecord, outer: LoopRecord): boolean {
  if (inner.from === outer.from && inner.to === outer.to) return false;
  return outer.from <= inner.from && inner.to <= outer.to;
}

/** The UIDs a loop's own hoists landed at, in that pass. */
function emitted(loop: LoopRecord): number[] {
  return loop.movables
    .filter((movable) => movable.decision === "moved" && movable.movedTo !== undefined)
    .map((movable) => movable.movedTo!);
}

/**
 * Every re-hoist of a loop-created insn, joined to the loop that created it.
 *
 * Bounded by construction: only movables whose source insn is above everything
 * an earlier pass could have been looking at are candidates, and each is
 * attributed to at most one inner loop.
 */
export function findCascades(trace: LoopTrace): Cascade[] {
  const cascades: Cascade[] = [];

  trace.passes.forEach((pass: PassRecord, index: number) => {
    const earlier = trace.passes.slice(0, index);
    if (earlier.length === 0) return;

    /* Every UID an earlier pass emitted. The smallest is the floor above which
       a UID cannot have existed when that pass began scanning. */
    const earlierEmissions = earlier.flatMap((record) => record.loops.flatMap(emitted));
    if (earlierEmissions.length === 0) return;
    const createdFrom = Math.min(...earlierEmissions);

    /* Every enclosing/enclosed pair an earlier pass could have fed this one,
       flattened so the search for a UID's origin stops at the first loop that
       claims it. A UID belongs to one emission; attributing it to two would
       report one cascade twice. */
    const candidates = earlier.flatMap((before) =>
      before.loops.map((inner) => ({ pass: before.index, inner, landings: emitted(inner) }))
        .filter((entry) => entry.landings.length > 0));

    for (const outer of pass.loops) {
      for (const movable of outer.movables) {
        if (movable.decision !== "moved") continue;
        if (movable.insn < createdFrom) continue;

        const origin = candidates.find((entry) =>
          nests(entry.inner, outer)
          && movable.insn >= Math.min(...entry.landings)
          && movable.insn <= Math.max(...entry.landings));
        if (!origin) continue;

        const exact = origin.landings.includes(movable.insn);
        /* Exactly, when the log printed this landing UID. Otherwise the nearest
           landing at or below it, which is the movable whose emission the UID
           belongs to when a pair occupies two slots. */
        const source = origin.inner.movables.find((entry) => entry.movedTo === movable.insn)
          ?? origin.inner.movables
            .filter((entry) => entry.movedTo !== undefined && entry.movedTo <= movable.insn)
            .sort((left, right) => right.movedTo! - left.movedTo!)[0];
        const cascade: Cascade = {
          firstPass: origin.pass,
          inner: `${origin.inner.from}..${origin.inner.to}`,
          innerInsn: source?.insn ?? movable.insn,
          landedAt: exact ? movable.insn : Math.min(...origin.landings),
          secondPass: pass.index,
          outer: `${outer.from}..${outer.to}`,
          reHoisted: movable.insn,
          certainty: exact ? "exact" : "bracketed",
        };
        if (movable.movedTo !== undefined) cascade.finalAt = movable.movedTo;
        const symbol = movable.symbol ?? source?.symbol;
        if (symbol !== undefined) cascade.symbol = symbol;
        cascades.push(cascade);
      }
    }
  });

  return cascades;
}

export function renderCascades(cascades: Cascade[]): string[] {
  if (cascades.length === 0) return [];
  const lines = [
    "CASCADES (an insn one pass created, re-hoisted by a later pass of an enclosing loop)",
    "  scan_loop cannot record a movable for an insn a loop pass created — loop_reg_used_before_p",
    "  has no luid for it — so the enclosing loop's pass-1 scan never saw these at all. They reach",
    "  the outer preheader as fresh pass-2 movables, with NO pass-1 decline behind them, and they",
    "  land there AFTER pass 1's giv initialisations. That is an emission order no pass-1 movable",
    "  can produce, and it needs no desirability story at the outer loop.",
  ];
  for (const cascade of cascades) {
    const name = cascade.symbol === undefined ? "" : ` — ${cascade.symbol}`;
    lines.push(
      `    cascade${name}: pass ${cascade.firstPass} loop ${cascade.inner} hoisted insn ${cascade.innerInsn} ` +
      `to ${cascade.landedAt} (inside the outer body); pass ${cascade.secondPass} loop ${cascade.outer} ` +
      `re-hoisted insn ${cascade.reHoisted}` +
      `${cascade.finalAt === undefined ? "" : ` to ${cascade.finalAt}`} (the outer preheader)`);
    if (cascade.certainty === "bracketed") {
      lines.push(
        `      insn ${cascade.reHoisted} is not itself a landing UID the log printed; it falls inside ` +
        `${cascade.inner}'s emitted range, which is what a %hi/%lo pair looks like — the pass prints one ` +
        "landing UID per movable and the pair occupies two. Check it against the dump before relying on it.");
    }
  }
  return lines;
}
