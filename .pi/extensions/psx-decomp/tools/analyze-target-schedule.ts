import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

export function registerAnalyzeTargetScheduleTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_analyze_target_schedule",
    label: "PSX Target Schedule Analysis",
    description: "Align target/candidate machine instructions through zero-width RTL nodes, explain exact legacy-scheduler priority/dependency/LUID ties, replay bounded target orders, and emit allocation, scheduling, and delay-slot requirements. Diagnostic only; never edits source. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol to analyze" }),
      block: Type.Optional(Type.Integer({ minimum: 0, maximum: 10000, description: "Optional basic block focus" })),
      maxInterventions: Type.Optional(Type.Integer({ minimum: 1, maximum: 8, description: "Maximum abstract intervention alternatives per requirement" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      const args = ["tsx", "tools/agent/analyzeTargetSchedule.ts", params.functionName];
      if (params.block !== undefined) args.push("--block", String(params.block));
      if (params.maxInterventions !== undefined) args.push("--max-interventions", String(params.maxInterventions));
      onUpdate?.({ content: [{ type: "text", text: `Analyzing target schedule for ${params.functionName}...` }], details: {} });
      return runProjectCommand(pi, ctx.cwd, "npx", args, signal, 120_000);
    },
  });
}
