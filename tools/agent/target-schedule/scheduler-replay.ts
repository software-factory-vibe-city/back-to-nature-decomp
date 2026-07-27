import type { SchedulerStage } from "../compiler-trace/types.js";
import type { SchedulerReplayResult } from "./types.js";

export function replayScheduler(stage: SchedulerStage, focusedBlock?: number): SchedulerReplayResult[] {
  const blocks = [...new Set(stage.decisions.map((decision) => decision.block))]
    .filter((block) => focusedBlock === undefined || block === focusedBlock)
    .sort((a, b) => a - b);
  return blocks.map((block) => {
    const decisions = stage.decisions.filter((decision) => decision.block === block);
    const participating = new Set(decisions.flatMap((decision) => decision.ready.map((entry) => entry.uid)));
    const selected = new Set<number>();
    let matchedCycles = 0;
    let firstMismatch: string | undefined;
    const caveats: string[] = [];
    let inferredTie = false;

    for (const decision of decisions) {
      const choice = decision.selectedUid;
      if (choice === undefined) {
        firstMismatch ||= `cycle ${decision.cycle}: dump did not expose a selected UID`;
        continue;
      }
      const ready = new Set(decision.ready.map((entry) => entry.uid));
      if (!ready.has(choice)) {
        firstMismatch ||= `cycle ${decision.cycle}: selected UID ${choice} is absent from the observed ready list`;
        continue;
      }
      if (decision.ranked[0] !== choice) {
        firstMismatch ||= `cycle ${decision.cycle}: replay ranking selects UID ${decision.ranked[0] ?? "none"}, dump selects UID ${choice}`;
        continue;
      }
      const blocked = stage.dependencies.filter((edge) =>
        edge.fromUid === choice && participating.has(edge.toUid) && !selected.has(edge.toUid)
      );
      if (blocked.length > 0) {
        firstMismatch ||= `cycle ${decision.cycle}: UID ${choice} still has unscheduled successor dependency UID ${blocked[0]!.toUid}`;
        continue;
      }
      if (decision.reason === "luid-or-list-order" && decision.ready.length > 1) {
        inferredTie = true;
        caveats.push(`cycle ${decision.cycle}: LUID/list tie-break was not recoverable from the stock dump`);
      }
      selected.add(choice);
      matchedCycles++;
    }

    const reproduced = !firstMismatch && matchedCycles === decisions.length;
    const result: SchedulerReplayResult = {
      stage: stage.stage,
      block,
      reproduced,
      counterfactualEligible: reproduced && !inferredTie,
      matchedCycles,
      totalCycles: decisions.length,
      caveats: [...new Set(caveats)],
    };
    if (firstMismatch) result.firstMismatch = firstMismatch;
    if (reproduced && inferredTie) {
      result.caveats.push("Observed choices replay, but an inferred tie makes this block observational-only for counterfactuals.");
    }
    return result;
  });
}
