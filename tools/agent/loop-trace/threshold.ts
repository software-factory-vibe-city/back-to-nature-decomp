/**
 * threshold.ts — solve for the number `loop.c` never prints.
 *
 * `threshold` is the denominator of every desirability test the loop optimizer
 * makes, and it is not in the log. It is also not free: both thresholds are
 * derived from one compilation-wide constant,
 *
 *     move_movables    threshold = (loop_has_call ? 1 : 2) * (1 + n_non_fixed_regs)
 *     strength_reduce  threshold = (loop_has_call ? 1 : 2) * (3 + n_non_fixed_regs)
 *
 * so every decision in every loop of every function constrains the same
 * unknown. This module turns decisions into constraints on `n_non_fixed_regs`
 * and intersects them. Once the feasible set is a single value the desirability
 * test becomes arithmetic anyone can check.
 *
 * Two things make this delicate, and both are the difference between a correct
 * bracket and one that excludes the truth.
 *
 * **The threshold decays inside a loop.** `move_movables` takes `threshold` by
 * value and does `threshold -= 3` after each movable it actually moves — "the
 * more regs we move, the less we like moving them". So the k-th decision in a
 * loop is taken against `threshold - 3 * (moves before it)`, and two movables
 * with identical `savings` and `life` in the same loop can legitimately decide
 * differently. Reading them as a contradiction, or as evidence that one moved
 * through some other clause, throws away the tightest constraints in the log.
 *
 * **A move is a disjunction.** The test is
 *
 *     already_moved[regno] || flag_move_all_movables
 *       || threshold * savings * lifetime >= (moved_once ? insn_count*2 : insn_count)
 *       || (m->forces && m->forces->done && n_times_set[m->forces->regno] == 1)
 *
 * so a movable that moved proves the product test passed only when no other
 * disjunct could have carried it. `not desirable` is always sound — it means
 * every disjunct failed.
 */

import type { LoopRecord, LoopTrace } from "./types.js";

/** Solve `x * product >= denominator` for the least integer x. */
function leastPassingThreshold(product: number, denominator: number): number {
  return Math.ceil(denominator / product);
}

export interface MovableConstraint {
  kind: "movable";
  function: string;
  pass: number;
  loop: string;
  insn: number;
  regno: number;
  savings: number;
  life: number;
  denominator: number;
  /** Moves before this decision, which each took 3 off the threshold. */
  decay: number;
  /** Bound on the loop's *initial* threshold, decay already added back. */
  bound: { op: ">=" | "<="; value: number };
  raw: string;
}

export interface GivConstraint {
  kind: "giv";
  function: string;
  pass: number;
  loop: string;
  insn: number;
  product: number;
  insnCount: number;
  /** The strength-reduce threshold divides this, because the printed product
   *  is `lifetime * threshold * benefit` and the other two are integers. */
  divides: number;
  raw: string;
}

export type Constraint = MovableConstraint | GivConstraint;

export interface RejectedConstraint {
  loop: string;
  raw: string;
  reason: string;
}

export interface ConstraintHarvest {
  constraints: Constraint[];
  rejected: RejectedConstraint[];
}

/** Flags that switch a desirability test off entirely. */
export const THRESHOLD_DEFEATING_FLAGS = ["-fmove-all-movables", "-freduce-all-givs"];

/**
 * Turn one function's trace into constraints.
 *
 * `cc1Flags` is required rather than assumed: `-fmove-all-movables` makes
 * every move unconditional and `-freduce-all-givs` makes every giv survive, so
 * under either flag the decisions say nothing about the threshold at all.
 */
export function harvestConstraints(
  trace: LoopTrace,
  options: { functionName?: string; cc1Flags?: string[] } = {},
): ConstraintHarvest {
  const functionName = options.functionName ?? trace.functionName;
  const flags = options.cc1Flags ?? [];
  const constraints: Constraint[] = [];
  const rejected: RejectedConstraint[] = [];

  const defeated = THRESHOLD_DEFEATING_FLAGS.filter((flag) => flags.includes(flag));

  for (const pass of trace.passes) {
    for (const loop of pass.loops) {
      const key = `${loop.from}..${loop.to}`;
      if (defeated.length > 0) {
        for (const movable of loop.movables) {
          if (movable.decision === "moved" || movable.decision === "not desirable") {
            rejected.push({ loop: key, raw: movable.raw, reason: `${defeated.join(" and ")} in effect — the desirability test did not decide this` });
          }
        }
        continue;
      }
      harvestLoop(loop, { functionName, pass: pass.index, key, constraints, rejected });
    }
  }
  return { constraints, rejected };
}

