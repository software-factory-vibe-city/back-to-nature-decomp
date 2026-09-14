/**
 * Family replay — solve one member, then instantiate and verify the rest.
 *
 * This is the unit of improvement the plan asks for. A capability that closes
 * one handpicked function is a spelling; a capability that closes a family is
 * a capability. So the interesting question is never "did the transfer work
 * for this target" but "how many members of this family does one donor's C
 * account for, and which ones does it not".
 *
 * Every member is verified independently through the relocated-byte oracle.
 * Membership in a family is a retrieval fact, not a proof of anything: the
 * signature says two functions have the same shape, and only the oracle says
 * a candidate *is* the target. A member that fails is kept in the report with
 * its residual, because a family that transfers eleven of twelve is a finding
 * and a family reported as "eleven" is a missing row.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { buildFamilyIndex, donorsFor, familyOf, type Family, type FamilyIndex } from "./family-index.js";
import { transferFromDonor, type TransferAttempt, type TransferOptions } from "./transfer.js";

export interface MemberOutcome {
  functionName: string;
  containerId: string;
  sizeBytes: number;
  /** Why this member was not attempted, when it was not. */
  skipped?: string;
  /** The donor that produced the best result, when any was attempted. */
  donor?: string;
  verdict: "match" | "mismatch" | "undetermined" | "error" | "refused" | "skipped";
  matchedWords?: number;
  totalWords?: number;
  differingCount?: number;
  sourcePath?: string;
  detail?: string;
}

export interface ReplayReport {
  shape: string;
  tier: string;
  words: number;
  members: number;
  donors: string[];
  outcomes: MemberOutcome[];
  /** Members the replay closed byte-exactly. */
  matched: string[];
  /** Members that compiled but did not reproduce the target. */
  near: string[];
}

export interface ReplayOptions extends TransferOptions {
  /** Use this donor only; otherwise every eligible donor is tried in order. */
  donor?: string | undefined;
  /** Try at most this many donors per member. */
  donorsPerMember?: number | undefined;
  /** Prebuilt index, to avoid rebuilding it per family. */
  index?: FamilyIndex | undefined;
}

/**
 * Replay one family: for every member that is still a stub, try each donor in
 * turn until one reproduces the target's words.
 *
 * The *best* attempt is kept rather than the last: a member that no donor
 * matches still has a closest reading, and that reading is the useful handoff.
 */
export function replayFamily(family: Family, options: ReplayOptions = {}): ReplayReport {
  const notify = options.notify ?? (() => {});
  const donorsPerMember = options.donorsPerMember ?? 3;
  const outcomes: MemberOutcome[] = [];

  const eligibleDonors = options.donor
    ? family.members.filter((member) => member.functionName === options.donor && !member.excluded)
    : family.members.filter((member) => !member.excluded);

  for (const member of family.members) {
    if (!member.excluded) {
      outcomes.push({
        functionName: member.functionName,
        containerId: member.containerId,
        sizeBytes: member.sizeBytes,
        verdict: "skipped",
        skipped: "already matched — this member is a donor, not a target",
      });
      continue;
    }
    if (member.excluded !== "include-asm" && member.excluded !== "no-source") {
      outcomes.push({
        functionName: member.functionName,
        containerId: member.containerId,
        sizeBytes: member.sizeBytes,
        verdict: "skipped",
        skipped: `source is excluded from transfer (${member.excluded})`,
      });
      continue;
    }

    const donors = eligibleDonors
      .filter((donor) => donor.functionName !== member.functionName)
      .sort((left, right) => (left.containerId === member.containerId ? 0 : 1) - (right.containerId === member.containerId ? 0 : 1))
      .slice(0, donorsPerMember);

    if (donors.length === 0) {
      outcomes.push({
        functionName: member.functionName,
        containerId: member.containerId,
        sizeBytes: member.sizeBytes,
        verdict: "skipped",
        skipped: "the family has no member with clean matched C to donate",
      });
      continue;
    }

    let best: MemberOutcome | undefined;
    for (const donor of donors) {
      notify(`${member.functionName} ← ${donor.functionName}`);
      const attempt = transferFromDonor(member.functionName, donor.functionName, options);
      const outcome = summarize(member, donor.functionName, attempt);
      if (outcome.verdict === "match") { best = outcome; break; }
      if (!best || rank(outcome) < rank(best)) best = outcome;
    }
    outcomes.push(best!);
  }

  return {
    shape: family.shape,
    tier: family.tier,
    words: family.words,
    members: family.members.length,
    donors: family.donors,
    outcomes,
    matched: outcomes.filter((outcome) => outcome.verdict === "match").map((outcome) => outcome.functionName),
    near: outcomes.filter((outcome) => outcome.verdict === "mismatch").map((outcome) => outcome.functionName),
  };
}

