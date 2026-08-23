/**
 * compare.ts — turn the requirement into a goal, and score a candidate on it.
 *
 * The requirement says which preheader groups the original cannot have emitted
 * before pass 2. The candidate's loop trace says which symbols *it* emitted, in
 * which pass. Matching them by symbol gives a predicate an agent can iterate
 * against — and, unlike the byte residual, one that moves.
 *
 * That distinction is the reason this exists. On `ovl_10_func_800BA394` the
 * byte residual is flat across the whole family of source spellings, and it
 * ranks the one variant that gets the mechanism right forty-four words *worse*
 * than variants that get it wrong. A search steered by it cannot find the
 * answer no matter how long it runs.
 */

import { EmissionClass, type PreheaderGroup, type PreheaderRequirement } from "./types.js";
import { pass2Routes, type Pass2Route } from "./derive.js";
import type { LoopTrace } from "../loop-trace/types.js";

/** Every non-decreasing class assignment over a preheader, up to a bound. */
export function assignments(requirement: PreheaderRequirement, limit = 512): EmissionClass[][] {
  const results: EmissionClass[][] = [];
  const groups = requirement.groups;
  const walk = (index: number, floor: EmissionClass, prefix: EmissionClass[]): void => {
    if (results.length >= limit) return;
    if (index === groups.length) { results.push([...prefix]); return; }
    for (const candidate of groups[index]!.consistent) {
      if (candidate < floor) continue;
      prefix.push(candidate);
      walk(index + 1, candidate, prefix);
      prefix.pop();
    }
  };
  walk(0, EmissionClass.Source, []);
  return results;
}

export interface EmissionGoal {
  group: PreheaderGroup;
  /** Name for reading. The identity is `address`. */
  symbol: string;
  /** Exact address the group materialises — the only sound identity. */
  address?: number;
  /** True when no reading at all lets pass 1 or the source emit this group. */
  unconditional: boolean;
  /**
   * True when every reading in which *anything earlier* was hoisted puts this
   * group in pass 2. The escape is the all-source reading, where the C names
   * every address — which is a real reading, and the candidate may be in it.
   */
  whenAnythingHoisted: boolean;
  /**
   * How the original's loop pass can have got it there.
   *
   * Carried on the goal because the goal without them is a coordinate: "this
   * cannot be a pass-1 emission" leaves an agent to work out what can produce a
   * pass-2 one, and the enumeration it will reach for unaided is missing the
   * route that is usually the answer in a nest.
   */
  routes: Pass2Route[];
}

/** The groups whose class the ordering constrains beyond their own evidence. */
export function goalsFor(requirement: PreheaderRequirement): EmissionGoal[] {
  const options = assignments(requirement);
  const goals: EmissionGoal[] = [];

  requirement.groups.forEach((group, index) => {
    if (group.symbol === undefined) return;
    if (group.consistent.length === 0) return;
    const unconditional = group.consistent.every((value) => value >= EmissionClass.Pass2Movable);
    const hoistedOptions = options.filter((assignment) =>
      assignment.slice(0, index).some((value) => value >= EmissionClass.Pass1Movable));
    const whenAnythingHoisted = hoistedOptions.length > 0
      && hoistedOptions.every((assignment) => assignment[index]! >= EmissionClass.Pass2Movable);
    if (unconditional || whenAnythingHoisted) {
      goals.push({
        group,
        symbol: group.symbol,
        ...(group.symbolAddress === undefined ? {} : { address: group.symbolAddress }),
        unconditional,
        whenAnythingHoisted,
        routes: pass2Routes(requirement, group),
      });
    }
  });
  return goals;
}

/* ---- what the candidate actually did ------------------------------------ */

/** Resolve a name the compiler's RTL used to the address it denotes. */
export type AddressOfSymbol = (name: string) => number | undefined;

/** Every address a trace-side symbol string denotes; comma-joined names split. */
function addressesOf(symbol: string | undefined, addressOf: AddressOfSymbol): number[] {
  if (symbol === undefined) return [];
  return symbol
    .split(",")
    .map((name) => addressOf(name.trim()))
    .filter((address): address is number => address !== undefined);
}

