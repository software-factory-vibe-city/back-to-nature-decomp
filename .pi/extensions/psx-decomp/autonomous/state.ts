import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ControllerState, FunctionState, WorkerUsage } from "./types.ts";
import { DEFAULT_CONTAINER, functionKey } from "./call-graph.ts";

/** The schema this build reads and writes. */
export const STATE_SCHEMA_VERSION = 2;

const EMPTY_USAGE: WorkerUsage = {
  turns: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: 0,
};

/** State as written by schema 1: `functions` keyed by VRAM, no container. */
interface LegacyControllerState extends Omit<ControllerState, "schemaVersion" | "functions" | "activeFunctionKey"> {
  schemaVersion: number;
  functions: Record<string, Omit<FunctionState, "container"> & { container?: string }>;
  activeFunctionVram?: string;
}

/**
 * Bring a persisted state file up to the current schema, or refuse it.
 *
 * Schema 1 predates containers, so every function it holds is the PS-X EXE's —
 * there was no other container to have queued work from, and the plan that
 * introduced them forbade adding one until this rekey landed. That makes the
 * migration total and lossless: each entry gains `container: "exe"` and moves
 * from its bare VRAM key to `exe:<VRAM>`. Attempts keep their identifiers, so
 * every recorded session, patch and gate survives the move.
 *
 * A schema this build does not know is an error, never a silent reinterpretation
 * of somebody else's fields.
 */
export function migrateState(raw: ControllerState | LegacyControllerState): ControllerState {
  const version = raw.schemaVersion;
  if (version === STATE_SCHEMA_VERSION) return raw as ControllerState;
  if (version !== 1) throw new Error(`Unsupported state schema ${version}`);

  const legacy = raw as LegacyControllerState;
  const functions: ControllerState["functions"] = {};
  for (const [oldKey, fn] of Object.entries(legacy.functions)) {
    const container = fn.container ?? DEFAULT_CONTAINER;
    const vram = fn.vram ?? oldKey;
    functions[functionKey(container, vram)] = { ...fn, container, vram };
  }

  const attempts: ControllerState["attempts"] = {};
  for (const [id, attempt] of Object.entries(legacy.attempts)) {
    attempts[id] = attempt.functionVram
      ? { ...attempt, functionContainer: attempt.functionContainer ?? DEFAULT_CONTAINER }
      : attempt;
  }

  const { activeFunctionVram, ...rest } = legacy;
  const migrated: ControllerState = {
    ...(rest as unknown as ControllerState),
    schemaVersion: STATE_SCHEMA_VERSION,
    functions,
    attempts,
  };
  if (activeFunctionVram) {
    migrated.activeFunctionKey = functionKey(DEFAULT_CONTAINER, activeFunctionVram);
  }
  return migrated;
}

export function createState(projectRoot: string): ControllerState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
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
        const raw = JSON.parse(readFileSync(path, "utf8")) as ControllerState;
        if (resolve(raw.projectRoot) !== resolve(this.projectRoot)) {
          throw new Error(`State belongs to another project: ${raw.projectRoot}`);
        }
        return migrateState(raw);
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
