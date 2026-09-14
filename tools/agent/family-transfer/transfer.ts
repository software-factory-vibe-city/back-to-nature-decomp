/**
 * Family transfer — instantiate a donor's C for a target and let the byte
 * oracle decide.
 *
 * The claim a transfer makes is narrow and testable: *this donor's source,
 * with these substitutions, compiles to the target's words.* It is never
 * "these functions are the same", and similarity is not evidence. Every
 * candidate is compiled under the target's own effective flag set and
 * compared through the same relocated-byte oracle every other route uses; a
 * transfer that fails is reported with its residual, not retried by loosening
 * the check.
 *
 * Cross-container transfer is permitted and labelled. A donor in another
 * overlay was built in a different link, and possibly under a different
 * small-data threshold; that is a difference the result carries so a reader
 * can weigh it, not a reason to refuse in advance.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT,
  compileSource,
  detectImplicitDeclarations,
  loadFlagOverrides,
  rejectionFromDiagnostics,
} from "../decompToolchain.js";
import { compareFunction } from "../../lib/functionOracle.js";
import { analyzeCSource } from "../cSourceGuard.js";
import { antiUnify, describeSubstitutions, type Substitution } from "./anti-unify.js";
import {
  applyEdits,
  enumerateCandidates,
  planInstantiation,
  type Edit,
} from "./instantiate.js";
import {
  decodeFunctionWords,
  signatureOf,
  symbolResolverFor,
  type FamilySignature,
  type SignatureTier,
} from "./signature.js";

export interface TransferCandidate {
  id: string;
  /** Substitutions this reading applied, for the report. */
  edits: Edit[];
  sourcePath: string;
  verdict: "match" | "mismatch" | "undetermined" | "error";
  matchedWords?: number;
  totalWords?: number;
  differingCount?: number;
  differingVram?: number[];
  compileError?: string;
}

export interface TransferAttempt {
  target: string;
  donor: string;
  tier: SignatureTier;
  crossContainer: boolean;
  /** Present when the pair does not anti-unify at all. */
  refused?: string;
  substitutions: Substitution[];
  /** Substitutions with no locatable site in the donor's C. */
  unplaceable: Substitution[];
  candidates: TransferCandidate[];
  /** The exact candidate, when one compiled to the target's words. */
  winner?: { id: string; source: string; sourcePath: string; notes: string[] };
  /** Candidate readings the enumeration cap dropped. */
  truncated: number;
}

export interface TransferOptions {
  tier?: SignatureTier;
  /** Where candidates are written. Defaults under `build/familyTransfer`. */
  outputDirectory?: string | undefined;
  /** Stop at the first exact candidate (the default). */
  exhaustive?: boolean | undefined;
  /** Candidate readings to enumerate at most. */
  limit?: number | undefined;
  notify?: ((line: string) => void) | undefined;
}

/**
 * Attempt one donor → target transfer.
 *
 * Both signatures are rebuilt here rather than taken from an index, so a
 * caller holding a stale index cannot make the transfer claim something the
 * current bytes do not support.
 */
