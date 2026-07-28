import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

function safeJsonPath(path: string): boolean {
  return path.endsWith(".json") && !path.startsWith("/") && !path.split(/[\\/]/).includes("..");
}

export function registerSynthesizeSourceShapesTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_synthesize_source_shapes",
    label: "PSX Requirement-Guided Source Synthesis",
    description: "Derive and optionally execute a bounded finite grammar of natural clean-C source shapes from target-schedule requirements. Preserves generated candidates under build/, never mutates src/, and never promotes a candidate. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol to synthesize source shapes for" }),
      analysis: Type.Optional(Type.String({ description: "Project-relative target-schedule analysis JSON path; omit to refresh analysis" })),
      deriveOnly: Type.Optional(Type.Boolean({ description: "Write the source model, recipes, and search spec without compiling variants" })),
      maxVariants: Type.Optional(Type.Integer({ minimum: 1, maximum: 5000, description: "Bounded generated/search variants" })),
      maxDepth: Type.Optional(Type.Integer({ minimum: 1, maximum: 3, description: "Bounded recipe interaction depth" })),
      jobs: Type.Optional(Type.Integer({ minimum: 1, maximum: 16, description: "Bounded isolated compiler workers" })),
      resume: Type.Optional(Type.Boolean({ description: "Resume the generated source-shape search checkpoint" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      if (params.analysis && !safeJsonPath(params.analysis)) throw new Error(`Invalid analysis path: ${params.analysis}`);
      const args = ["tsx", "tools/agent/synthesizeSourceShapes.ts", params.functionName];
      if (params.analysis) args.push("--analysis", params.analysis);
      if (params.deriveOnly) args.push("--derive-only");
      if (params.maxVariants !== undefined) args.push("--max-variants", String(params.maxVariants));
      if (params.maxDepth !== undefined) args.push("--max-depth", String(params.maxDepth));
      if (params.jobs !== undefined) args.push("--jobs", String(params.jobs));
      if (params.resume) args.push("--resume");
      onUpdate?.({ content: [{ type: "text", text: `Deriving requirement-guided clean-C shapes for ${params.functionName}...` }], details: {} });
      return runProjectCommand(pi, ctx.cwd, "npx", args, signal, 1_800_000);
    },
  });
}