/** Lower is better: exact, then fewest differing words, then anything else. */
function rank(outcome: MemberOutcome): number {
  if (outcome.verdict === "match") return -1;
  if (outcome.verdict === "mismatch") return outcome.differingCount ?? 1e6;
  return 1e9;
}

function summarize(
  member: { functionName: string; containerId: string; sizeBytes: number },
  donor: string,
  attempt: TransferAttempt,
): MemberOutcome {
  const base: MemberOutcome = {
    functionName: member.functionName,
    containerId: member.containerId,
    sizeBytes: member.sizeBytes,
    donor,
    verdict: "refused",
  };
  if (attempt.refused) return { ...base, detail: attempt.refused };
  if (attempt.winner) {
    const outcome = attempt.candidates.find((candidate) => candidate.id === attempt.winner!.id);
    return {
      ...base,
      verdict: "match",
      sourcePath: attempt.winner.sourcePath,
      ...(outcome?.matchedWords !== undefined ? { matchedWords: outcome.matchedWords } : {}),
      ...(outcome?.totalWords !== undefined ? { totalWords: outcome.totalWords } : {}),
      differingCount: 0,
    };
  }
  const closest = attempt.candidates
    .filter((candidate) => candidate.verdict === "mismatch" || candidate.verdict === "undetermined")
    .sort((left, right) => (left.differingCount ?? 1e6) - (right.differingCount ?? 1e6))[0];
  if (closest) {
    return {
      ...base,
      verdict: closest.verdict,
      sourcePath: closest.sourcePath,
      ...(closest.matchedWords !== undefined ? { matchedWords: closest.matchedWords } : {}),
      ...(closest.totalWords !== undefined ? { totalWords: closest.totalWords } : {}),
      ...(closest.differingCount !== undefined ? { differingCount: closest.differingCount } : {}),
      detail: attempt.unplaceable.length > 0
        ? `${attempt.unplaceable.length} substitution(s) had no site in the donor's C`
        : `closest reading differs in ${closest.differingCount} word(s)`,
    };
  }
  const error = attempt.candidates.find((candidate) => candidate.compileError);
  return {
    ...base,
    verdict: "error",
    detail: error?.compileError ?? "no candidate could be constructed",
  };
}

/** Replay the family one named function belongs to. */
export function replayFamilyOf(functionName: string, options: ReplayOptions = {}): ReplayReport | { absent: string } {
  const index = options.index ?? buildFamilyIndex({ tier: (options.tier ?? "flexible") });
  const family = familyOf(index, functionName);
  if (!family) return { absent: `${functionName} is in no family of two or more at the ${index.tier} tier` };
  return replayFamily(family, { ...options, index });
}

/** Donor names for one target, from a freshly built or supplied index. */
export function donorNamesFor(functionName: string, options: ReplayOptions = {}): string[] {
  const index = options.index ?? buildFamilyIndex({ tier: (options.tier ?? "flexible") });
  return donorsFor(index, functionName).map((member) => member.functionName);
}

/** Where a family's replay report is written. */
export function replayReportPath(shape: string): string {
  return join(ROOT, "build/familyTransfer", `replay-${shape.replace(/[^0-9a-z]/gi, "_")}.json`);
}

/** True when the project tree is configured enough to build an index. */
export function projectConfigured(): boolean {
  return existsSync(join(ROOT, "configs/splat"));
}
