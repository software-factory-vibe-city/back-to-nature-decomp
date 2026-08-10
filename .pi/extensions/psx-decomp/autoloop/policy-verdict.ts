import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { validateFunctionName } from "../tools/shared.ts";
import type { PolicyVerdict } from "./types.ts";

export const POLICY_VERDICT_TOOL = "psx_loop_policy_verdict";

/**
 * The review turn's only channel back to the loop.
 *
 * The reviewer's prose is not parsed for a decision — a verdict exists only if
 * the reviewer called the tool, and the loop treats a silent review as a
 * rejection. Approval has to be an explicit act.
 */
export interface VerdictSink {
  /** Function the loop is currently awaiting a verdict for, or undefined when no review is open. */
  awaiting?: string;
  verdict?: PolicyVerdict;
}

export function createVerdictSink(): VerdictSink {
  return {};
}

export function registerPolicyVerdictTool(pi: ExtensionAPI, sink: VerdictSink): void {
  pi.registerTool({
    name: POLICY_VERDICT_TOOL,
    label: "Policy Verdict",
    description:
      "Record the reviewing tier's decision on a forbidden source construct proposed by a lower escalation tier. Call exactly once, then stop.",
    promptGuidelines: [
      "Only the escalation loop's policy review turn may call this tool.",
      "Approve only when the forbidden construct is demonstrably the correct answer for the function; reject by default.",
    ],
    parameters: Type.Object({
      functionName: Type.String({ description: "Function under review" }),
      decision: Type.Union([Type.Literal("approve"), Type.Literal("reject")], {
        description: "approve to grant the exemption, reject to require a clean-C solution",
      }),
      rationale: Type.String({
        description: "Evidence for the decision, traceable to the assembly or a documented exception class",
      }),
    }),
    async execute(_toolCallId, params) {
      validateFunctionName(params.functionName);
      if (!sink.awaiting) {
        throw new Error(`${POLICY_VERDICT_TOOL} is only callable during an escalation-loop policy review`);
      }
      if (sink.awaiting !== params.functionName) {
        throw new Error(`Policy review is open for ${sink.awaiting}, not ${params.functionName}`);
      }
      sink.verdict = { decision: params.decision, rationale: params.rationale };
      return {
        content: [
          {
            type: "text",
            text: `Recorded ${params.decision} for ${params.functionName}. The escalation loop will act on it.`,
          },
        ],
        details: { decision: params.decision },
        terminate: true,
      };
    },
  });
}

/** Add or remove the verdict tool from the active set without disturbing the rest of it. */
export function setVerdictToolActive(pi: ExtensionAPI, active: boolean): void {
  const tools = new Set(pi.getActiveTools());
  if (active) tools.add(POLICY_VERDICT_TOOL);
  else tools.delete(POLICY_VERDICT_TOOL);
  pi.setActiveTools([...tools]);
}
