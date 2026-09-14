/**
 * campaignRun.ts — an unattended reconstruction campaign to a fixed point.
 *
 * Runs every unmatched function through the cheapest route that could settle
 * it — a family transfer where a member with clean C shares its word shape,
 * reconstruction otherwise — and when one succeeds, requeues *only* its
 * dependents: its callers, its family, the functions that share a global with
 * it. That bound is what makes a campaign converge instead of re-running the
 * project after every success.
 *
 * It writes nothing to `src/`. Byte-exact candidates land under `build/` with
 * their integration plans; everything else gets a prepared bundle carrying the
 * draft (or the honest absence of one), the recovered context, the residual
 * placed in the target's own blocks, the experiments already closed, and the
 * next bounded work item. Promoting a candidate is a separately authorized
 * step — `finalizeEngineMatches.ts` with `--write`.
 *
 * A budget stop is a normal outcome and keeps everything settled so far.
 *
 * Usage:
 *   npx tsx tools/agent/campaignRun.ts                       # the whole project
 *   npx tsx tools/agent/campaignRun.ts <fn> [<fn> ...]       # a chosen set
 *   npx tsx tools/agent/campaignRun.ts --container ovl_11    # one container
 *   npx tsx tools/agent/campaignRun.ts --max-attempts 40 --bundles
 *   npx tsx tools/agent/campaignRun.ts --overlay             # what is published
 *   npx tsx tools/agent/campaignRun.ts --retract [<fn>]      # unpublish
 *   Options: --max-rounds N  --bundles  --graph  --json
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./decompToolchain.js";
import { writeStableJson } from "./provenance.js";
import { loadContainers, requireContainer } from "../lib/container.js";
import { buildEvidenceGraph, describeGraph } from "./campaign/evidence-graph.js";
import { renderCampaign, runCampaign } from "./campaign/campaign.js";
import { prepareBundle, renderBundle } from "./campaign/bundle.js";
import { describeOverlay, loadOverlay, retractRecovered } from "./campaign/artifact-overlay.js";

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const writeBundles = args.includes("--bundles");
  const containerId = flagValue(args, "--container");
  const maxAttempts = Number(flagValue(args, "--max-attempts") ?? "0") || undefined;
  const maxRounds = Number(flagValue(args, "--max-rounds") ?? "0") || undefined;
  const positional = args.filter((argument, index) =>
    !argument.startsWith("--") && !["--container", "--max-attempts", "--max-rounds", "--bundle"].includes(args[index - 1] ?? ""));

  const containers = containerId ? [requireContainer(containerId)] : loadContainers();

  if (args.includes("--graph")) {
    const graph = buildEvidenceGraph({
      containers,
      onProgress: (done, total) => {
        if (done % 500 === 0) console.error(`building the evidence graph: ${done}/${total}`);
      },
    });
    if (json) {
      console.log(JSON.stringify({
        functions: graph.functions.length,
        edges: graph.edges.length,
        notes: graph.notes,
      }, null, 2));
      return;
    }
    console.log(describeGraph(graph).join("\n"));
    return;
  }

  if (args.includes("--overlay")) {
    if (json) {
      console.log(JSON.stringify(loadOverlay(), null, 2));
      return;
    }
    console.log(describeOverlay().join("\n"));
    for (const entry of loadOverlay().entries) {
      console.log(`  ${entry.functionName.padEnd(28)} ${entry.route.padEnd(16)} ${entry.contextMode.padEnd(5)} ${entry.words} word(s)`);
    }
    return;
  }

  if (args.includes("--retract")) {
    const only = flagValue(args, "--retract");
    const revision = retractRecovered(only && !only.startsWith("--") ? only : undefined);
    console.log(`retracted ${only && !only.startsWith("--") ? only : "every entry"}; overlay revision is now ${revision}`);
    return;
  }

  const bundleFor = flagValue(args, "--bundle");
  if (bundleFor) {
    const bundle = prepareBundle(bundleFor);
    if (json) {
      console.log(JSON.stringify(bundle, null, 2));
      return;
    }
    console.log(renderBundle(bundle).join("\n"));
    return;
  }

  const report = runCampaign({
    ...(positional.length > 0 ? { functions: positional } : {}),
    containers,
    ...(maxAttempts !== undefined ? { maxAttempts } : {}),
    ...(maxRounds !== undefined ? { maxRounds } : {}),
    writeBundles,
    notify: (line) => console.error(line),
  });

  mkdirSync(join(ROOT, "build/campaign"), { recursive: true });
  const artifact = join(ROOT, "build/campaign", "report.json");
  writeStableJson(artifact, report);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(renderCampaign(report).join("\n"));
  console.log(`written: ${artifact.slice(ROOT.length + 1)}`);
  if (report.exact.length > 0) {
    console.log("");
    console.log("Nothing was written to src/. To integrate the exact candidates, run:");
    console.log("  npx tsx tools/agent/finalizeEngineMatches.ts --write");
    console.log("and then the repository's full verification gate.");
  }
}

if (process.argv[1]?.endsWith("campaignRun.ts")) main();
