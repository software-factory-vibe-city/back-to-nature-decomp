import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ControllerState, WorkerUsage } from "./types.ts";

const EMPTY_USAGE: WorkerUsage = {
  turns: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: 0,
};

export function createState(projectRoot: string): ControllerState {
  return {
    schemaVersion: 1,
    projectRoot: resolve(projectRoot),
    status: "idle",
    updatedAt: new Date().toISOString(),
    epoch: 1,
    matchesSinceTargeted: 0,
    matchesSinceProject: 0,
    functions: {},
    attempts: {},
    totalUsage: { ...EMPTY_USAGE },
  };
}

export class StateStore {
  readonly statePath: string;
  readonly backupPath: string;
  readonly eventsPath: string;

  constructor(readonly runtimeDir: string, readonly projectRoot: string) {
    mkdirSync(runtimeDir, { recursive: true });
    this.statePath = join(runtimeDir, "state.json");
    this.backupPath = join(runtimeDir, "state.backup.json");
    this.eventsPath = join(runtimeDir, "events.jsonl");
  }

  load(): ControllerState {
    for (const path of [this.statePath, this.backupPath]) {
      if (!existsSync(path)) continue;
      try {
        const state = JSON.parse(readFileSync(path, "utf8")) as ControllerState;
        if (state.schemaVersion !== 1) throw new Error(`Unsupported state schema ${state.schemaVersion}`);
        if (resolve(state.projectRoot) !== resolve(this.projectRoot)) {
          throw new Error(`State belongs to another project: ${state.projectRoot}`);
        }
        return state;
      } catch (error) {
        if (path === this.backupPath) throw error;
      }
    }
    return createState(this.projectRoot);
  }

  save(state: ControllerState): void {
    state.updatedAt = new Date().toISOString();
    mkdirSync(dirname(this.statePath), { recursive: true });
    const temp = `${this.statePath}.${process.pid}.tmp`;
    if (existsSync(this.statePath)) writeFileSync(this.backupPath, readFileSync(this.statePath));
    writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
    renameSync(temp, this.statePath);
  }

  event(type: string, data: Record<string, unknown> = {}): void {
    const event = { source: "autodecomp-controller", time: new Date().toISOString(), type, ...data };
    const line = JSON.stringify(event);
    appendFileSync(this.eventsPath, `${line}\n`);
    process.stdout.write(`${line}\n`);
  }
}

export function addUsage(total: WorkerUsage, usage: WorkerUsage): void {
  total.turns += usage.turns;
  total.inputTokens += usage.inputTokens;
  total.outputTokens += usage.outputTokens;
  total.cacheReadTokens += usage.cacheReadTokens;
  total.cacheWriteTokens += usage.cacheWriteTokens;
  total.costUsd += usage.costUsd;
}
