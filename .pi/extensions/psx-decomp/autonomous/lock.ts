import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

interface LockData {
  pid: number;
  hostname: string;
  startedAt: string;
  projectRoot: string;
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export class ControllerLock {
  readonly path: string;
  private owned = false;

  constructor(runtimeDir: string, private projectRoot: string) {
    this.path = join(runtimeDir, "controller.lock");
  }

  acquire(force = false): void {
    if (existsSync(this.path)) {
      let existing: LockData | undefined;
      try {
        existing = JSON.parse(readFileSync(this.path, "utf8")) as LockData;
      } catch {
        /* Malformed lock is stale. */
      }
      if (!force && existing && existing.hostname === hostname() && processAlive(existing.pid)) {
        throw new Error(`Autodecomp controller already running as PID ${existing.pid}`);
      }
      if (!force && existing && existing.hostname !== hostname()) {
        throw new Error(`Autodecomp lock belongs to ${existing.hostname}; use force-unlock only after verifying it is stale`);
      }
      rmSync(this.path, { force: true });
    }

    const lock: LockData = {
      pid: process.pid,
      hostname: hostname(),
      startedAt: new Date().toISOString(),
      projectRoot: this.projectRoot,
    };
    writeFileSync(this.path, `${JSON.stringify(lock, null, 2)}\n`, { flag: "wx" });
    this.owned = true;
  }

  release(): void {
    if (!this.owned) return;
    try {
      const lock = JSON.parse(readFileSync(this.path, "utf8")) as LockData;
      if (lock.pid === process.pid) rmSync(this.path, { force: true });
    } catch {
      /* Do not remove a lock we cannot identify. */
    }
    this.owned = false;
  }

  static forceUnlock(runtimeDir: string): void {
    rmSync(join(runtimeDir, "controller.lock"), { force: true });
  }
}