/**
 * The decision behind one emission, with the terms that decided it.
 *
 * Carried so a lever can name a *source edit* rather than a direction.
 * `savings` and `lifetime` are not opaque: `savings` starts at
 * `n_times_set[regno]` and absorbs every movable that matches or forces this
 * one, and `lifetime` is the luid span of the register in the loop and absorbs
 * theirs too. Both terms therefore decompose into things the source controls —
 * how many times the value is materialised in the loop, and how far apart its
 * first and last use are.
 */
export interface EmissionDetail {
  insn: number;
  savings?: number;
  lifetime: number;
  /** Movables that matched this one; each contributed its savings and lifetime. */
  matchedBy: number[];
  /** Movables forced by this one; same contribution, and inseparable from it. */
  forcedBy: number[];
  /** The loop's `insn_count`, the denominator of the desirability test. */
  insnCount: number;
}

/** What one loop's own emissions were, in the candidate. */
export interface LoopEmissions {
  /** `from..to` from the loop log, which is stable across passes. */
  key: string;
  addresses: Map<number, EmissionClass>;
  /** Why, for the addresses a movable decision produced. */
  detail: Map<number, EmissionDetail>;
}

export interface CandidateClassing {
  loops: LoopEmissions[];
  /** Hoists whose symbol no address could be found for. */
  unresolved: string[];
}

/**
 * Read the candidate's own emission assignment out of its loop trace, per loop.
 *
 * Per loop, not per function: one address can be hoisted out of two different
 * loops in the same function with different classes, and a single
 * address-to-class map cannot tell those apart. It silently attributed one
 * loop's hoist to another preheader's group before this was split out.
 *
 * A `%hi`/`%lo` pair is two movables and one materialisation, so the first
 * class seen for an address in a loop is the one — the pair moves as a unit and
 * `force_movables` has already tied them together.
 */
export function classifyCandidate(trace: LoopTrace, addressOf: AddressOfSymbol): CandidateClassing {
  const byKey = new Map<string, { addresses: Map<number, EmissionClass>; detail: Map<number, EmissionDetail> }>();
  const unresolved: string[] = [];

  for (const pass of trace.passes) {
    for (const loop of pass.loops) {
      const key = `${loop.from}..${loop.to}`;
      const entry = byKey.get(key) ?? { addresses: new Map<number, EmissionClass>(), detail: new Map<number, EmissionDetail>() };
      byKey.set(key, entry);
      const { addresses, detail } = entry;
      const note = (found: number[], value: EmissionClass): void => {
        for (const address of found) if (!addresses.has(address)) addresses.set(address, value);
      };
      for (const movable of loop.movables) {
        if (movable.decision !== "moved") continue;
        const found = addressesOf(movable.symbol, addressOf);
        if (found.length === 0) { unresolved.push(`pass ${pass.index} movable insn ${movable.insn}`); continue; }
        note(found, pass.index === 1 ? EmissionClass.Pass1Movable : EmissionClass.Pass2Movable);
        for (const address of found) {
          if (detail.has(address)) continue;
          detail.set(address, {
            insn: movable.insn,
            ...(movable.savings === undefined ? {} : { savings: movable.savings }),
            lifetime: movable.life,
            matchedBy: loop.movables.filter((other) => other.matches === movable.insn).map((other) => other.insn),
            forcedBy: loop.movables.filter((other) => other.forces === movable.insn).map((other) => other.insn),
            insnCount: loop.insnCount,
          });
        }
      }
      for (const giv of loop.givs) {
        if (giv.reducedTo === undefined) continue;
        note(addressesOf(giv.symbol, addressOf), pass.index === 1 ? EmissionClass.Pass1GivInit : EmissionClass.Pass2GivInit);
      }
    }
  }
  return { loops: [...byKey].map(([key, value]) => ({ key, ...value })), unresolved };
}

