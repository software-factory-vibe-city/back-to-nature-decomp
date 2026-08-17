import type { ResidualReading } from "../autonomous/gates.ts";
import type { DiffResult, GateResult, PolicyFinding } from "../autonomous/types.ts";
import type { HandoffSummary } from "./types.ts";
import { measurements, readLedger } from "../../../../tools/agent/experimentLedger.ts";

export const DECOMPILE_SKILL = "psx-decompile-function";

/**
 * The nudge the loop sends on every return that is not yet a match.
 *
 * It states the protocol rather than offering encouragement. A turn told only
 * to keep going will often spend most of its context reasoning forward from the
 * last report — building a chain about what the compiler would do, several
 * unmeasured steps deep, before making any edit at all. Naming the four steps
 * each time costs a few lines and is the difference between a turn that
 * produces a measurement and one that produces an argument.
 */
export const KEEP_GOING = [
  "Keep going — there is clean C that matches this function 100%, and you stop only when it does.",
  "",
  "One experiment is one edit and one measurement:",
  "1. OBSERVE — run one tool. Three bullets of what it printed. No inference.",
  "2. HYPOTHESISE — one sentence: <edit> should lower <term> in block <n>, because <mechanism>.",
  "3. ACT — make that one edit and nothing else.",
  "4. MEASURE — psx_residual_objective, then start the next experiment immediately.",
  "",
  "Run them back to back. Do not stop to summarise, and do not defer an experiment",
  "you can already name — running it costs less than describing it.",
].join("\n");

/**
 * What the turn is told about where it stands.
 *
 * The verdict decides; the word count is context. What the turn should *steer
 * by* is the residual: it names the pass that owns the difference and the block
 * to work next, and unlike the word count it goes down when the source moves
 * toward the target rather than when the registers happen to line up.
 */
/**
 * Whether the last few measurements moved the residual at all.
 *
 * Read from the ledger rather than from loop state, because the ledger is what
 * survives a context clear and a model change. Three measurements with no
 * improvement is the point at which re-spelling the same axis stops being
 * search and starts being repetition.
 */
function stallLine(functionName: string): string | undefined {
  /* Respellings are excluded: a source that reaches an already-measured
   * program is not a measurement that failed to move, it is the same program
   * arrived at again. Counting them as failures makes a loop that is opening
   * its own search space look like a loop that has run out of ideas. */
  const entries = measurements(readLedger(functionName));
  if (entries.length < 4) return undefined;

  const better = (left: number[], right: number[]): boolean => {
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
      const difference = (left[index] ?? 0) - (right[index] ?? 0);
      if (difference !== 0) return difference < 0;
    }
    return false;
  };

  const recent = entries.slice(-3);
  const earlier = entries.slice(0, -3);
  const bestEarlier = earlier.reduce((best, entry) => (better(entry.key, best) ? entry.key : best), earlier[0]!.key);
  if (recent.some((entry) => better(entry.key, bestEarlier))) return undefined;

  return `STALLED: the last ${recent.length} distinct measurements did not improve on [${bestEarlier.join(", ")}]. ` +
    "The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. " +
    "Enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), " +
    "solve for the compiler state instead of modelling it (psx_solve_local_allocation, " +
    "psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass " +
    "directly (psx_compiler_source). A solver result is a specification for a source shape, " +
    "and an UNSAT is a real finding that closes a direction. Record what each one closed. " +
    "When a search reports no exact candidate, that is not the end of its output: read the " +
    "per-class residual axes and the runs each class moved, and take the next experiment from " +
    "the axis that moved rather than from the match count. Before trusting any search verdict, " +
    "check its caveats for constructs the grammar refused, its axis-effect block for axes that " +
    "are counted but inert, and its coverage — a --derive-only run sampled, and a sample " +
    "supports no statement about the domain.";
}

export function matchReport(diff: DiffResult, residual?: ResidualReading | null): string {
  const lines = [
    `Oracle: ${diff.functionName} verdict ${diff.verdict.toUpperCase()} — ${diff.matchedInstructions}/${diff.totalInstructions} words (${diff.matchPercent}%).`,
  ];
  if (diff.instructionCountDelta !== 0) {
    lines.push(
      `Instruction count delta versus target: ${diff.instructionCountDelta > 0 ? "+" : ""}${diff.instructionCountDelta}.`,
    );
  }
  if (residual && !residual.objective.exact) {
    const { controlFlow, population, schedule, allocation } = residual.objective;
    lines.push(
      `Residual (steer by this, not the word count): control-flow ${controlFlow}, population ${population}, ` +
      `schedule ${schedule}, allocation ${allocation}.`,
    );
    if (population > 0 || controlFlow > 0) {
      lines.push("The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.");
    }
    const next = residual.work[0];
    if (next) {
      lines.push(
        `Next block: ${next.block.block}` +
        `${next.block.vram === undefined ? "" : ` (0x${next.block.vram.toString(16).toUpperCase()})`}` +
        ` — population ${next.block.population}, schedule ${next.block.schedule}, ` +
        `allocation ${next.block.allocation + next.block.coalescing}. ${next.reason}`,
      );
      if (next.duplicates.length > 0) {
        lines.push(`Fixing it should also close block ${next.duplicates.join(", ")}.`);
      }
    }
    lines.push("`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; " +
      "`psx_residual_objective` with a source ranks candidate edits and records them.");
    const stalled = stallLine(diff.functionName);
    if (stalled) lines.push("", stalled);
  }
  return lines.join("\n");
}

