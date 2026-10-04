import { existsSync, lstatSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { safePath } from "../agent/resource-extraction/storage.ts";

/** Tool-process housekeeping, not an analyzer change: existing verified runs
 * remain usable. Never signal an owner or discard its artifacts/checkpoints. */
export function recoverAbandonedResourceLocks(project: string): string[] {
  const directory = safePath(project, "build/assets/locks");
  if (!existsSync(directory)) return [];
  const recovered: string[] = [];
  for (const name of readdirSync(directory)) {
    if (!/^[a-zA-Z0-9_-]+\.lock$/.test(name)) continue;
    const path = safePath(directory, name);
    try {
      const before = lstatSync(path);
      if (!before.isFile() || before.size > 64) continue;
      const owner = readFileSync(path, "utf8"), text = owner.trim();
      if (!/^[1-9][0-9]*$/.test(text)) continue;
      const pid = Number(text);
      if (!Number.isSafeInteger(pid)) continue;
      try { process.kill(pid, 0); continue; }
      catch (error) {
        // EPERM also means an owner may be alive. Only ESRCH proves it exited.
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") continue;
      }
      const current = lstatSync(path);
      if (current.dev !== before.dev || current.ino !== before.ino || readFileSync(path, "utf8") !== owner) continue;
      unlinkSync(path);
      recovered.push(name);
    } catch (error) {
      // Another process may already have released the lock.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return recovered;
}
