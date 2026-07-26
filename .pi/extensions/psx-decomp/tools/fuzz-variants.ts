import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

export function registerFuzzVariantsTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_fuzz_variants",
    label: "PSX Fuzz Variants",
    description:
      "Compile several complete variant C shapes for one PlayStation function side by side and report each variant's diff class, exact-match count, and first divergence against the original assembly. Hypothesis testing for stubborn operand-order, allocation, or scheduling mismatches: read divergences comparatively to name the compiler mechanism before promoting a shape; do not hill-climb match percentages. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol the variants target" }),
      variants: Type.Array(Type.String(), {
        description:
          "Variant .c files (paths relative to the project root, or absolute). Each must be a complete compilable unit using the project's include headers; keep them under build/ so the tree stays clean.",
      }),
      cc1Only: Type.Optional(
        Type.Boolean({
          description:
            "Fast triage: stop after cc1 and compare normalized compiler output instead of the full maspsx/as pipeline. Confirm finalists without this flag before promoting.",
        }),
      ),
      show: Type.Optional(
        Type.String({ description: "Variant stem whose full target-vs-compiled instruction listing should be printed" }),
      ),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      if (params.variants.length === 0) {
        throw new Error("At least one variant .c file is required.");
      }
      for (const variant of params.variants) {
        if (!variant.endsWith(".c") || variant.split("/").includes("..")) {
          throw new Error(`Invalid variant path: ${variant}`);
        }
      }
      onUpdate?.({
        content: [{ type: "text", text: `Fuzzing ${params.variants.length} variant(s) for ${params.functionName}...` }],
        details: {},
      });

      const args = ["tsx", "tools/agent/fuzzVariants.ts", params.functionName, ...params.variants];
      if (params.cc1Only) args.push("--cc1-only");
      if (params.show) args.push("--show", params.show);
      return runProjectCommand(pi, ctx.cwd, "npx", args, signal, 120_000);
    },
  });
}
