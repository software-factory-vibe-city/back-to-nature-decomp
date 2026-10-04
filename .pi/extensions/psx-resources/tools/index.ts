import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runResource } from "./runner.ts";
import type { Request } from "../../../../tools/agent/resource-extraction/types.ts";
import { bindRequest, TOOL_SPECS, type RoleBinding } from "./specs.ts";

export function boundedReport(value: unknown): string {
  const text = JSON.stringify(value, null, 2), lines = text.split("\n");
  const prefix = Buffer.from(lines.slice(0, 900).join("\n"));
  let result = prefix.subarray(0, 45000).toString("utf8");
  if (lines.length > 900 || prefix.length > 45000) result += `\n[Truncated to 900 lines/45 KB. Full report: ${(value as { fullReport?: string }).fullReport ?? "build/assets/manifest.json"}]`;
  return result;
}
export function registerResourceTools(pi: ExtensionAPI, getBinding: () => RoleBinding | undefined, projectRoot: (cwd: string) => string): void {
  for (const spec of TOOL_SPECS) pi.registerTool({
    name: spec.name, label: `Resources: ${spec.operation}`, description: `${spec.description} Output bounded to 900 lines/45 KB.`, parameters: spec.parameters,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const binding = getBinding(), request = bindRequest(binding, spec.operation, params as Request);
      const combined = AbortSignal.any([signal, binding?.controller.signal].filter((s): s is AbortSignal => Boolean(s)));
      let lastUpdate = 0;
      const result = await runResource(spec.operation, projectRoot(ctx.cwd), request, combined, info => {
        if (Date.now() - lastUpdate < 150) return; lastUpdate = Date.now();
        onUpdate?.({ content: [{ type: "text", text: boundedReport(info) }], details: {} });
      });
      const terminate = Boolean(binding && spec.operation === "parser" && result.outcome === "parser-tested");
      if (terminate) binding!.finish = true;
      return { content: [{ type: "text", text: boundedReport(result) }], details: result, ...(terminate ? { terminate: true } : {}) };
    },
  });
}