/**
 * Match each preheader to the loop whose emissions it holds.
 *
 * The two sides are indexed differently and cannot be joined directly: the
 * requirement is in machine blocks, the trace is in RTL insn UIDs. What they do
 * share is *what was emitted*, so preheaders are assigned to loops so as to
 * maximise total overlap of emitted addresses. The optimum is taken over whole
 * assignments rather than greedily, because a locally tied pair is often
 * settled by what the other preheaders need — a greedy veto refused a correct
 * join and threw the answer away.
 *
 * Where two distinct optimal assignments disagree about a preheader, that
 * preheader is left unjoined and judged on nothing.
 */
export function matchLoops(
  preheaders: PreheaderRequirement[],
  classing: CandidateClassing,
): Map<number, LoopEmissions> {
  const overlap = (preheader: PreheaderRequirement, loop: LoopEmissions): number =>
    new Set(preheader.groups
      .map((group) => group.symbolAddress)
      .filter((address): address is number => address !== undefined && loop.addresses.has(address))).size;

  const scores = preheaders.map((preheader) => classing.loops.map((loop) => overlap(preheader, loop)));

  /* Injective assignments of preheaders to loops, scored. Both sides are a
     handful of loops, so exhaustive is exact and instant. */
  let bestScore = -1;
  let optima: Array<Array<number | undefined>> = [];
  const walk = (index: number, used: Set<number>, chosen: Array<number | undefined>, score: number): void => {
    if (index === preheaders.length) {
      if (score > bestScore) { bestScore = score; optima = [[...chosen]]; }
      else if (score === bestScore) optima.push([...chosen]);
      return;
    }
    walk(index + 1, used, [...chosen, undefined], score);
    for (let loop = 0; loop < classing.loops.length; loop++) {
      if (used.has(loop) || scores[index]![loop]! === 0) continue;
      used.add(loop);
      walk(index + 1, used, [...chosen, loop], score + scores[index]![loop]!);
      used.delete(loop);
    }
  };
  walk(0, new Set(), [], 0);

  const matches = new Map<number, LoopEmissions>();
  preheaders.forEach((preheader, index) => {
    const choices = new Set(optima.map((assignment) => assignment[index]));
    if (choices.size !== 1) return;
    const loop = [...choices][0];
    if (loop === undefined) return;
    matches.set(preheader.block, classing.loops[loop]!);
  });
  return matches;
}

/* ---- scoring ------------------------------------------------------------ */

/**
 * `undetermined` is a first-class outcome, not a rounding of `met`.
 *
 * Matching is by address, and an address either side cannot produce — or that
 * two groups of one preheader share — means the tool does not know. Reporting
 * that as `met` is the failure this type exists to prevent: it did exactly
 * that twice while this was being built, and both times read as a clean pass.
 */
export type GoalOutcome = "met" | "not-met" | "undetermined";

export interface GroupVerdict {
  group: PreheaderGroup;
  address: number;
  /** What the candidate's own loop pass did with it. */
  actual: EmissionClass;
  /** What this group can be on its own evidence and position. */
  admissible: EmissionClass[];
  outcome: GoalOutcome;
  /** The decision's own terms, when a movable produced it. */
  detail?: EmissionDetail;
  /**
   * Source edits that would change the decision, instantiated on this
   * candidate's own numbers. A direction an agent cannot type is not guidance.
   */
  moves?: string[];
  lever?: string;
}

export interface PreheaderVerdict {
  preheader: PreheaderRequirement;
  /** The trace loop this preheader was joined to, when one could be. */
  loop?: string;
  groups: GroupVerdict[];
  /**
   * The readings of the target's preheader that hold every class the candidate
   * actually produced.
   *
   * Empty means no reading does — the combination is impossible. Exactly one
   * means the two sides together have pinned what the original's loop pass did,
   * which is the strongest statement this tool can make and is worth saying
   * outright: the requirement has stopped being a range.
   */
  readings: EmissionClass[][];
  /**
   * Set when every group's class is individually possible but no single
   * reading of the preheader holds all of them at once. That is a distinct
   * failure from a group being in an impossible class, and it is the one that
   * matters here: it means the *combination* has to change, and it names which
   * readings are still open.
   */
  combinationImpossible: boolean;
  consistentWithTarget: boolean;
  undetermined: string[];
}

