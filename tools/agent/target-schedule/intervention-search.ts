import type { SchedulerReplayResult } from "./types.js";
import type { InstructionCorrespondence, MachineInstructionRef, TargetScheduleRequirement } from "./types.js";

export function deriveSchedulingRequirements(
  target: MachineInstructionRef[],
  candidate: MachineInstructionRef[],
  correspondence: InstructionCorrespondence[],
  replay: SchedulerReplayResult[],
  maxInterventions: number,
): TargetScheduleRequirement[] {
  const counterfactual = replay.some((item) => item.counterfactualEligible);
  const result: TargetScheduleRequirement[] = [];
  const claimed = new Set<number>();
  for (const item of correspondence) {
    if (item.candidateIndex === undefined || claimed.has(item.targetIndex)) continue;
    const left = target[item.targetIndex]!;
    const right = candidate[item.candidateIndex]!;
    if (left.canonical !== right.canonical || item.candidateIndex === item.targetIndex) continue;
    const crossedStart = Math.min(item.targetIndex, item.candidateIndex);
    const crossedEnd = Math.max(item.targetIndex, item.candidateIndex);
    const crossed = candidate.slice(crossedStart, crossedEnd + 1).filter((instruction) => instruction.uid !== undefined);
    const uid = right.uid;
    const evidence = [
      `${left.canonical} is target index ${item.targetIndex} but candidate index ${item.candidateIndex}.`,
      counterfactual
        ? "At least one affected scheduler block exactly replayed without an unresolved tie."
        : "Scheduler replay is observational-only; intervention effects are inferred, not replay-proven.",
    ];
    const interventions = [
      {
        id: `sched-order-${item.targetIndex}-${item.candidateIndex}`,
        stage: "sched" as const,
        kind: "birth-order" as const,
        uids: crossed.map((instruction) => instruction.uid!),
        pseudos: [],
        expectedEffect: `move UID ${uid ?? "unknown"} from candidate index ${item.candidateIndex} to the target-relative position ${item.targetIndex}`,
        sourceMechanisms: ["statement-birth-order", "fresh-vs-reused-web", "constant-birth-site"] as const,
        confidence: counterfactual ? "reconstructed" as const : "inferred" as const,
        evidence,
      },
      {
        id: `sched-dependency-${item.targetIndex}-${item.candidateIndex}`,
        stage: "sched" as const,
        kind: "dependency-add" as const,
        uids: crossed.map((instruction) => instruction.uid!),
        pseudos: [],
        expectedEffect: "change ready-list eligibility only through a natural true/anti/output/alias dependency",
        sourceMechanisms: ["alias-dependency", "result-vs-input-reuse"] as const,
        confidence: "inferred" as const,
        evidence: ["A bounded natural dependency is an alternative when source birth order is erased before sched1."],
      },
    ].slice(0, Math.max(1, maxInterventions)).map((intervention) => ({
      ...intervention,
      sourceMechanisms: [...intervention.sourceMechanisms],
    }));
    result.push({
      id: `schedule-order-${item.targetIndex}`,
      stage: "sched",
      description: `${left.canonical} must move from candidate index ${item.candidateIndex} to target-relative index ${item.targetIndex}.`,
      targetIndexes: [item.targetIndex],
      targetCanonical: [left.canonical],
      candidateIndexes: [item.candidateIndex],
      candidateUids: uid === undefined ? [] : [uid],
      pseudos: [],
      hardConstraint: false,
      interventions,
      confidence: counterfactual ? "reconstructed" : "inferred",
      evidence,
    });
    claimed.add(item.targetIndex);
  }
  return result;
}
