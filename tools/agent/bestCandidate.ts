/**
 * bestCandidate.ts — Serve the engine's best-effort C for a function.
 *
 * Prints the best candidate source, its diff summary, and a provenance note.
 * Wire into the decompile handoff so an agent starting a function sees this
 * before m2c output (m2cFunc.ts remains available; the skill decides which
 * to lead with).
 *
 *   npx tsx tools/agent/bestCandidate.ts <functionName>
 *
 * Reads build/matchingReconstruction/<functionName>/result.json.
 * When no best-effort candidate exists (e.g. unsupported-target), prints
 * the unresolved detail and exits with code 2.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./decompToolchain.js";
import type { ResultBundle } from "./matching-reconstruction/types.js";

function main(): void {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("usage: npx tsx tools/agent/bestCandidate.ts <functionName>");
    process.exit(1);
  }
  const functionName = args[0]!;
  const resultPath = join(ROOT, "build/matchingReconstruction", functionName, "result.json");

  if (!existsSync(resultPath)) {
    console.error(`no reconstruction result for ${functionName} at ${resultPath}`);
    console.error(`run 'npx tsx tools/diagnostics/benchmarkReconstruction.ts ${functionName}' first`);
    process.exit(2);
  }

  const result = JSON.parse(readFileSync(resultPath, "utf-8")) as ResultBundle;

  /* Prefer a winner (exact match) over best-effort. */
  if (result.state === "exact-candidate" && result.winner) {
    console.log(`=== ${functionName}: EXACT MATCH (${result.winner.id}) ===`);
    console.log();
    console.log(result.winner.source);
    console.log();
    console.log(`Integration plan:`);
    for (const step of result.winner.integrationPlan) {
      console.log(`  ${step}`);
    }
    process.exit(0);
  }

  if (result.bestEffort) {
    const { matchedWords, totalWords, differingVram, diffSummary } = result.bestEffort;
    const wordsOff = totalWords !== undefined && matchedWords !== undefined ? totalWords - matchedWords : "?";
    console.log(`=== ${functionName}: ENGINE BEST EFFORT ===`);
    console.log(`State: ${result.state}`);
    console.log(`Diff: ${diffSummary}`);
    console.log(`Words off: ${wordsOff}`);
    if (differingVram && differingVram.length > 0) {
      console.log(`Differing at: 0x${differingVram.map((v) => (v >>> 0).toString(16)).join(", 0x")}`);
    }
    console.log();
    console.log(result.bestEffort.source);
    console.log();
    console.log(`Integration plan:`);
    for (const step of result.bestEffort.integrationPlan) {
      console.log(`  ${step}`);
    }
    console.log();
    console.log(`Provenance: engine best-effort, ${wordsOff} words off, state=${result.state}`);
    process.exit(0);
  }

  /* No best-effort — print the unresolved reason. */
  console.log(`=== ${functionName}: ${result.state} ===`);
  console.log(`No best-effort candidate available.`);
  if (result.unresolved) {
    console.log(`Reason: ${result.unresolved.detail}`);
    if (result.unresolved.vram) {
      console.log(`At: 0x${result.unresolved.vram.map((v) => (v >>> 0).toString(16)).join(", 0x")}`);
    }
  }
  process.exit(2);
}

main();