import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runResource } from "./runner.ts";
import type { Request } from "../../../../tools/agent/resource-extraction/types.ts";
import { bindRequest, TOOL_SPECS, type RoleBinding } from "./specs.ts";

export function boundedReport(value: unknown): string {
  const text = JSON.stringify(value, null, 2);
  const lines = text.split("\n");
  const prefix = Buffer.from(lines.slice(0, 900).join("\n"));
  let result = prefix.subarray(0, 45000).toString("utf8");
  if (lines.length > 900 || prefix.length > 45000) {
    const report = value as { fullReport?: string; commandLog?: string };
    result += `\n[Truncated to 900 lines/45 KB. Full report: build/assets/${report?.fullReport ?? report?.commandLog ?? " (see persisted command logs)"}]`;
  }
  return result;
}
export function registerResourceTools(pi: ExtensionAPI, getBinding: () => RoleBinding | undefined, projectRoot: (cwd: string) => string): void {
  for (const spec of TOOL_SPECS) pi.registerTool({
    name: spec.name, label: `Resources: ${spec.operation}`, description: `${spec.description} Output bounded to 900 lines/45 KB; complete JSON under build/assets/.`,
    parameters: spec.parameters,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const binding = getBinding();
      const request = bindRequest(binding, spec.operation, params as Request);
      const signals = [signal, binding?.controller.signal, AbortSignal.timeout(120000)].filter((s): s is AbortSignal => Boolean(s));
      const combined = AbortSignal.any(signals);
      let lastUpdate = 0;
      const result = await runResource(spec.operation, projectRoot(ctx.cwd), request, combined, info => {
        if (binding && typeof info.run === "string") binding.run = info.run;
        if (Date.now() - lastUpdate < 150) return;
        lastUpdate = Date.now();
        onUpdate?.({ content: [{ type: "text", text: boundedReport(info) }], details: {} });
      });
      if (binding && typeof result.run === "string") binding.run = result.run;
      let terminate = false;
      if (binding?.phase === "extraction" && spec.operation === "campaign" &&
          (result.state === "supported-fixed-point" || result.state === "budget-exhausted")) {
        const checked = result.documentation as { manifestHash?: string; outcome?: string } | undefined;
        if (checked?.outcome === "validated" && checked.manifestHash) {
          binding.finish = { phase: "extraction", state: result.state, manifestHash: checked.manifestHash };
          terminate = true;
        }
      }
      if (binding?.phase === "documentation" && spec.operation === "iteration" && result.outcome === "asset-committed") {
        binding.finish = { phase: "documentation", state: "asset-committed", commit: result.commit as string };
        terminate = true;
      }
      if (binding?.phase === "parser" && spec.operation === "parser" && result.outcome === "parser-committed") {
        binding.finish = { phase: "parser", state: "parser-committed", commit: result.commit as string };
        terminate = true;
      }
      return { content: [{ type: "text", text: boundedReport(result) }], details: { run: result.run, state: result.state, fullReport: result.fullReport }, ...(terminate ? { terminate: true } : {}) };
    },
  });
}
