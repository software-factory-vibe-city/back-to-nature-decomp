import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

export function registerExplainDiffTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_explain_diff",
    label: "Explain PSX Diff",
    description: "Classify a PlayStation function mismatch by instruction selection, allocation, operand order, scheduling, relocation, or mixed causes. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol whose mismatch should be classified" }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      onUpdate?.({ content: [{ type: "text", text: `Classifying ${params.functionName}...` }], details: {} });
      return runProjectCommand(
        pi,
        ctx.cwd,
        "npx",
        ["tsx", "tools/agent/explainDiff.ts", params.functionName],
        signal,
        15_000,
      );
    },
  });
}