export function transferFromDonor(
  target: string,
  donor: string,
  options: TransferOptions = {},
): TransferAttempt {
  const tier = options.tier ?? "flexible";
  const notify = options.notify ?? (() => {});
  const targetWords = decodeFunctionWords(target);
  const donorWords = decodeFunctionWords(donor);
  const targetSignature: FamilySignature = signatureOf(
    target, targetWords.container.id, targetWords.insns, tier, symbolResolverFor(targetWords.container));
  const donorSignature: FamilySignature = signatureOf(
    donor, donorWords.container.id, donorWords.insns, tier, symbolResolverFor(donorWords.container));

  const attempt: TransferAttempt = {
    target,
    donor,
    tier,
    crossContainer: targetWords.container.id !== donorWords.container.id,
    substitutions: [],
    unplaceable: [],
    candidates: [],
    truncated: 0,
  };

  const unified = antiUnify(donorSignature, targetSignature);
  if (!unified.fitted) {
    attempt.refused = unified.reason;
    return attempt;
  }
  attempt.substitutions = unified.substitutions;
  notify(`  ${donor} → ${target}: ${unified.identical} hole(s) already agree, ${unified.substitutions.length} to substitute`);
  for (const line of describeSubstitutions(unified.substitutions)) notify(`    ${line}`);

  /* The donor's source must be clean, parseable C that defines the donor —
   * an assembly stub or a file that does not parse teaches nothing and cannot
   * be edited soundly. */
  const donorSourcePath = join(ROOT, donorWords.container.paths.srcDir, `${donor}.c`);
  let donorSource: string;
  try {
    donorSource = readFileSync(donorSourcePath, "utf-8");
  } catch {
    attempt.refused = `donor source is unreadable at ${donorSourcePath}`;
    return attempt;
  }
  const guard = analyzeCSource(donorSource);
  if (!guard.parses) {
    attempt.refused = `donor source does not parse cleanly: ${guard.reasons.join("; ")}`;
    return attempt;
  }
  if (guard.includeAsm.length > 0) {
    attempt.refused = `donor still hands ${guard.includeAsm.map((site) => site.symbol).join(", ")} to the assembler`;
    return attempt;
  }

  const plan = planInstantiation(donorSource, donor, target, unified.substitutions);
  attempt.unplaceable = plan.unplaceable;
  if (plan.unplaceable.length > 0) {
    notify(`    ${plan.unplaceable.length} substitution(s) have no site in the donor's C`);
  }

  const enumerated = enumerateCandidates(plan, options.limit ?? 24);
  attempt.truncated = enumerated.truncated;

  const outputDirectory = options.outputDirectory ?? join(ROOT, "build/familyTransfer", target, donor);
  mkdirSync(outputDirectory, { recursive: true });

  for (let index = 0; index < enumerated.candidates.length; index++) {
    const candidate = enumerated.candidates[index]!;
    const id = `${String(index).padStart(3, "0")}-${candidate.label}`;
    const sourcePath = join(outputDirectory, `${id}.c`);
    let text: string;
    try {
      text = applyEdits(donorSource, candidate.edits);
    } catch (error) {
      attempt.candidates.push({
        id, edits: candidate.edits, sourcePath, verdict: "error",
        compileError: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    writeFileSync(sourcePath, header(target, donor, attempt, candidate.edits) + text);

    const outcome: TransferCandidate = { id, edits: candidate.edits, sourcePath, verdict: "error" };
    try {
      const artifacts = compileSource(sourcePath, join(outputDirectory, id), target, {
        assemble: true,
        containerKind: targetWords.container.kind,
      });
      const implicit = detectImplicitDeclarations(readFileSync(artifacts.preprocessed, "utf-8"), target);
      if (implicit.length > 0) {
        outcome.compileError = `implicit declaration(s): ${implicit.join(", ")}`;
        attempt.candidates.push(outcome);
        notify(`    ${id}: implicit declaration (${implicit[0]})`);
        continue;
      }
      /* The same acceptance bar the engine applies: a substitution that
       * crosses a type boundary the donor's C did not is invalid C, and the
       * byte oracle cannot see it. */
      const rejection = rejectionFromDiagnostics(artifacts.diagnostics);
      if (rejection) {
        outcome.compileError = `invalid C accepted by the front end: ${rejection}`;
        attempt.candidates.push(outcome);
        notify(`    ${id}: invalid C (${rejection})`);
        continue;
      }
      const oracle = compareFunction(target, { objectPath: artifacts.object!, container: targetWords.container });
      outcome.verdict = oracle.verdict === "stub" ? "error" : oracle.verdict;
      outcome.matchedWords = oracle.same;
      outcome.totalWords = Math.max(oracle.targetWords.length, oracle.candidateWords.length);
      outcome.differingCount = oracle.differing.length;
      outcome.differingVram = oracle.differing.slice(0, 16);
      notify(`    ${id}: ${outcome.verdict} (${oracle.same}/${outcome.totalWords})`);
      if (oracle.verdict === "match" && !attempt.winner) {
        attempt.winner = {
          id,
          source: text,
          sourcePath,
          notes: integrationNotes(target, donor, attempt),
        };
      }
    } catch (error) {
      outcome.compileError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      notify(`    ${id}: compile error`);
    }
    attempt.candidates.push(outcome);
    if (attempt.winner && !options.exhaustive) break;
  }

  return attempt;
}

/**
 * Compile one candidate source as `target` and put it through the oracle.
 *
 * Exposed because "a wrong mapping is rejected" is a claim that has to be
 * testable directly: the only way to show the transfer cannot launder a bad
 * substitution into an accepted result is to hand it a bad one and watch the
 * oracle refuse it.
 */
export function verifyCandidate(
  target: string,
  source: string,
  label = "probe",
): { verdict: "match" | "mismatch" | "undetermined" | "error"; matchedWords?: number; totalWords?: number; error?: string } {
  const { container } = decodeFunctionWords(target);
  const directory = join(ROOT, "build/familyTransfer", target, "_verify", label);
  mkdirSync(directory, { recursive: true });
  const sourcePath = join(directory, `${target}.c`);
  writeFileSync(sourcePath, source);
  try {
    const artifacts = compileSource(sourcePath, directory, target, {
      assemble: true,
      containerKind: container.kind,
    });
    const implicit = detectImplicitDeclarations(readFileSync(artifacts.preprocessed, "utf-8"), target);
    if (implicit.length > 0) return { verdict: "error", error: `implicit declaration(s): ${implicit.join(", ")}` };
    const oracle = compareFunction(target, { objectPath: artifacts.object!, container });
    return {
      verdict: oracle.verdict === "stub" ? "error" : oracle.verdict,
      matchedWords: oracle.same,
      totalWords: Math.max(oracle.targetWords.length, oracle.candidateWords.length),
    };
  } catch (error) {
    return { verdict: "error", error: (error instanceof Error ? error.message : String(error)).slice(0, 300) };
  }
}

/**
 * The candidate's own provenance banner.
 *
 * A transferred source that reaches a reviewer without saying where it came
 * from is a source nobody can audit, and this project's rule is that a claim
 * carries its evidence.
 */
function header(target: string, donor: string, attempt: TransferAttempt, edits: Edit[]): string {
  const lines = [
    `/* Family transfer: ${donor} → ${target}.`,
    ` * Same ${attempt.tier} signature over the original words.`,
  ];
  if (attempt.crossContainer) {
    lines.push(` * CROSS-CONTAINER: donor built in a different link; verify the flag column.`);
  }
  for (const line of describeSubstitutions(attempt.substitutions)) lines.push(` * ${line}`);
  const applied = [...new Set(edits.filter((edit) => edit.reason !== "function identity").map((edit) => edit.reason))];
  for (const reason of applied.slice(0, 12)) lines.push(` * edit: ${reason}`);
  lines.push(" * Verified only by the relocated-byte oracle; similarity proves nothing.", " */", "");
  return lines.join("\n");
}

/** What an authorized integration would have to settle. Never applied here. */
function integrationNotes(target: string, donor: string, attempt: TransferAttempt): string[] {
  const notes = [
    `place the candidate at the target's configured source path for ${target}`,
    `the donor ${donor} declares its own view types; rename collisions were applied by identity edits`,
  ];
  const override = loadFlagOverrides().get(target);
  if (override) notes.push(`the target carries a per-file flag override (${override.join(" ")}); it was applied`);
  if (attempt.crossContainer) {
    notes.push("donor and target live in different containers — record the build difference with the change");
  }
  return notes;
}
