import { finalizeWorkspace, finalizedDiff } from "../tools/finalization.ts";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadCallGraph, rebuildCallGraph } from "../../shared/call-graph.ts";
import { loadConfig } from "../../shared/config.ts";
import { runBuildCheck, runFunctionDiff } from "../../shared/gates.ts";
import { checkSourcePolicy, isPendingStub, withinAllowedRoots } from "../../shared/source-policy.ts";
import type { AutodecompConfig, CallGraphEntry, DiffResult, GateResult, PolicyFinding } from "../../shared/types.ts";
import {
  changedFilesBetweenTrees,
  createTreeFromWorktree,
  filterNewChanges,
  treePatch,
  workspaceChangedFiles,
} from "../../shared/workspace.ts";
import { withLoopExemptions } from "./state.ts";
import type { LoopState } from "./types.ts";

/**
 * The loop's two oracles.
 *
 * `isMatched` answers one question only — is this function byte-exact — and it
 * answers it from the diff tool's own verdict, never from a word count that
 * happens to read full. `finalize` answers the second, wider question the
 * `psx_finalize_function` tool answers: exact diff *and* a green full build
 * *and* a clean, in-scope source policy. Nothing in the loop is allowed to
 * call a function done on the first oracle alone; the build is the real
 * verdict, and a pre-link diff can pass while the linked image does not.
 */

export interface MatchVerdict {
  matched: boolean;
  diff: DiffResult;
}

export interface FinalizeVerdict {
  passed: boolean;
  gate: GateResult;
  /** Workspace changes the loop itself is responsible for. */
  changedFiles: string[];
}

export interface OracleContext {
  projectRoot: string;
  /** Files already dirty when the loop started; never charged to the loop. */
  baseline: Set<string>;
  state: LoopState;
  signal?: AbortSignal;
}

export function gateConfig(projectRoot: string, state: LoopState): AutodecompConfig {
  return withLoopExemptions(loadConfig(projectRoot), state);
}

export async function isMatched(ctx: OracleContext, functionName: string): Promise<MatchVerdict> {
  ctx.signal?.throwIfAborted();
  const diff = finalizedDiff(ctx.projectRoot, functionName, gateConfig(ctx.projectRoot, ctx.state)) ??
    await runFunctionDiff(ctx.projectRoot, functionName, 120_000, ctx.signal);
  return { matched: diff.exact, diff };
}

function callGraphEntry(projectRoot: string, functionName: string): CallGraphEntry | undefined {
  try {
    return loadCallGraph(projectRoot).functions.find((entry) => entry.name === functionName);
  } catch {
    return undefined;
  }
}

export async function loopChangedFiles(ctx: OracleContext): Promise<{ changedFiles: string[]; patch: string }> {
  const config = gateConfig(ctx.projectRoot, ctx.state);
  const tree = await createTreeFromWorktree(ctx.projectRoot, ctx.projectRoot, config.integration.allowedRoots, ctx.signal);
  const patch = await treePatch(ctx.projectRoot, "HEAD", tree, config.integration.allowedRoots, ctx.signal);
  const all = [
    ...new Set([
      ...(await changedFilesBetweenTrees(ctx.projectRoot, "HEAD", tree, ctx.signal)),
      ...(await workspaceChangedFiles(ctx.projectRoot, ctx.signal)),
    ]),
  ].sort();
  return { changedFiles: filterNewChanges(all, ctx.baseline).newFiles, patch };
}

/**
 * Split the loop's own changed files by what it is allowed to commit.
 *
 * A commit the loop makes on the user's branch may only carry the paths the
 * project's integration roots name. Anything the loop dirtied outside them is
 * not committable and not the loop's to keep — it is reported, and the caller
 * decides what to do with it.
 */
export async function scopedLoopChanges(
  ctx: OracleContext,
): Promise<{ committable: string[]; outOfScope: string[] }> {
  const config = gateConfig(ctx.projectRoot, ctx.state);
  const { changedFiles } = await loopChangedFiles(ctx);
  return {
    committable: changedFiles.filter((file) => withinAllowedRoots(config, file)),
    outOfScope: changedFiles.filter((file) => !withinAllowedRoots(config, file)),
  };
}

