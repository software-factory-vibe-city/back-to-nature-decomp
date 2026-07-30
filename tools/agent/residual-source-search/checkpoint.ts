import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeStableJson } from "../variant-lab/artifacts.js";
import { RESIDUAL_SEARCH_SCHEMA_VERSION, type SearchCheckpoint } from "./types.js";
import type { ShardSpec } from "./enumerate.js";

export function checkpointPath(runRoot: string, shard: ShardSpec): string {
  return join(runRoot, `checkpoint-${shard.index}-${shard.count}.json`);
}

export function loadSearchCheckpoint(path: string): SearchCheckpoint | undefined {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as SearchCheckpoint;
}

export function validateSearchCheckpoint(
  checkpoint: SearchCheckpoint,
  expected: { functionName: string; runId: string; identityHash: string },
): void {
  if (checkpoint.schemaVersion !== RESIDUAL_SEARCH_SCHEMA_VERSION) throw new Error(`unsupported checkpoint schema: ${checkpoint.schemaVersion}`);
  if (checkpoint.function !== expected.functionName || checkpoint.runId !== expected.runId) {
    throw new Error("checkpoint belongs to a different search run");
  }
  if (checkpoint.identityHash !== expected.identityHash) {
    throw new Error("grammar, input, or toolchain identity changed; refusing resume (baseline-drift)");
  }
}

export function writeSearchCheckpoint(path: string, checkpoint: SearchCheckpoint): void {
  writeStableJson(path, checkpoint);
}
