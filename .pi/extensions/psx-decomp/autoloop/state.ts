import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AutodecompConfig } from "../autonomous/types.ts";
import type { ApprovalRecord, LoopConfig, LoopState, ParkRecord } from "./types.ts";

export function statePath(config: LoopConfig): string {
  return join(config.runtimeDir, "state.json");
}

export function emptyState(): LoopState {
  return { parked: {}, approvals: {} };
}

export function readState(config: LoopConfig): LoopState {
  const path = statePath(config);
  if (!existsSync(path)) return emptyState();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<LoopState>;
    return { parked: raw.parked ?? {}, approvals: raw.approvals ?? {} };
  } catch {
    return emptyState();
  }
}

export function writeState(config: LoopConfig, state: LoopState): void {
  const path = statePath(config);
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temp, path);
}

export function recordPark(config: LoopConfig, state: LoopState, record: ParkRecord): LoopState {
  const next: LoopState = { ...state, parked: { ...state.parked, [record.functionName]: record } };
  writeState(config, next);
  return next;
}

export function recordApproval(config: LoopConfig, state: LoopState, record: ApprovalRecord): LoopState {
  const next: LoopState = { ...state, approvals: { ...state.approvals, [record.functionName]: record } };
  writeState(config, next);
  return next;
}

/**
 * Project the loop's own decisions onto the shared source-policy allowlist.
 *
 * A parked function is `INCLUDE_ASM` on purpose, and an agent-approved
 * exemption has been adjudicated one rung up the ladder — both must stop the
 * gate from failing every *later* function whose patch happens to contain
 * those lines. Neither is written into `.pi/autodecomp.json`: that allowlist is
 * the human's permanent assertion about a function, and the loop only ever
 * files a request for one (see the approvals directory).
 */
export function withLoopExemptions(config: AutodecompConfig, state: LoopState): AutodecompConfig {
  const allowlist: Record<string, string[]> = { ...config.sourcePolicy.allowlist };
  const add = (name: string, kinds: string[]) => {
    const key = name.toLowerCase();
    allowlist[key] = [...new Set([...(allowlist[key] ?? []), ...kinds])];
  };
  for (const name of Object.keys(state.parked)) add(name, ["include-asm"]);
  for (const [name, approval] of Object.entries(state.approvals)) add(name, approval.kinds);
  return { ...config, sourcePolicy: { ...config.sourcePolicy, allowlist } };
}
