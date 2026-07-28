import type { SchedulerStage } from "../compiler-trace/types.js";
import type { BaselineReplayResult, SchedulerReplayResult } from "./types.js";

export function baselineSchedulerReplay(stage: SchedulerStage, focusedBlock?: number): BaselineReplayResult[] {
  const blocks = [...new Set(stage.decisions.map((decision) => decision.block))]
    .filter((block) => focusedBlock === undefined || block === focusedBlock)
    .sort((left, right) => left - right);
  return blocks.map((block) => {
    const decisions = stage.decisions.filter((decision) => decision.block === block);
    const explanations = stage.selectionExplanations.filter((item) => item.block === block);
    let matchedSelections = 0;
    let matchedReadySets = 0;
    let firstDivergence: string | undefined;
    const unsupportedFeatures = new Set<string>();
    for (const decision of decisions) {
      const explanation = explanations.find((item) => item.cycle === decision.cycle);
      if (decision.selectedUid !== undefined && decision.ranked[0] === decision.selectedUid) matchedSelections++;
      else firstDivergence ||= `cycle ${decision.cycle}: selected UID is not the final ready-list winner`;
      if (explanation && !explanation.caveats.some((item) => item.startsWith("Modeled comparator"))) matchedReadySets++;
      else firstDivergence ||= `cycle ${decision.cycle}: legacy comparator order was not reproduced`;
      if (decision.events.length > 0) unsupportedFeatures.add(`cycle ${decision.cycle}: backend launch/block/hazard event`);
      if (explanation?.comparisons.some((item) => item.criterion === "unresolved")) unsupportedFeatures.add(`cycle ${decision.cycle}: unresolved comparator relation`);
    }
    const allComparatorOrders = matchedReadySets === decisions.length;
    const allSelections = matchedSelections === decisions.length;
    const status = allComparatorOrders && allSelections
      ? "exact" as const
      : matchedReadySets > 0 ? "partial" as const : "failed" as const;
    const result: BaselineReplayResult = {
      stage: stage.stage,
      block,
      status,
      matchedSelections,
      totalSelections: decisions.length,
      matchedReadySets,
      unsupportedFeatures: [...unsupportedFeatures],
      confidence: status === "exact" ? "exact" : status === "partial" ? "reconstructed" : "inferred",
      evidence: [
        `${matchedReadySets}/${decisions.length} dumped comparator orders reproduced from priority, last-scheduled dependency class, and LUID.`,
        `${matchedSelections}/${decisions.length} final selected UIDs agree with the dumped ready-list winner.`,
      ],
    };
    if (firstDivergence) result.firstDivergence = firstDivergence;
    return result;
  });
}

export function replayScheduler(stage: SchedulerStage, focusedBlock?: number): SchedulerReplayResult[] {
  return baselineSchedulerReplay(stage, focusedBlock).map((baseline) => {
    const reproduced = baseline.status === "exact";
    const result: SchedulerReplayResult = {
      stage: baseline.stage,
      block: baseline.block,
      reproduced,
      counterfactualEligible: reproduced && baseline.unsupportedFeatures.length === 0,
      matchedCycles: Math.min(baseline.matchedSelections, baseline.matchedReadySets),
      totalCycles: baseline.totalSelections,
      caveats: [...baseline.unsupportedFeatures],
    };
    if (baseline.firstDivergence) result.firstMismatch = baseline.firstDivergence;
    return result;
  });
}
