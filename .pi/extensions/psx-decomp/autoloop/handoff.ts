import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { validateFunctionName } from "../tools/shared.ts";
import type { HandoffSummary } from "./types.ts";

export const HANDOFF_TOOL = "psx_loop_handoff";

/**
 * The outgoing tier's report to the incoming one.
 *
 * Structured rather than free prose, because the receiving tier reads it after
 * a context clear and has nothing else of the previous attempt except the
 * source file. Four fields keep it answerable by the smallest model on the
 * ladder while still separating what was done from what it means.
 */
export interface HandoffSink {
  awaiting?: string;
  summary?: HandoffSummary;
}

export function createHandoffSink(): HandoffSink {
  return {};
}

export function registerHandoffTool(pi: ExtensionAPI, sink: HandoffSink): void {
  pi.registerTool({
    name: HANDOFF_TOOL,
    label: "Escalation Handoff",
    description:
      "Record the findings of the current escalation tier for the next one. Call exactly once when the loop asks for a handoff, then stop.",
    promptGuidelines: [
      "Only the escalation loop's handoff turn may call this tool.",
      "Report what was measured, not what was hoped; every claim must be traceable to the assembly or a tool that measured it.",
    ],
    parameters: Type.Object({
      functionName: Type.String({ description: "Function being handed off" }),
      whatWasTried: Type.String({
        description: "Source shapes actually compiled and measured, and what each did to the residual — including which produced identical code and are therefore not experiments to repeat",
      }),
      ruledOut: Type.String({
        description: "Hypotheses positively eliminated, and the evidence that eliminated each one. State what each elimination was conditional on: a form ruled out under one schedule or allocation is not ruled out if that state is itself the open variable",
      }),
      currentDivergence: Type.String({
        description: "The residual as psx_reverse_pipeline reports it: which pass owns it, the per-block residual, and the open decisions with their source levers — not a word count",
      }),
      leadingHypothesis: Type.String({
        description: "The most promising untested direction, and the cheapest evidence that would confirm or kill it",
      }),
    }),
    async execute(_toolCallId, params) {
      validateFunctionName(params.functionName);
      if (!sink.awaiting) {
        throw new Error(`${HANDOFF_TOOL} is only callable during an escalation-loop handoff`);
      }
      if (sink.awaiting !== params.functionName) {
        throw new Error(`A handoff is open for ${sink.awaiting}, not ${params.functionName}`);
      }
      sink.summary = {
        functionName: params.functionName,
        whatWasTried: params.whatWasTried,
        ruledOut: params.ruledOut,
        currentDivergence: params.currentDivergence,
        leadingHypothesis: params.leadingHypothesis,
        source: "tool",
      };
      return {
        content: [{ type: "text", text: `Handoff recorded for ${params.functionName}.` }],
        details: {},
        terminate: true,
      };
    },
  });
}

export function setHandoffToolActive(pi: ExtensionAPI, active: boolean): void {
  const tools = new Set(pi.getActiveTools());
  if (active) tools.add(HANDOFF_TOOL);
  else tools.delete(HANDOFF_TOOL);
  pi.setActiveTools([...tools]);
}

/**
 * Fallback when the tier ended its handoff turn without calling the tool.
 *
 * Prose is worth less than the structured form and is labelled as such, but it
 * is worth more than nothing: the next tier is told to treat either kind
 * adversarially, so a loose summary costs it no more than a rigorous one.
 */
export function lastAssistantText(ctx: ExtensionCommandContext): string {
  const entries = ctx.sessionManager.getEntries();
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (entry.type !== "message") continue;
    const message = (entry as { message?: { role?: string; content?: unknown } }).message;
    if (message?.role !== "assistant" || !Array.isArray(message.content)) continue;
    const text = message.content
      .filter((block): block is { type: "text"; text: string } => (block as { type?: string })?.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
}
