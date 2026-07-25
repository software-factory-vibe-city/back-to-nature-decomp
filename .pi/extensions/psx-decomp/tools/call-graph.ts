import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand } from "./shared.ts";

export function registerCallGraphTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_build_call_graph",
    label: "Build PSX Call Graph",
    description: "Regenerate the PlayStation project's call graph and priority worklist with tools/agent/callGraph.ts. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal, onUpdate, ctx) {
      onUpdate?.({ content: [{ type: "text", text: "Rebuilding the call graph..." }], details: {} });
      return runProjectCommand(
        pi,
        ctx.cwd,
        "npx",
        ["tsx", "tools/agent/callGraph.ts"],
        signal,
        120_000,
      );
    },
  });
}
