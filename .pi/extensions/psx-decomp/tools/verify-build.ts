import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { runProjectCommand } from "./shared.ts";

export function registerVerifyBuildTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "psx_verify_build",
    label: "Verify PSX Build",
    description: "Run the project's full byte-identity verification with make check. Output is limited to 50 KB or 2000 lines.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal, onUpdate, ctx) {
      onUpdate?.({ content: [{ type: "text", text: "Verifying the full build..." }], details: {} });
      return runProjectCommand(pi, ctx.cwd, "make", ["check"], signal, 120_000);
    },
  });
}
