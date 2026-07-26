import { workspaceChangedFiles } from "../autonomous/workspace.ts";

/**
 * Session-scoped snapshot of the workspace's dirty files, captured once at
 * extension activation.
 *
 * The finalize scope gate must only fail on files the worker itself touched
 * during the session. Dirt that pre-dates the session (user WIP, local vendor
 * patches, unrelated tool edits) is recorded here and subtracted from the
 * scope check, so it cannot block finalization of an unrelated function.
 *
 * Fail-safe: if the snapshot cannot be taken, the baseline is empty and the
 * scope gate keeps its original strict behavior.
 */
let baselinePromise: Promise<Set<string>> | undefined;

export function captureSessionBaseline(projectRoot: string): void {
  if (baselinePromise) return;
  baselinePromise = workspaceChangedFiles(projectRoot)
    .then((files) => new Set(files))
    .catch(() => new Set<string>());
}

export function getSessionBaseline(projectRoot: string): Promise<Set<string>> {
  captureSessionBaseline(projectRoot);
  return baselinePromise as Promise<Set<string>>;
}
