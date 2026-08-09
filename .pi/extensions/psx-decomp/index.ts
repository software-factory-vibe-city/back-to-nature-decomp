import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerAnalyzeTargetScheduleTool } from "./tools/analyze-target-schedule.ts";
import { registerCallGraphTool } from "./tools/call-graph.ts";
import { registerCompilerTraceTool } from "./tools/compiler-trace.ts";
import { registerDiagnosticTools } from "./tools/diagnostics.ts";
import { registerDiffFunctionTool } from "./tools/diff-function.ts";
import { registerExplainDiffTool } from "./tools/explain-diff.ts";
import { registerExportContextTool } from "./tools/export-context.ts";
import { registerFinalizeFunctionTool } from "./tools/finalize-function.ts";
import { registerFuzzVariantsTool } from "./tools/fuzz-variants.ts";
import { registerAutodecompCommands } from "./autonomous/commands.ts";
import { registerAutoloopCommands } from "./autoloop/commands.ts";
import { registerM2cTool } from "./tools/m2c.ts";
import { registerSearchSourceShapesTool } from "./tools/search-source-shapes.ts";
import { registerSynthesizeSourceShapesTool } from "./tools/synthesize-source-shapes.ts";
import { registerVerifyBuildTool } from "./tools/verify-build.ts";
import { runProjectCommand } from "./tools/shared.ts";
import { captureSessionBaseline } from "./tools/session-baseline.ts";

interface CallGraphEntry {
  name: string;
  priority: number;
  decompiled: boolean;
  handwritten: false | "asm" | "gte";
  dead: boolean;
  calls: string[];
  calledBy: string[];
}

interface CallGraph {
  functions: CallGraphEntry[];
}

