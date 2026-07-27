import { existsSync, readFileSync } from "node:fs";
import { writeStableJson } from "../variant-lab/artifacts.js";
import type { SearchCheckpoint } from "./types.js";

export function loadCheckpoint(path: string): SearchCheckpoint | undefined {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as SearchCheckpoint;
}

export function validateCheckpoint(
  checkpoint: SearchCheckpoint,
  expected: { functionName: string; runId: string; specHash: string; toolchainHash: string },
): void {
  if (checkpoint.schemaVersion !== 1) throw new Error(`unsupported checkpoint schema: ${checkpoint.schemaVersion}`);
  if (checkpoint.function !== expected.functionName || checkpoint.runId !== expected.runId) throw new Error("checkpoint belongs to a different search run");
  if (checkpoint.specHash !== expected.specHash) throw new Error("search specification changed; refusing resume");
  if (checkpoint.toolchainHash !== expected.toolchainHash) throw new Error("toolchain identity changed; refusing resume");
}

export function writeCheckpoint(path: string, checkpoint: SearchCheckpoint): void {
  writeStableJson(path, checkpoint);
}
