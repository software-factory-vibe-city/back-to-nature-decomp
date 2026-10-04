import { createTreeFromWorktree, changedFilesBetweenTrees, treePatch } from "../autonomous/workspace.ts";
import { loadCallGraph } from "../autonomous/call-graph.ts";
import { runGate } from "../autonomous/gates.ts";
import { runCommand } from "../autonomous/process.ts";
import type { AutodecompConfig, GateResult } from "../autonomous/types.ts";

/** One authoritative route for static, interactive and controller matches.
 * Context export happens only after a passed gate, then the integrated inputs
 * (including publication) are gated again before completion is recorded. */
export async function finalizeWorkspace(options: {
  projectRoot: string; config: AutodecompConfig; functionName: string;
  changedFiles: string[]; patch: string; signal?: AbortSignal;
}): Promise<GateResult> {
  options.signal?.throwIfAborted();
  const graph = loadCallGraph(options.projectRoot);
  const entry = graph.functions.find((f) => f.name === options.functionName);
  const gateOptions = {
    ...options, mode: "match" as const,
    ...(entry?.vram ? { functionVram: entry.vram } : {}),
    ...(entry?.container ? { functionContainer: entry.container } : {}),
    functionVrams: Object.fromEntries(graph.functions.map((f) => [f.name, f.vram])),
    functionContainers: Object.fromEntries(graph.functions.map((f) => [f.name, f.container])),
    functionSources: Object.fromEntries(graph.functions.map((f) => [f.name, f.source ?? `src/${f.name}.c`])),
  };
  let gate = await runGate(gateOptions);
  if (!gate.pass) return gate;
  if (options.signal?.aborted) return { ...gate, pass: false, failures: ["Finalization cancelled before context export"] };
  const before = await createTreeFromWorktree(options.projectRoot, options.projectRoot, options.config.integration.allowedRoots, options.signal);
  options.signal?.throwIfAborted();
  const publication = await runCommand("npx", ["tsx", "tools/agent/contextExport.ts", options.functionName], {
    cwd: options.projectRoot, signal: options.signal, timeoutMs: 120_000,
  });
  options.signal?.throwIfAborted();
  if (publication.code !== 0) return { ...gate, pass: false,
    failures: [`Context export failed: ${publication.stdout}\n${publication.stderr}`] };
  const after = await createTreeFromWorktree(options.projectRoot, options.projectRoot, options.config.integration.allowedRoots, options.signal);
  const exportedFiles = await changedFilesBetweenTrees(options.projectRoot, before, after, options.signal);
  options.signal?.throwIfAborted();
  gate = await runGate({ ...gateOptions,
    changedFiles: [...new Set([...options.changedFiles, ...exportedFiles])].sort(),
    patch: options.patch + "\n" + await treePatch(options.projectRoot, before, after, options.config.integration.allowedRoots, options.signal),
  });
  if (options.signal?.aborted) return { ...gate, pass: false, failures: [...gate.failures, "Finalization cancelled after publication gate"] };
  return gate;
}