function findProjectRoot(start: string): string {
  let current = resolve(start);

  while (true) {
    if (existsSync(join(current, "AGENTS.md")) && existsSync(join(current, "tools", "agent"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

function loadCallGraph(root: string): CallGraph | undefined {
  const graphPath = join(root, "build", "callGraph.json");
  if (!existsSync(graphPath)) return undefined;

  try {
    return JSON.parse(readFileSync(graphPath, "utf8")) as CallGraph;
  } catch {
    return undefined;
  }
}

function functionNames(root: string, predicate?: (entry: CallGraphEntry) => boolean): string[] {
  const graph = loadCallGraph(root);
  if (!graph) return [];
  return graph.functions.filter((entry) => !predicate || predicate(entry)).map((entry) => entry.name);
}

function completionItems(names: string[], prefix: string) {
  const needle = prefix.trim().toLowerCase();
  return names
    .filter((name) => name.toLowerCase().includes(needle))
    .slice(0, 50)
    .map((name) => ({ value: name, label: name }));
}

function parseFunctionArg(args: string): string | undefined {
  const value = args.trim();
  if (!value || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return undefined;
  return value;
}

function targetExists(root: string, name: string): boolean {
  const graph = loadCallGraph(root);
  if (graph?.functions.some((entry) => entry.name === name)) return true;
  return existsSync(join(root, "src", `${name}.c`)) || existsSync(join(root, "build", "asm", "nonmatchings", name));
}

function nextDecompilationTarget(root: string): string | undefined {
  const graph = loadCallGraph(root);
  return graph?.functions.find((entry) => !entry.decompiled && entry.handwritten === false && !entry.dead)?.name;
}

/* The decompiled flags are derived from src/*.c at graph-generation time, so
 * the cached graph goes stale as soon as any function source is written. */
function callGraphStale(root: string): boolean {
  const graphPath = join(root, "build", "callGraph.json");
  let graphMtimeMs: number;
  try {
    graphMtimeMs = statSync(graphPath).mtimeMs;
  } catch {
    return true;
  }

  const srcDir = join(root, "src");
  try {
    for (const file of readdirSync(srcDir)) {
      if (!file.endsWith(".c")) continue;
      if (statSync(join(srcDir, file)).mtimeMs > graphMtimeMs) return true;
    }
  } catch {
    return true;
  }
  return false;
}

async function ensureCallGraph(
  pi: ExtensionAPI,
  ctx: { ui: { notify(message: string, level: "info" | "warning" | "error"): void } },
  root: string,
  options: { refresh?: boolean } = {},
): Promise<boolean> {
  if (loadCallGraph(root) && !(options.refresh && callGraphStale(root))) return true;

  ctx.ui.notify("build/callGraph.json is missing or stale; rebuilding it...", "info");
  try {
    await runProjectCommand(pi, root, "npx", ["tsx", "tools/agent/callGraph.ts"], undefined, 120_000);
  } catch (error) {
    ctx.ui.notify(
      `Call graph rebuild failed: ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
    return false;
  }

  return loadCallGraph(root) !== undefined;
}

function nextRefinementTarget(root: string): string | undefined {
  const graph = loadCallGraph(root);
  if (!graph) return undefined;

  const live = graph.functions.filter((entry) => entry.decompiled && !entry.dead);
  const decompiled = new Set(live.map((entry) => entry.name));
  const ranked = live
    .map((entry) => ({
      name: entry.name,
      decompiledNeighbors: [...new Set([...entry.calls, ...entry.calledBy])].filter((name) => decompiled.has(name)).length,
      totalNeighbors: new Set([...entry.calls, ...entry.calledBy]).size,
    }))
    .sort(
      (a, b) =>
        b.decompiledNeighbors - a.decompiledNeighbors ||
        b.totalNeighbors - a.totalNeighbors ||
        a.name.localeCompare(b.name),
    );
  return ranked[0]?.name;
}

function dispatchSkill(
  pi: ExtensionAPI,
  ctx: { isIdle(): boolean; ui: { notify(message: string, level: "info" | "warning" | "error"): void } },
  skill: string,
  request: string,
): void {
  const prompt = `/skill:${skill} ${request}`;

  if (ctx.isIdle()) {
    pi.sendUserMessage(prompt);
  } else {
    pi.sendUserMessage(prompt, { deliverAs: "followUp" });
    ctx.ui.notify(`Queued ${skill}`, "info");
  }
}

export default function psxDecompExtension(pi: ExtensionAPI) {
  registerAnalyzeTargetScheduleTool(pi);
  registerCallGraphTool(pi);
  registerCompilerTraceTool(pi);
  registerDiagnosticTools(pi);
  registerDiffFunctionTool(pi);
  registerExplainDiffTool(pi);
  registerExportContextTool(pi);
  registerFinalizeFunctionTool(pi);
  registerFuzzVariantsTool(pi);
  registerM2cTool(pi);
  registerSearchSourceShapesTool(pi);
  registerSynthesizeSourceShapesTool(pi);
  registerVerifyBuildTool(pi);

  const root = findProjectRoot(process.cwd());
  /* Snapshot pre-existing workspace dirt so the finalize scope gate only
   * fails on files this session actually touched. */
  captureSessionBaseline(root);
  const allFunctionCompletions = (prefix: string) => {
    const items = completionItems(functionNames(root), prefix);
    return items.length > 0 ? items : null;
  };

  pi.registerCommand("decompile", {
    description: "Decompile and byte-match a function; omit the name to pick the next priority target",
    getArgumentCompletions: (prefix) => {
      const items = completionItems(
        functionNames(root, (entry) => !entry.decompiled && entry.handwritten === false && !entry.dead),
        prefix,
      );
      return items.length > 0 ? items : null;
    },
    handler: async (args, ctx) => {
      const explicit = args.trim().length > 0;
      let name = explicit ? parseFunctionArg(args) : undefined;

      if (!explicit && (await ensureCallGraph(pi, ctx, root, { refresh: true }))) {
        name = nextDecompilationTarget(root);
      }

      if (!name) {
        ctx.ui.notify(
          explicit
            ? "Usage: /decompile <function_name>"
            : "No decompilation target found.",
          "warning",
        );
        return;
      }
      if (!targetExists(root, name)) {
        ctx.ui.notify(`Unknown function: ${name}`, "error");
        return;
      }

      dispatchSkill(
        pi,
        ctx,
        "psx-decompile-function",
        `Target: ${name}. Mode: fresh decompilation. Create an m2c draft only if the source is still an INCLUDE_ASM stub; never overwrite an existing clean-C attempt.`,
      );
    },
  });

  pi.registerCommand("fix-decomp", {
    description: "Resume and fix an existing clean-C decompilation attempt",
    getArgumentCompletions: allFunctionCompletions,
    handler: async (args, ctx) => {
      const name = parseFunctionArg(args);
      if (!name) {
        ctx.ui.notify("Usage: /fix-decomp <function_name>", "warning");
        return;
      }
      if (!targetExists(root, name)) {
        ctx.ui.notify(`Unknown function: ${name}`, "error");
        return;
      }

      dispatchSkill(
        pi,
        ctx,
        "psx-decompile-function",
        `Target: ${name}. Mode: resume/fix. Preserve the current clean-C attempt, classify its existing diff, and continue from there.`,
      );
    },
  });

  pi.registerCommand("refine-decomp", {
    description: "Refine an already-matching function using decompiled neighbor context",
    getArgumentCompletions: (prefix) => {
      const items = completionItems(functionNames(root, (entry) => entry.decompiled && !entry.dead), prefix);
      return items.length > 0 ? items : null;
    },
    handler: async (args, ctx) => {
      const explicit = args.trim().length > 0;
      let name = explicit ? parseFunctionArg(args) : undefined;

      if (!explicit && (await ensureCallGraph(pi, ctx, root, { refresh: true }))) {
        name = nextRefinementTarget(root);
      }

      if (!name) {
        ctx.ui.notify(
          explicit
            ? "Usage: /refine-decomp <function_name>"
            : "No refinement target found.",
          "warning",
        );
        return;
      }
      if (!targetExists(root, name)) {
        ctx.ui.notify(`Unknown function: ${name}`, "error");
        return;
      }

      dispatchSkill(pi, ctx, "psx-refine-function", `Target: ${name}.`);
    },
  });

  pi.registerCommand("project-refine", {
    description: "Run one conservative, verified project-wide refinement batch",
    handler: async (args, ctx) => {
      if (args.trim()) {
        ctx.ui.notify("Usage: /project-refine", "warning");
        return;
      }
      dispatchSkill(pi, ctx, "psx-project-refinement", "Survey the current tree and execute one coherent refinement batch.");
    },
  });

  registerAutodecompCommands(pi, root);
  registerAutoloopCommands(pi, root);

  pi.registerCommand("decomp-status", {
    description: "Show the current call-graph decompilation worklist summary",
    handler: async (_args, ctx) => {
      let graph = loadCallGraph(root);
      if ((!graph || callGraphStale(root)) && (await ensureCallGraph(pi, ctx, root, { refresh: true }))) {
        graph = loadCallGraph(root);
      }
      if (!graph) {
        ctx.ui.notify("build/callGraph.json is missing or invalid and could not be rebuilt.", "warning");
        return;
      }

      const remaining = graph.functions.filter((entry) => !entry.decompiled && entry.handwritten === false && !entry.dead);
      const decompiled = graph.functions.filter((entry) => entry.decompiled && !entry.dead).length;
      const next = remaining[0]?.name ?? "none";
      ctx.ui.notify(`${decompiled} decompiled; ${remaining.length} clean-C targets remain; next: ${next}`, "info");
    },
  });
}
