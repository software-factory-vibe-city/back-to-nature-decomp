import { loadCallGraph, rebuildCallGraph } from "../autonomous/call-graph.ts";
import { loadConfig } from "../autonomous/config.ts";
import { runBuildCheck, runFunctionDiff, runGate } from "../autonomous/gates.ts";
import { checkSourcePolicy } from "../autonomous/source-policy.ts";
import type { AutodecompConfig, CallGraphEntry, DiffResult, GateResult, PolicyFinding } from "../autonomous/types.ts";
import {
  changedFilesBetweenTrees,
  createTreeFromWorktree,
  filterNewChanges,
  treePatch,
  workspaceChangedFiles,
} from "../autonomous/workspace.ts";
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
  const diff = await runFunctionDiff(ctx.projectRoot, functionName, 120_000, ctx.signal);
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
  const tree = await createTreeFromWorktree(ctx.projectRoot, ctx.projectRoot, config.integration.allowedRoots);
  const patch = await treePatch(ctx.projectRoot, "HEAD", tree, config.integration.allowedRoots);
  const all = [
    ...new Set([
      ...(await changedFilesBetweenTrees(ctx.projectRoot, "HEAD", tree)),
      ...(await workspaceChangedFiles(ctx.projectRoot)),
    ]),
  ].sort();
  return { changedFiles: filterNewChanges(all, ctx.baseline).newFiles, patch };
}

export async function finalize(ctx: OracleContext, functionName: string): Promise<FinalizeVerdict> {
  const config = gateConfig(ctx.projectRoot, ctx.state);
  const { changedFiles, patch } = await loopChangedFiles(ctx);
  const gate = await runGate({
    projectRoot: ctx.projectRoot,
    config,
    mode: "match",
    functionName,
    functionVram: callGraphEntry(ctx.projectRoot, functionName)?.vram,
    changedFiles,
    patch,
    signal: ctx.signal,
  });
  return { passed: gate.pass, gate, changedFiles };
}

/**
 * Assembly the current turn introduced, judged by the same rules the finalize
 * gate uses. Only source-policy findings are returned — an out-of-scope file or
 * a failing diff is not an approval question, it is an ordinary gate failure.
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
  return policy.hardFailures.filter((finding) => finding.kind !== "out-of-scope");
}

/** The environment guard: the tree the loop hands to the next function must build. */
export async function environmentIsIntact(ctx: OracleContext): Promise<{ ok: boolean; detail: string }> {
  const build = await runBuildCheck(ctx.projectRoot, 10 * 60_000, ctx.signal);
  if (build.code === 0) return { ok: true, detail: "" };
  const tail = [build.stdout, build.stderr].filter(Boolean).join("\n").split("\n").slice(-40).join("\n");
  return { ok: false, detail: `make check exited ${build.code}\n${tail}` };
}

export async function nextTarget(projectRoot: string, skip: Set<string>): Promise<string | undefined> {
  const graph = await rebuildCallGraph(projectRoot).catch(() => loadCallGraph(projectRoot));
  return graph.functions.find(
    (entry) => !entry.decompiled && entry.handwritten === false && !entry.dead && !skip.has(entry.name),
  )?.name;
}
