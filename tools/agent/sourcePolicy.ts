#!/usr/bin/env npx tsx

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../.pi/extensions/psx-decomp/autonomous/config.ts";
import { loadCallGraph } from "../../.pi/extensions/psx-decomp/autonomous/call-graph.ts";
import { checkSourcePolicy } from "../../.pi/extensions/psx-decomp/autonomous/source-policy.ts";
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
  const scanFunctions = functionName
    ? [functionName]
    : graph.functions.filter((candidate) => !candidate.dead && candidate.handwritten === false).map((candidate) => candidate.name);
  const result = checkSourcePolicy({
    projectRoot: ROOT,
    config,
    functionName,
    functionVram: entry?.vram,
    scanFunctions,
    functionVrams: Object.fromEntries(graph.functions.map((candidate) => [candidate.name, candidate.vram])),
    changedFiles,
    patch,
  });

  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else if (result.pass) console.log(`Source policy passed (${scanFunctions.length} function(s) scanned).`);
  else {
    console.error("Source policy failed:");
    for (const finding of result.hardFailures) {
      console.error(`  ${finding.file}${finding.line ? `:${finding.line}` : ""}: ${finding.message}`);
    }
  }
  if (!result.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
