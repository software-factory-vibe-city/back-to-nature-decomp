import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

export function registerDiffFunctionTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_diff_function",
    label: "PSX Function Diff",
    description: "Compile one function through the configured PlayStation toolchain and compare it with the original assembly. Returns the exact diff and match percentage, truncated to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol to compile and compare" }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      onUpdate?.({ content: [{ type: "text", text: `Diffing ${params.functionName}...` }], details: {} });
      return runProjectCommand(
        pi,
        ctx.cwd,
        "npx",
        ["tsx", "tools/agent/diffFunc.ts", params.functionName],
        signal,
        10_000,
      );
    },
  });
}
