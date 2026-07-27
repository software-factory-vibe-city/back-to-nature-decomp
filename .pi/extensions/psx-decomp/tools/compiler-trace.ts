import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

export function registerCompilerTraceTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_compiler_trace",
    label: "PSX Compiler Trace",
    description: "Run the configured compiler trace for one PlayStation function and summarize pseudo provenance, observed SET/use/death UIDs, reconstructed lifetime endpoints, allocation, scheduler decisions, hard-register hazards, and target-register recurrence hints. Writes a typed report.json artifact. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Exact function symbol to trace" }),
      pseudo: Type.Optional(Type.Integer({ minimum: 80, description: "Optional pseudo number for focused provenance output" })),
      schedulerWindow: Type.Optional(Type.String({ pattern: "^\\d+:\\d+$", description: "Optional inclusive scheduler cycle window, for example 24:32" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      validateFunctionName(params.functionName);
      onUpdate?.({ content: [{ type: "text", text: `Tracing ${params.functionName}...` }], details: {} });
      const args = ["tsx", "tools/agent/compilerTrace.ts", params.functionName];
      if (params.pseudo !== undefined) args.push("--pseudo", String(params.pseudo));
      if (params.schedulerWindow) args.push("--scheduler-window", params.schedulerWindow);
      return runProjectCommand(
        pi,
        ctx.cwd,
        "npx",
        args,
        signal,
        30_000,
      );
    },
  });
}
