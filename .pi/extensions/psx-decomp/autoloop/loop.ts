import { mkdirSync } from "node:fs";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { runResidualObjective } from "../autonomous/gates.ts";
import type { PolicyFinding } from "../autonomous/types.ts";
import { commitMatchedFunction } from "./commit.ts";
import {
  environmentIsIntact,
  finalize,
  introducedForbiddenConstructs,
  isMatched,
  loopChangedFiles,
  nextTarget,
  type OracleContext,
} from "./oracles.ts";
import {
  archiveSource,
  buildApprovalNote,
  buildApprovedExemptionNote,
  committedSource,
  noteRelativePath,
  planPark,
  readSource,
  writeNote,
  writeSource,
} from "./park.ts";
import { lastAssistantText, setHandoffToolActive, type HandoffSink } from "./handoff.ts";
import { setVerdictToolActive, type VerdictSink } from "./policy-verdict.ts";
import {
  escalationMessage,
  gateReport,
  groupingsMessage,
  handoffMessage,
  matchReport,
  nudgeMessage,
  openingMessage,
  rejectionReport,
  reviewMessage,
} from "./prompts.ts";
import { isNotesPath, restoreDrift, snapshotFiles } from "./scope-guard.ts";
import { readState, recordApproval, recordPark, writeState } from "./state.ts";
import { waitForTurn, type TurnGate } from "./turn-gate.ts";
import type {
  FunctionOutcome,
  HandoffSummary,
  LoopConfig,
  LoopState,
  LoopTier,
  ParkReason,
  ParkRecord,
} from "./types.ts";

export interface AbortFlag {
  aborted: boolean;
}

/** The turn-scoped instruments the loop opens and closes around a single turn. */
export interface LoopSinks {
  verdict: VerdictSink;
  handoff: HandoffSink;
  /** Completed-agent-run counter, half of the loop's proof that a turn happened. */
  gate: TurnGate;
}

/** How long a sent message may take to become a running agent turn. */
const TURN_START_TIMEOUT_MS = 120_000;
const TURN_POLL_MS = 100;

export interface LoopDeps {
  pi: ExtensionAPI;
  ctx: ExtensionCommandContext;
  projectRoot: string;
  config: LoopConfig;
  sink: LoopSinks;
  flag: AbortFlag;
  /** Workspace dirt that pre-dates the loop and is never charged to it. */
  baseline: Set<string>;
}

function notify(deps: LoopDeps, message: string, level: "info" | "warning" | "error" = "info"): void {
  deps.ctx.ui.notify(message, level);
}

function setStatus(deps: LoopDeps, text: string | undefined): void {
  deps.ctx.ui.setStatus("autoloop", text === undefined ? undefined : deps.ctx.ui.theme.fg("accent", text));
}

/** Point the session at one rung of the ladder. Returns false when the rung is unusable. */
async function applyTier(deps: LoopDeps, tier: LoopTier): Promise<boolean> {
  const model = deps.ctx.modelRegistry.find(tier.provider, tier.model);
  if (!model) {
    notify(deps, `Escalation tier unavailable: ${tier.provider}/${tier.model} is not in the model catalogue`, "warning");
    return false;
  }
  if (!(await deps.pi.setModel(model))) {
    notify(deps, `Escalation tier unavailable: no API key for ${tier.provider}/${tier.model}`, "warning");
    return false;
  }
  deps.pi.setThinkingLevel(tier.thinking);
  return true;
}

/**
 * One agent turn: hand it the message, wait for it to be answered.
 *
 * Waiting is two-step — see the turn gate — because a send only queues. The
 * session stays idle for as long as it takes the prompt to start, so an
 * immediate `waitForIdle()` returns before the agent has read anything. The loop
 * would then apply the next tier's model to this tier's message, score both
 * oracles against an untouched file, and walk the whole ladder in seconds,
 * parking functions no tier ever attempted.
 */