export async function finalize(ctx: OracleContext, functionName: string): Promise<FinalizeVerdict> {
  const config = gateConfig(ctx.projectRoot, ctx.state);
  const { changedFiles, patch } = await loopChangedFiles(ctx);
  const gate = await finalizeWorkspace({ projectRoot: ctx.projectRoot, config, functionName, changedFiles, patch, signal: ctx.signal });
  return { passed: gate.pass, gate, changedFiles: (await loopChangedFiles(ctx)).changedFiles };
}

/**
 * Assembly the current turn introduced, judged by the same rules the finalize
 * gate uses. Only source-policy findings are returned — an out-of-scope file or
 * a failing diff is not an approval question, it is an ordinary gate failure.
 *
 * A source that is still nothing but its `INCLUDE_ASM` placeholder is exempt,
 * and that exemption is the difference between "the turn proposed assembly" and
 * "the turn produced nothing". They read identically to the scan and need
 * opposite responses: the first is a policy question for a human, the second is
 * a turn to retry. `func_8001F2EC` was parked for a human decision on the stub
 * it was handed — no C was ever written for it, and it turned out to be nine
 * lines of clean C that match on the first draft.
 */
export async function introducedForbiddenConstructs(
  ctx: OracleContext,
  functionName: string,
): Promise<PolicyFinding[]> {
  const config = gateConfig(ctx.projectRoot, ctx.state);
  const { changedFiles, patch } = await loopChangedFiles(ctx);
  const policy = checkSourcePolicy({
    projectRoot: ctx.projectRoot,
    config,
    functionName,
    functionVram: callGraphEntry(ctx.projectRoot, functionName)?.vram,
    scanFunctions: [functionName],
    changedFiles,
    patch,
  });
  const untouched = pendingStub(ctx.projectRoot, functionName);
  return policy.hardFailures.filter((finding) =>
    finding.kind !== "out-of-scope" && !(untouched && finding.kind === "include-asm"));
}

/** Is this function's source still nothing but the placeholder it started as? */
function pendingStub(projectRoot: string, functionName: string): boolean {
  const relative = callGraphEntry(projectRoot, functionName)?.source ?? `src/${functionName}.c`;
  const path = resolve(projectRoot, relative);
  if (!existsSync(path)) return false;
  return isPendingStub(readFileSync(path, "utf8"));
}

/** The environment guard: the tree the loop hands to the next function must build. */
export async function environmentIsIntact(ctx: OracleContext): Promise<{ ok: boolean; detail: string }> {
  const build = await runBuildCheck(ctx.projectRoot, 10 * 60_000, ctx.signal);
  if (build.code === 0) return { ok: true, detail: "" };
  const tail = [build.stdout, build.stderr].filter(Boolean).join("\n").split("\n").slice(-40).join("\n");
  return { ok: false, detail: `make check exited ${build.code}\n${tail}` };
}

/**
 * The next function to work, with the parked set's families pushed back.
 *
 * Call-graph order alone put four functions of one family — the same shape, the
 * same author, the same root cause — back to back for three hours, and none of
 * them matched. Whatever stopped the first was going to stop the next three,
 * and the loop had no way to know it had just learned something about all of
 * them.
 *
 * So a parked function's family is deferred, not skipped. `defer` names the
 * functions a park has implicated: same suspected translation unit, or a
 * residual signature the parked one carried. They stay in the queue and come
 * back once everything unimplicated has been tried — by which time the cause
 * may have been closed, and by which time §2.1's index has an answer to carry.
 */
export async function nextTarget(
  projectRoot: string,
  skip: Set<string>,
  defer: Set<string> = new Set(),
): Promise<string | undefined> {
  const graph = await rebuildCallGraph(projectRoot).catch(() => loadCallGraph(projectRoot));
  const eligible = graph.functions.filter(
    (entry) => !entry.decompiled && entry.handwritten === false && !entry.dead && !skip.has(entry.name),
  );
  return (eligible.find((entry) => !defer.has(entry.name)) ?? eligible[0])?.name;
}