/**
 * Source edits that would move one group from the class it has to a class the
 * target admits, instantiated on this candidate's own numbers.
 *
 * Keyed on the *transition*, not on where the candidate is: "you are a pass-1
 * movable" is a reading, "become a pass-2 movable" is a different job from
 * "become a source statement", and an agent needs the second. Each move names a
 * term and what in the source sets it, because `move_movables` compares
 * `savings * lifetime` against `ceil(insn_count / threshold)` and both factors
 * decompose:
 *
 *   savings   = n_times_set[regno], plus every movable that matches or forces
 *               this one (combine_movables and force_movables add theirs in)
 *   lifetime  = luid(last use in loop) - luid(first use in loop), plus theirs
 */
export function movesFor(
  actual: EmissionClass,
  required: EmissionClass[],
  detail: EmissionDetail | undefined,
  routes: Pass2Route[] = [],
): string[] {
  const want = required.filter((value) => value !== actual);
  const moves: string[] = [];
  const cascadeOpen = routes.some((route) => route.id === "inner-cascade");

  const terms = (): void => {
    if (detail === undefined) {
      moves.push("Run psx_loop_trace to see the savings and lifetime that decided it.");
      return;
    }
    const product = (detail.savings ?? 0) * detail.lifetime;
    moves.push(
      `insn ${detail.insn} decided on savings ${detail.savings ?? "?"} x lifetime ${detail.lifetime} = ${product} ` +
      `against insn_count ${detail.insnCount}; psx_loop_trace prints the bar it had to clear.`);
    if (detail.forcedBy.length > 0) {
      moves.push(
        `INSEPARABLE PAIR — insn ${detail.forcedBy.join(", ")} ${detail.forcedBy.length > 1 ? "are" : "is"} forced by it, so ` +
        "force_movables has already summed both halves' savings and lifetimes into this one. Neither term reaches 1 " +
        "while the pair exists, so the product floors at 2x2 = 4. Do not spend edits lowering it; go at invariance. " +
        (cascadeOpen
          ? "NOTE that this floor closes the pass-1-decline route ONLY. It says nothing about the cascade route " +
            "below, where pass 1 of this loop never evaluates the pair at all."
          : ""));
    }
    if (detail.matchedBy.length > 0) {
      moves.push(
        `LOWER SAVINGS — insn ${detail.matchedBy.join(", ")} materialise the same value elsewhere in the loop and ` +
        "combine_movables folds each one's savings and lifetime into this one. Remove a second materialisation from " +
        "the body (reuse the value already computed, or lift that use out) and both terms drop. Note the direction: " +
        "a duplicate use FEEDS the hoist, it does not compete with it.");
    }
    moves.push(
      `LOWER LIFETIME — ${detail.lifetime} is the luid distance between the register's first and last use inside the ` +
      "loop. Bring the uses together; a use near the top of the body and another near the bottom is what stretches " +
      "it. Reordering statements inside the loop changes this without changing what the loop computes.");
  };

  if (want.includes(EmissionClass.Pass2Movable) || want.includes(EmissionClass.Pass2GivInit)) {
    moves.push(
      "MAKE IT A PASS-2 EMISSION. These are different mechanisms, not rewordings of one. The first two put " +
      "the value through pass 1 of this loop and turn on what pass 1 decided; the third keeps it out of " +
      "pass 1's sight altogether, and for that one no desirability argument about this loop applies at all.");
    moves.push(
      "  (i) BREAK PASS-1 INVARIANCE — make the address computation depend on something the loop writes, so it is " +
      "not a loop-invariant set when pass 1 looks. Index the object through a value the loop updates rather than " +
      "forming its address once. Pass 1's own strength reduction then rewrites the address, and what is left is " +
      "invariant for pass 2.");
    moves.push(
      "  (ii) BECOME AN INDUCTION EXPRESSION — write the access as base + a value the loop steps by a constant. " +
      "Pass 1 reduces the offset to a pseudo, pass 2 sees that pseudo as a biv, and the base becomes a giv of it " +
      "whose init emit_iv_add_mult puts in the preheader after everything pass 1 emitted.");
    /* The route the enumeration was missing, and the only one whose eligibility
       is a fact about the target rather than about the edit — so it is stated
       only when the target's own nest leaves it open. */
    const cascade = routes.find((route) => route.id === "inner-cascade");
    if (cascade) {
      moves.push(`  (iii) CASCADE OUT OF A NESTED LOOP — ${cascade.summary}`);
      for (const line of cascade.evidence) moves.push(`    evidence: ${line}`);
      for (const line of cascade.requirements) moves.push(`    needs: ${line}`);
    }
    terms();
  }
  if (want.includes(EmissionClass.Source)) {
    moves.push(
      "MAKE IT A SOURCE STATEMENT — the original put this in the preheader itself. Hold the address in a local " +
      "assigned before the loop and use that local inside the body, so there is nothing left for move_movables to " +
      "hoist. Check the population term after: naming an address lets gcse reuse an earlier %hi across a diamond " +
      "where the target re-materialises it, which trades this word for a different one.");
  }
  if (want.includes(EmissionClass.Pass1GivInit)) {
    moves.push(
      "MAKE IT A REDUCED GIV — stop assigning it in the source and derive it from the loop counter instead " +
      "(`counter * stride` at each use rather than a variable stepped alongside). strength_reduce then creates the " +
      "pseudo and emits its initialisation, which lands after pass 1's movables rather than before them.");
  }
  if (want.includes(EmissionClass.Pass1Movable)) {
    moves.push(
      "MAKE IT A PASS-1 MOVABLE — stop naming it in the source and let the body reference the object directly, so " +
      "the address becomes a loop-invariant set move_movables can lift.");
    terms();
  }
  if (moves.length === 0) {
    moves.push("No reading of the target's preheader holds any other class at this position.");
  }
  return moves;
}

