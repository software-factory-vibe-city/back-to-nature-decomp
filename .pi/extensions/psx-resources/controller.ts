import { readFileSync } from "node:fs";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { createTurnGate, registerTurnGate, waitForTurn } from "../psx-decomp/autoloop/turn-gate.ts";
import { parseArguments, splitArguments, HELP } from "../../../tools/agent/resource-extraction/cli.ts";
import { Store, runPath, safePath } from "../../../tools/agent/resource-extraction/storage.ts";
import { parserPath } from "../../../tools/agent/resource-extraction/parser-builder.ts";
import { TOOL_SPECS, type RoleBinding } from "./tools/specs.ts";
import { boundedReport } from "./tools/index.ts";
import { runResource } from "./tools/runner.ts";

interface Active extends RoleBinding { alive: boolean; ownsTurn: boolean; turns: number; messages: number; root: string }
export interface Harness { binding(): RoleBinding | undefined }
function skill(name: string): string { return readFileSync(new URL(`../../skills/${name}/SKILL.md`, import.meta.url), "utf8"); }

/** Same-TUI iteration loop. The only successful iteration is an asset/document
 * commit or a tested parser commit. Existing parser closure leads to builder
 * work, not an automatic all-assets-found verdict. */
export function registerResourceCommand(pi: ExtensionAPI, rootOf: (cwd: string) => string): Harness {
  const gate = createTurnGate(); registerTurnGate(pi, gate);
  let active: Active | undefined;
  const stop = (ctx: { abort(): void | Promise<void> }): void => {
    if (!active) return;
    active.controller.abort(new Error("Resource loop stopped"));
    if (active.ownsTurn) void ctx.abort();
  };
  pi.on("session_shutdown", (_event, ctx) => { if (active) active.alive = false; stop(ctx); });
  pi.on("input", (event, ctx) => { if (active && event.source === "interactive") stop(ctx); return { action: "continue" }; });
  pi.on("turn_start", (_event, ctx) => { if (active?.ownsTurn && ++active.turns > (active.phase === "parser" ? 32 : 8)) stop(ctx); });
  pi.on("tool_call", event => {
    if (!active?.ownsTurn) return;
    const allowed = active.phase === "parser" ? ["read", "write", "edit", "psx_resource_parser", "psx_resource_inventory", "psx_resource_analyze"] :
      active.phase === "documentation" ? ["psx_resource_document", "psx_resource_verify", "psx_resource_extract", "psx_resource_iteration"] : TOOL_SPECS.map(s => s.name);
    if (!allowed.includes(event.toolName)) return { block: true, reason: "This resource role has no shell/build/game-source mutation capability", terminate: true };
    if (active.phase === "parser" && ["read", "write", "edit"].includes(event.toolName)) {
      const raw = (event.input as { path?: string }).path;
      try {
        if (!raw) throw new Error("Missing path");
        const target = safePath(active.root, raw);
        const path = target.slice(active.root.length + 1).replaceAll("\\", "/");
        if (event.toolName !== "read" && !parserPath(path)) throw new Error("Parser builder writes only parsers/*.ts and parser-plugins.ts");
      } catch (error) { return { block: true, reason: String(error), terminate: true }; }
    }
  });
  pi.on("message_end", event => {
    if (!active?.run || !active.ownsTurn) return;
    new Store(active.root).json(`${runPath(active.run)}/logs/tui-${active.phase}-${active.messages++}.json`, event.message);
  });
  async function turn(ctx: ExtensionCommandContext, state: Active, prompt: string): Promise<void> {
    state.controller.signal.throwIfAborted(); await ctx.waitForIdle();
    const before = gate.settled;
    state.ownsTurn = true; state.turns = 0; state.calls = 0; state.seen = {}; delete state.finish;
    pi.sendUserMessage(prompt);
    const result = await waitForTurn({ gate, before, isIdle: () => ctx.isIdle(), isAborted: () => state.controller.signal.aborted,
      waitForIdle: () => ctx.waitForIdle(), startTimeoutMs: 120000, pollMs: 50, now: () => Date.now(), sleep: ms => new Promise(r => setTimeout(r, ms)) });
    state.ownsTurn = false;
    if (result !== "settled") throw new Error(`TUI role ${result}; unanswered turns never earn commits`);
  }
  pi.registerCommand("extract-resources", {
    description: "In-TUI asset/parser loop, committing each verified iteration: [--input extracted/path] [--resume RUN] [--max-iterations N] [--status] [--no-agents] [--cancel]",
    handler: async (args, ctx) => {
      const root = rootOf(ctx.cwd);
      let parsed: ReturnType<typeof parseArguments>;
      try { parsed = parseArguments(splitArguments(args), root); }
      catch (error) { pi.sendMessage({ customType: "resource-harness", content: String(error), display: true }); return; }
      if (parsed.help) { pi.sendMessage({ customType: "resource-harness", content: HELP, display: true }); return; }
      if (parsed.cancel) { stop(ctx); return; }
      if (parsed.operation === "document") {
        const result = await runResource("document", root, parsed.request);
        pi.sendMessage({ customType: "resource-harness", content: boundedReport(result), display: true }); return;
      }
      if (parsed.request.action === "check") {
        const status = active ? { running: true, phase: active.phase, run: active.run } : await runResource("campaign", root, parsed.request);
        pi.sendMessage({ customType: "resource-harness", content: boundedReport(status), display: true }); return;
      }
      if (active || !ctx.isIdle()) { pi.sendMessage({ customType: "resource-harness", content: "Start when this TUI is idle. Type a message or /extract-resources --cancel to stop this loop.", display: true }); return; }
      const state: Active = { phase: "extraction", request: parsed.request, root, controller: new AbortController(), calls: 0, alive: true, ownsTurn: false, turns: 0, messages: 0,
        ...(parsed.request.run || parsed.request.resume ? { run: parsed.request.run ?? parsed.request.resume } : {}) };
      active = state;
      const saved = pi.getActiveTools();
      const onAbort = (): void => { if (state.ownsTurn) void ctx.abort(); };
      state.controller.signal.addEventListener("abort", onAbort);
      let timer: ReturnType<typeof setTimeout> | undefined, iterations = 0;
      try {
        if (!parsed.agents) {
          const result = await runResource(parsed.operation ?? "campaign", root, parsed.request, state.controller.signal);
          pi.sendMessage({ customType: "resource-harness", content: boundedReport(result), display: true }); return;
        }
        pi.sendMessage({ customType: "resource-harness", content: "Resource loop started in this TUI. Successful iterations commit either verified asset notes or a tested parser. Generated assets stay in build/assets/. Type any message to stop.", display: true });
        while (iterations < parsed.maxIterations) {
          state.controller.signal.throwIfAborted();
          const selection = state.run ? { run: state.run, action: "next" as const } : { ...parsed.request, action: "next" as const };
          const work = await runResource("iteration", root, selection, state.controller.signal);
          if (typeof work.run === "string") state.run = work.run;
          if (work.outcome === "scan-work") continue;
          if (work.outcome === "budget-stop") throw new Error("Input/resource budget reached; accepted iterations retained. Narrow scope or explicitly raise its budget.");
          timer = setTimeout(() => stop(ctx), 20 * 60 * 1000);
          if (work.outcome === "asset-work") {
            state.phase = "documentation"; state.target = work.node as string;
            pi.setActiveTools(["psx_resource_document", "psx_resource_verify", "psx_resource_extract", "psx_resource_iteration"]);
            await turn(ctx, state, `${skill("psx-extract-resources")}\n\n${skill("psx-document-resources")}\n\nIteration ${iterations + 1}: ${JSON.stringify(work)}. This is an asset iteration. Obtain its verified evidence, then finish with psx_resource_iteration action=asset. The gate extracts/replays it, appends extraction instructions to notes/asset-identification.md and commits only that note. User authorized per-iteration commits. Stay in this TUI; do not claim unrelated semantic meaning.`);
            if (state.finish?.state !== "asset-committed") throw new Error("Asset turn produced no verified documentation commit; no iteration accepted from prose");
          } else if (work.outcome === "parser-work") {
            const prepared = await runResource("parser", root, { action: "prepare" }, state.controller.signal);
            state.phase = "parser"; state.baseline = prepared.baseline as string;
            pi.setActiveTools(["read", "write", "edit", "psx_resource_parser", "psx_resource_inventory", "psx_resource_analyze"]);
            await turn(ctx, state, `${skill("psx-build-resource-parser")}\n\nIteration ${iterations + 1}: ${JSON.stringify(work)}. Prepared baseline: ${state.baseline}. Build/register a pure parser with corresponding tests, then call psx_resource_parser action=test and action=accept. Only a tested parser commit finishes this iteration. Do not fabricate a format or edit core/game sources to force progress.`);
            if (state.finish?.state !== "parser-committed") throw new Error("Parser turn did not implement/test/commit a capability; stopping rather than looping on an unsupported guess");
            delete state.baseline;
            // Next deterministic call loads new parser modules in a fresh tool
            // process and restarts the discovery scope with a new fingerprint.
          } else throw new Error(`Unexpected resource work outcome: ${work.outcome}`);
          clearTimeout(timer); timer = undefined;
          iterations++;
          new Store(root).json("loop/state.json", { run: state.run, iterations, lastCommit: state.finish?.commit, phase: state.phase });
          pi.sendMessage({ customType: "resource-harness", content: `Iteration ${iterations}: ${state.finish?.state}, commit ${state.finish?.commit}. Continuing discovery.`, display: true });
        }
      } catch (error) {
        if (state.alive) pi.sendMessage({ customType: "resource-harness", content: `${String(error)}\n${iterations} accepted iteration(s) retained${state.run ? `; run build/assets/${runPath(state.run)}` : ""}.`, display: true });
      } finally {
        if (timer) clearTimeout(timer);
        state.controller.signal.removeEventListener("abort", onAbort);
        if (state.baseline) {
          try { await runResource("parser", root, { action: "discard", baseline: state.baseline }); }
          catch (error) { if (state.alive) pi.sendMessage({ customType: "resource-harness", content: `Parser attempt retained for inspection: ${String(error)}`, display: true }); }
        }
        if (state.alive) { if (state.controller.signal.aborted && state.ownsTurn) await ctx.abort(); pi.setActiveTools(saved); if (ctx.hasUI) ctx.ui.setStatus("resources", undefined); }
        if (active === state) active = undefined;
      }
    },
  });
  return { binding: () => active };
}
