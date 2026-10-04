import { readFileSync } from "node:fs";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { createTurnGate, registerTurnGate, waitForTurn } from "../psx-decomp/autoloop/turn-gate.ts";
import { parseArguments, splitArguments, HELP } from "../../../tools/agent/resource-extraction/cli.ts";
import { safePath } from "../../../tools/agent/resource-extraction/storage.ts";
import { parserPath } from "../../../tools/agent/resource-extraction/parser-builder.ts";
import type { RoleBinding } from "./tools/specs.ts";
import { boundedReport } from "./tools/index.ts";
import { runResource } from "./tools/runner.ts";

interface Active { controller: AbortController; alive: boolean; ownsTurn: boolean; root: string; binding?: RoleBinding; turns: number }
export interface Harness { binding(): RoleBinding | undefined }
/** Known formats run with zero model turns. Parser development is one explicit
 * work item, one skill dispatch, no per-asset role cycle or automatic commit. */
export function registerResourceCommand(pi: ExtensionAPI, rootOf: (cwd: string) => string): Harness {
  const gate = createTurnGate(); registerTurnGate(pi, gate);
  let active: Active | undefined;
  const message = (text: string): void => pi.sendMessage({ customType: "resource-harness", content: text, display: true });
  const stop = (ctx: { abort(): void | Promise<void> }): void => {
    if (!active) return;
    active.controller.abort(new Error("Resource work stopped"));
    if (active.ownsTurn) void ctx.abort();
  };
  pi.on("session_shutdown", (_event, ctx) => { if (active) active.alive = false; stop(ctx); });
  pi.on("input", (event, ctx) => { if (active && event.source === "interactive") stop(ctx); return { action: "continue" }; });
  pi.on("turn_start", (_event, ctx) => { if (active?.ownsTurn && ++active.turns > 32) stop(ctx); });
  pi.on("tool_call", event => {
    if (!active?.ownsTurn) return;
    if (!["read", "write", "edit", "psx_resource_parser", "psx_resource_analyze", "psx_resource_extract"].includes(event.toolName)) return { block: true, reason: "Parser work has no shell, game-source mutation or commit capability", terminate: true };
    if (["read", "write", "edit"].includes(event.toolName)) {
      const raw = (event.input as { path?: string }).path;
      try {
        if (!raw) throw new Error("Missing path");
        const target = safePath(active.root, raw), path = target.slice(active.root.length + 1).replaceAll("\\", "/");
        if (event.toolName !== "read" && !parserPath(path)) throw new Error("Parser builder writes only parsers/*.ts and parser-plugins.ts");
      } catch (error) { return { block: true, reason: String(error), terminate: true }; }
    }
  });
  async function run(ctx: ExtensionCommandContext, body: (state: Active) => Promise<void>): Promise<void> {
    if (active || !ctx.isIdle()) { message("Start resource work when this TUI is idle; --cancel stops the active resource work item."); return; }
    const state: Active = { root: rootOf(ctx.cwd), controller: new AbortController(), alive: true, ownsTurn: false, turns: 0 };
    active = state;
    try { await body(state); }
    catch (error) { if (state.alive) message(`${String(error)}\nParser drafts and unrelated work have not been reset or committed.`); }
    finally { if (active === state) active = undefined; }
  }
  pi.registerCommand("extract-resources", {
    description: "Deterministic extraction only: [--input extracted/path] [--force] [--full-verify] [--verify] [--migrate-legacy] [--cancel]. No model turns or commits.",
    handler: async (args, ctx) => {
      let parsed: ReturnType<typeof parseArguments>;
      try { parsed = parseArguments(splitArguments(args), rootOf(ctx.cwd)); }
      catch (error) { message(String(error)); return; }
      if (parsed.help) { message(HELP); return; }
      if (parsed.cancel) { stop(ctx); return; }
      await run(ctx, async state => {
        const result = await runResource(parsed.operation ?? "extract", state.root, parsed.request, state.controller.signal);
        if (state.alive) message(boundedReport(result));
      });
    },
  });
  pi.registerCommand("build-resource-parser", {
    description: "Investigate/implement/test one explicitly requested format capability. Loads the builder once; no automatic commit. --cancel stops without restoring drafts.",
    handler: async (args, ctx) => {
      if (args.trim() === "--cancel") { stop(ctx); return; }
      if (!args.trim() || args.length > 8192) { message("Usage: /build-resource-parser <format, original input/evidence, and requested capability>"); return; }
      await run(ctx, async state => {
        const saved = pi.getActiveTools(); let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const prepared = await runResource("parser", state.root, { action: "prepare" }, state.controller.signal);
          state.binding = { baseline: prepared.baseline as string, controller: state.controller, calls: 0 };
          pi.setActiveTools(["read", "write", "edit", "psx_resource_parser", "psx_resource_analyze", "psx_resource_extract"]);
          const skill = readFileSync(new URL("../../skills/psx-build-resource-parser/SKILL.md", import.meta.url), "utf8");
          await ctx.waitForIdle(); state.controller.signal.throwIfAborted();
          const before = gate.settled; state.ownsTurn = true;
          timer = setTimeout(() => stop(ctx), 20 * 60 * 1000);
          pi.sendUserMessage(`${skill}\n\nWork item: ${args}\nPrepared baseline: ${state.binding.baseline}. Finish with action=test, then action=accept. Success is a tested capability, not an asset note or a commit. Stop honestly if the required evidence is missing.`);
          const result = await waitForTurn({ gate, before, isIdle: () => ctx.isIdle(), isAborted: () => state.controller.signal.aborted, waitForIdle: () => ctx.waitForIdle(), startTimeoutMs: 120000, pollMs: 50, now: () => Date.now(), sleep: ms => new Promise(r => setTimeout(r, ms)) });
          if (result !== "settled") throw new Error(`Parser turn ${result}`);
          if (state.alive) message(state.binding.finish ? "Parser capability tested. Run npm run extract-assets to regenerate supported exports; nothing committed." : "Parser work ended without an accepted test gate; drafts remain for inspection. Nothing committed.");
        } finally {
          if (timer) clearTimeout(timer);
          if (state.alive) { if (state.controller.signal.aborted && state.ownsTurn) await ctx.abort(); pi.setActiveTools(saved); }
          state.ownsTurn = false;
        }
      });
    },
  });
  return { binding: () => active?.binding };
}
