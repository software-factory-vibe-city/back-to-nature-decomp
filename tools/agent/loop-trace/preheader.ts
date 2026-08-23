/**
 * preheader.ts — reassemble the preheader from the log.
 *
 * `move_movables` and `strength_reduce` both emit with
 * `emit_insn_before (..., loop_start)`, and each call lands immediately before
 * the loop, so successive emissions occupy successive positions. The preheader
 * a loop ends up with is therefore
 *
 *     [ whatever the source put there ]
 *     [ movables, in the order move_movables moved them ]
 *     [ giv initialisations, from strength_reduce ]
 *
 * per pass, and pass 2's emissions land after pass 1's. That layout is the
 * thing a preheader-order residual is *about*, and it is not readable off the
 * assembly: the assembly shows where the instructions ended up, not which pass
 * put them there or why.
 *
 * The giv initialisation insns are the one part the pass does not number in
 * the pass that creates them. A later pass does, when it recognises the
 * reduced pseudo as a biv of its own and prints `Biv N initialized at insn M`,
 * so the UID is filled in from there when it is available and left blank —
 * never guessed — when it is not.
 */

import type { LoopTrace, PreheaderLayout, PreheaderSlot } from "./types.js";

/** `(reg:SI 600)` -> 600. */
export function pseudoOf(rtx: string | undefined): number | undefined {
  const matched = rtx?.match(/\(reg[^\s]*\s+(\d+)\)/);
  return matched ? Number(matched[1]) : undefined;
}

export function preheaderLayouts(trace: LoopTrace): PreheaderLayout[] {
  /* Where any pass named the init insn of a pseudo that became a biv. */
  const initOfPseudo = new Map<number, number>();
  for (const pass of trace.passes) {
    for (const loop of pass.loops) {
      for (const biv of loop.bivs) {
        if (biv.initInsn !== undefined && !initOfPseudo.has(biv.regno)) {
          initOfPseudo.set(biv.regno, biv.initInsn);
        }
      }
    }
  }

  const layouts: PreheaderLayout[] = [];
  for (const pass of trace.passes) {
    for (const loop of pass.loops) {
      const slots: PreheaderSlot[] = [];

      for (const movable of loop.movables.filter((entry) => entry.decision === "moved")) {
        const because = movable.forces !== undefined
          ? ` (moved because ${movable.forces} did)`
          : movable.halved ? " (denominator doubled: this register already moved out of a loop)" : "";
        slots.push({
          kind: "movable",
          uid: movable.movedTo,
          from: movable.insn,
          regno: movable.regno,
          ...(movable.symbol === undefined ? {} : { symbol: movable.symbol }),
          detail: `movable insn ${movable.insn}, regno ${movable.regno}, life ${movable.life}, savings ${movable.savings ?? "?"}` +
            `${movable.symbol === undefined ? "" : ` — ${movable.symbol}`}${because}`,
        });
      }
      slots.sort((left, right) => (left.uid ?? 0) - (right.uid ?? 0));

      /* Several givs commonly reduce to one pseudo, and one pseudo is one
         initialisation. Group by the pseudo, keep the order the reductions
         were logged in. */
      const byPseudo = new Map<number, { givs: number[]; mult?: string; add?: string; symbol?: string }>();
      for (const giv of loop.givs) {
        const pseudo = pseudoOf(giv.reducedTo);
        if (pseudo === undefined) continue;
        const group = byPseudo.get(pseudo) ?? { givs: [], mult: giv.mult, add: giv.add, symbol: giv.symbol };
        group.givs.push(giv.insn);
        group.symbol ??= giv.symbol;
        byPseudo.set(pseudo, group);
      }
      for (const [pseudo, group] of byPseudo) {
        const step = group.mult === undefined ? "" : `, step mult ${group.mult}${group.add === undefined ? "" : ` add ${group.add}`}`;
        slots.push({
          kind: "giv-init",
          uid: initOfPseudo.get(pseudo),
          regno: pseudo,
          ...(group.symbol === undefined ? {} : { symbol: group.symbol }),
          detail: `giv init for (reg ${pseudo}) from insn${group.givs.length > 1 ? "s" : ""} ${group.givs.join(", ")}${step}` +
            `${group.symbol === undefined ? "" : ` — ${group.symbol}`}`,
        });
      }

      if (slots.length > 0) layouts.push({ pass: pass.index, from: loop.from, to: loop.to, slots });
    }
  }
  return layouts;
}