function harvestLoop(
  loop: LoopRecord,
  context: {
    functionName: string;
    pass: number;
    key: string;
    constraints: Constraint[];
    rejected: RejectedConstraint[];
  },
): void {
  const { functionName, pass, key, constraints, rejected } = context;

  /* `already_moved` is per-loop and is set both for the moved register and for
     every movable that matched it. A movable whose regno is in this set moved
     through the first disjunct, whatever the product would have said. */
  const alreadyMoved = new Set<number>();
  /* Moves that certainly took 3 off the threshold, and moves that may have.
     The `m->partial && m->match` path emits without decaying, and `partial` is
     not printed — so a moved movable that also printed `matches` leaves the
     decay uncertain. Lower bounds then use the smaller count and upper bounds
     the larger, which is sound in both directions. */
  let decayCertain = 0;
  let decayPossible = 0;

  for (const movable of loop.movables) {
    const carried = alreadyMoved.has(movable.regno);

    if (movable.decision === "moved" || movable.decision === "not desirable") {
      const savings = movable.savings;
      if (savings === undefined) {
        rejected.push({ loop: key, raw: movable.raw, reason: "no savings printed, so the product is unknown" });
      } else {
        const product = savings * movable.life;
        const denominator = movable.halved ? loop.insnCount * 2 : loop.insnCount;
        if (product <= 0) {
          rejected.push({ loop: key, raw: movable.raw, reason: `product ${product} is not positive, so the inequality bounds nothing` });
        } else if (movable.decision === "not desirable") {
          /* Every disjunct failed. threshold_eff * product < denominator, so
             threshold_eff <= ceil(denominator / product) - 1, and the initial
             threshold is at most that plus the decay already taken. */
          constraints.push({
            kind: "movable", function: functionName, pass, loop: key,
            insn: movable.insn, regno: movable.regno, savings, life: movable.life,
            denominator, decay: decayPossible,
            bound: { op: "<=", value: leastPassingThreshold(product, denominator) - 1 + 3 * decayPossible },
            raw: movable.raw,
          });
        } else if (carried) {
          rejected.push({ loop: key, raw: movable.raw, reason: `already_moved[${movable.regno}] was set by an earlier move in this loop, so the move proves nothing about the threshold` });
        } else if (movable.forces !== undefined) {
          rejected.push({ loop: key, raw: movable.raw, reason: `forces ${movable.forces} — the fourth disjunct could have carried this move` });
        } else {
          constraints.push({
            kind: "movable", function: functionName, pass, loop: key,
            insn: movable.insn, regno: movable.regno, savings, life: movable.life,
            denominator, decay: decayCertain,
            bound: { op: ">=", value: leastPassingThreshold(product, denominator) + 3 * decayCertain },
            raw: movable.raw,
          });
        }
      }
    }

    if (movable.decision === "moved") {
      alreadyMoved.add(movable.regno);
      for (const other of loop.movables) {
        if (other.matches === movable.insn) alreadyMoved.add(other.regno);
      }
      decayPossible++;
      if (movable.matches === undefined) decayCertain++;
    }
  }

  for (const giv of loop.givs) {
    if (!giv.rejected) continue;
    const magnitude = Math.abs(giv.rejected.product);
    const raw = `giv of insn ${giv.insn} not worth while, ${giv.rejected.product} vs ${giv.rejected.insnCount}.`;
    if (magnitude === 0) {
      rejected.push({ loop: key, raw, reason: "the printed product is zero, which every threshold divides" });
      continue;
    }
    constraints.push({
      kind: "giv", function: functionName, pass, loop: key,
      insn: giv.insn, product: giv.rejected.product, insnCount: giv.rejected.insnCount,
      divides: magnitude, raw,
    });
  }
}

/* ---- solving ------------------------------------------------------------ */

/** Above the largest plausible `FIRST_PSEUDO_REGISTER` for a 32-bit target. */
const MAX_NON_FIXED_REGS = 256;

export interface LoopBracket {
  loop: string;
  function: string;
  pass: number;
  /** Tightest lower bound on this loop's move_movables threshold, with its witness. */
  lower?: { value: number; witness: string };
  upper?: { value: number; witness: string };
  /** Values the strength-reduce threshold must divide, with their witnesses. */
  divisors: Array<{ value: number; witness: string }>;
}

export interface ThresholdSolution {
  /** Feasible values of `n_non_fixed_regs`, the one compilation-wide unknown. */
  candidates: number[];
  brackets: LoopBracket[];
  /** True when every constraint can be satisfied by some candidate. */
  consistent: boolean;
  constraintCount: number;
}