async function turn(deps: LoopDeps, message: string): Promise<boolean> {
  await deps.ctx.waitForIdle();
  if (deps.flag.aborted) return false;

  const before = deps.sink.gate.settled;
  deps.pi.sendUserMessage(message);

  const outcome = await waitForTurn({
    gate: deps.sink.gate,
    before,
    isIdle: () => deps.ctx.isIdle(),
    isAborted: () => deps.flag.aborted,
    waitForIdle: () => deps.ctx.waitForIdle(),
    startTimeoutMs: TURN_START_TIMEOUT_MS,
    pollMs: TURN_POLL_MS,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  if (outcome === "never-started") {
    notify(deps, "The agent never picked up the loop's message; stopping rather than scoring an unanswered turn.", "error");
    deps.flag.aborted = true;
    return false;
  }
  return outcome === "settled" && !deps.flag.aborted;
}

/**
 * The outgoing tier's exit interview, taken before its context is dropped.
 *
 * It runs on that tier's own model while its reasoning still exists. The
 * structured form is preferred; a tier that ends the turn without filling it in
 * has its prose scraped instead, labelled as prose so the receiving tier knows
 * how much weight it carries. Either way the next tier is told to treat it
 * adversarially, so a weak summary costs nothing beyond the turn.
 */
async function captureHandoff(
  deps: LoopDeps,
  functionName: string,
  tierLabel: string,
): Promise<HandoffSummary | undefined> {
  if (!deps.config.handoffSummary) return undefined;

  setStatus(deps, `◎ ${functionName} · handoff from ${tierLabel}`);
  deps.sink.handoff.awaiting = functionName;
  deps.sink.handoff.summary = undefined;
  setHandoffToolActive(deps.pi, true);
  try {
    if (!(await turn(deps, handoffMessage(functionName)))) return undefined;
  } finally {
    setHandoffToolActive(deps.pi, false);
    deps.sink.handoff.awaiting = undefined;
  }

  const structured = deps.sink.handoff.summary;
  deps.sink.handoff.summary = undefined;
  if (structured) return structured;

  const prose = lastAssistantText(deps.ctx).slice(0, 8000);
  if (!prose) return undefined;
  notify(deps, `${tierLabel} ended its handoff without the structured form; carrying its prose forward`, "info");
  return {
    functionName,
    whatWasTried: prose,
    ruledOut: "",
    currentDivergence: "",
    leadingHypothesis: "",
    source: "prose",
  };
}

/**
 * Drop the conversation before a new tier or a new function starts.
 *
 * A tier that inherits the previous tier's reasoning inherits its dead ends and
 * its wrong premises — the whole point of escalating is a fresh reading of the
 * same evidence. The evidence itself is not in the conversation: it is the
 * source file on disk, the oracle report carried in the message, and the
 * project's own notes. So the loop clears rather than compacts, and every
 * message it sends after a clear is self-contained.
 */
async function clearContext(deps: LoopDeps): Promise<void> {
  if (!deps.config.clearContextBetween) return;
  await deps.ctx.waitForIdle();

  const entries = deps.ctx.sessionManager.getEntries();
  const first = entries.find(
    (entry) => entry.type === "message" && (entry as { message?: { role?: string } }).message?.role === "user",
  );
  if (!first) return;

  try {
    await deps.ctx.navigateTree(first.id, { summarize: false });
    deps.ctx.ui.setEditorText("");
  } catch (error) {
    /* A failed clear leaves a working conversation; a half-cleared one would not. */
    notify(deps, `Context clear skipped: ${error instanceof Error ? error.message : String(error)}`, "warning");
  }
}

/**
 * The one turn between a match and its commit: record grouping evidence.
 *
 * The finalize gate has already proven this exact set of build inputs. This turn
 * is allowed to write `notes/` and nothing else, so that proof survives it
 * without a second full build. Returns the file list to commit.
 */
async function recordGroupingEvidence(
  deps: LoopDeps,
  oracle: OracleContext,
  functionName: string,
  changedFiles: string[],
): Promise<string[]> {
  if (!deps.config.updateFileGroupings) return changedFiles;

  setStatus(deps, `◎ ${functionName} · file-groupings`);
  const before = snapshotFiles(deps.projectRoot, changedFiles.filter((file) => !isNotesPath(file)));
  if (!(await turn(deps, groupingsMessage(functionName)))) return changedFiles;

  const after = await loopChangedFiles(oracle);
  const restored = restoreDrift(deps.projectRoot, before, after.changedFiles);
  if (restored.length > 0) {
    notify(deps, `Reverted out-of-scope edits from the file-groupings turn: ${restored.join(", ")}`, "warning");
    return (await loopChangedFiles(oracle)).changedFiles;
  }
  return after.changedFiles;
}

/**
 * Ask the next rung up whether a forbidden construct is legitimate.
 *
 * The reviewer runs on the escalated model with only the verdict tool added,
 * and the working tier is restored before the loop continues. `unavailable`
 * means the proposing tier was already the top of the ladder — there is nobody
 * left to ask, which is exactly the case that belongs to a human.
 */
async function adjudicate(
  deps: LoopDeps,
  functionName: string,
  findings: PolicyFinding[],
  tierIndex: number,
): Promise<{ decision: "approve" | "reject" | "unavailable"; rationale: string; reviewer: string }> {
  const reviewerTier = deps.config.ladder[tierIndex + 1];
  if (!reviewerTier) return { decision: "unavailable", rationale: "", reviewer: "" };

  const workingTier = deps.config.ladder[tierIndex];
  setStatus(deps, `⚖ ${functionName} policy review → ${reviewerTier.label}`);
  if (!(await applyTier(deps, reviewerTier))) {
    return { decision: "unavailable", rationale: "reviewing tier could not be reached", reviewer: reviewerTier.label };
  }

  deps.sink.verdict.awaiting = functionName;
  deps.sink.verdict.verdict = undefined;
  setVerdictToolActive(deps.pi, true);
  try {
    await turn(deps, reviewMessage(functionName, findings));
  } finally {
    setVerdictToolActive(deps.pi, false);
    deps.sink.verdict.awaiting = undefined;
  }

  const verdict = deps.sink.verdict.verdict;
  deps.sink.verdict.verdict = undefined;
  await applyTier(deps, workingTier);

  /* Fail closed: a review that produced no verdict has not approved anything. */
  if (!verdict) {
    return { decision: "reject", rationale: "the review turn ended without a verdict", reviewer: reviewerTier.label };
  }
  return {
    decision: verdict.decision === "approve" ? "approve" : "reject",
    rationale: verdict.rationale,
    reviewer: reviewerTier.label,
  };
}

async function park(
  deps: LoopDeps,
  state: LoopState,
  functionName: string,
  reason: ParkReason,
  reachedTier: string,
  lastReport: string,
  findings: PolicyFinding[],
): Promise<{ state: LoopState; record: ParkRecord }> {
  const attempt = readSource(deps.projectRoot, functionName);
  const record: ParkRecord = {
    functionName,
    reason,
    parkedAt: new Date().toISOString(),
    reachedTier,
    lastReport,
    findings,
  };
  const archived = archiveSource(deps.config.runtimeDir, functionName, attempt, "parked", record.parkedAt);
  const notePath = noteRelativePath(deps.config, `${functionName}.md`);
  const plan = await planPark({
    projectRoot: deps.projectRoot,
    runtimeDir: deps.config.runtimeDir,
    functionName,
    attemptSource: attempt,
    committedSource: await committedSource(deps.projectRoot, `src/${functionName}.c`),
    reason,
    reachedTier,
    notePath,
    parkedAt: record.parkedAt,
  });

  writeSource(deps.projectRoot, functionName, plan.source);
  writeNote(deps.projectRoot, deps.config, `${functionName}.md`, buildApprovalNote(record, attempt, plan.reasons));

  const next = recordPark(deps.config, state, record);
  const preserved = plan.preserved ? "attempt preserved in the source" : "attempt preserved in the note only";
  notify(deps, `Parked ${functionName} (${reason}); ${preserved}; wrote ${notePath}`, "warning");
  if (archived) notify(deps, `Pre-park source archived at ${archived}`, "info");
  if (!plan.preserved && plan.reasons.length) notify(deps, plan.reasons.join("; "), "info");
  return { state: next, record };
}

/**
 * Drive one function to a match, or to a park.
 *
 * The escalation ladder is walked in order, each rung getting a fixed number of
 * non-matching returns before the next rung takes over with the previous
 * attempt intact. The two oracles decide, never the agent's own report: a turn
 * ends the function only when the diff verdict is MATCH *and* the finalize gate
 * — full build included — passes.
 */
async function runFunction(deps: LoopDeps, state: LoopState, functionName: string): Promise<{ state: LoopState; outcome: FunctionOutcome }> {
  const oracle = (current: LoopState): OracleContext => ({
    projectRoot: deps.projectRoot,
    baseline: deps.baseline,
    state: current,
    signal: undefined,
  });

  let current = state;
  let lastReport = "";
  let lastFindings: PolicyFinding[] = [];
  let handoff: HandoffSummary | undefined;
  let reachedTier = deps.config.ladder[0]?.label ?? "none";
  /* A park rewrites the source; it is only ever the verdict of tiers that ran. */
  let tiersRan = 0;

  for (let tierIndex = 0; tierIndex < deps.config.ladder.length; tierIndex++) {
    const tier = deps.config.ladder[tierIndex];
    if (!(await applyTier(deps, tier))) continue;
    tiersRan += 1;
    /* Escalating means a fresh reading of the same evidence, so the new tier
     * starts without the previous tier's conversation. */
    if (tierIndex > 0) await clearContext(deps);
    reachedTier = tier.label;

    for (let attempt = 1; attempt <= deps.config.returnsPerTier; attempt++) {
      if (deps.flag.aborted) return { state: current, outcome: { kind: "aborted", functionName } };

      setStatus(deps, `↻ ${functionName} · ${tier.label} · return ${attempt}/${deps.config.returnsPerTier}`);
      const snapshot = readSource(deps.projectRoot, functionName);

      const message =
        attempt > 1
          ? nudgeMessage(lastReport)
          : tierIndex === 0
            ? openingMessage(functionName)
            : escalationMessage(functionName, tier.label, lastReport, handoff);

      if (!(await turn(deps, message))) return { state: current, outcome: { kind: "aborted", functionName } };

      /* Policy comes before the match verdict: a match bought with forbidden
       * source is not a match this project accepts. */
      const findings = await introducedForbiddenConstructs(oracle(current), functionName);
      if (findings.length > 0) {
        lastFindings = findings;
        const review = await adjudicate(deps, functionName, findings, tierIndex);
        if (deps.flag.aborted) return { state: current, outcome: { kind: "aborted", functionName } };

        if (review.decision === "unavailable") {
          const parked = await park(
            deps,
            current,
            functionName,
            "asm-needs-human-approval",
            reachedTier,
            lastReport || "top tier proposed a forbidden construct with no higher tier to adjudicate it",
            findings,
          );
          return { state: parked.state, outcome: { kind: "parked", functionName, record: parked.record } };
        }

        if (review.decision === "reject") {
          const rejected = readSource(deps.projectRoot, functionName);
          const archived = archiveSource(
            deps.config.runtimeDir,
            functionName,
            rejected,
            "rejected",
            new Date().toISOString(),
          );
          writeSource(deps.projectRoot, functionName, snapshot);
          lastReport = rejectionReport(functionName, findings, review.rationale);
          notify(deps, `${review.reviewer} rejected the forbidden construct in ${functionName}; reverted`, "warning");
          if (archived) notify(deps, `Rejected source archived at ${archived}`, "info");
          continue;
        }

        const kinds = [...new Set(findings.map((finding) => finding.kind))];
        current = recordApproval(deps.config, current, {
          functionName,
          kinds,
          approvedAt: new Date().toISOString(),
          approvedBy: review.reviewer,
          rationale: review.rationale,
        });
        const notePath = writeNote(
          deps.projectRoot,
          deps.config,
          `${functionName}.approved.md`,
          buildApprovedExemptionNote(functionName, kinds, review.reviewer, review.rationale, new Date().toISOString()),
        );
        notify(deps, `${review.reviewer} approved ${kinds.join(", ")} for ${functionName}; filed ${notePath}`, "info");
      }

      setStatus(deps, `◎ ${functionName} · oracle`);
      const match = await isMatched(oracle(current), functionName);
      if (!match.matched) {
        /* The verdict already decided; the residual is what the next turn
         * should steer by, so it is read only when there is a next turn. */
        const residual = await runResidualObjective(deps.projectRoot, functionName);
        lastReport = matchReport(match.diff, residual);
        continue;
      }

      const gate = await finalize(oracle(current), functionName);
      if (gate.passed) {
        notify(deps, `${functionName} matched and finalized on ${tier.label}`, "info");
        const changedFiles = await recordGroupingEvidence(deps, oracle(current), functionName, gate.changedFiles);
        return {
          state: current,
          outcome: { kind: "matched", functionName, tier: tier.label, changedFiles },
        };
      }
      lastReport = gateReport(gate.gate);
    }

    /* The tier is out of returns. Take its findings now, while its context and
     * its model are both still the ones that produced them. */
    if (tierIndex + 1 < deps.config.ladder.length) {
      handoff = (await captureHandoff(deps, functionName, tier.label)) ?? handoff;
      if (deps.flag.aborted) return { state: current, outcome: { kind: "aborted", functionName } };
    }
  }

  /* Every rung was unreachable — no model, no key. That is an environment fault,
   * not a verdict on the function, and parking it here would hand back an
   * INCLUDE_ASM stub in place of work no tier ever looked at. */
  if (tiersRan === 0) {
    notify(deps, `No escalation tier was reachable for ${functionName}; left the source untouched.`, "error");
    return { state: current, outcome: { kind: "aborted", functionName } };
  }

  const parked = await park(
    deps,
    current,
    functionName,
    "escalation-exhausted",
    reachedTier,
    lastReport,
    lastFindings,
  );
  return { state: parked.state, outcome: { kind: "parked", functionName, record: parked.record } };
}

export interface LoopOptions {
  /** Explicit first target; the call graph picks every target after it. */
  firstTarget?: string;
  maxFunctions?: number;
}

export async function runLoop(deps: LoopDeps, options: LoopOptions = {}): Promise<FunctionOutcome[]> {
  mkdirSync(deps.config.runtimeDir, { recursive: true });
  const savedModel = deps.ctx.model;
  const savedThinking = deps.pi.getThinkingLevel();
  const limit = options.maxFunctions ?? deps.config.maxFunctions;
  const outcomes: FunctionOutcome[] = [];

  let state = readState(deps.config);
  const skip = new Set(Object.keys(state.parked));

  try {
    for (let index = 0; index < limit; index++) {
      if (deps.flag.aborted) break;

      /* Each function starts on a clean conversation; the first one keeps
       * whatever the user was doing when they started the loop. */
      if (index > 0) await clearContext(deps);

      setStatus(deps, "↻ autoloop · selecting target");
      const target = index === 0 && options.firstTarget ? options.firstTarget : await nextTarget(deps.projectRoot, skip);
      if (!target) {
        notify(deps, "No remaining clean-C decompilation targets.", "info");
        break;
      }
      skip.add(target);

      const run = await runFunction(deps, state, target);
      state = run.state;
      outcomes.push(run.outcome);
      if (run.outcome.kind === "aborted") break;

      if (run.outcome.kind === "matched" && deps.config.commitOnMatch) {
        setStatus(deps, `◎ ${target} · commit`);
        const commit = await commitMatchedFunction(deps.projectRoot, target, run.outcome.tier, run.outcome.changedFiles);
        if (commit.committed) {
          run.outcome.commit = commit.detail;
          notify(deps, `Committed ${target} as ${commit.detail}`, "info");
        } else {
          notify(deps, `Not committed: ${target} — ${commit.detail}`, "warning");
        }
      }

      /* A match already proved the build green inside the finalize gate; only a
       * park changes the tree afterwards, so only a park needs re-checking. */
      if (run.outcome.kind === "parked") {
        setStatus(deps, "◎ autoloop · environment check");
        const environment = await environmentIsIntact({
          projectRoot: deps.projectRoot,
          baseline: deps.baseline,
          state,
        });
        if (!environment.ok) {
          outcomes.push({ kind: "environment-broken", functionName: target, detail: environment.detail });
          notify(deps, `Loop stopped: the tree no longer builds after parking ${target}.\n${environment.detail}`, "error");
          break;
        }
      }
    }
  } finally {
    writeState(deps.config, state);
    /* Stopping the loop hands the session back to the user mid-turn: the message
     * they typed is what stopped it, and it is being answered right now by the
     * tier that was working. Swapping the model out from under that request
     * would corrupt the turn they are waiting on, so the ladder's tier stays
     * until the session is idle again. */
    if (savedModel && deps.ctx.isIdle()) {
      await deps.pi.setModel(savedModel);
      deps.pi.setThinkingLevel(savedThinking);
    } else if (savedModel) {
      notify(deps, `Loop stopped mid-turn; leaving the active model in place. Restore it with /model ${savedModel.id}.`, "info");
    }
    setVerdictToolActive(deps.pi, false);
    setHandoffToolActive(deps.pi, false);
    setStatus(deps, undefined);
  }

  return outcomes;
}

export function summarize(outcomes: FunctionOutcome[]): string {
  const matched = outcomes.filter((outcome) => outcome.kind === "matched").length;
  const parked = outcomes.filter((outcome) => outcome.kind === "parked").length;
  const broken = outcomes.some((outcome) => outcome.kind === "environment-broken");
  const aborted = outcomes.some((outcome) => outcome.kind === "aborted");
  const committed = outcomes.filter((outcome) => outcome.kind === "matched" && outcome.commit).length;
  const parts = [`${matched} matched`, `${committed} committed`, `${parked} parked`];
  if (aborted) parts.push("aborted");
  if (broken) parts.push("environment guard tripped");
  return `autoloop: ${parts.join(", ")}`;
}
