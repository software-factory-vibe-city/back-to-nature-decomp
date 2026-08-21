#!/usr/bin/env npx tsx

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../.pi/extensions/psx-decomp/autonomous/config.ts";
import { loadCallGraph } from "../../.pi/extensions/psx-decomp/autonomous/call-graph.ts";
import { checkSourcePolicy, isPendingStub } from "../../.pi/extensions/psx-decomp/autonomous/source-policy.ts";
import {
  changedFilesBetweenTrees,
  createTreeFromWorktree,
  treePatch,
  workspaceChangedFiles,
} from "../../.pi/extensions/psx-decomp/autonomous/workspace.ts";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const functionIndex = args.indexOf("--function");
  const functionName = functionIndex >= 0 ? args[functionIndex + 1] : undefined;
  const config = loadConfig(ROOT);
  const tree = await createTreeFromWorktree(ROOT, ROOT, config.integration.allowedRoots);
  const patch = await treePatch(ROOT, "HEAD", tree, config.integration.allowedRoots);
  const changedFiles = [...new Set([
    ...await changedFilesBetweenTrees(ROOT, "HEAD", tree),
    ...await workspaceChangedFiles(ROOT),
  ])].sort();
  const graph = loadCallGraph(ROOT);
  const entry = functionName ? graph.functions.find((candidate) => candidate.name === functionName) : undefined;
  if (functionName && !entry) throw new Error(`Unknown function: ${functionName}`);
  /* --final reproduces the controller's completion audit, where every live
   * function must be real C and a leftover INCLUDE_ASM stub is a failure. The
   * default repo-wide sweep is a mid-project diagnostic: it audits the
   * functions that claim to be decompiled and skips the undecompiled backlog,
   * whose stubs are the expected state rather than folded assembly. */
  const finalAudit = args.includes("--final");
  const live = graph.functions.filter((candidate) => !candidate.dead && candidate.handwritten !== "asm");
  const candidates = functionName ? [functionName] : live.map((candidate) => candidate.name);
  /* The call graph places each function's translation unit. Reconstructing
     `src/<name>.c` here would look past every overlay's source directory, and a
     file that is not there reads as a function with no stub to skip. */
  const sourceOf = new Map(graph.functions.map((candidate) => [candidate.name, candidate.source ?? `src/${candidate.name}.c`]));
  const pendingStubs = functionName || finalAudit
    ? []
    : candidates.filter((name) => {
      const path = resolve(ROOT, sourceOf.get(name) ?? `src/${name}.c`);
      return existsSync(path) && isPendingStub(readFileSync(path, "utf8"));
    });
  const pending = new Set(pendingStubs);
  const scanFunctions = candidates.filter((name) => !pending.has(name));
  const result = checkSourcePolicy({
    projectRoot: ROOT,
    config,
    ...(functionName ? { functionName } : {}),
    ...(entry?.vram ? { functionVram: entry.vram } : {}),
    ...(entry?.container ? { functionContainer: entry.container } : {}),
    scanFunctions,
    functionVrams: Object.fromEntries(graph.functions.map((candidate) => [candidate.name, candidate.vram])),
    functionContainers: Object.fromEntries(graph.functions.map((candidate) => [candidate.name, candidate.container])),
    functionSources: Object.fromEntries(sourceOf),
    changedFiles,
    patch,
  });

  /* Worker containment ("did this patch touch anything outside the integration
   * roots?") is the controller's concern, not this diagnostic's: run by hand
   * with unrelated tooling edits in the tree it reports the tree, not a source
   * defect. Report those, but judge the run on the source findings. */
  const sourceFailures = result.hardFailures.filter((finding) => finding.kind !== "out-of-scope");
  const pass = sourceFailures.length === 0;
  const scope = `${scanFunctions.length} function(s) scanned`
    + (pendingStubs.length > 0 ? `, ${pendingStubs.length} undecompiled stub(s) skipped — rerun with --final to audit them` : "");

  if (args.includes("--json")) console.log(JSON.stringify({ ...result, pass, scanFunctions, pendingStubs, finalAudit }, null, 2));
  else {
    if (pass) console.log(`Source policy passed (${scope}).`);
    else {
      console.error(`Source policy failed (${scope}):`);
      for (const finding of sourceFailures) {
        console.error(`  ${finding.file}${finding.line ? `:${finding.line}` : ""}: ${finding.kind}: ${finding.message}`);
      }
    }
    if (result.outOfScopeFiles.length > 0) {
      console.log(`Note: ${result.outOfScopeFiles.length} changed file(s) outside the integration roots (not a source-policy failure here):`);
      for (const file of result.outOfScopeFiles) console.log(`  ${file}`);
    }
  }
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
