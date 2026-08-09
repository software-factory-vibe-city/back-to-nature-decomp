import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Absent files are recorded as null so a file created during a turn can be removed again. */
export type FileSnapshot = Map<string, string | null>;

export function isNotesPath(file: string): boolean {
  return file === "notes" || file.startsWith("notes/");
}

export function snapshotFiles(projectRoot: string, files: Iterable<string>): FileSnapshot {
  const snapshot: FileSnapshot = new Map();
  for (const file of files) {
    const path = resolve(projectRoot, file);
    snapshot.set(file, existsSync(path) ? readFileSync(path, "utf8") : null);
  }
  return snapshot;
}

/**
 * Hold a verified tree still across a turn that is only meant to write notes.
 *
 * The finalize gate has already proven this exact set of build inputs produces a
 * byte-exact function and a green build. A follow-up turn that edits one of them
 * invalidates that proof, and re-proving it costs a full build. So the turn is
 * allowed to write notes and nothing else: anything else it touched is restored,
 * and the verdict the gate reached still holds.
 */
export function restoreDrift(projectRoot: string, before: FileSnapshot, candidates: Iterable<string>): string[] {
  const restored: string[] = [];
  for (const file of new Set([...before.keys(), ...candidates])) {
    if (isNotesPath(file)) continue;
    const path = resolve(projectRoot, file);
    const original = before.has(file) ? before.get(file)! : null;
    const current = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (current === original) continue;

    if (original === null) rmSync(path, { force: true });
    else writeFileSync(path, original);
    restored.push(file);
  }
  return restored.sort();
}
