import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { functionPaths } from "../../shared/call-graph.ts";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

export function registerM2cTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_m2c",
    label: "PSX m2c",
    description: "Prepare faithful context and a measured m2c handoff under build/. Preserve raw output, complete diagnostics and explicit unknowns; an existing clean-C attempt remains primary. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol to decompile" }),
      alternative: Type.Optional(Type.Boolean({ description: "Explicitly generate an m2c alternative to an existing attempt" })),
      stage: Type.Optional(Type.Boolean({ description: "Safely stage a compiling candidate into an unchanged committed target stub" })),
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
          ["tsx", "tools/agent/m2cFunc.ts", params.functionName, ...(params.alternative ? ["--alternative"] : []), ...(params.stage ? ["--write"] : [])],
          signal,
          600_000,
        ),
      );
    },
  });
}
