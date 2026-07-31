/*
 * Comparator model for GCC 2.95.2 gcc/sched.c (legacy scheduler),
 * rank_for_schedule and sched_analyze: higher INSN_PRIORITY first; then the
 * class relative to last_scheduled_insn (independent/latency-one, anti/output,
 * true); finally greater block-local INSN_LUID first because scheduling runs
 * backward. LUID increments across every RTL chain node, including notes.
 */
import type {
  DependencyEdge,
  PairwiseSchedulerComparison,
  ReadyEntry,
  RtlInstruction,
  SchedulerDecision,
  SchedulerOrderKey,
  SchedulerSelectionExplanation,
} from "./types.js";

function blockOf(instruction: RtlInstruction): number {
  return instruction.block ?? 0;
}

/**
 * GCC's pre-scheduling splitter replaces one instruction with several fresh
 * ones (new, higher UIDs) at the same chain position, so stage-input dumps
 * that predate the split have no entry for the product UIDs and their LUIDs
 * would stay unreconstructed. Splice each product group into the input order
 * at the position of the unique deleted input instruction that set the same
 * registers; when no unique origin exists the products are left unspliced and
 * downstream consumers keep failing closed.
 */
export function spliceSplitProducts(
  input: RtlInstruction[],
  stageInstructions: RtlInstruction[],
  caveats: string[],
): RtlInstruction[] {
  if (input.length === 0) return input;
  const inputUids = new Set(input.map((instruction) => instruction.uid));
  const stageUids = new Set(stageInstructions.map((instruction) => instruction.uid));
  const products = stageInstructions
    .filter((instruction) => !inputUids.has(instruction.uid))
    .sort((left, right) => left.uid - right.uid);
  if (products.length === 0) return input;
  const deleted = input.filter((instruction) => !stageUids.has(instruction.uid));
  const signatureOf = (instruction: RtlInstruction): string =>
    instruction.sets.map((reference) => reference.register).sort((a, b) => a - b).join(",");
  const originsBySignature = new Map<string, RtlInstruction[]>();
  for (const origin of deleted) {
    if (origin.sets.length === 0) continue;
    const signature = signatureOf(origin);
    originsBySignature.set(signature, [...(originsBySignature.get(signature) ?? []), origin]);
  }
  let result = input;
  const unclaimed: number[] = [];
  const groups = new Map<string, RtlInstruction[]>();
  for (const product of products) {
    if (product.sets.length === 0) {
      unclaimed.push(product.uid);
      continue;
    }
    const signature = signatureOf(product);
    groups.set(signature, [...(groups.get(signature) ?? []), product]);
  }
  for (const [signature, group] of groups) {
    const origins = originsBySignature.get(signature) ?? [];
    if (origins.length !== 1) {
      caveats.push(
        `Scheduler stage input has no unique split origin for product UIDs ${group.map((item) => item.uid).join(", ")}; their LUIDs stay unreconstructed.`,
      );
      unclaimed.push(...group.map((item) => item.uid));
      continue;
    }
    const origin = origins[0]!;
    const at = result.findIndex((instruction) => instruction.uid === origin.uid);
    const placed = group.map((instruction) => {
      const clone: RtlInstruction = { ...instruction };
      if (origin.block === undefined) delete clone.block;
      else clone.block = origin.block;
      return clone;
    });
    result = [...result.slice(0, at), ...placed, ...result.slice(at + 1)];
  }
  if (result === input) return input;
  if (unclaimed.length > 0) {
    caveats.push(`Split products without a reconstructed chain position: ${unclaimed.join(", ")}.`);
  }
  return result.map((instruction, index) => ({ ...instruction, order: index, chainOrder: index }));
}

/**
 * GCC 2.95.2's legacy sched.c resets luid in sched_analyze for each block
 * and increments it for every RTL chain node. chainOrder includes notes, so
 * differences preserve the comparator's original-order relation.
 */
export function reconstructLuid(source: RtlInstruction[]): Record<string, number> {
  const result: Record<string, number> = {};
  const groups = new Map<number, RtlInstruction[]>();
  for (const instruction of source) {
    const block = blockOf(instruction);
    const values = groups.get(block) || [];
    values.push(instruction);
    groups.set(block, values);
  }
  for (const values of groups.values()) {
    values.sort((left, right) =>
      (left.chainOrder ?? left.order) - (right.chainOrder ?? right.order) || left.uid - right.uid
    );
    const base = values[0]?.chainOrder ?? values[0]?.order ?? 0;
    for (const instruction of values) {
      result[String(instruction.uid)] = (instruction.chainOrder ?? instruction.order) - base;
    }
  }
  return result;
}

function dependencyClass(
  uid: number,
  lastUid: number | undefined,
  dependencies: DependencyEdge[],
): 1 | 2 | 3 {
  if (lastUid === undefined) return 3;
  const edge = dependencies.find((item) => item.fromUid === uid && item.toUid === lastUid);
  if (!edge || edge.cost === 1) return 3;
  return edge.kind === "true" ? 1 : 2;
}

function priority(entry: ReadyEntry): number {
  /* The dump prints unsigned birth-adjusted priorities in hexadecimal. */
  return entry.displayedPriority >>> 0;
}

