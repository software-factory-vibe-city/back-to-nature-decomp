import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

const mechanism = Type.Union([
  Type.Literal("fresh-vs-reused-web"),
  Type.Literal("single-vs-multi-set"),
  Type.Literal("constant-birth-site"),
  Type.Literal("result-vs-input-reuse"),
  Type.Literal("address-expression-family"),
  Type.Literal("alias-dependency"),
  Type.Literal("statement-birth-order"),
  Type.Literal("custom"),
]);

function safePath(path: string): boolean {
  return !path.split("/").includes("..");
}

export function registerFuzzVariantsTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_fuzz_variants",
    label: "PSX Variant Laboratory",
    description:
      "Compile complete C variants as explicit compiler-mechanism hypotheses. Preserves source, preprocessing, assembly/object, hashes, flags, comparisons, and optional pass traces under a deterministic run directory. Reports mechanism verdicts before match percentage; no random permutation or hill climbing. Use a JSON manifest for distinct per-variant hypotheses, or provide common mechanism metadata with variants. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol the variants target" }),
      variants: Type.Optional(Type.Array(Type.String(), {
        description: "Complete variant .c paths. Requires mechanism, expectedPass, and expectedEffect; use manifest for different hypotheses per variant.",
      })),
      manifest: Type.Optional(Type.String({
        description: "JSON manifest containing id, sourcePath, mechanism, expectedPass, expectedEffect, and invariants for each variant.",
      })),
      transformSpec: Type.Optional(Type.String({
        description: "Opt-in curated transformation specification. Exact edits generate complete C89 variants under build/ before running.",
      })),
      mechanism: Type.Optional(mechanism),
      expectedPass: Type.Optional(Type.String({ description: "Compiler pass predicted to change, such as rtl, combine, sched, lreg, greg, or sched2" })),
      expectedEffect: Type.Optional(Type.String({ description: "Concrete compiler effect the supplied variants are intended to test" })),
      invariants: Type.Optional(Type.Array(Type.String(), { description: "Semantic/source properties that must remain unchanged" })),
      tracePasses: Type.Optional(Type.Boolean({ description: "Compare rtl through dbr and report the first meaningful divergence" })),
      cc1Only: Type.Optional(Type.Boolean({
        description: "Fast triage only. A cc1-only exact result is never promotion-eligible until rerun in full mode.",
      })),
      show: Type.Optional(Type.String({ description: "Variant id whose full target-versus-compiled instruction listing should be printed" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      const variants = params.variants || [];
      const modes = Number(Boolean(params.manifest)) + Number(Boolean(params.transformSpec)) + Number(variants.length > 0);
      if (modes !== 1) throw new Error("Choose exactly one of variants, manifest, or transformSpec.");
      for (const path of [...variants, params.manifest, params.transformSpec].filter((value): value is string => Boolean(value))) {
        if (!safePath(path)) throw new Error(`Invalid path: ${path}`);
      }
      if (variants.length > 0 && (!params.mechanism || !params.expectedPass || !params.expectedEffect)) {
        throw new Error("Direct variants require mechanism, expectedPass, and expectedEffect. Use manifest for per-variant metadata.");
      }
      for (const variant of variants) {
        if (!variant.endsWith(".c")) throw new Error(`Variant path must end in .c: ${variant}`);
      }

      const args = ["tsx", "tools/agent/fuzzVariants.ts", params.functionName];
      if (params.manifest) args.push("--manifest", params.manifest);
      else if (params.transformSpec) args.push("--transform-spec", params.transformSpec);
      else args.push(...variants, "--mechanism", params.mechanism!, "--expected-pass", params.expectedPass!, "--expected-effect", params.expectedEffect!);
      for (const invariant of params.invariants || []) args.push("--invariant", invariant);
      if (params.tracePasses) args.push("--trace-passes");
      if (params.cc1Only) args.push("--cc1-only");
      if (params.show) args.push("--show", params.show);

      onUpdate?.({
        content: [{ type: "text", text: `Running mechanism-aware variants for ${params.functionName}...` }],
        details: {},
      });
      return runProjectCommand(pi, ctx.cwd, "npx", args, signal, 180_000);
    },
  });
}
