import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { functionPaths } from "../autonomous/call-graph.ts";
import { runCommand } from "../autonomous/process.ts";
import type { PolicyFinding } from "../autonomous/types.ts";
import { declaresIncludeAsm, inspectSource, type SourceFacts } from "./c-ast.ts";
import type { LoopConfig, ParkRecord, ParkReason } from "./types.ts";

/**
 * The stub a parked function is returned to.
 *
 * The assembly path is the one the function's own container publishes, not the
 * executable's. A stub written against the wrong directory compiles — the macro
 * takes a string — and fails at link time on a missing symbol, which reads as a
 * broken park rather than a wrong path.
 */
export function canonicalStub(projectRoot: string, functionName: string): string {
  return [
    '#include "common.h"',
    '#include "include_asm.h"',
    "",
    `INCLUDE_ASM("${functionPaths(projectRoot, functionName).includeAsmPath}", ${functionName});`,
    "",
  ].join("\n");
}

/** The opening of a park's header comment; also how a re-park recognizes one. */
export const PARK_MARKER = "/* PARKED by /auto_decompilation_loop on ";

/**
 * Take a previous park back off a file before parking it again.
 *
 * A committed park is what `HEAD` holds for a parked function, so the base for
 * a second park is the first one — header, disabled attempt and all. Composing
 * on top of that would stack a park inside a park and grow the file by one
 * dead attempt per visit. Everything from the header onwards was written by a
 * park, so cutting there leaves exactly the translation unit the park was
 * applied to.
 */
export function stripPreviousPark(source: string): string {
  const index = source.indexOf(PARK_MARKER);
  return index < 0 ? source : `${source.slice(0, index).replace(/\s*$/, "")}\n`;
}

export interface ComposeInput {
  functionName: string;
  /** The park base: a translation unit that hands the function back to the assembler. */
  base: string;
  /** The best non-matching clean-C attempt. */
  attemptSource: string;
  /** Whether the attempt has been proven safe to place inside a disabled block. */
  preserveAttempt: boolean;
  reason: ParkReason;
  reachedTier: string;
  notePath: string;
  parkedAt: string;
}

/**
 * Parking a function.
 *
 * The committed `INCLUDE_ASM` stub goes back at the top, so the assembler
 * supplies the original bytes and every downstream oracle — the full build
 * above all — goes green again. The attempt is not thrown away: when the AST
 * says it is safe to do so it is kept verbatim behind `#if 0`, where the
 * preprocessor skips it but a later session can read exactly how far the ladder
 * got. A park is a suspended attempt with its evidence attached, never a
 * deletion: an attempt that cannot be embedded safely is still preserved in
 * full in the approvals note.
 */
export function composeParkedSource(input: ComposeInput): string {
  const attempt = input.attemptSource.replace(/\s*$/, "");
  const preserve = input.preserveAttempt && attempt.length > 0;

  const header = [
    "",
    `${PARK_MARKER}${input.parkedAt}.`,
    ` * Reason: ${input.reason}.`,
    ` * Escalation reached: ${input.reachedTier}.`,
    ...(preserve ? [" * The best non-matching attempt is preserved verbatim below, disabled."] : []),
    ` * Findings and the decision needed: ${input.notePath}`,
    " */",
    "",
  ].join("\n");

  const preserved = preserve
    ? ["#if 0", "/* Best non-matching attempt, preserved for the next session. */", attempt, "#endif", ""].join("\n")
    : "";

  return [input.base.replace(/\s*$/, "\n"), header, preserved].filter(Boolean).join("\n");
}

export interface ParkPlan {
  source: string;
  /** Whether the attempt survives inside the parked `.c`. */
  preserved: boolean;
  /** Why it does not, when it does not. */
  reasons: string[];
}

export interface PlanParkInput {
  projectRoot: string;
  /** Scratch directory for the sources handed to the parser. */
  runtimeDir: string;
  functionName: string;
  attemptSource: string;
  /** Last committed source for the file, when there is one. */
  committedSource: string | undefined;
  reason: ParkReason;
  reachedTier: string;
  notePath: string;
  parkedAt: string;
}

