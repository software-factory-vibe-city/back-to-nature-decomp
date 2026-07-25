import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

export function registerCompilerTraceTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_compiler_trace",
    label: "PSX Compiler Trace",
    description: "Run the configured compiler trace for one PlayStation function and summarize pseudo lifetimes, allocation passes, conflicts, and scheduling decisions. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol to trace" }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      onUpdate?.({ content: [{ type: "text", text: `Tracing ${params.functionName}...` }], details: {} });
      return runProjectCommand(
        pi,
        ctx.cwd,
        "npx",
        ["tsx", "tools/agent/compilerTrace.ts", params.functionName],
        signal,
        20_000,
      );
    },
  });
}
