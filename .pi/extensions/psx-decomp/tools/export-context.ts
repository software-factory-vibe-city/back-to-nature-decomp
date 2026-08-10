import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

export function registerExportContextTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_export_context",
    label: "Export PSX Context",
    description: "Export one matched function signature, or all matched signatures, into the project's generated function context header. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.Optional(Type.String({ description: "Exact function symbol; omit to export all matched signatures" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (params.functionName) validateFunctionName(params.functionName);
      onUpdate?.({
        content: [{ type: "text", text: params.functionName ? `Exporting ${params.functionName}...` : "Exporting all signatures..." }],
        details: {},
      });

      const args = ["tsx", "tools/agent/contextExport.ts", params.functionName ?? "--all"];
      const target = resolve(ctx.cwd, "include", "functions.h");
      return withFileMutationQueue(target, () =>
        runProjectCommand(pi, ctx.cwd, "npx", args, signal, 30_000),
      );
    },
  });
}
