/**
 * mechanisms.ts — what a program's loop pass demonstrably reached.
 *
 * A loop trace is a few hundred decisions. What transfers between two functions
 * is not a decision but a *mechanism*: "an index giv of this shape reduced",
 * "two identical givs combined so their benefits summed", "an insn one pass
 * created was re-hoisted by the next". Those are comparable across functions in
 * a way UIDs and register numbers are not, and comparing them is the whole
 * point of reading somebody else's trace.
 *
 * Every mechanism here is keyed on the shape the pass printed, never on the
 * symbols or registers it happened to involve, so two functions that solve the
 * same problem over different data agree. A giv's `mult` and the kind of its
 * `add` are the key, because together they are the source expression: `mult 1
 * add (plus REG REG)` is `base + (i + j)` and nothing else, and `mult 16 add 0`
 * is `i * 16`.
 *
 * The declines are first-class. A shape the donor *reduced* and the target
 * *declined* is the sharpest evidence this project can produce about a source
 * spelling: both programs asked the same question and got different answers, so
 * the difference is in the source, and the log prints both sides of the
 * inequality that decided it.
 */

import { findCascades } from "./cascade.js";
import type { GeneralInductionVariable, LoopTrace } from "./types.js";

export interface Mechanism {
  /** Stable across functions: the comparison key. */
  id: string;
  /** What it is, in source terms. */
  label: string;
  /** The log facts that prove it — UIDs, benefits, the numbers it turned on. */
  witness: string;
  /**
   * The pre-loop insn UIDs behind it.
   *
   * Carried so a reader can be given the *source line* rather than a UID:
   * `lineMapFor` maps these to lines, and a mechanism named at its own line of
   * C is the difference between "read this function" and "read this statement".
   */
  insns: number[];
  /**
   * For a reduced giv: did it get there by combining with another occurrence?
   *
   * Scoped to the shape on purpose. "This program combines givs somewhere" is
   * almost always true and says nothing; "the giv of the shape yours was
   * refused reached the gate by summing two occurrences" is the edit.
   */
  combined?: boolean;
  /** `from..to` of the loop it happened in. */
  loop: string;
  pass: number;
}

/** How a giv's `add` term is spelled, which is what the source controls. */
export type AddKind = "const" | "simple" | "compound";

export function addKind(add: string | undefined): AddKind {
  if (add === undefined) return "const";
  const text = add.trim();
  if (/^-?\d+$/.test(text)) return "const";
  if (/^\(reg[^()]*\)$/.test(text)) return "simple";
  return "compound";
}

/** The shape key: what the source expression is, independent of its operands. */
export function givShape(giv: GeneralInductionVariable): string {
  return `mult=${giv.mult ?? "?"}/add=${addKind(giv.add)}`;
}

function describeShape(giv: GeneralInductionVariable): string {
  const scale = giv.mult === "1" ? "the loop counter itself" : `the loop counter times ${giv.mult ?? "?"}`;
  switch (addKind(giv.add)) {
    case "const":
      return `${scale} with a constant offset`;
    case "simple":
      return `${scale} plus one other value`;
    default:
      return `${scale} plus a SUM of two values`;
  }
}

/** What the shape means for the source, said once rather than at each use. */
function shapeConsequence(giv: GeneralInductionVariable): string {
  switch (addKind(giv.add)) {
    case "const":
      return "";
    case "simple":
      return " — a derived index, which the source does not step as a variable of its own";
    default:
      return " — a two-register-sum index, whose %lo cannot fold into a load and so stays a standalone pair";
  }
}

