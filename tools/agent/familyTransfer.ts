/**
 * familyTransfer.ts — find a function's family, instantiate a donor's C for
 * it, and verify every member independently.
 *
 * The reframe this rests on: on day one a decompiler has the target's machine
 * words and no C at all, so the query has to be the words. Functions with the
 * same word shape form a family; a family member that already has clean C is a
 * donor; and the difference between donor and target is a small, explicit
 * substitution over offsets, constants and symbol names. Instantiating that
 * substitution is deterministic, which means it belongs in a tool rather than
 * in an agent's attention.
 *
 * Nothing here promotes a candidate. A transfer produces C under `build/`,
 * verified by the relocated-byte oracle, plus the integration steps an
 * authorized change would have to take.
 *
 * Usage:
 *   npx tsx tools/agent/familyTransfer.ts <target>                 # try every donor
 *   npx tsx tools/agent/familyTransfer.ts <target> --donor <name>  # one donor
 *   npx tsx tools/agent/familyTransfer.ts --family <target>        # replay the family
 *   npx tsx tools/agent/familyTransfer.ts --survey [--min-members 2]
 *   npx tsx tools/agent/familyTransfer.ts --survey --json
 *   Options: --tier strict|flexible  --limit N  --exhaustive  --json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./decompToolchain.js";
import { writeStableJson } from "./provenance.js";
import { buildFamilyIndex, donorsFor } from "./family-transfer/family-index.js";
import { replayFamily, replayFamilyOf } from "./family-transfer/replay.js";
import { transferFromDonor } from "./family-transfer/transfer.js";
import { describeSubstitutions } from "./family-transfer/anti-unify.js";
import type { SignatureTier } from "./family-transfer/signature.js";

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const exhaustive = args.includes("--exhaustive");
  const tier = (flagValue(args, "--tier") ?? "flexible") as SignatureTier;
  const limit = Number(flagValue(args, "--limit") ?? "24");
  const donor = flagValue(args, "--donor");
  const minimumMembers = Number(flagValue(args, "--min-members") ?? "2");
  const positional = args.filter((arg, index) =>
    !arg.startsWith("--") && !["--donor", "--tier", "--limit", "--min-members", "--family"].includes(args[index - 1] ?? ""));

  if (tier !== "strict" && tier !== "flexible") {
    console.error(`unknown tier ${tier}; use strict or flexible`);
    process.exit(2);
  }

  if (args.includes("--survey")) {
    survey(tier, minimumMembers, json);
    return;
  }

  const familyMode = args.includes("--family");
  const target = familyMode ? flagValue(args, "--family") ?? positional[0] : positional[0];
  if (!target) {
    console.error("usage: npx tsx tools/agent/familyTransfer.ts <target> [--donor <name>] [--family] [--survey] [--tier strict|flexible]");
    process.exit(2);
  }

  if (familyMode) {
    const report = replayFamilyOf(target, { tier, exhaustive, limit, notify: (line) => console.error(line) });
    if ("absent" in report) {
      console.error(report.absent);
      process.exit(1);
    }
    if (json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(`family ${report.shape} (${report.tier}, ${report.words} words, ${report.members} members)`);
    console.log(`  donors: ${report.donors.join(", ") || "(none)"}`);
    for (const outcome of report.outcomes) {
      const detail = outcome.verdict === "match"
        ? `EXACT via ${outcome.donor}`
        : outcome.verdict === "skipped"
          ? outcome.skipped
          : `${outcome.verdict}${outcome.differingCount !== undefined ? ` (${outcome.differingCount} word(s) differ)` : ""} — ${outcome.detail ?? ""}`;
      console.log(`  ${outcome.functionName.padEnd(26)} ${detail}`);
    }
    console.log(`  matched ${report.matched.length}/${report.outcomes.filter((outcome) => outcome.verdict !== "skipped").length} attempted`);
    return;
  }

  const donors = donor ? [donor] : donorNames(target, tier);
  if (donors.length === 0) {
    console.error(`${target}: no family member with clean matched C at the ${tier} tier`);
    process.exit(1);
  }

  const attempts = [];
  for (const candidate of donors) {
    const attempt = transferFromDonor(target, candidate, { tier, exhaustive, limit, notify: (line) => console.error(line) });
    attempts.push(attempt);
    if (attempt.winner) break;
  }

  if (json) {
    console.log(JSON.stringify(attempts, null, 2));
    return;
  }

  for (const attempt of attempts) {
    console.log(`${attempt.donor} → ${attempt.target} (${attempt.tier}${attempt.crossContainer ? ", cross-container" : ""})`);
    if (attempt.refused) {
      console.log(`  refused: ${attempt.refused}`);
      continue;
    }
    for (const line of describeSubstitutions(attempt.substitutions)) console.log(`  ${line}`);
    for (const unplaceable of attempt.unplaceable) {
      console.log(`  UNPLACEABLE: ${unplaceable.kind} ${unplaceable.donorValue} has no site in the donor's C`);
    }
    for (const candidate of attempt.candidates) {
      console.log(
        `  ${candidate.id}: ${candidate.verdict}` +
        `${candidate.matchedWords !== undefined ? ` (${candidate.matchedWords}/${candidate.totalWords})` : ""}` +
        `${candidate.compileError ? ` — ${candidate.compileError}` : ""}`,
      );
    }
    if (attempt.truncated > 0) console.log(`  ${attempt.truncated} further reading(s) not enumerated (raise --limit)`);
    if (attempt.winner) {
      console.log(`  EXACT: ${attempt.winner.sourcePath}`);
      for (const note of attempt.winner.notes) console.log(`    integration: ${note}`);
    }
  }
  process.exit(attempts.some((attempt) => attempt.winner) ? 0 : 1);
}

function donorNames(target: string, tier: SignatureTier): string[] {
  const index = buildFamilyIndex({ tier });
  return donorsFor(index, target).map((member) => member.functionName);
}

/**
 * The survey: every family, what it could donate, and what it still owes.
 *
 * The number that matters is not how many families exist but how many *stub*
 * members sit in a family that already has a donor — that set is work a
 * deterministic tool can attempt today, with no agent involved.
 */