export function gateReport(gate: GateResult): string {
  return [
    `Finalize oracle failed for ${gate.functionName}:`,
    ...gate.failures.map((failure) => `- ${failure}`),
  ].join("\n");
}

export function findingsReport(findings: PolicyFinding[]): string {
  return findings
    .map((finding) => `- ${finding.file}:${finding.line ?? "?"} — ${finding.kind} — ${finding.message}\n    ${finding.text ?? ""}`)
    .join("\n");
}

/**
 * The message that opens work on a function.
 *
 * It carries the protocol, because with `returnsPerTier` at 1 it is the only
 * message an agent ever receives — `nudgeMessage` is sent from the second
 * return onward and never fires. A protocol that lives only in the nudge is a
 * protocol nothing reads.
 *
 * The pacing is stated here in the harness's own vocabulary. "Turn" means one
 * assistant response to this harness and one loop iteration in the skill, and
 * an agent that resolves the two the wrong way concludes it owes exactly one
 * measurement — which is what happened: 30 minutes of work, one measurement, a
 * classification report, and a named next experiment left unrun.
 */
export function openingMessage(functionName: string): string {
  return [
    `/skill:${DECOMPILE_SKILL} Target: ${functionName}. Mode: fresh decompilation.`,
    "Create an m2c draft only if the source is still an INCLUDE_ASM stub; never overwrite an existing clean-C attempt.",
    "",
    "Do not stop until the function is byte-exact and psx_finalize_function passes.",
    "Run experiments back to back — one edit and one psx_residual_objective call each,",
    "as many as it takes — without pausing to summarise, check in, or report progress.",
    "The single-experiment rule is about attribution, never about pace: there is no",
    "budget of one measurement, and no good stopping point short of a match.",
    "",
    "If you can name the next experiment, run it. A compile is under a second, so",
    "'next experiment, when resuming' is always the wrong sentence — the run costs",
    "less than writing that down. Classify once at the start; after that every",
    "diagnostic must be followed by an edit and a measurement before the next one.",
    "",
    "Return only when the function is byte-exact, or when something genuinely needs a",
    "human decision (an allowlist entry, a policy exception) — then say which, briefly.",
    "Do not commit, do not create a worktree, and do not edit files outside src/, include/, and configs/.",
  ].join(" ");
}

/**
 * The outgoing tier's exit interview.
 *
 * It runs on that tier's own model with its context still intact — the last
 * moment the reasoning exists anywhere. Everything after this point reads the
 * source file, the oracle report, and this summary, and nothing else.
 */
export function handoffMessage(functionName: string): string {
  return [
    `You have not reached a byte-exact match for ${functionName}, and the loop is escalating to a`,
    "stronger model. Your context ends here; the next tier will see only the source file on disk,",
    "the oracle report, and the summary you are about to write.",
    "",
    `Call \`${"psx_loop_handoff"}\` exactly once with four fields:`,
    "",
    "- **whatWasTried** — the source shapes and structural hypotheses you actually compiled and",
    "  diffed, and what each one did to the diff. Not what you considered; what you measured.",
    "- **ruledOut** — hypotheses you positively eliminated, each with the evidence that killed it.",
    "  This is the most valuable field: it is what stops the next tier repeating your work.",
    "- **currentDivergence** — the first remaining divergence. Where it is, what the target does",
    "  there, what your candidate does instead.",
    "- **leadingHypothesis** — the most promising direction you did not get to, and the cheapest",
    "  evidence that would confirm or kill it.",
    "",
    "Every claim must be traceable to an assembly line or a tool that measured it. A hunch you",
    "cannot point at is worse than an empty field — it will be read as a finding. Do not edit any",
    "files in this turn.",
  ].join("\n");
}

/**
 * How the incoming tier is told to read that summary.
 *
 * The previous tier failed, so at least one premise it was working from is
 * probably wrong — and a summary written by a failed attempt is exactly the
 * kind of plausible, confident, wrong context that makes the next attempt fail
 * the same way. It is offered as a lead to disprove, never as a foundation.
 */
