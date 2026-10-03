/*
 * Worklist ranking only. Eligibility, dependency classification and depth
 * computation belong to the graph builder; parked/attempted exclusions and
 * family deferrals belong to the consumers of its ranked output.
 */
export interface WorklistEntry {
  name: string;
  container: string;
  tier: number;
  instructionCount: number;
  callerCount: number;
  decompiled: boolean;
  handwritten: false | "asm" | "gte";
  dead: boolean;
}

export interface WorklistRankingContext {
  containerRank: ReadonlyMap<string, number>;
  depthByName: ReadonlyMap<string, number>;
  maxDepth: number;
}

export interface CallGraphSelectionStrategy {
  name: string;
  compare(a: WorklistEntry, b: WorklistEntry, context: WorklistRankingContext): number;
}

function depth(entry: WorklistEntry, context: WorklistRankingContext): number {
  return context.depthByName.get(entry.name) ?? context.maxDepth + 1;
}

function containerRank(entry: WorklistEntry, context: WorklistRankingContext): number {
  return context.containerRank.get(entry.container) ?? 99;
}

/** Original order: container, tier, tier-3 depth, size, then caller count. */
export const containerFirstStrategy: CallGraphSelectionStrategy = {
  name: "container-first",
  compare(a, b, context) {
    const container = containerRank(a, context) - containerRank(b, context);
    if (container !== 0) return container;
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.tier === 3) {
      const dependency = depth(a, context) - depth(b, context);
      if (dependency !== 0) return dependency;
    }
    return a.instructionCount - b.instructionCount || b.callerCount - a.callerCount;
  },
};

/** Bottom-up across containers; depth-zero tiers compete on size. */
export const dependencyReadySmallFirstStrategy: CallGraphSelectionStrategy = {
  name: "dependency-ready-small-first",
  compare(a, b, context) {
    return (
      depth(a, context) - depth(b, context) ||
      a.instructionCount - b.instructionCount ||
      b.callerCount - a.callerCount ||
      containerRank(a, context) - containerRank(b, context)
    );
  },
};

/** Leave existing exclusions ahead of every ranking policy. GTE is handled by
 * consumers, not by the graph builder (which previously only sidelined asm). */
export function rankWorklist<T extends WorklistEntry>(
  entries: readonly T[],
  strategy: CallGraphSelectionStrategy,
  context: WorklistRankingContext,
): T[] {
  return [...entries].sort((a, b) => {
    const aSkip = a.decompiled || a.handwritten === "asm" || a.dead;
    const bSkip = b.decompiled || b.handwritten === "asm" || b.dead;
    if (aSkip !== bSkip) return aSkip ? 1 : -1;
    return strategy.compare(a, b, context);
  });
}