export function mechanismsOf(trace: LoopTrace): Mechanism[] {
  const mechanisms: Mechanism[] = [];
  /**
   * One entry per mechanism, merged rather than first-wins.
   *
   * Several givs of one shape are one mechanism, and which of them the log
   * happens to print first decides nothing. It is usually the *survivor* of a
   * combine that carries `reduced to`, while the giv that carries
   * `combined with` is the one folded into it — so first-wins loses the fact
   * that combining is what got the shape through, and loses the second
   * occurrence's insn, which is exactly the line of source a reader needs.
   */
  const add = (mechanism: Mechanism): void => {
    const existing = mechanisms.find((entry) => entry.id === mechanism.id);
    if (!existing) { mechanisms.push(mechanism); return; }
    if (mechanism.combined) existing.combined = true;
    for (const insn of mechanism.insns) if (!existing.insns.includes(insn)) existing.insns.push(insn);
  };

  for (const cascade of findCascades(trace)) {
    add({
      id: "cascade",
      label:
        "a value hoisted out of a nested loop by one pass, re-hoisted into the enclosing loop's " +
        "preheader by the next — the route to a pass-2 emission that faces no pass-1 test",
      witness:
        `pass ${cascade.firstPass} loop ${cascade.inner} hoisted insn ${cascade.innerInsn} to ` +
        `${cascade.landedAt}; pass ${cascade.secondPass} loop ${cascade.outer} re-hoisted insn ` +
        `${cascade.reHoisted}${cascade.symbol === undefined ? "" : ` — ${cascade.symbol}`}`,
      insns: [cascade.innerInsn],
      loop: cascade.outer,
      pass: cascade.secondPass,
    });
  }

  for (const pass of trace.passes) {
    for (const loop of pass.loops) {
      const key = `${loop.from}..${loop.to}`;

      if (loop.phony) {
        add({
          id: "phony-loop",
          label: "a loop loop.c discarded unscanned, so nothing inside it was ever a candidate",
          witness: loop.phonyCause?.detail ?? "cause undetermined from this dump",
          insns: loop.phonyCause?.intruders ?? [],
          loop: key,
          pass: pass.index,
        });
      }

      if (pass.index > 1 && loop.movables.some((movable) => movable.decision === "moved")) {
        const moved = loop.movables.filter((movable) => movable.decision === "moved");
        add({
          id: "pass2-movable",
          label: "a movable this pass hoisted that the first pass did not — a pass-2 emission, which " +
            "lands after every pass-1 giv initialisation",
          witness: moved.map((movable) =>
            `insn ${movable.insn} savings ${movable.savings ?? "?"} x life ${movable.life} -> ${movable.movedTo}` +
            `${movable.symbol === undefined ? "" : ` (${movable.symbol})`}`).join("; "),
          insns: moved.map((movable) => movable.insn),
          loop: key,
          pass: pass.index,
        });
      }

      const combined = loop.givs.filter((giv) => giv.combinedWith !== undefined);
      if (combined.length > 0) {
        add({
          id: "giv-combined",
          label:
            "two or more identical givs combined, so their benefits SUM — the lever that clears the " +
            "reduce gate for an expression that declines as a single occurrence",
          witness: combined.map((giv) =>
            `insn ${giv.insn} (benefit ${giv.benefit}) combined with ${giv.combinedWith}`).join("; ")
            + (loop.combineStatistics.length > 0
              ? `; sorted combine totals ${loop.combineStatistics
                .map((table) => table.map((entry) => `{${entry.insn}, ${entry.totalBenefit}}`).join(" "))
                .filter(Boolean).join(" | ")}`
              : ""),
          insns: combined.flatMap((giv) => [giv.insn, giv.combinedWith!]),
          loop: key,
          pass: pass.index,
        });
      }

      for (const giv of loop.givs) {
        const shape = givShape(giv);
        if (giv.reducedTo !== undefined) {
          add({
            id: `giv-reduced:${shape}`,
            combined: giv.combinedWith !== undefined,
            label: `a giv of ${describeShape(giv)} was REDUCED to a pseudo, whose initialisation the pass ` +
              `emits into the preheader${shapeConsequence(giv)}`,
            witness:
              `insn ${giv.insn} ${giv.destAddress ? "dest address" : `giv reg ${giv.reg}`} src biv ${giv.srcReg} ` +
              `benefit ${giv.benefit} lifetime ${giv.lifetime} mult ${giv.mult ?? "?"} add ${giv.add ?? "0"} ` +
              `-> ${giv.reducedTo}` +
              `${giv.combinedWith === undefined ? "" : ` (after combining with insn ${giv.combinedWith})`}`,
            insns: giv.combinedWith === undefined ? [giv.insn] : [giv.insn, giv.combinedWith],
            loop: key,
            pass: pass.index,
          });
        } else if (giv.rejected !== undefined && giv.benefit > 0 && giv.rejected.product >= 0) {
          /* Two filters, and both are about what a *source edit* could still
             reach.
             A benefit-0 giv is not a refused source expression: it is what is
             left of one the pass already reduced — a dest-address giv over the
             pseudo the previous pass created — and `lifetime * threshold * 0`
             loses to any insn_count whatever the source says.
             A NEGATIVE product is not a near miss either. The product is
             `benefit * lifetime * threshold` with both other terms positive, so
             it is negative exactly when the pass valued the giv below zero —
             and the lever for a refused giv is combining, which SUMS benefits.
             Two occurrences of a negative benefit is a worse number, not a
             better one. Reporting those as refusals pairs them with genuine
             near-misses elsewhere and manufactures a contradiction. */
          add({
            id: `giv-declined:${shape}`,
            label: `a giv of ${describeShape(giv)} was REFUSED — lifetime x threshold x benefit lost to insn_count`,
            witness:
              `insn ${giv.insn} benefit ${giv.benefit} lifetime ${giv.lifetime} mult ${giv.mult ?? "?"} ` +
              `add ${giv.add ?? "0"} — not worth while, ${giv.rejected.product} vs ${giv.rejected.insnCount}`,
            insns: [giv.insn],
            loop: key,
            pass: pass.index,
          });
        }
      }
    }
  }

  return mechanisms;
}

/** The reduced-giv shapes a trace reached, as bare shape keys. */
export function reducedShapes(mechanisms: Mechanism[]): string[] {
  return mechanisms
    .filter((mechanism) => mechanism.id.startsWith("giv-reduced:"))
    .map((mechanism) => mechanism.id.slice("giv-reduced:".length));
}

/** The giv shapes a trace asked about and was refused. */
export function declinedShapes(mechanisms: Mechanism[]): string[] {
  return mechanisms
    .filter((mechanism) => mechanism.id.startsWith("giv-declined:"))
    .map((mechanism) => mechanism.id.slice("giv-declined:".length));
}
