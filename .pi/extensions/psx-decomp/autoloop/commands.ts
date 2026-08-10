import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getSessionBaseline } from "../tools/session-baseline.ts";
import { loadLoopConfig } from "./config.ts";
import { runLoop, summarize, type AbortFlag } from "./loop.ts";
import { createHandoffSink, registerHandoffTool, setHandoffToolActive } from "./handoff.ts";
import { createVerdictSink, registerPolicyVerdictTool, setVerdictToolActive } from "./policy-verdict.ts";
import { readState } from "./state.ts";
import { createTurnGate, registerTurnGate } from "./turn-gate.ts";

export const LOOP_COMMAND = "auto_decompilation_loop";

interface ParsedArgs {
  action: "run" | "status" | "stop" | "usage";
  target?: string;
  maxFunctions?: number;
}

export function parseArgs(args: string): ParsedArgs {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { action: "run" };
  if (tokens[0] === "status") return { action: "status" };
  if (tokens[0] === "stop") return { action: "stop" };

  const parsed: ParsedArgs = { action: "run" };
  for (const token of tokens) {
    const limit = token.match(/^--max(?:-functions)?=(\d+)$/);
    if (limit) {
      parsed.maxFunctions = Number.parseInt(limit[1], 10);
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token) && !parsed.target) {
      parsed.target = token;
      continue;
    }
    return { action: "usage" };
  }
  if (parsed.maxFunctions !== undefined && parsed.maxFunctions < 1) return { action: "usage" };
  return parsed;
}

/**
 * `/auto_decompilation_loop` — the in-TUI escalation loop.
 *
 * It runs in this session, on this tree: no worktrees, no detached supervisor,
 * no forked agents. The command handler is the loop body, `sendUserMessage` +
 * `waitForIdle` is the turn, and the two oracles are the only things allowed to
 * call a function finished.
 */
export function registerAutoloopCommands(pi: ExtensionAPI, projectRoot: string): void {
  const sink = { verdict: createVerdictSink(), handoff: createHandoffSink(), gate: createTurnGate() };
  registerPolicyVerdictTool(pi, sink.verdict);
  registerHandoffTool(pi, sink.handoff);
  registerTurnGate(pi, sink.gate);

  let active: AbortFlag | null = null;

  /* Both are turn-scoped instruments: they stay out of the ordinary active set
   * until the loop opens a policy review or a handoff. */
  pi.on("session_start", async () => {
    setVerdictToolActive(pi, false);
    setHandoffToolActive(pi, false);
  });

  /* Interactive input while the loop runs is the stop signal. The loop's own
   * messages carry source="extension", so it never interrupts itself. */
  pi.on("input", async (event) => {
    if (active && event.source === "interactive") active.aborted = true;
    return { action: "continue" };
  });

  pi.registerCommand(LOOP_COMMAND, {
    description:
      "Run the tiered escalation decompilation loop in this session. Usage: /auto_decompilation_loop [function] [--max=N] | status | stop",
    handler: async (args, ctx) => {
      const parsed = parseArgs(args);

      if (parsed.action === "usage") {
        ctx.ui.notify(`Usage: /${LOOP_COMMAND} [function] [--max=N] | status | stop`, "warning");
        return;
      }

      if (parsed.action === "stop") {
        if (!active) {
          ctx.ui.notify("No escalation loop is running.", "info");
          return;
        }
        active.aborted = true;
        ctx.ui.notify("Escalation loop will stop at the next checkpoint.", "info");
        return;
      }

      let config: ReturnType<typeof loadLoopConfig>;
      try {
        config = loadLoopConfig(projectRoot);
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
        return;
      }

      if (parsed.action === "status") {
        const state = readState(config);
        const parked = Object.keys(state.parked);
        const approvals = Object.keys(state.approvals);
        ctx.ui.notify(
          [
            `ladder: ${config.ladder.map((tier) => tier.label).join(" → ")}`,
            `returns per tier: ${config.returnsPerTier}`,
            `running: ${active ? "yes" : "no"}`,
            `parked (${parked.length}): ${parked.join(", ") || "none"}`,
            `agent-approved exemptions (${approvals.length}): ${approvals.join(", ") || "none"}`,
          ].join("\n"),
          "info",
        );
        return;
      }

      if (active) {
        ctx.ui.notify("An escalation loop is already running. Send any message, or /auto_decompilation_loop stop.", "warning");
        return;
      }

      const flag: AbortFlag = { aborted: false };
      active = flag;
      ctx.ui.notify(
        `Escalation loop starting. Ladder: ${config.ladder.map((tier) => tier.label).join(" → ")}. Type any message to stop.`,
        "info",
      );

      try {
        const outcomes = await runLoop(
          { pi, ctx, projectRoot, config, sink, flag, baseline: await getSessionBaseline(projectRoot) },
          { firstTarget: parsed.target, maxFunctions: parsed.maxFunctions },
        );
        ctx.ui.notify(summarize(outcomes), "info");
      } catch (error) {
        ctx.ui.notify(`Escalation loop failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      } finally {
        active = null;
      }
    },
  });
}