export function checkPreheader(
  requirement: PreheaderRequirement,
  emissions: LoopEmissions | undefined,
  unresolved: string[],
): PreheaderVerdict {
  const addressed = requirement.groups
    .map((group, index) => ({ group, index }))
    .filter((entry) => entry.group.symbolAddress !== undefined);

  const occurrences = new Map<number, number>();
  for (const entry of addressed) {
    const address = entry.group.symbolAddress!;
    occurrences.set(address, (occurrences.get(address) ?? 0) + 1);
  }

  const attributable = (index: number): boolean =>
    emissions !== undefined && (occurrences.get(requirement.groups[index]!.symbolAddress!) ?? 0) === 1;
  const actualOf = (index: number): EmissionClass =>
    emissions?.addresses.get(requirement.groups[index]!.symbolAddress!) ?? EmissionClass.Source;

  const groups: GroupVerdict[] = addressed.map((entry) => {
    const address = entry.group.symbolAddress!;
    const actual = actualOf(entry.index);

    if (!attributable(entry.index)) {
      return {
        group: entry.group, address, actual, admissible: entry.group.consistent,
        outcome: "undetermined" as const,
        lever: emissions === undefined
          ? "this preheader could not be joined to a loop in the candidate's trace, so nothing " +
            "the candidate did can be attributed to it"
          : "two groups of this preheader materialise the same address, so the candidate's " +
            "emission class cannot be attributed to one of them",
      };
    }

    const outcome: GoalOutcome = entry.group.consistent.includes(actual) ? "met" : "not-met";
    const verdict: GroupVerdict = { group: entry.group, address, actual, admissible: entry.group.consistent, outcome };
    const detail = emissions?.detail.get(address);
    if (detail !== undefined) verdict.detail = detail;
    if (outcome === "not-met") {
      verdict.moves = movesFor(actual, entry.group.consistent, detail, pass2Routes(requirement, entry.group));
    }
    return verdict;
  });

  /* Which readings hold every attributable group's actual class at once?
     Not just whether one does: the surviving set is the answer to "what did the
     original's loop pass do", and when it narrows to one the requirement has
     stopped being a range and become a statement. */
  const readings = assignments(requirement).filter((reading) => addressed.every((entry) =>
    !attributable(entry.index) || reading[entry.index] === actualOf(entry.index)));
  const holdsAll = readings.length > 0;
  const judged = groups.filter((group) => group.outcome !== "undetermined");
  const allIndividuallyFine = judged.length > 0 && judged.every((group) => group.outcome === "met");

  const verdict: PreheaderVerdict = {
    preheader: requirement,
    groups,
    readings,
    combinationImpossible: allIndividuallyFine && !holdsAll,
    consistentWithTarget: allIndividuallyFine && holdsAll,
    undetermined: unresolved,
  };
  if (emissions !== undefined) verdict.loop = emissions.key;
  return verdict;
}