async function inspectText(input: PlanParkInput, name: string, source: string): Promise<SourceFacts> {
  const path = join(input.runtimeDir, "inspect", `${input.functionName}.${name}.c`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return inspectSource(input.projectRoot, path);
}

/**
 * Decide the parked source with the parser, not with pattern matching.
 *
 * Three AST questions, in order: does the committed source still declare this
 * function's `INCLUDE_ASM` placeholder (is it a usable park base); is the
 * attempt safe to wrap in a disabled block; and — the one that actually
 * protects the tree — does the composed file parse. A composition that fails
 * the last question is discarded in favour of the bare stub, so parking cannot
 * be the thing that breaks the build.
 */
export async function planPark(input: PlanParkInput): Promise<ParkPlan> {
  const reasons: string[] = [];

  const committed = input.committedSource === undefined ? undefined : stripPreviousPark(input.committedSource);
  const stubFacts = committed ? await inspectText(input, "base", committed) : undefined;
  const base =
    committed && stubFacts && declaresIncludeAsm(stubFacts, input.functionName)
      ? committed
      : canonicalStub(input.projectRoot, input.functionName);
  if (committed && stubFacts && !declaresIncludeAsm(stubFacts, input.functionName)) {
    reasons.push("committed source no longer declares the INCLUDE_ASM placeholder; synthesized a canonical stub");
  }

  const attempt = input.attemptSource.trim();
  let preserveAttempt = false;
  if (!attempt) {
    reasons.push("no attempt to preserve");
  } else {
    const attemptFacts = await inspectText(input, "attempt", input.attemptSource);
    if (!attemptFacts.available) {
      reasons.push(`C parser unavailable: ${attemptFacts.reasons.join("; ")}`);
    } else if (declaresIncludeAsm(attemptFacts, input.functionName)) {
      reasons.push("attempt is itself an INCLUDE_ASM stub; nothing to preserve");
    } else if (!attemptFacts.embeddable) {
      reasons.push(`attempt is not safe to embed: ${attemptFacts.reasons.join("; ")}`);
    } else {
      preserveAttempt = true;
    }
  }

  const compose = (preserve: boolean) =>
    composeParkedSource({
      functionName: input.functionName,
      base,
      attemptSource: input.attemptSource,
      preserveAttempt: preserve,
      reason: input.reason,
      reachedTier: input.reachedTier,
      notePath: input.notePath,
      parkedAt: input.parkedAt,
    });

  let source = compose(preserveAttempt);
  const composedFacts = await inspectText(input, "parked", source);
  const composedIsSound =
    composedFacts.available && composedFacts.parses && declaresIncludeAsm(composedFacts, input.functionName);

  if (!composedIsSound && preserveAttempt) {
    reasons.push(`composed park did not parse (${composedFacts.reasons.join("; ") || "unknown"}); kept the bare stub`);
    preserveAttempt = false;
    source = compose(false);
  } else if (!composedIsSound) {
    reasons.push(`composed park did not parse (${composedFacts.reasons.join("; ") || "unknown"})`);
  }

  return { source, preserved: preserveAttempt, reasons };
}

export function buildApprovalNote(record: ParkRecord, attemptSource: string, planReasons: string[] = []): string {
  const findings = record.findings.length
    ? record.findings
        .map((finding) => `- \`${finding.file}:${finding.line ?? "?"}\` — **${finding.kind}** — ${finding.message}\n  \`${finding.text ?? ""}\``)
        .join("\n")
    : "- none recorded";

  return [
    `# ${record.functionName} — human decision needed`,
    "",
    `- **Parked:** ${record.parkedAt}`,
    `- **Reason:** ${record.reason}`,
    `- **Escalation reached:** ${record.reachedTier}`,
    `- **Source:** \`${record.sourcePath ?? `src/${record.functionName}.c`}\` (INCLUDE_ASM restored)`,
    ...(planReasons.length ? [`- **Parking notes:** ${planReasons.join("; ")}`] : []),
    "",
    "## What the loop needs",
    "",
    record.reason === "asm-needs-human-approval"
      ? [
          "The top escalation tier proposed a source construct the clean-source policy forbids,",
          "and there is no higher agent to adjudicate it. Decide whether the construct is the",
          "correct answer for this function. If it is, add the allowlist entry to",
          "`.pi/autodecomp.json` under `sourcePolicy.allowlist` and re-run the loop on this",
          "target. If it is not, the function needs a different structural hypothesis.",
        ].join("\n")
      : [
          "Every tier on the escalation ladder returned without a byte-exact match. The function",
          "needs either a new structural hypothesis or a policy decision that the ladder cannot",
          "make on its own. The preserved attempt and the oracle report below are the starting",
          "point.",
        ].join("\n"),
    "",
    "## Policy findings",
    "",
    findings,
    "",
    "## Last oracle report",
    "",
    "```",
    record.lastReport.trim() || "(none)",
    "```",
    "",
    "## Preserved attempt",
    "",
    "```c",
    attemptSource.trim() || "(none)",
    "```",
    "",
  ].join("\n");
}

export function buildApprovedExemptionNote(
  functionName: string,
  kinds: string[],
  approvedBy: string,
  rationale: string,
  approvedAt: string,
): string {
  return [
    `# ${functionName} — agent-approved exemption, awaiting ratification`,
    "",
    `- **Approved:** ${approvedAt}`,
    `- **Approved by:** ${approvedBy} (one rung above the tier that proposed it)`,
    `- **Constructs:** ${kinds.join(", ")}`,
    "",
    "## Rationale given",
    "",
    rationale.trim() || "(none)",
    "",
    "## Why this is filed rather than applied",
    "",
    [
      "The loop honours this exemption for the rest of its own run, but it does not write it",
      "into `.pi/autodecomp.json`. That allowlist is a permanent assertion that the construct is",
      "the correct answer for this function, and only a human makes that assertion. Ratify it by",
      "adding the entry there, or reject it by re-opening the function.",
    ].join("\n"),
    "",
  ].join("\n");
}

export async function committedSource(projectRoot: string, path: string): Promise<string | undefined> {
  const result = await runCommand("git", ["show", `HEAD:${path}`], { cwd: projectRoot, timeoutMs: 30_000 });
  return result.code === 0 ? result.stdout : undefined;
}

/** The function's C file, project-relative — for git, notes and patches. */
export function sourceRelativePath(projectRoot: string, functionName: string): string {
  return functionPaths(projectRoot, functionName).source;
}

export function sourcePath(projectRoot: string, functionName: string): string {
  return resolve(projectRoot, sourceRelativePath(projectRoot, functionName));
}

export function readSource(projectRoot: string, functionName: string): string {
  try {
    return readFileSync(sourcePath(projectRoot, functionName), "utf8");
  } catch {
    return "";
  }
}

export function writeSource(projectRoot: string, functionName: string, source: string): void {
  const path = sourcePath(projectRoot, functionName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
}

/**
 * Keep a copy of whatever the loop is about to overwrite.
 *
 * The loop replaces `src/<fn>.c` in exactly two places — a rejected policy
 * exemption and a park — and in both the file on disk may hold the only copy of
 * an attempt that took a tier an hour to reach. The note and the `#if 0` block
 * are the intended records, but they are produced by machinery that can itself
 * fail; this is the copy that does not depend on any of it working. Archives are
 * written under the runtime directory, which is not tracked, and are never
 * pruned by the loop.
 */
export function archiveSource(
  runtimeDir: string,
  functionName: string,
  source: string,
  tag: string,
  at: string,
): string | undefined {
  if (!source.trim()) return undefined;
  const stamp = at.replace(/[:.]/g, "-");
  const path = join(runtimeDir, "attempts", `${functionName}.${stamp}.${tag}.c`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
}

export function noteRelativePath(config: LoopConfig, fileName: string): string {
  return `${config.approvalsDir}/${fileName}`;
}

export function writeNote(projectRoot: string, config: LoopConfig, fileName: string, body: string): string {
  const relative = noteRelativePath(config, fileName);
  const path = join(projectRoot, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return relative;
}