export function handoffBlock(summary: HandoffSummary): string {
  const body =
    summary.source === "tool"
      ? [
          `- What was tried: ${summary.whatWasTried}`,
          `- Ruled out: ${summary.ruledOut}`,
          `- Current divergence: ${summary.currentDivergence}`,
          `- Leading hypothesis: ${summary.leadingHypothesis}`,
        ].join("\n")
      : summary.whatWasTried;

  return [
    "--- Handoff from the previous escalation tier ---",
    "",
    body,
    "",
    "--- How to read the above ---",
    "",
    "Treat this analysis adversarially and with skepticism. It was written by a tier that did not",
    "match the function, so at least one premise in it is likely wrong, and the wrong ones will be",
    "stated as confidently as the right ones. Use it to avoid repeating measurements, not to",
    "inherit conclusions. Re-derive every structural premise — arity, frame, types, ownership —",
    "from the tools and the assembly. Where the summary and the assembly disagree, the assembly",
    "wins and the summary was wrong.",
    "",
    "In particular, a hypothesis listed as ruled out is only ruled out if the evidence given",
    "actually rules it out. Check the evidence, not the verdict. Most eliminations are",
    "conditional without saying so: a source form shown to be unreachable under the schedule or",
    "allocation the previous tier happened to produce is not unreachable when that state is",
    "itself the thing you are changing. Re-read every 'proven blocked' with that in mind.",
  ].join("\n");
}

export function escalationMessage(
  functionName: string,
  tierLabel: string,
  lastReport: string,
  handoff?: HandoffSummary,
): string {
  return [
    `/skill:${DECOMPILE_SKILL} Target: ${functionName}. Mode: resume/fix.`,
    `The previous escalation tier did not reach a match; you are now ${tierLabel}.`,
    "Preserve the current clean-C attempt, classify its existing diff once, and continue from there.",
    "Re-derive the structural premises rather than trusting the previous tier's conclusions —",
    "but read psx_experiment_ledger first: re-deriving a classification is warranted, re-running",
    "an experiment it already records is not.",
    "",
    lastReport,
    ...(handoff ? ["", handoffBlock(handoff)] : []),
    "",
    KEEP_GOING,
  ].join("\n");
}

export function nudgeMessage(lastReport: string): string {
  return [KEEP_GOING, "", lastReport].join("\n");
}

/**
 * The one turn between a match and its commit.
 *
 * Grouping evidence is cheapest to record while the function is still in
 * context and most expensive to recover once it is not. The turn is scoped to
 * the ledger on purpose: the build inputs have just been proven, and anything
 * this turn writes outside `notes/` is reverted before the commit.
 */
export function groupingsMessage(functionName: string): string {
  return [
    `${functionName} is byte-exact and has passed the full finalize gate.`,
    "",
    "Before it is committed: update `notes/file-groupings.md` if — and only if — this function",
    "produced new evidence about which original translation unit it belongs to. Same-file",
    "evidence is things like a shared static or global cluster, a register-variable quirk",
    "shared with a neighbour, a declaration-order effect, an SDK idiom cluster, or an",
    "adjacency the call graph and the link order agree on.",
    "",
    "Record membership and one-line roles only. Technique and per-function detail belong in",
    "`notes/research/` or `notes/retros/`, not in the ledger.",
    "",
    "If this function produced no new grouping evidence, say so and change nothing — an",
    "unfounded ledger entry is worse than no entry.",
    "",
    "Edit nothing outside `notes/` in this turn. The source has already been verified and any",
    "other edit will be reverted.",
  ].join("\n");
}

export function reviewMessage(functionName: string, findings: PolicyFinding[]): string {
  return [
    `Policy review for ${functionName}. A lower escalation tier introduced source constructs the`,
    "clean-source policy forbids for an ordinary compiled function:",
    "",
    findingsReport(findings),
    "",
    "Read `src/" + functionName + ".c`, the original assembly, and the project's clean-source policy in",
    "AGENTS.md and prompts/c-style-guide.md. Decide one question only: is the forbidden construct the",
    "correct answer for this function — a genuine, documented exception class — or is it a workaround",
    "for a structural hypothesis the tier failed to find?",
    "",
    "An exemption asserts permanently, to every later agent, that the construct is correct here.",
    "Being stuck is not that assertion. Approve only on positive evidence; reject by default.",
    "",
    "Answer by calling `psx_loop_policy_verdict` exactly once. Do not edit any files in this turn.",
  ].join("\n");
}

export function rejectionReport(functionName: string, findings: PolicyFinding[], rationale: string): string {
  return [
    `Policy review rejected the forbidden constructs in ${functionName}; the edit has been reverted.`,
    "",
    findingsReport(findings),
    "",
    `Reviewer rationale: ${rationale.trim() || "(none given)"}`,
    "",
    "Do not reintroduce them. The remaining divergence has a clean-C expression; find it.",
  ].join("\n");
}
