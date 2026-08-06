import { existsSync } from "node:fs";
import { checkpointPath, loadSearchCheckpoint } from "./checkpoint.js";
import { shardSize, type ShardSpec } from "./enumerate.js";
import type { EvaluationState, StopReason } from "./evaluate.js";
import { RESIDUAL_GRAMMAR_SCHEMA_VERSION, type CoverageReport, type TerminalStatus } from "./types.js";

export function coverageReport(total: bigint, shard: ShardSpec, state: EvaluationState): CoverageReport {
  const ownSize = shardSize(total, shard);
  const report: CoverageReport = {
    totalCandidates: total.toString(),
    evaluatedCandidates: state.evaluatedCount.toString(),
    evaluatedRanges: state.nextShardIndex > state.startIndex
      ? [[state.startIndex.toString(), (state.nextShardIndex - 1n).toString()]]
      : [],
    complete: state.startIndex === 0n && state.nextShardIndex >= ownSize,
  };
  if (shard.count > 1) {
    report.shard = { index: shard.index, count: shard.count };
    report.shardCandidates = ownSize.toString();
  }
  return report;
}

/**
 * All shards of this run that have completed their residue class. Only a
 * complete union supports the exhausted-no-exact claim.
 */
export function completedShards(runRoot: string, total: bigint, count: number): number[] {
  const complete: number[] = [];
  for (let index = 1; index <= count; index++) {
    const path = checkpointPath(runRoot, { index, count });
    if (!existsSync(path)) continue;
    const checkpoint = loadSearchCheckpoint(path);
    if (!checkpoint) continue;
    const size = shardSize(total, { index, count });
    const covered = checkpoint.evaluatedRanges.length > 0 ? BigInt(checkpoint.evaluatedRanges[0]![1]) + 1n : 0n;
    if (covered >= size) complete.push(index);
  }
  return complete;
}

export function terminalStatus(options: {
  runRoot: string;
  total: bigint;
  shard: ShardSpec;
  state: EvaluationState;
  stop: StopReason;
}): { status: TerminalStatus; detail: string } {
  const { state, stop, shard } = options;
  if (state.exacts.length > 0) {
    return {
      status: "exact-candidate-found",
      detail: `${state.exacts.length} candidate(s) produced a byte-identical configured object`,
    };
  }
  if (stop === "budget" || stop === "aborted") {
    return {
      status: "incomplete-budget",
      detail: "the run stopped before the domain was covered; rerun the same command to resume from the checkpoint",
    };
  }
  if (shard.count === 1) {
    return {
      status: "exhausted-no-exact",
      detail: "every coordinate in the serialized domain was evaluated and no exact object exists in " +
        `grammar schema ${RESIDUAL_GRAMMAR_SCHEMA_VERSION}`,
    };
  }
  const complete = completedShards(options.runRoot, options.total, shard.count);
  if (complete.length === shard.count) {
    return {
      status: "exhausted-no-exact",
      detail: `all ${shard.count} shards completed and no exact object exists in grammar schema ${RESIDUAL_GRAMMAR_SCHEMA_VERSION}`,
    };
  }
  const missing = Array.from({ length: shard.count }, (_unused, index) => index + 1)
    .filter((index) => !complete.includes(index));
  const shown = missing.slice(0, 8).join(", ");
  return {
    status: "incomplete-shards",
    detail: `shard ${shard.index}/${shard.count} is complete; ${missing.length} shard(s) are missing` +
      (missing.length > 0 ? ` (${shown}${missing.length > 8 ? ", ..." : ""})` : ""),
  };
}
