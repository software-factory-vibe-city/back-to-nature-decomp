import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

function safeJsonPath(path: string): boolean {
  return path.endsWith(".json") && !path.startsWith("/") && !path.split(/[\\/]/).includes("..");
}

export function registerSearchSourceShapesTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_search_source_shapes",
    label: "PSX Source-Shape Search",
    description: "Exhaustively compile a bounded explicit clean-C source-shape grammar under build/, with deduplication, requirements, checkpoints, and full confirmation of exact candidates. Never mutates src/ or promotes a candidate. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol to search" }),
      spec: Type.String({ description: "Project-relative finite search specification JSON path" }),
      analysis: Type.Optional(Type.String({ description: "Project-relative target-schedule analysis JSON path" })),
      maxVariants: Type.Optional(Type.Integer({ minimum: 1, maximum: 5000, description: "Bounded product evaluations for this invocation" })),
      jobs: Type.Optional(Type.Integer({ minimum: 1, maximum: 16, description: "Bounded isolated compiler workers" })),
      resume: Type.Optional(Type.Boolean({ description: "Resume the verified deterministic checkpoint" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      if (!safeJsonPath(params.spec)) throw new Error(`Invalid spec path: ${params.spec}`);
      if (params.analysis && !safeJsonPath(params.analysis)) throw new Error(`Invalid analysis path: ${params.analysis}`);
      const args = ["tsx", "tools/agent/searchSourceShapes.ts", params.functionName, "--spec", params.spec];
      if (params.analysis) args.push("--analysis", params.analysis);
      if (params.maxVariants !== undefined) args.push("--max-variants", String(params.maxVariants));
      if (params.jobs !== undefined) args.push("--jobs", String(params.jobs));
      if (params.resume) args.push("--resume");
      onUpdate?.({ content: [{ type: "text", text: `Searching finite source shapes for ${params.functionName}...` }], details: {} });
      return runProjectCommand(pi, ctx.cwd, "npx", args, signal, 600_000);
    },
  });
}