function bracketsOf(constraints: Constraint[]): LoopBracket[] {
  const byLoop = new Map<string, LoopBracket>();
  for (const constraint of constraints) {
    const key = `${constraint.function}#${constraint.pass}#${constraint.loop}`;
    let bracket = byLoop.get(key);
    if (!bracket) {
      bracket = { loop: constraint.loop, function: constraint.function, pass: constraint.pass, divisors: [] };
      byLoop.set(key, bracket);
    }
    if (constraint.kind === "giv") {
      bracket.divisors.push({ value: constraint.divides, witness: constraint.raw });
      continue;
    }
    if (constraint.bound.op === ">=") {
      if (!bracket.lower || constraint.bound.value > bracket.lower.value) {
        bracket.lower = { value: constraint.bound.value, witness: constraint.raw };
      }
    } else if (!bracket.upper || constraint.bound.value < bracket.upper.value) {
      bracket.upper = { value: constraint.bound.value, witness: constraint.raw };
    }
  }
  return [...byLoop.values()];
}

/** Does one loop admit a call multiplier that satisfies all its constraints? */
function loopAdmits(bracket: LoopBracket, nonFixedRegs: number): boolean {
  return admissibleMultipliers(bracket, nonFixedRegs).length > 0;
}

/**
 * Intersect every loop's constraints on the one shared unknown.
 *
 * `loop_has_call` is not in the log, so each loop's multiplier is existentially
 * quantified: a candidate survives when *some* multiplier works for *every*
 * loop. That is weaker than knowing the multiplier and still strong enough —
 * one rejected giv usually pins the value on its own, because `threshold`
 * divides the printed product and the product is rarely composite enough to
 * admit two thresholds above 3.
 */
export function solveThreshold(constraints: Constraint[]): ThresholdSolution {
  const brackets = bracketsOf(constraints);
  const candidates: number[] = [];
  for (let nonFixedRegs = 0; nonFixedRegs <= MAX_NON_FIXED_REGS; nonFixedRegs++) {
    if (brackets.every((bracket) => loopAdmits(bracket, nonFixedRegs))) candidates.push(nonFixedRegs);
  }
  return { candidates, brackets, consistent: candidates.length > 0, constraintCount: constraints.length };
}

export function thresholdsFor(nonFixedRegs: number): {
  moveWithCall: number; moveWithoutCall: number; reduceWithCall: number; reduceWithoutCall: number;
} {
  return {
    moveWithCall: 1 * (1 + nonFixedRegs),
    moveWithoutCall: 2 * (1 + nonFixedRegs),
    reduceWithCall: 1 * (3 + nonFixedRegs),
    reduceWithoutCall: 2 * (3 + nonFixedRegs),
  };
}

/**
 * Does one loop admit this call multiplier?
 *
 * `loop_has_call` decides whether the threshold is `(1 + n)` or `2 * (1 + n)`,
 * and the log never says which. Where a loop's own decisions admit only one,
 * the multiplier is settled for that loop and its arithmetic becomes exact.
 */
export function admissibleMultipliers(bracket: LoopBracket | undefined, nonFixedRegs: number): number[] {
  if (!bracket) return [1, 2];
  return [1, 2].filter((multiplier) => {
    const moveThreshold = multiplier * (1 + nonFixedRegs);
    const reduceThreshold = multiplier * (3 + nonFixedRegs);
    if (bracket.lower && moveThreshold < bracket.lower.value) return false;
    if (bracket.upper && moveThreshold > bracket.upper.value) return false;
    return !bracket.divisors.some((divisor) => divisor.value % reduceThreshold !== 0);
  });
}

/**
 * What each movable's decision hinged on, once the threshold is a number.
 *
 * This is the answer to "what would have to change for this insn to stay in
 * the loop", stated as the quantity `move_movables` actually compares:
 * `savings * lifetime` against `ceil(denominator / threshold_effective)`.
 *
 * Both terms are reachable from source. `savings` starts as
 * `n_times_set[regno]` and *absorbs the savings of every movable that matches
 * or forces it*; `lifetime` is the luid distance between the register's first
 * and last use in the loop and absorbs the matched movables' lifetimes the
 * same way. So a second materialisation of the same value inside the loop does
 * not cost a hoist — it feeds one.
 */
export interface MovableMargin {
  pass: number;
  loop: string;
  insn: number;
  multiplier: number;
  effectiveThreshold: number;
  /** Least `savings * lifetime` that moves at this position. */
  requiredProduct: number;
  actualProduct: number;
  decay: number;
  decision: string;
  /**
   * Set when the movable's outcome is not the one the product test implies —
   * which is not a contradiction but a different clause of the disjunction
   * carrying it, named here so the arithmetic does not read as wrong.
   */
  carriedBy?: string;
  /** Position in the log's loop order, not the insn UID's numeric order. */
  loopOrder: number;
  initialThreshold: number;
  insnCount: number;
  savings: number;
  lifetime: number;
  movedOnce: boolean;
  /** Instructions by which N exceeds the largest N that still moves. */
  declineSlack: number;
  /** N can grow this much before the product ceases to pass. */
  moveHeadroom: number;
}

