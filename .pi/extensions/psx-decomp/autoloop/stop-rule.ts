import { readClosed } from "../../../../tools/agent/closedDirections.ts";
import { best, measurements, readLedger } from "../../../../tools/agent/experimentLedger.ts";
import type { ResidualReading } from "../autonomous/gates.ts";
import type { LoopConfig } from "./types.ts";

/**
 * When a tier is allowed to stop working a function.
 *
 * The loop used to stop on a counter: `returnsPerTier` non-matching returns and
 * the function was parked, whatever those returns had established. Measured
 * over one overnight run that spent 68% of its wall clock — 9.4 hours of 13.8 —
 * on the nine functions it gave up on, and at least two of those needed a
 * four-line edit it had not yet tried. The doctrine already said the opposite:
 * "park a function only when a human decision is required… never merely because
 * it is hard". The doctrine and the harness disagreed and the harness decided.
 *
 * So the counter becomes a floor and the *evidence* becomes the condition. A
 * tier may stop when all of these hold:
 *
 *   - it has had its minimum number of returns;
 *   - the residual has not improved across K distinct measurements — counted
 *     from the ledger, which survives a context clear, and excluding
 *     respellings of programs already measured;
 *   - at least one heavy tool has been run and its answer recorded, so the
 *     park hands the next reader a closed direction rather than a shrug.
 *
 * And two conditions stop it early, both of which mean the search cannot
 * succeed rather than has not yet:
 *
 *   - a *blocked* reading: the residual contains words no source edit can move,
 *     because the build cannot express the function. Park immediately, with
 *     that as the reason.
 *   - the wall clock, which escalates rather than parks.
 */
export interface StopVerdict {
  /** Stop working this function on this tier. */
  stop: boolean;
  /** Park now, with this reason, rather than escalating. */
  parkNow?: "blocked";
  /** One line for the operator and for the park note. */
  detail: string;
}

/** A residual whose terms no source edit can move. */
export function blockedReading(residual: ResidualReading | null | undefined): string | undefined {
  if (!residual) return undefined;
  const blind = residual.objective.blindBlocks ?? [];
  const undetermined = residual.objective.undetermined ?? 0;
  if (undetermined === 0 || blind.length === 0) return undefined;
  return (
    `${undetermined} word(s) in block ${blind.join(", ")} could not be resolved: a relocation whose ` +
    "symbol has no known address. No source this function can be given moves them, because the " +
    "difference is in the build's own configuration — most often a jump table with no `.rodata` " +
    "attribution in the container's splat config. Fix the configuration, then re-open the function."
  );
}

export interface StopInput {
  config: LoopConfig;
  functionName: string;
  /** Returns this tier has already had. */
  returns: number;
  /** Milliseconds since this tier started on this function. */
  elapsedMs: number;
  residual: ResidualReading | null | undefined;
}

export function shouldStop(input: StopInput): StopVerdict {
  const blocked = blockedReading(input.residual);
  if (blocked) return { stop: true, parkNow: "blocked", detail: blocked };

  if (input.config.tierMinutes > 0 && input.elapsedMs >= input.config.tierMinutes * 60_000) {
    return {
      stop: true,
      detail: `${Math.round(input.elapsedMs / 60_000)} minutes on this tier — the ceiling is ${input.config.tierMinutes}`,
    };
  }

  if (input.returns >= input.config.maxReturnsPerTier) {
    return { stop: true, detail: `${input.returns} returns — the hard bound is ${input.config.maxReturnsPerTier}` };
  }

  if (input.returns < input.config.returnsPerTier) {
    return { stop: false, detail: `${input.returns} of at least ${input.config.returnsPerTier} returns` };
  }

  const stalled = stalledMeasurements(input.functionName);
  if (stalled < input.config.parkAfterStalledMeasurements) {
    return {
      stop: false,
      detail: `${stalled} distinct measurement(s) since the residual last improved; the search is still moving`,
    };
  }

  const closed = readClosed(input.functionName);
  if (closed.length === 0) {
    return {
      stop: false,
      detail:
        `${stalled} measurements without improvement, but no heavy tool has recorded an answer. ` +
        "A park with nothing closed hands the next reader the same starting position.",
    };
  }

  return {
    stop: true,
    detail: `${stalled} distinct measurements without improvement, and ${closed.length} direction(s) recorded as answered`,
  };
}

/**
 * Distinct measurements since the residual last improved.
 *
 * Respellings are excluded: a source that reaches an already-measured program
 * is the same experiment arrived at again, not an experiment that failed to
 * move, and counting it as failure makes a search that is opening its own space
 * look like one that has run out of ideas.
 */
export function stalledMeasurements(functionName: string): number {
  const entries = measurements(readLedger(functionName));
  if (entries.length === 0) return 0;
  const winner = best(entries);
  if (!winner) return 0;
  const index = entries.findIndex((entry) => entry.at === winner.at && entry.sourceHash === winner.sourceHash);
  return index < 0 ? 0 : entries.length - 1 - index;
}