function compare(
  left: ReadyEntry,
  right: ReadyEntry,
  lastUid: number | undefined,
  dependencies: DependencyEdge[],
  luidByUid: Record<string, number>,
): number {
  const priorityDifference = priority(right) - priority(left);
  if (priorityDifference) return priorityDifference;
  const leftClass = dependencyClass(left.uid, lastUid, dependencies);
  const rightClass = dependencyClass(right.uid, lastUid, dependencies);
  if (leftClass !== rightClass) return rightClass - leftClass;
  const leftLuid = luidByUid[String(left.uid)];
  const rightLuid = luidByUid[String(right.uid)];
  if (leftLuid === undefined || rightLuid === undefined) return left.rank - right.rank;
  /* Legacy sched.c places the greater LUID first while scheduling backward. */
  return rightLuid - leftLuid;
}

function criterion(
  winner: ReadyEntry,
  loser: ReadyEntry,
  lastUid: number | undefined,
  dependencies: DependencyEdge[],
  luidByUid: Record<string, number>,
): PairwiseSchedulerComparison {
  if (priority(winner) !== priority(loser)) {
    return {
      winnerUid: winner.uid,
      loserUid: loser.uid,
      criterion: "priority",
      confidence: "exact",
      evidence: [`Displayed priority ${winner.rawPriority} beats ${loser.rawPriority}.`],
    };
  }
  const winnerClass = dependencyClass(winner.uid, lastUid, dependencies);
  const loserClass = dependencyClass(loser.uid, lastUid, dependencies);
  if (winnerClass !== loserClass) {
    return {
      winnerUid: winner.uid,
      loserUid: loser.uid,
      criterion: "dependency-class",
      confidence: "reconstructed",
      evidence: [`Relative to last-scheduled UID ${lastUid}, dependency class ${winnerClass} beats class ${loserClass}.`],
    };
  }
  const winnerLuid = luidByUid[String(winner.uid)];
  const loserLuid = luidByUid[String(loser.uid)];
  if (winnerLuid !== undefined && loserLuid !== undefined && winnerLuid !== loserLuid) {
    return {
      winnerUid: winner.uid,
      loserUid: loser.uid,
      criterion: "luid",
      confidence: "reconstructed",
      evidence: [`Equal-priority/class legacy sched.c tie: LUID ${winnerLuid} is later than LUID ${loserLuid} and is selected first while scheduling backward.`],
    };
  }
  return {
    winnerUid: winner.uid,
    loserUid: loser.uid,
    criterion: "unresolved",
    confidence: "inferred",
    evidence: ["Priority and dependency class tie, but a unique LUID relation was unavailable."],
  };
}

export function explainSchedulerSelections(
  stage: "sched" | "sched2",
  decisions: SchedulerDecision[],
  dependencies: DependencyEdge[],
  luidByUid: Record<string, number>,
): SchedulerSelectionExplanation[] {
  const result: SchedulerSelectionExplanation[] = [];
  const lastByBlock = new Map<number, number>();
  for (const decision of decisions) {
    const lastUid = lastByBlock.get(decision.block);
    const modeled = [...decision.ready].sort((left, right) =>
      compare(left, right, lastUid, dependencies, luidByUid)
    ).map((entry) => entry.uid);
    const events = decision.events;
    const comparatorObserved = decision.comparatorRanked;
    const comparatorMatches = modeled.length === comparatorObserved.length &&
      modeled.every((uid, index) => uid === comparatorObserved[index]);
    const selectedEntry = decision.ready.find((entry) => entry.uid === decision.selectedUid);
    const orderKeys: SchedulerOrderKey[] = decision.ready.map((entry) => {
      const luid = luidByUid[String(entry.uid)];
      const key: SchedulerOrderKey = {
        uid: entry.uid,
        displayedPriority: priority(entry),
        dependencyClass: dependencyClass(entry.uid, lastUid, dependencies),
        confidence: luid === undefined ? "inferred" : "reconstructed",
        evidence: [`Ready-list insertion rank ${entry.rank}; displayed priority ${entry.rawPriority}.`],
      };
      if (luid !== undefined) {
        key.luid = luid;
        key.sourceOrder = luid;
        key.evidence.push("LUID relation reconstructed from the pre-scheduler RTL chain including notes.");
      }
      return key;
    });
    const comparisons: PairwiseSchedulerComparison[] = [];
    if (selectedEntry) {
      for (const loser of decision.ready) {
        if (loser.uid !== selectedEntry.uid) comparisons.push(criterion(selectedEntry, loser, lastUid, dependencies, luidByUid));
      }
    }
    const caveats: string[] = [];
    if (!comparatorMatches) caveats.push(`Modeled comparator order ${modeled.join(" ")} does not reproduce dumped order ${comparatorObserved.join(" ")}.`);
    if (events.length > 0) caveats.push("Backend hazard/launch events changed or constrained the comparator order; counterfactual resource effects are not replayed.");
    const confidence = comparatorMatches && comparisons.every((item) => item.criterion !== "unresolved")
      ? "exact" as const
      : comparatorMatches ? "reconstructed" as const : "inferred" as const;
    const explanation: SchedulerSelectionExplanation = {
      stage,
      block: decision.block,
      cycle: decision.cycle,
      orderKeys,
      comparisons,
      confidence,
      caveats,
    };
    if (decision.selectedUid !== undefined) explanation.selectedUid = decision.selectedUid;
    result.push(explanation);
    if (decision.selectedUid !== undefined) lastByBlock.set(decision.block, decision.selectedUid);
  }
  return result;
}
