/**
 * orchestrator.ts — Drive the decompilation pipeline
 *
 * Reads callGraph.json and processes functions through m2c -> match -> cleanup stages.
 * Default is dry-run; use --write to modify src/ files.
 *
 * Usage:
 *   npx tsx --env-file=.env tools/orchestrator.ts                        # dry-run: show what would happen
 *   npx tsx --env-file=.env tools/orchestrator.ts --write                # actually modify src/ files
 *   npx tsx --env-file=.env tools/orchestrator.ts --top 5                # only process top 5 priority functions
 *   npx tsx --env-file=.env tools/orchestrator.ts --func func_80011F08   # process a specific function
 *   npx tsx --env-file=.env tools/orchestrator.ts --stage 1              # only run stage 1 (m2c)
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { exportContext as runContextExport } from "./contextExport.js";
import { runAgentLoop } from "./agent-loop.js";
import { getDecompilationCleanupAgentPrompt } from "./getPrompt.js";
import { runM2c } from "./m2cFunc.js";

const ROOT = new URL("..", import.meta.url).pathname;

// --- CLI args ---

const args = process.argv.slice(2);
const writeMode = args.includes("--write");

function argVal(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const topN = argVal("--top") ? parseInt(argVal("--top")!, 10) : 0;
const targetFunc = argVal("--func");
const maxStage = argVal("--stage") ? parseInt(argVal("--stage")!, 10) : 4;

// --- Types ---

interface CallGraphEntry {
  name: string;
  vram: string;
  size: number;
  tier: number;
  priority: number;
  callerCount: number;
  calls: string[];
  calledBy: string[];
  sdkCalls: string[];
  instructionCount: number;
  decompiled: boolean;
  handwritten: false | "asm" | "gte";
}

interface CallGraph {
  functions: CallGraphEntry[];
  stats: { total: number; tier1: number; tier2: number; tier3: number; decompiled: number; gte: number; asm: number };
}

interface AgentResult {
  success: boolean;
  attempts?: number;
  matchPercent?: number;
  log: string[];
}

interface PipelineContext {
  funcName: string;
  sFile: string;
  cFile: string;
  stagingDir: string;
  callGraphEntry: CallGraphEntry;
  contextHeader?: string;
}

// --- Agent stubs ---

async function runMatchingAgent(funcName: string, ctx: PipelineContext): Promise<AgentResult> {
  console.log(`  Stage 2: running matching agent for ${funcName}`);

  const systemPrompt = getDecompilationCleanupAgentPrompt(funcName);

  const checkSuccess = (): boolean => {
    try {
      // Check per-function match via diffFunc
      const diffOutput = execSync(`timeout 10 npx tsx tools/diffFunc.ts ${funcName}`, {
        cwd: ROOT,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (!diffOutput.includes("100.0%")) return false;

      // Verify full binary still matches (catches relocation/linker issues)
      const makeOutput = execSync("make check", {
        cwd: ROOT,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60000,
      });
      return makeOutput.includes("matches original payload");
    } catch {
      return false;
    }
  };

  const result = await runAgentLoop({
    systemPrompt,
    userMessage: `Decompile and match ${funcName}. The file src/${funcName}.c already contains m2c output as your starting point. Run \`timeout 5 npx tsx tools/diffFunc.ts ${funcName}\` to compile and check your match percentage. Keep iterating until you reach 100% match.`,
    cwd: ROOT,
    maxRetries: 10,
    checkSuccess,
  });

  return {
    success: result.success,
    attempts: result.retries + 1,
    matchPercent: result.success ? 100 : undefined,
    log: [result.output.slice(-500)],
  };
}

async function runCleanupAgent(funcName: string, _ctx: PipelineContext): Promise<AgentResult> {
  console.log(`  Stage 3: running cleanup agent for ${funcName}`);
  // TODO: integrate with agent framework
  return { success: false, attempts: 0, log: ["agent not implemented"] };
}

function exportContext(funcName: string, _ctx: PipelineContext): string {
  const result = runContextExport(funcName, ROOT);
  if (result.skipped) {
    console.log(`  Stage 4: skipped (${result.reason})`);
    return "skipped";
  }
  console.log(`  Stage 4: exported ${result.signatures.length} signature(s) to include/functions.h`);
  return "ok";
}

// --- Pipeline ---

interface FuncResult {
  name: string;
  stages: Record<string, string>; // stage name -> status
}

async function processFunctions(funcs: CallGraphEntry[]): Promise<FuncResult[]> {
  const results: FuncResult[] = [];

  for (const entry of funcs) {
    const name = entry.name;
    console.log(`\nProcessing ${name} (tier ${entry.tier}, ${entry.instructionCount} instrs, priority #${entry.priority})`);

    const stagingDir = join(ROOT, "build/pipeline", name);
    mkdirSync(stagingDir, { recursive: true });

    // Resolve the actual .s file (handles named symbols like __start)
    const asmDir = join("build/asm/nonmatchings", name);
    let sFile = join(asmDir, `${name}.s`);
    if (!existsSync(join(ROOT, sFile))) {
      const absDir = join(ROOT, asmDir);
      if (existsSync(absDir)) {
        const files = readdirSync(absDir).filter((f) => f.endsWith(".s"));
        if (files.length === 1) {
          sFile = join(asmDir, files[0]);
        }
      }
    }

    const ctx: PipelineContext = {
      funcName: name,
      sFile,
      cFile: join("src", `${name}.c`),
      stagingDir,
      callGraphEntry: entry,
    };

    const autoContext = join(ROOT, "include/functions.h");
    if (existsSync(autoContext)) {
      ctx.contextHeader = "include/functions.h";
    }

    const stages: Record<string, string> = {};

    // Stage 1: m2c
    try {
      const wrapped = runM2c(name, ROOT, {
        contextFile: ctx.contextHeader,
        write: writeMode,
      });

      writeFileSync(join(stagingDir, "m2c_output.c"), wrapped);

      stages["m2c"] = "ok";
      console.log(`  Stage 1: m2c ok`);
    } catch (e: any) {
      stages["m2c"] = "error";
      console.log(`  Stage 1: m2c error — ${e.message}`);
      const logLines = [`m2c error: ${e.message}`];
      writeFileSync(join(stagingDir, "log.txt"), logLines.join("\n"));
      results.push({ name, stages });
      continue; // skip remaining stages on m2c failure
    }

    // Pre-check: does m2c output already match?
    let alreadyMatched = false;
    if (writeMode && maxStage >= 2) {
      try {
        const diffOutput = execSync(`timeout 10 npx tsx tools/diffFunc.ts ${name}`, {
          cwd: ROOT,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        if (diffOutput.includes("100.0%")) {
          console.log(`  Stage 2: m2c output already matches 100% — skipping agent`);
          stages["match"] = "ok (m2c)";
          alreadyMatched = true;
        }
      } catch {
        // compile or diff failed, proceed to agent
      }
    }

    // Stage 2: match agent
    if (maxStage >= 2 && !alreadyMatched) {
      const result = await runMatchingAgent(name, ctx);
      stages["match"] = result.success ? "ok" : "stubbed";
    }

    // Stage 3: cleanup agent (stubbed)
    if (maxStage >= 3) {
      const result = await runCleanupAgent(name, ctx);
      stages["cleanup"] = result.success ? "ok" : "stubbed";
    }

    // Stage 4: context export
    if (maxStage >= 4) {
      stages["context"] = exportContext(name, ctx);
    }

    // Write pipeline log
    const logLines = Object.entries(stages).map(([k, v]) => `${k}: ${v}`);
    writeFileSync(join(stagingDir, "log.txt"), logLines.join("\n") + "\n");

    results.push({ name, stages });
  }

  return results;
}

// --- Main ---

async function main() {
  const graphPath = join(ROOT, "build/callGraph.json");
  if (!existsSync(graphPath)) {
    console.error("callGraph.json not found. Run: npx tsx tools/callGraph.ts");
    process.exit(1);
  }

  const graph: CallGraph = JSON.parse(readFileSync(graphPath, "utf-8"));

  // Filter functions to process
  let funcs = graph.functions.filter((f) => !f.decompiled && f.handwritten !== "asm");

  if (targetFunc) {
    funcs = graph.functions.filter((f) => f.name === targetFunc);
    if (funcs.length === 0) {
      console.error(`Function not found in call graph: ${targetFunc}`);
      process.exit(1);
    }
  } else if (topN > 0) {
    funcs = funcs.slice(0, topN);
  }

  console.log(`Pipeline: ${funcs.length} function(s)${writeMode ? "" : " (dry run)"}`);

  const results = await processFunctions(funcs);

  // Summary
  console.log(`\n${"—".repeat(60)}`);
  console.log(`Processed ${results.length} function(s):\n`);
  for (const r of results) {
    const stageStr = Object.entries(r.stages)
      .map(([k, v]) => {
        const icon = v === "ok" ? "\u2713" : v === "error" ? "\u2717" : "(stubbed)";
        return `${k} ${icon}`;
      })
      .join(" | ");
    console.log(`  ${r.name}: ${stageStr}`);
  }

  if (!writeMode) {
    console.log(`\nDry run. Run with --write to modify src/ files.`);
  }
}

main();