function survey(tier: SignatureTier, minimumMembers: number, json: boolean): void {
  const index = buildFamilyIndex({
    tier,
    minimumMembers,
    onProgress: (done, total) => {
      if (done % 250 === 0) console.error(`indexing ${done}/${total}`);
    },
  });

  const families = index.families.map((family) => ({
    shape: family.shape,
    words: family.words,
    members: family.members.length,
    donors: family.donors.length,
    targets: family.targets.length,
    donorNames: family.donors.slice(0, 4),
    targetNames: family.targets.slice(0, 8),
    containers: [...new Set(family.members.map((member) => member.containerId))].sort(),
  }));

  const transferable = families.filter((family) => family.donors > 0 && family.targets > 0);
  const unsolved = families.filter((family) => family.donors === 0 && family.targets > 0);

  const summary = {
    tier,
    families: families.length,
    membersIndexed: index.signatures.size,
    transferableFamilies: transferable.length,
    transferableTargets: transferable.reduce((sum, family) => sum + family.targets, 0),
    unsolvedFamilies: unsolved.length,
    unsolvedTargets: unsolved.reduce((sum, family) => sum + family.targets, 0),
    skipped: index.skipped.length,
  };

  const artifact = join(ROOT, "build/familyTransfer", `survey-${tier}.json`);
  mkdirSync(join(ROOT, "build/familyTransfer"), { recursive: true });
  writeStableJson(artifact, { summary, families });

  if (json) {
    console.log(JSON.stringify({ summary, families }, null, 2));
    return;
  }
  console.log(`family survey (${tier} tier, minimum ${minimumMembers} members)`);
  console.log(`  ${summary.membersIndexed} functions indexed into ${summary.families} families`);
  console.log(`  ${summary.transferableFamilies} families have a donor and a stub: ${summary.transferableTargets} target(s) attemptable now`);
  console.log(`  ${summary.unsolvedFamilies} families have no donor: ${summary.unsolvedTargets} target(s) wait on one representative`);
  console.log();
  console.log("transferable families, most targets first:");
  for (const family of transferable.sort((left, right) => right.targets - left.targets).slice(0, 20)) {
    console.log(
      `  ${String(family.targets).padStart(3)} target(s), ${family.donors} donor(s), ${family.words} words ` +
      `[${family.containers.join("+")}]  donor ${family.donorNames[0]}`,
    );
    console.log(`      targets: ${family.targetNames.join(", ")}${family.targets > family.targetNames.length ? ", …" : ""}`);
  }
  console.log();
  console.log("largest families with no donor, most members first:");
  for (const family of unsolved.sort((left, right) => right.targets - left.targets).slice(0, 10)) {
    console.log(
      `  ${String(family.targets).padStart(3)} member(s), ${family.words} words [${family.containers.join("+")}]  ` +
      `e.g. ${family.targetNames.slice(0, 3).join(", ")}`,
    );
  }
  console.log();
  console.log(`written: ${artifact.slice(ROOT.length + 1)}`);
}

if (process.argv[1]?.endsWith("familyTransfer.ts")) main();

export { writeFileSync };
