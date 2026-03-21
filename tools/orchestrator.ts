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
 *   npx tsx --env-file=.env tools/orchestrator.ts --refine              # run global refinement on all candidates
 *   npx tsx --env-file=.env tools/orchestrator.ts --refine --func X     # refine a specific function
 *   npx tsx --env-file=.env tools/orchestrator.ts --refine --top 5      # refine top 5 candidates
 *   npx tsx --env-file=.env tools/orchestrator.ts --project-refine     # project-wide refinement pass
 */

import { createHash } from "crypto";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { exportContext as runContextExport } from "./contextExport.js";
import { runAgentLoop, runPlanThenExecute } from "./agent-loop.js";
import { getDecompilationCleanupAgentPrompt, getGlobalRefinementAgentPrompt, getProjectRefinementAgentPrompt, findRefinementCandidates } from "./getPrompt.js";
import { runM2c } from "./m2cFunc.js";
import { WorktreeManager } from "./worktree.js";

const ROOT = new URL("..", import.meta.url).pathname;
const wt = new WorktreeManager(ROOT);

// --- CLI args ---

const args = process.argv.slice(2);
const writeMode = args.includes("--write");

function argVal(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const topN = argVal("--top") ? parseInt(argVal("--top")!, 10) : 0;
const targetFunc = argVal("--func");
const maxStage = argVal("--stage") ? parseInt(argVal("--stage")!, 10) : 5;
const refineMode = args.includes("--refine");
const projectRefineMode = args.includes("--project-refine");

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

async function runMatchingAgent(funcName: string, ctx: PipelineContext, workDir: string = ROOT): Promise<AgentResult> {
  console.log(`  Stage 2: running matching agent for ${funcName}`);

  const systemPrompt = getDecompilationCleanupAgentPrompt(funcName, workDir);

  const checkSuccess = (): boolean => {
    try {
      // Check per-function match via diffFunc
      const diffOutput = execSync(`timeout 10 npx tsx tools/diffFunc.ts ${funcName}`, {
        cwd: workDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (!diffOutput.includes("100.0%")) return false;

      // Verify full binary still matches (catches relocation/linker issues)
      const makeOutput = execSync("make check", {
        cwd: workDir,
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
    cwd: workDir,
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


async function runRefinementAgent(funcName: string, workDir: string = ROOT): Promise<AgentResult> {
  console.log(`  Stage 5: running refinement agent for ${funcName}`);

  const systemPrompt = getGlobalRefinementAgentPrompt(funcName, workDir);

  const checkSuccess = (): boolean => {
    try {
      const diffOutput = execSync(`timeout 10 npx tsx tools/diffFunc.ts ${funcName}`, {
        cwd: workDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (!diffOutput.includes("100.0%")) return false;

      const makeOutput = execSync("make check", {
        cwd: workDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60000,
      });
      return makeOutput.includes("matches original payload");
    } catch {
      return false;
    }
  };

  /* Verify match before starting — don't refine broken functions */
  if (!checkSuccess()) {
    console.log(`  Stage 5: skipping — function does not currently match`);
    return { success: false, attempts: 0, log: ["pre-check failed: not matching"] };
  }

  const result = await runAgentLoop({
    systemPrompt,
    userMessage: `Refine ${funcName} using context from its decompiled neighbors. The function already matches — your job is to improve readability (rename variables, propagate types, add comments) while keeping the 100% match. Run \`npx tsx tools/diffFunc.ts ${funcName}\` after every change to verify. If you cannot improve it with the available context, say so.`,
    cwd: workDir,
    maxRetries: 3,
    checkSuccess,
  });

  return {
    success: result.success,
    attempts: result.retries + 1,
    log: [result.output.slice(-500)],
  };
}

async function runProjectRefinementAgent(workDir: string = ROOT): Promise<AgentResult> {
  console.log(`Running project-wide refinement pass (plan-then-execute)...`);

  const systemPrompt = getProjectRefinementAgentPrompt(workDir);

  const checkSuccess = (): boolean => {
    try {
      /* Full clean rebuild: agent may have changed splat.yaml or symbol_addrs.txt,
       * so we need make clean + make split to regenerate the linker script and
       * assembly before checking the binary match. */
      execSync("make clean", { cwd: workDir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 60000 });
      execSync("npx tsx ./tools/callGraph.ts", { cwd: workDir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 120000 });
      execSync("make split", { cwd: workDir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 120000 });
      const makeOutput = execSync("make check", {
        cwd: workDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 120000,
      });
      return makeOutput.includes("matches original payload");
    } catch {
      return false;
    }
  };

  /* Verify full binary matches before starting */
  if (!checkSuccess()) {
    console.log(`Project refinement: skipping — binary does not currently match`);
    return { success: false, attempts: 0, log: ["pre-check failed: binary not matching"] };
  }

  const planMessage = `Survey all decompiled source files and create a plan for refinement.

Read every file in src/ that doesn't contain INCLUDE_ASM. Identify:
- Shared struct types that should be consolidated (same globals accessed with different local structs)
- \`_D_\` references that should use \`&D_\` or be moved to globals_override.h
- Variables that can be meaningfully renamed based on context
- Functions whose purpose is clear enough to rename

Then output your plan as a JSON array of task strings, fenced in \`\`\`json ... \`\`\`.

IMPORTANT: Output at most 5 tasks. Group related work into batches — e.g., ALL struct consolidations in one task, ALL function renames in another. Each task spawns a fresh agent session (expensive), so fewer bigger tasks are better than many small ones. Each task description should list every file and change in the batch so the executing agent has full context.

Example:
\`\`\`json
[
  "Consolidate shared struct types: (1) Define GfxObj in game_types.h with fields at 0x18, 0x1C, 0x2C, 0x30 — update func_80013AA4.c and func_80013AC8.c to use it. (2) Define Struct_80061DE8 in globals_override.h with fields at 0x00-0x1C — update func_8001B9F8.c and func_8001BA40.c. Verify with make check after all changes.",
  "Rename functions with clear purposes: func_80011F08 -> getGameState (getter for D_8005E394), func_80011F14 -> setGameState (setter). For each: update symbol_addrs.txt, update splat.yaml segment name, mv the source file, update function name in source, update functions.h. Run make split then make check after all renames.",
  "Fix _D_ references and type void* parameters: In func_80021FD0.c change _D_8006C838 to &D_8006C838. In func_80015880.c and func_80015894.c, change void* to SomeStruct*. Verify each with diffFunc."
]
\`\`\`

Do NOT make any changes during planning. Only survey and output the task list.`;

  const result = await runPlanThenExecute({
    systemPrompt,
    planMessage,
    cwd: workDir,
    maxRetries: 3,
    checkSuccess,
  });

  const successCount = result.results.filter((r) => r.success).length;
  return {
    success: successCount > 0,
    attempts: result.results.length,
    log: result.plan,
  };
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

    // Create and prepare worktree for isolation
    let wtInfo;
    try {
      wtInfo = wt.create(name);
      wt.prepare(wtInfo);
    } catch (e: any) {
      console.log(`  Worktree setup failed — ${e.message}`);
      results.push({ name, stages: { worktree: "error" } });
      if (wtInfo) wt.cleanup(wtInfo, true);
      continue;
    }

    const wtPath = wtInfo.path;

    // Resolve the actual .s file (handles named symbols like __start)
    const asmDir = join("build/asm/nonmatchings", name);
    let sFile = join(asmDir, `${name}.s`);
    if (!existsSync(join(wtPath, sFile))) {
      const absDir = join(wtPath, asmDir);
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

    const autoContext = join(wtPath, "include/functions.h");
    if (existsSync(autoContext)) {
      ctx.contextHeader = "include/functions.h";
    }

    const stages: Record<string, string> = {};

    // Stage 1: m2c (writes src/ in worktree)
    try {
      const wrapped = runM2c(name, wtPath, {
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
      wt.cleanup(wtInfo, true);
      continue; // skip remaining stages on m2c failure
    }

    // Pre-check: does m2c output already match?
    let alreadyMatched = false;
    if (writeMode && maxStage >= 2) {
      try {
        const diffOutput = execSync(`timeout 10 npx tsx tools/diffFunc.ts ${name}`, {
          cwd: wtPath,
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

    // Stage 2: match agent (runs in worktree)
    if (maxStage >= 2 && !alreadyMatched) {
      const result = await runMatchingAgent(name, ctx, wtPath);
      stages["match"] = result.success ? "ok" : "stubbed";
    }

    // On success: commit in worktree, merge into trunk, rebuild
    const matched = stages["match"] === "ok" || stages["match"] === "ok (m2c)";
    if (matched) {
      const committed = wt.commit(wtInfo, `Decomp: ${name}`);
      if (committed) {
        const mergeResult = wt.merge(wtInfo);
        if (mergeResult.success) {
          wt.cleanup(wtInfo);

          // Rebuild trunk after merge
          console.log(`  Rebuilding trunk after merge...`);
          execSync("make clean", { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"], timeout: 60000 });
          execSync("make split", { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"], timeout: 120000 });

          // Stage 4: context export (runs on trunk post-merge)
          if (maxStage >= 4) {
            stages["context"] = exportContext(name, ctx);
          }
        } else {
          console.log(`  Merge failed — discarding worktree`);
          stages["merge"] = "conflict";
          wt.cleanup(wtInfo, true);
        }
      } else {
        // No changes to commit (shouldn't happen for a successful match)
        wt.cleanup(wtInfo);
        if (maxStage >= 4) {
          stages["context"] = exportContext(name, ctx);
        }
      }
    } else {
      // Failed — discard worktree
      wt.cleanup(wtInfo, true);
    }

    // Write pipeline log
    const logLines = Object.entries(stages).map(([k, v]) => `${k}: ${v}`);
    writeFileSync(join(stagingDir, "log.txt"), logLines.join("\n") + "\n");

    results.push({ name, stages });
  }

  return results;
}

// --- Refinement tracking ---

/**
 * Hash the sorted decompiled neighbor list. When a new neighbor gets
 * decompiled the hash changes, triggering re-refinement.
 */
function neighborHash(neighbors: string[]): string {
  const sorted = [...neighbors].sort().join(",");
  return createHash("sha256").update(sorted).digest("hex").slice(0, 12);
}

/**
 * Check if a marker file exists for this neighbor set.
 * Marker path: build/pipeline/{funcName}/refined_{hash}.marker
 */
function isAlreadyRefined(funcName: string, neighbors: string[]): boolean {
  const hash = neighborHash(neighbors);
  const stagingDir = join(ROOT, "build/pipeline", funcName);
  return existsSync(join(stagingDir, `refined_${hash}.marker`));
}

/**
 * Write a marker file recording that this function was refined
 * with the given neighbor set. Removes any old marker files first.
 */
function markRefined(funcName: string, neighbors: string[]): void {
  const hash = neighborHash(neighbors);
  const stagingDir = join(ROOT, "build/pipeline", funcName);
  mkdirSync(stagingDir, { recursive: true });

  /* Remove old markers */
  if (existsSync(stagingDir)) {
    for (const f of readdirSync(stagingDir)) {
      if (f.startsWith("refined_") && f.endsWith(".marker")) {
        unlinkSync(join(stagingDir, f));
      }
    }
  }

  writeFileSync(join(stagingDir, `refined_${hash}.marker`), neighbors.sort().join("\n") + "\n");
}

// --- Refinement pipeline ---

interface RefinementResult {
  name: string;
  neighbors: string[];
  status: string;
}

async function runRefinementPipeline(): Promise<RefinementResult[]> {
  let candidates = findRefinementCandidates(ROOT);

  if (targetFunc) {
    candidates = candidates.filter((c) => c.name === targetFunc);
    if (candidates.length === 0) {
      /* Allow refining a specific function even if it has no decompiled neighbors */
      console.log(`${targetFunc} has no decompiled neighbors — running refinement anyway`);
      candidates = [{ name: targetFunc, decompiledNeighborCount: 0, neighbors: [] }];
    }
  }

  if (topN > 0) {
    candidates = candidates.slice(0, topN);
  }

  /* Filter out already-refined candidates (unless targeting a specific function) */
  if (!targetFunc) {
    const before = candidates.length;
    candidates = candidates.filter((c) => !isAlreadyRefined(c.name, c.neighbors));
    const skipped = before - candidates.length;
    if (skipped > 0) {
      console.log(`Skipping ${skipped} already-refined function(s) (neighbor set unchanged)`);
    }
  }

  console.log(`Refinement: ${candidates.length} candidate(s)\n`);

  if (!writeMode) {
    for (const c of candidates) {
      console.log(`  ${c.name} — ${c.decompiledNeighborCount} decompiled neighbor(s): ${c.neighbors.join(", ")}`);
    }
    console.log(`\nDry run. Run with --write to actually refine.`);
    return candidates.map((c) => ({ name: c.name, neighbors: c.neighbors, status: "dry-run" }));
  }

  const results: RefinementResult[] = [];
  for (const candidate of candidates) {
    console.log(`\nRefining ${candidate.name} (${candidate.decompiledNeighborCount} decompiled neighbor(s))`);

    // Create worktree for isolation
    let wtInfo;
    try {
      wtInfo = wt.create(candidate.name);
      wt.prepare(wtInfo);
    } catch (e: any) {
      console.log(`  Worktree setup failed — ${e.message}`);
      results.push({ name: candidate.name, neighbors: candidate.neighbors, status: "worktree-error" });
      if (wtInfo) wt.cleanup(wtInfo, true);
      continue;
    }

    const result = await runRefinementAgent(candidate.name, wtInfo.path);

    if (result.success) {
      const committed = wt.commit(wtInfo, `Refine: ${candidate.name}`);
      if (committed) {
        const mergeResult = wt.merge(wtInfo);
        if (mergeResult.success) {
          wt.cleanup(wtInfo);
          markRefined(candidate.name, candidate.neighbors);
        } else {
          console.log(`  Merge failed — discarding refinement`);
          wt.cleanup(wtInfo, true);
        }
      } else {
        wt.cleanup(wtInfo);
        markRefined(candidate.name, candidate.neighbors);
      }
    } else {
      wt.cleanup(wtInfo, true);
    }

    const status = result.success ? "ok" : "failed";
    results.push({
      name: candidate.name,
      neighbors: candidate.neighbors,
      status,
    });
  }

  return results;
}

// --- Main ---

async function main() {
  // Clean up any leftover worktrees from crashed runs
  wt.cleanupStale();

  const graphPath = join(ROOT, "build/callGraph.json");
  if (!existsSync(graphPath)) {
    console.error("callGraph.json not found. Run: npx tsx tools/callGraph.ts");
    process.exit(1);
  }

  if (projectRefineMode) {
    let wtInfo;
    try {
      wtInfo = wt.create("project-refine");
      wt.prepare(wtInfo);
      const result = await runProjectRefinementAgent(wtInfo.path);
      if (result.success) {
        const committed = wt.commit(wtInfo, "Project-wide refinement");
        if (committed) {
          const mergeResult = wt.merge(wtInfo);
          if (!mergeResult.success) {
            console.log(`Merge failed: ${mergeResult.error}`);
          }
        }
        wt.cleanup(wtInfo);
      } else {
        wt.cleanup(wtInfo, true);
      }
      console.log(`\n${"—".repeat(60)}`);
      console.log(`Project refinement: ${result.success ? "\u2713 done" : "\u2717 failed"}`);
    } catch (e: any) {
      console.log(`Project refinement worktree failed — ${e.message}`);
      if (wtInfo) wt.cleanup(wtInfo, true);
    }
    return;
  }

  if (refineMode) {
    const results = await runRefinementPipeline();
    console.log(`\n${"—".repeat(60)}`);
    console.log(`Refined ${results.length} function(s):\n`);
    for (const r of results) {
      const icon = r.status === "ok" ? "\u2713" : r.status === "dry-run" ? "(dry)" : "\u2717";
      console.log(`  ${r.name} ${icon} — neighbors: ${r.neighbors.join(", ") || "(none)"}`);
    }
    return;
  }

  /* Clean build to ensure consistent state before processing */
  console.log("Running: make clean");
  execSync("make clean", { cwd: ROOT, stdio: "inherit" });
  console.log("Running: make split");
  execSync("make split", { cwd: ROOT, stdio: "inherit" });
  console.log("Running: make check");
  execSync("make check", { cwd: ROOT, stdio: "inherit" });
  console.log("Running: callGraph.ts");
  execSync("npx tsx tools/callGraph.ts", { cwd: ROOT, stdio: "inherit" });

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

  // Stage 5: global refinement — rebuild callGraph so it reflects any
  // functions decompiled in this run, then check for refinement candidates
  if (maxStage >= 5) {
    if (writeMode) {
      console.log(`\nRebuilding call graph for refinement...`);
      execSync("npx tsx tools/callGraph.ts", { cwd: ROOT, stdio: "ignore" });
    }
    const refinementResults = await runRefinementPipeline();
    if (refinementResults.length > 0) {
      console.log(`\n${"—".repeat(60)}`);
      console.log(`Refined ${refinementResults.length} function(s):\n`);
      for (const r of refinementResults) {
        const icon = r.status === "ok" ? "\u2713" : r.status === "dry-run" ? "(dry)" : "\u2717";
        console.log(`  ${r.name} ${icon} — neighbors: ${r.neighbors.join(", ") || "(none)"}`);
      }
    }
  }

  // Stage 6: project-wide refinement pass (in worktree)
  if (writeMode) {
    console.log(`\n${"—".repeat(60)}`);
    console.log(`Running project-wide refinement pass...`);
    let wtInfo;
    try {
      wtInfo = wt.create("project-refine");
      wt.prepare(wtInfo);
      const projectResult = await runProjectRefinementAgent(wtInfo.path);
      if (projectResult.success) {
        const committed = wt.commit(wtInfo, "Project-wide refinement");
        if (committed) {
          const mergeResult = wt.merge(wtInfo);
          if (!mergeResult.success) {
            console.log(`Project refinement merge failed: ${mergeResult.error}`);
          }
        }
        wt.cleanup(wtInfo);
      } else {
        wt.cleanup(wtInfo, true);
      }
      console.log(`Project refinement: ${projectResult.success ? "\u2713 done" : "\u2717 failed"}`);
    } catch (e: any) {
      console.log(`Project refinement worktree failed — ${e.message}`);
      if (wtInfo) wt.cleanup(wtInfo, true);
    }

    /* Re-export signatures after project refinement (may have renamed functions/added types) */
    console.log("Running: contextExport.ts --all");
    execSync("npx tsx tools/contextExport.ts --all", { cwd: ROOT, stdio: "inherit" });
  }
}

main();