/**
 * Which loops contain which, from their insn-UID ranges.
 *
 * The endpoints are the UIDs of the loop's begin and end NOTEs, all created
 * during RTL expansion and therefore in stream order relative to each other.
 * Containment of the ranges is containment of the loops.
 */
function containment(loops: LoopRecord[]): Array<{ inner: number; outer: number }> {
  const pairs: Array<{ inner: number; outer: number }> = [];
  loops.forEach((inner, innerIndex) => {
    loops.forEach((outer, outerIndex) => {
      if (innerIndex === outerIndex) return;
      if (outer.from < inner.from && inner.to < outer.to) pairs.push({ inner: innerIndex, outer: outerIndex });
    });
  });
  return pairs;
}

/**
 * Settle each loop's call multiplier as far as the evidence allows.
 *
 * A loop's own decisions often admit both multipliers. Nesting closes the gap
 * without another assumption: `loop_has_call` is monotone under containment —
 * a call inside an inner loop is a call inside every loop that contains it —
 * so a pinned inner loop with a call pins its parents, and a parent with no
 * call pins its children.
 */
export function resolveMultipliers(
  loops: LoopRecord[],
  bracketFor: (loop: LoopRecord) => LoopBracket | undefined,
  nonFixedRegs: number,
): number[][] {
  const admissible = loops.map((loop) => admissibleMultipliers(bracketFor(loop), nonFixedRegs)
    .filter((multiplier) => loop.hasCall === undefined || multiplier === (loop.hasCall ? 1 : 2)));
  const pairs = containment(loops);
  let changed = true;
  while (changed) {
    changed = false;
    for (const { inner, outer } of pairs) {
      /* Inner loop provably has a call -> so does the outer. */
      if (admissible[inner]!.length === 1 && admissible[inner]![0] === 1 && admissible[outer]!.includes(2)) {
        admissible[outer] = admissible[outer]!.filter((value) => value === 1);
        changed = true;
      }
      /* Outer loop provably has no call -> neither does the inner. */
      if (admissible[outer]!.length === 1 && admissible[outer]![0] === 2 && admissible[inner]!.includes(1)) {
        admissible[inner] = admissible[inner]!.filter((value) => value === 2);
        changed = true;
      }
    }
  }
  return admissible;
}

export function movableMargins(
  trace: { passes: Array<{ index: number; loops: LoopRecord[] }> },
  nonFixedRegs: number,
  brackets: LoopBracket[],
): MovableMargin[] {
  const margins: MovableMargin[] = [];
  for (const pass of trace.passes) {
    const multipliers = resolveMultipliers(
      pass.loops,
      (loop) => brackets.find((entry) => entry.pass === pass.index && entry.loop === `${loop.from}..${loop.to}`),
      nonFixedRegs,
    );
    pass.loops.forEach((loop, loopIndex) => {
      const key = `${loop.from}..${loop.to}`;
      if (multipliers[loopIndex]!.length !== 1) return;
      const multiplier = multipliers[loopIndex]![0]!;
      const initial = multiplier * (1 + nonFixedRegs);
      const alreadyMoved = new Set<number>();
      let decay = 0;
      for (const [loopOrder, movable] of loop.movables.entries()) {
        if (movable.savings !== undefined && (movable.decision === "moved" || movable.decision === "not desirable")) {
          const effective = initial - 3 * decay;
          const denominator = movable.halved ? loop.insnCount * 2 : loop.insnCount;
          const required = effective > 0 ? Math.ceil(denominator / effective) : Number.POSITIVE_INFINITY;
          const actual = movable.savings * movable.life;
          const productMoves = actual >= required;
          const carriedBy = movable.decision === "moved" && !productMoves
            ? (alreadyMoved.has(movable.regno)
                ? `already_moved[${movable.regno}]`
                : movable.forces !== undefined ? `forces ${movable.forces}` : "a clause this tool cannot see")
            : undefined;
          margins.push({
            pass: pass.index, loop: key, insn: movable.insn, multiplier,
            effectiveThreshold: effective, requiredProduct: required, actualProduct: actual,
            decay, decision: movable.decision, ...(carriedBy === undefined ? {} : { carriedBy }),
            loopOrder, initialThreshold: initial, insnCount: loop.insnCount, savings: movable.savings,
            lifetime: movable.life, movedOnce: movable.halved,
            declineSlack: loop.insnCount - Math.floor(effective * actual / (movable.halved ? 2 : 1)),
            moveHeadroom: Math.floor(effective * actual / (movable.halved ? 2 : 1)) - loop.insnCount,
          });
        }
        if (movable.decision === "moved") {
          alreadyMoved.add(movable.regno);
          for (const other of loop.movables) {
            if (other.matches === movable.insn) alreadyMoved.add(other.regno);
          }
          if (movable.matches === undefined) decay++;
        }
      }
    });
  }
  return margins;
}
