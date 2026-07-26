import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { loadConfig } from "../autonomous/config.ts";
import { runGate } from "../autonomous/gates.ts";
import { loadCallGraph } from "../autonomous/call-graph.ts";
import { createTreeFromWorktree, changedFilesBetweenTrees, filterNewChanges, treePatch, workspaceChangedFiles } from "../autonomous/workspace.ts";
import { getSessionBaseline } from "./session-baseline.ts";
import { validateFunctionName } from "./shared.ts";

export function registerFinalizeFunctionTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_finalize_function",
    label: "Finalize PSX Function",
    description: "Run the exact function diff, full binary check, modification-scope check, and clean-source policy gate. A passing result terminates the autonomous worker turn.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol to finalize" }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      if (signal?.aborted) throw new Error("Finalization cancelled");
      onUpdate?.({ content: [{ type: "text", text: `Finalizing ${params.functionName}...` }], details: {} });
      const config = loadConfig(ctx.cwd);
      const entry = loadCallGraph(ctx.cwd).functions.find((candidate) => candidate.name === params.functionName);
      const tree = await createTreeFromWorktree(ctx.cwd, ctx.cwd, config.integration.allowedRoots);
      const patch = await treePatch(ctx.cwd, "HEAD", tree, config.integration.allowedRoots);
      const allChangedFiles = [...new Set([
        ...await changedFilesBetweenTrees(ctx.cwd, "HEAD", tree),
        ...await workspaceChangedFiles(ctx.cwd),
      ])].sort();
      const baseline = await getSessionBaseline(ctx.cwd);
      const { newFiles: changedFiles, preExisting } = filterNewChanges(allChangedFiles, baseline);
      const gate = await runGate({
        projectRoot: ctx.cwd,
        config,
        mode: "match",
        functionName: params.functionName,
        functionVram: entry?.vram,
        changedFiles,
        patch,
        signal,
      });
      const scopeNote = preExisting.length
        ? `\nScope gate ignored ${preExisting.length} pre-existing workspace change(s): ${preExisting.join(", ")}`
        : "";
      const text = gate.pass
        ? `${params.functionName} passed exact diff, full build, scope, and clean-source gates.${scopeNote}`
        : `${params.functionName} failed finalization:\n${gate.failures.map((failure) => `- ${failure}`).join("\n")}${scopeNote}`;
      return {
        content: [{ type: "text", text }],
        details: gate,
        terminate: gate.pass,
      };
    },
  });
}
