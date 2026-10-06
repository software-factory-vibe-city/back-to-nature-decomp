import { readFileSync } from "node:fs";
import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { validateFunctionName } from "../tools/shared.ts";
import { rejectionFromDiagnostics } from "../../../../tools/agent/decompToolchain.ts";
import type { PreparationPacket } from "../../../../tools/agent/campaign/packet.ts";
import type { PrepHandoffSummary } from "./types.ts";

export const PREP_HANDOFF_TOOL = "psx_loop_prep_handoff";
export interface PrepSink {
  awaiting?: string;
  summary?: PrepHandoffSummary;
}

export function registerPrepHandoffTool(pi: ExtensionAPI, sink: PrepSink): void {
  pi.registerTool({
    name: PREP_HANDOFF_TOOL,
    label: "Preparation Handoff",
    description: "Hand the prepared C candidate and its header/SDK context to the matching agent. Call once when the loop requests the preparation handoff, then stop.",
    parameters: Type.Object({
      functionName: Type.String({ description: "Function prepared" }),
      candidatePath: Type.String({ description: "Path to the actual C candidate, whether staged or live" }),
      headerChanges: Type.String({ description: "Headers changed and the declarations/types published in each; name their evidence" }),
      sdkIdioms: Type.String({ description: "SDK types and macro operations established or restored; name their evidence" }),
      compilation: Type.String({ description: "Actual production compile commands, result and diagnostic/artifact paths" }),
      unresolved: Type.String({ description: "Remaining compile errors, uncertain contracts and integration blockers; empty if none" }),
    }),
    async execute(_toolCallId, params) {
      validateFunctionName(params.functionName);
      if (sink.awaiting !== params.functionName) throw new Error("No preparation handoff is open for this function");
      sink.summary = { ...params, source: "tool" };
      return { content: [{ type: "text", text: `Preparation handoff recorded for ${params.functionName}.` }], details: {}, terminate: true };
    },
  });
}

export function setPrepHandoffToolActive(pi: ExtensionAPI, active: boolean): void {
  const tools = new Set(pi.getActiveTools());
  if (active) tools.add(PREP_HANDOFF_TOOL);
  else tools.delete(PREP_HANDOFF_TOOL);
  pi.setActiveTools([...tools]);
}

export const PREP_TOOLS = [
  "read", "bash", "edit", "write",
  "psx_m2c", "psx_c_source_guard", "psx_callee_truth", "psx_frame_map",
  "psx_sdk_idioms", "psx_triage",
];

/** Keep project/user constraints, but omit the full skill catalogue and solver guidance. */
export function prepSystemPrompt(options: BuildSystemPromptOptions): string {
  return [
    options.customPrompt,
    "You are the autoloop preparation agent. Follow the preparation skill supplied in the task. " +
      "Prepare compiling C and its header/SDK context, then hand off; do not try to match bytes.",
    "Use read for file contents, edit for precise changes, write for new files and bash for commands. " +
      "Do not commit or modify unrelated work.",
    options.appendSystemPrompt,
    ...(options.contextFiles ?? []).map((file) => `<project_instructions path="${file.path}">\n${file.content}\n</project_instructions>`),
    `Current working directory: ${options.cwd}`,
  ].filter(Boolean).join("\n\n");
}

export function prepMessage(functionName: string, preparedOpening: string): string {
  /* sendUserMessage does not expand skills by default. Supply this short skill
     explicitly rather than relying on the model to discover the right one. */
  const skill = readFileSync(new URL("../../../skills/psx-prepare-function/SKILL.md", import.meta.url), "utf8");
  return [
    skill,
    `Target: ${functionName}. Role: prep. Compilation is the finish line, not byte matching.`,
    preparedOpening,
  ].join("\n\n");
}

export function prepNudge(lastReport: string, preparedOpening: string): string {
  return [
    "Continue preparation only. Repair the remaining compile/declaration errors, refresh psx_m2c, " +
      "and return once the actual candidate compiles. Do not optimize for a match.",
    lastReport, preparedOpening,
  ].join("\n\n");
}

/** A preparatory result is independent of exactness and full finalization. */
export function prepStatus(packet: PreparationPacket): { ready: boolean; report: string } {
  const rejection = rejectionFromDiagnostics(packet.compilation.diagnostics);
  const unpublished = packet.integration.blockers.includes("source-local types require explicit declaration integration");
  const noBody = packet.integration.blockers.includes("no clean-C target definition");
  const ready = !!packet.primary && packet.compilation.status === "succeeded" && !rejection && !unpublished && !noBody;
  return {
    ready,
    report: [
      `Preparation: ${ready ? "compiling C ready for the matching tier" : "not ready"}.`,
      `Candidate: ${packet.primary?.path ?? "none"}. Live destination: ${packet.identity.destination} (${packet.integration.state}).`,
      `Compilation: ${packet.compilation.status}${rejection ? `; rejecting diagnostic: ${rejection}` : ""}.`,
      ...(unpublished ? ["Required source-local declarations still need publication in the proper headers."] : []),
      ...(noBody ? ["No clean-C definition of the target exists yet."] : []),
      `Other preparation findings: ${packet.integration.blockers.join("; ") || "none"}. See the packet's evidence and full diagnostics.`,
      "Compilation is not proof of semantic correctness, a byte match, or finalization.",
    ].join("\n"),
  };
}

export function prepHandoffBlock(summary: PrepHandoffSummary): string {
  return [
    "--- Preparation handoff ---",
    `Candidate: ${summary.candidatePath}`,
    `Header changes: ${summary.headerChanges || "not reported"}`,
    `SDK idioms: ${summary.sdkIdioms || "not reported"}`,
    `Compilation: ${summary.compilation}`,
    `Unresolved: ${summary.unresolved || "none reported"}`,
    ...(summary.source === "prose" ? ["No structured prep handoff was recorded; the summary above is a prose fallback."] : []),
    "Continue from the measured candidate and refreshed packet, even if it is still staged under build/.",
    "Verify declaration and SDK claims against their evidence. Compilation alone does not establish semantics or a match.",
  ].join("\n");
}

export function prepHandoffMessage(functionName: string): string {
  return [
    `Preparation for ${functionName} is ending; the next ladder tier will continue from your candidate and refreshed packet.`,
    "Call psx_loop_prep_handoff exactly once. Do not edit files in this turn.",
    "candidatePath: the actual C candidate you prepared.",
    "headerChanges: header paths and declarations/types published, with evidence.",
    "sdkIdioms: SDK types/macros established or restored, with evidence.",
    "compilation: actual production compile commands/results and diagnostic/artifact paths.",
    "unresolved: remaining compile errors, uncertain contracts and integration blockers; empty if none.",
  ].join("\n");
}
