import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

export function registerM2cTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_m2c",
    label: "PSX m2c",
    description: "Generate and write an m2c first-pass source file for one PlayStation function. This overwrites src/<functionName>.c, so inspect the existing source before calling it. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol to decompile" }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      onUpdate?.({ content: [{ type: "text", text: `Running m2c for ${params.functionName}...` }], details: {} });
      const target = resolve(ctx.cwd, "src", `${params.functionName}.c`);
      return withFileMutationQueue(target, () =>
        runProjectCommand(
          pi,
          ctx.cwd,
          "npx",
          ["tsx", "tools/agent/m2cFunc.ts", params.functionName, "--write"],
          signal,
          30_000,
        ),
      );
    },
  });
}
