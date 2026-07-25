import type { AutodecompConfig, CallGraph, ControllerState, FunctionState, WorkItem } from "./types.ts";
import { eligibleState, matchedNeighborHash } from "./call-graph.ts";

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
    .filter((fn) => eligibleState(fn) && ["pending", "retry-ready", "gate-failed", "integration-failed"].includes(fn.status))
    .filter((fn) => !fn.nextEligibleAt || Date.parse(fn.nextEligibleAt) <= Date.now())
    .sort((a, b) => a.priority - b.priority || a.vram.localeCompare(b.vram));

  for (const fn of candidates) {
    const tier = modelTierForAttempt(fn, config);
    if (tier !== undefined && fn.attemptsThisEpoch < config.budgets.maxAttemptsPerFunctionPerEpoch) {
      return { mode: "match", functionVram: fn.vram, functionName: fn.currentName, modelTier: tier };
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
    .filter((fn) => fn.status === "matched" && eligibleState(fn))
    .map((fn) => ({ fn, neighbors: matchedNeighborHash(fn.vram, state, graph) }))
    .filter(({ fn, neighbors }) => neighbors.count > 0 && neighbors.hash !== fn.lastRefinedNeighborHash)
    .sort((a, b) => a.fn.priority - b.fn.priority);
  const candidate = candidates[0];
  if (!candidate) return undefined;
  return {
    mode: "targeted-refinement",
    functionVram: candidate.fn.vram,
    functionName: candidate.fn.currentName,
    modelTier: 0,
  };
}

export function projectRefinementDue(state: ControllerState, config: AutodecompConfig, finalizing = false): boolean {
  if (finalizing) {
    return config.refinement.projectAtFinalization && state.lastProjectRefinedGraphHash !== state.graphHash;
  }
  return state.matchesSinceProject >= config.refinement.projectEveryMatches;
}

export function pendingEligible(state: ControllerState): FunctionState[] {
  return Object.values(state.functions).filter((fn) => eligibleState(fn) && fn.status !== "matched" && fn.status !== "manually-skipped");
}

export function completionReady(state: ControllerState, graph: CallGraph, config: AutodecompConfig): boolean {
  if (pendingEligible(state).length > 0) return false;
  if (nextTargetedRefinement(state, graph, config, true)) return false;
  if (projectRefinementDue(state, config, true)) return false;
  return true;
}

export function beginNewEpoch(state: ControllerState, config: AutodecompConfig): number {
  state.epoch++;
  let reactivated = 0;
  for (const fn of Object.values(state.functions)) {
    fn.attemptsThisEpoch = 0;
    if (config.retry.retryParkedAfterEpoch && fn.status === "parked" && eligibleState(fn)) {
      fn.status = "retry-ready";
      fn.parkedReason = undefined;
      reactivated++;
    }
  }
  return reactivated;
}
