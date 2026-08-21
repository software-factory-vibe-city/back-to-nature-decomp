import type { AutodecompConfig, CallGraph, ControllerState, FunctionState, WorkItem } from "./types.ts";
import { eligibleState, keyOf, matchedNeighborHash } from "./call-graph.ts";

/**
 * Is this function inside the containers this run may take work from?
 *
 * `containers: null` means every container. A pinned run is the scheduling
 * shape the overlay plan argues for: the engine API is the dependency frontier,
 * and behind it a container's work needs no coordination with any other beyond
 * the shared engine symbol export.
 */
export function inScope(fn: FunctionState, config: AutodecompConfig): boolean {
  return config.containers === null || config.containers.includes(fn.container);
}

/** One function's work item, with its container carried alongside its address. */
function workItem(fn: FunctionState, mode: WorkItem["mode"], modelTier: number): WorkItem {
  return {
    mode,
    functionKey: keyOf(fn),
    functionContainer: fn.container,
    functionVram: fn.vram,
    functionName: fn.currentName,
    modelTier,
  };
}

export function modelTierForAttempt(fn: FunctionState, config: AutodecompConfig): number | undefined {
  let remaining = fn.attemptsThisEpoch;
  for (let index = 0; index < config.matching.models.length; index++) {
    const count = config.matching.models[index].maxAttempts;
    if (remaining < count) return index;
    remaining -= count;
  }
  return undefined;
}

export function nextMatchingWork(state: ControllerState, config: AutodecompConfig): WorkItem | undefined {
  const candidates = Object.values(state.functions)
    .filter((fn) => eligibleState(fn) && inScope(fn, config) && ["pending", "retry-ready", "gate-failed", "integration-failed"].includes(fn.status))
    .filter((fn) => !fn.nextEligibleAt || Date.parse(fn.nextEligibleAt) <= Date.now())
    /* The tiebreak is the full key, not the address: two containers can hold a
       function at the same address, and an address-only tiebreak both orders
       them arbitrarily and interleaves two address spaces. */
    .sort((a, b) => a.priority - b.priority || keyOf(a).localeCompare(keyOf(b)));

  for (const fn of candidates) {
    const tier = modelTierForAttempt(fn, config);
    if (tier !== undefined && fn.attemptsThisEpoch < config.budgets.maxAttemptsPerFunctionPerEpoch) {
      return workItem(fn, "match", tier);
    }
    fn.status = "parked";
    fn.parkedReason = "Attempt budget exhausted for this epoch";
  }
  return undefined;
}

export function nextTargetedRefinement(
  state: ControllerState,
  graph: CallGraph,
  config: AutodecompConfig,
  force = false,
): WorkItem | undefined {
  if (!force && state.matchesSinceTargeted < config.refinement.targetedEveryMatches) return undefined;
  const candidates = Object.values(state.functions)
    .filter((fn) => fn.status === "matched" && eligibleState(fn) && inScope(fn, config))
    .map((fn) => ({ fn, neighbors: matchedNeighborHash(keyOf(fn), state, graph) }))
    .filter(({ fn, neighbors }) => neighbors.count > 0 && neighbors.hash !== fn.lastRefinedNeighborHash)
    .sort((a, b) => a.fn.priority - b.fn.priority || keyOf(a.fn).localeCompare(keyOf(b.fn)));
  const candidate = candidates[0];
  if (!candidate) return undefined;
  return workItem(candidate.fn, "targeted-refinement", 0);
}

export function projectRefinementDue(state: ControllerState, config: AutodecompConfig, finalizing = false): boolean {
  if (finalizing) {
    return config.refinement.projectAtFinalization && state.lastProjectRefinedGraphHash !== state.graphHash;
  }
  return state.matchesSinceProject >= config.refinement.projectEveryMatches;
}

/**
 * Work this run still owes.
 *
 * Scoped to the run's containers when one is given, because a run pinned to one
 * overlay is not blocked by, and is not finished on behalf of, the rest of the
 * project. Called without a config it reports the whole project, which is what
 * a status line wants.
 */
export function pendingEligible(state: ControllerState, config?: AutodecompConfig): FunctionState[] {
  return Object.values(state.functions).filter((fn) =>
    eligibleState(fn) &&
    fn.status !== "matched" &&
    fn.status !== "manually-skipped" &&
    (!config || inScope(fn, config)));
}

export function completionReady(state: ControllerState, graph: CallGraph, config: AutodecompConfig): boolean {
  if (pendingEligible(state, config).length > 0) return false;
  if (nextTargetedRefinement(state, graph, config, true)) return false;
  if (projectRefinementDue(state, config, true)) return false;
  return true;
}

export function beginNewEpoch(state: ControllerState, config: AutodecompConfig): number {
  state.epoch++;
  let reactivated = 0;
  for (const fn of Object.values(state.functions)) {
    fn.attemptsThisEpoch = 0;
    if (config.retry.retryParkedAfterEpoch && fn.status === "parked" && eligibleState(fn) && inScope(fn, config)) {
      fn.status = "retry-ready";
      fn.parkedReason = undefined;
      reactivated++;
    }
  }
  return reactivated;
}
