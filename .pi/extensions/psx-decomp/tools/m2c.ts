import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { functionPaths } from "../autonomous/call-graph.ts";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

export function registerM2cTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_m2c",
    label: "PSX m2c",
    description: "Generate and write an m2c first-pass source file for one PlayStation function. This overwrites that function's source file — which is its own container's, not necessarily src/<functionName>.c — so inspect the existing source before calling it. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol to decompile" }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      onUpdate?.({ content: [{ type: "text", text: `Running m2c for ${params.functionName}...` }], details: {} });
      /* Lock the file m2c will actually write. Queuing on `src/<name>.c` for an
         overlay function guards a path nothing touches, so two writers to the
         real file would not serialise against each other. */
      const target = resolve(ctx.cwd, functionPaths(ctx.cwd, params.functionName).source);
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