/** Score every preheader of a function against one candidate. */
export function checkRequirement(
  preheaders: PreheaderRequirement[],
  classing: CandidateClassing,
): PreheaderVerdict[] {
  const matches = matchLoops(preheaders, classing);
  return preheaders
    .map((preheader) => checkPreheader(preheader, matches.get(preheader.block), classing.unresolved))
    .filter((verdict) => verdict.groups.length > 0);
}

/**
 * Which readings are still open for a preheader whose combination is impossible.
 *
 * This is the actionable half: it says what the candidate would have to change
 * about one group while keeping the others.
 */
export interface OneChange {
  group: GroupVerdict;
  to: EmissionClass;
  moves: string[];
}

/**
 * The single changes that would make the candidate's assignment a reading of
 * the target's preheader — each with the source edits that would make it.
 *
 * This is the actionable half. Without the moves it says "D_800BB9BC: pass-1
 * movable -> pass-2 movable", which is a coordinate, not an instruction.
 */
export function openReadings(verdict: PreheaderVerdict): OneChange[] {
  if (!verdict.combinationImpossible) return [];
  const attributed = verdict.groups.filter((group) => group.outcome !== "undetermined");
  const changes = new Map<string, OneChange>();
  for (const reading of assignments(verdict.preheader)) {
    const differing = attributed.filter((group) => reading[group.group.index] !== group.actual);
    if (differing.length !== 1) continue;
    const group = differing[0]!;
    const to = reading[group.group.index]!;
    const key = `${group.address}:${to}`;
    if (changes.has(key)) continue;
    changes.set(key, {
      group,
      to,
      moves: movesFor(group.actual, [to], group.detail, pass2Routes(verdict.preheader, group.group)),
    });
  }
  return [...changes.values()];
}

/** One number a search can minimise. Undetermined counts against, not for. */
export function emissionDistance(verdicts: PreheaderVerdict[]): number {
  const parts = emissionDistanceParts(verdicts);
  return parts.failures + parts.combinations + parts.undetermined;
}

/**
 * The distance, decomposed.
 *
 * `undetermined` is part of the total on purpose. A candidate the tool cannot
 * judge must not outrank one it can: scored as zero, a variant whose preheader
 * could not be joined to any loop came out top of the corpus.
 */
export function emissionDistanceParts(verdicts: PreheaderVerdict[]): {
  failures: number; combinations: number; undetermined: number;
} {
  return {
    failures: verdicts.reduce((total, verdict) =>
      total + verdict.groups.filter((group) => group.outcome === "not-met").length, 0),
    combinations: verdicts.filter((verdict) => verdict.combinationImpossible).length,
    undetermined: verdicts.reduce((total, verdict) =>
      total + verdict.groups.filter((group) => group.outcome === "undetermined").length, 0),
  };
}
