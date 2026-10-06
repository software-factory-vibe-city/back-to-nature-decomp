import { prepareAttempt, attemptStaticFinalization, buildInputs, documentCompletion, sameInputs, inputIdentity, type Completion } from "../tools/prepared-attempt.ts";
import { mkdirSync } from "node:fs";
import { packetOpening } from "../../../../tools/agent/campaign/packet.ts";
import { PREP_TOOLS, prepHandoffMessage, prepMessage, prepNudge, prepStatus, setPrepHandoffToolActive, type PrepSink } from "./prep.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { runFunctionDiff, runResidualObjective } from "../../shared/gates.ts";
import type { PolicyFinding } from "../../shared/types.ts";
import { chooseParkAttempt } from "./best-attempt.ts";
import { implicatedByPark } from "./family.ts";
import { shouldStop } from "./stop-rule.ts";
import { commitMatchedFunction, commitParkedFunction } from "./commit.ts";
import { needsCompaction, requestCompaction } from "./context.ts";
import {
  environmentIsIntact,
  finalize,
  introducedForbiddenConstructs,
  isMatched,
  loopChangedFiles,
  nextTarget,
  scopedLoopChanges,
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
  sourceRelativePath,
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
  PrepHandoffSummary,
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
  prep: PrepSink;
  /** Completed-agent-run counter, half of the loop's proof that a turn happened. */
  gate: TurnGate;
  /** Turn-scoped role, used to keep preparation's system prompt lean. */
  role?: LoopTier["role"];
}

/** How long a sent message may take to become a running agent turn. */
const TURN_START_TIMEOUT_MS = 120_000;
const TURN_POLL_MS = 100;
/** How long a compaction may take before the loop stops waiting on it. */
const COMPACTION_TIMEOUT_MS = 10 * 60_000;

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
  await compactIfLarge(deps);
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
 * Hold the working context under the configured ceiling.
 *
 * Checked where every turn passes and while the session is idle, because that
 * is the only moment a compaction can run without landing in the middle of a
 * tier's reasoning. The reading is the one the last response left behind, so it
 * measures the context this turn would actually start from.
 *
 * A compaction that fails or never reports is not fatal. The turn still has its
 * message, the tree still has the evidence, and the harness has its own
 * overflow recovery — losing the ceiling costs the loop nothing it cannot get
 * back, while stopping the loop over it would.
 */
async function compactIfLarge(deps: LoopDeps): Promise<void> {
  const usage = deps.ctx.getContextUsage();
  if (!needsCompaction(usage, deps.config.compactAtTokens)) return;

  const tokens = usage?.tokens ?? 0;
  setStatus(deps, `◎ autoloop · compacting (${tokens} tokens)`);
  const result = await requestCompaction({
    compact: (handlers) => deps.ctx.compact({ onComplete: () => handlers.onComplete(), onError: handlers.onError }),
    timeoutMs: COMPACTION_TIMEOUT_MS,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  if (result.outcome === "compacted") {
    notify(deps, `Compacted the conversation at ${tokens} context tokens (ceiling ${deps.config.compactAtTokens}).`, "info");
  } else {
    notify(deps, `Compaction ${result.outcome} at ${tokens} context tokens; continuing. ${result.detail}`, "warning");
  }

  /* Whatever the outcome, the summarizing run may still be settling, and the
   * next thing the caller does is send a message into that session. */
  await deps.ctx.waitForIdle();
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

/** Prep has its own exit report, independent of the matching tier's interview. */
async function capturePrepHandoff(deps: LoopDeps, functionName: string, lastReport: string): Promise<PrepHandoffSummary> {
  setStatus(deps, `◎ ${functionName} · preparation handoff`);
  deps.sink.prep.awaiting = functionName;
  deps.sink.prep.summary = undefined;
  setPrepHandoffToolActive(deps.pi, true);
  try {
    await turn(deps, prepHandoffMessage(functionName));
  } finally {
    setPrepHandoffToolActive(deps.pi, false);
    deps.sink.prep.awaiting = undefined;
  }
  const summary = deps.sink.prep.summary;
  deps.sink.prep.summary = undefined;
  return summary ?? {
    functionName, source: "prose", candidatePath: "See the refreshed prepared packet",
    headerChanges: "", sdkIdioms: "", compilation: lastReport,
    unresolved: lastAssistantText(deps.ctx).slice(0, 8000) || "No preparation summary was recorded.",
  };
}

/**
 * Drop the conversation before a new tier or a new function starts.
 *
 * A tier that inherits the previous tier's reasoning inherits its dead ends and
 * its wrong premises — the whole point of escalating is a fresh reading of the
 * same evidence. The evidence itself is not in the conversation: it is the
 * source file on disk, the oracle report carried in the message, and the
 * project's own notes. So at a boundary the loop clears rather than compacts,
 * and every message it sends after a clear is self-contained. Compaction is for
 * the other case — a context that outgrows its ceiling while one tier is still
 * working one function, where a summary keeps reasoning a clear would discard.
 * Prep role boundaries always clear, so neither role inherits the other's task.
 */
async function clearContext(deps: LoopDeps, force = false): Promise<void> {
  if (!force && !deps.config.clearContextBetween) return;
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
async function documentMatch(deps: LoopDeps, state: LoopState, functionName: string, completion: Completion): Promise<LoopState> {
  let current: LoopState = { ...state, completions: { ...state.completions, [functionName]: completion } };
  writeState(deps.config, current); /* durable pending state BEFORE dispatch */
  if (!deps.config.updateFileGroupings) return current;
  setStatus(deps, `◎ ${functionName} · documentation`);
  const documented = await documentCompletion(deps.projectRoot, completion, async () => {
    if (deps.flag.aborted || !deps.ctx.model) return false;
    if (!(await turn(deps, groupingsMessage(functionName) +
      `\nVerified source/evidence identity: ${completion.verifiedIdentity}. Origin: ${completion.origin}. Changed files: ${completion.changedFiles.join(", ")}.`))) return false;
    const last = [...deps.ctx.sessionManager.getBranch()].reverse().find((e) => e.type === "message" && e.message.role === "assistant");
    return last?.type === "message" && last.message.role === "assistant" && last.message.stopReason === "stop";
  });
  current = { ...current, completions: { ...current.completions, [functionName]: documented } };
  writeState(deps.config, current);
  if (documented.documentation !== "passed") notify(deps, `${functionName} matched; documentation pending: ${documented.error ?? "disabled"}`, "warning");
  return current;
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
  const reviewerTier = deps.config.ladder.slice(tierIndex + 1).find((tier) => tier.role !== "prep");
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
    await turn(deps, reviewMessage(functionName, findings, sourceRelativePath(deps.projectRoot, functionName)));
  } finally {
    setVerdictToolActive(deps.pi, false);
    deps.sink.verdict.awaiting = undefined;
  }

  /* The review tool writes this cell asynchronously during turn(). Read through
     the sink's declared type rather than the earlier local undefined assignment. */
  const verdict = (deps.sink.verdict as LoopDeps["sink"]["verdict"]).verdict;
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
  const onDisk = readSource(deps.projectRoot, functionName);
  const sourcePath = sourceRelativePath(deps.projectRoot, functionName);
  const parkedAt = new Date().toISOString();

  /* Preserve the best program the function ever produced, not the last one a
     tier happened to leave behind — and re-measure it here, so the report in
     the note describes the source under it. Those two disagreeing is worse
     than either being wrong on its own: the note hands the next session a
     residual its own code cannot reproduce, and the session spends its opening
     move discovering that. */
  const choice = chooseParkAttempt(deps.projectRoot, functionName, onDisk);
  let attempt = choice.text;
  let parkReport = lastReport;
  let attemptNote = choice.note;

  if (choice.origin === "ledger") {
    archiveSource(deps.config.runtimeDir, functionName, onDisk, "superseded", parkedAt);
    writeSource(deps.projectRoot, functionName, choice.text);
    const remeasured = await remeasure(deps, functionName);
    if (remeasured) {
      parkReport = remeasured;
    } else {
      /* Could not re-measure it, so the report and the source would disagree
         again. Keep the program that was measured. */
      writeSource(deps.projectRoot, functionName, onDisk);
      attempt = onDisk;
      attemptNote = `${choice.note} — but it could not be re-measured at park time, so the source on disk was kept`;
    }
  } else if (reason !== "asm-needs-human-approval") {
    const remeasured = await remeasure(deps, functionName);
    if (remeasured) parkReport = remeasured;
  }

  const record: ParkRecord = {
    functionName,
    sourcePath,
    reason,
    parkedAt,
    reachedTier,
    lastReport: parkReport,
    attemptNote,
    findings,
  };
  const archived = archiveSource(deps.config.runtimeDir, functionName, attempt, "parked", record.parkedAt);
  const notePath = noteRelativePath(deps.config, `${functionName}.md`);
  const plan = await planPark({
    projectRoot: deps.projectRoot,
    runtimeDir: deps.config.runtimeDir,
    functionName,
    attemptSource: attempt,
    committedSource: await committedSource(deps.projectRoot, sourcePath),
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
  notify(deps, `${functionName}: ${attemptNote}`, "info");
  return { state: next, record };
}

/**
 * Measure the source that is on disk right now.
 *
 * Used at park time so the preserved program and the report above it are the
 * same program. Never fatal: a park that cannot measure is still a park.
 */
async function remeasure(deps: LoopDeps, functionName: string): Promise<string | undefined> {
  try {
    const diff = await runFunctionDiff(deps.projectRoot, functionName);
    const residual = diff.verdict === "stub" ? null : await runResidualObjective(deps.projectRoot, functionName);
    return matchReport(diff, residual);
  } catch {
    return undefined;
  }
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
export async function runFunction(deps: LoopDeps, state: LoopState, functionName: string): Promise<{ state: LoopState; outcome: FunctionOutcome }> {
  const abort = new AbortController();
  const poll = setInterval(() => { if (deps.flag.aborted) abort.abort(); }, 100);
  if (deps.flag.aborted) abort.abort();
  try { return await runFunctionWithSignal(deps, state, functionName, abort.signal); }
  finally { clearInterval(poll); }
}

async function runFunctionWithSignal(deps: LoopDeps, state: LoopState, functionName: string, signal: AbortSignal): Promise<{ state: LoopState; outcome: FunctionOutcome }> {
  const oracle = (current: LoopState): OracleContext => ({
    projectRoot: deps.projectRoot,
    baseline: deps.baseline,
    state: current,
    signal,
  });

  let current = state;
  if (deps.flag.aborted || signal.aborted) return { state: current, outcome: { kind: "aborted", functionName } };
  let lastReport = "";
  let lastFindings: PolicyFinding[] = [];
  let handoff: HandoffSummary | undefined;
  let prepHandoff: PrepHandoffSummary | undefined;
  let reachedTier = deps.config.ladder[0]?.label ?? "none";
  /* A park is a verdict of matching tiers that ran, never of preparation alone. */
  let tiersRan = 0;

  const completed = current.completions?.[functionName];
  if (completed && sameInputs(completed.inputs, buildInputs(deps.projectRoot))) {
    current = await documentMatch(deps, current, functionName, completed);
    if (current.completions?.[functionName]?.verification === "invalidated") return { state: current,
      outcome: { kind: "environment-broken", functionName, detail: "Documentation changed verified build inputs; rerun finalization." } };
    return { state: current, outcome: { kind: "matched", functionName, tier: completed.origin,
      changedFiles: completed.changedFiles, documentation: current.completions?.[functionName]?.documentation ?? "pending" } };
  }
  /* No solver-model lookup until a static exact candidate has reached its gate. */
  let preparedOpening = "";
  try {
    const prepared = await prepareAttempt(deps.projectRoot, functionName, signal);
    const result = await attemptStaticFinalization({ root: deps.projectRoot, attempt: prepared, aborted: () => deps.flag.aborted,
      finalize: async () => {
        const gate = await finalize(oracle(current), functionName);
        return { passed: gate.passed, changedFiles: gate.changedFiles, detail: gateReport(gate.gate) };
      } });
    preparedOpening = result.handoff;
    if (result.completed) {
      current = await documentMatch(deps, current, functionName, result.completed);
      if (current.completions?.[functionName]?.verification === "invalidated") return { state: current,
        outcome: { kind: "environment-broken", functionName, detail: "Documentation changed verified build inputs; rerun finalization." } };
      return { state: current, outcome: { kind: "matched", functionName, tier: "static",
        changedFiles: (await loopChangedFiles(oracle(current))).changedFiles, documentation: current.completions?.[functionName]?.documentation ?? "pending" } };
    }
  } catch (error) { preparedOpening = `Preparation could not complete: ${String(error)}. Preserve current source; investigate the named input failure.`; }
  if (deps.flag.aborted) return { state: current, outcome: { kind: "aborted", functionName } };

  for (let tierIndex = 0; tierIndex < deps.config.ladder.length; tierIndex++) {
    const tier = deps.config.ladder[tierIndex];
    if (!(await applyTier(deps, tier))) continue;
    /* Escalating means a fresh reading of the same evidence, so the new tier
     * starts without the previous tier's conversation. */
    if (tierIndex > 0 || tier.role === "prep") {
      await clearContext(deps, tier.role === "prep" || !!prepHandoff);
    }
    reachedTier = tier.label;

    const tierStarted = Date.now();
    if (tier.role === "prep") {
      const savedTools = deps.pi.getActiveTools();
      deps.sink.role = "prep";
      deps.pi.setActiveTools(PREP_TOOLS);
      try {
        for (let attempt = 1; attempt <= deps.config.maxReturnsPerTier; attempt++) {
          setStatus(deps, `↻ ${functionName} · ${tier.label} · prep ${attempt}`);
          const message = attempt === 1 ? prepMessage(functionName, preparedOpening) : prepNudge(lastReport, preparedOpening);
          if (!(await turn(deps, message))) return { state: current, outcome: { kind: "aborted", functionName } };

          /* Re-measure the preserved primary draft, not the untouched assembly
             stub. Forward this refreshed packet without replacing agent edits. */
          let ready = false;
          try {
            const prepared = await prepareAttempt(deps.projectRoot, functionName, signal);
            preparedOpening = packetOpening(prepared.packet, prepared.path);
            const status = prepStatus(prepared.packet);
            lastReport = status.report;
            ready = status.ready;
          } catch (error) {
            lastReport = `Preparation measurement failed: ${String(error)}. Candidate edits remain on disk.`;
          }
          if (deps.flag.aborted) return { state: current, outcome: { kind: "aborted", functionName } };
          if (ready || (deps.config.tierMinutes > 0 && Date.now() - tierStarted >= deps.config.tierMinutes * 60_000)) break;
        }
        /* Compilation, not matching or residual stagnation, ends a prep tier. */
        prepHandoff = await capturePrepHandoff(deps, functionName, lastReport);
      } finally {
        deps.sink.role = undefined;
        deps.pi.setActiveTools(savedTools);
      }
      if (deps.flag.aborted) return { state: current, outcome: { kind: "aborted", functionName } };
      continue;
    }

    tiersRan += 1;
    for (let attempt = 1; ; attempt++) {
      if (deps.flag.aborted) return { state: current, outcome: { kind: "aborted", functionName } };

      setStatus(deps, `↻ ${functionName} · ${tier.label} · return ${attempt} (min ${deps.config.returnsPerTier})`);
      const snapshot = readSource(deps.projectRoot, functionName);

      const message =
        attempt > 1
          ? nudgeMessage(lastReport)
          : tierIndex === 0
            ? openingMessage(functionName) + "\n\n" + preparedOpening
            : escalationMessage(functionName, tier.label, lastReport, handoff, prepHandoff ? preparedOpening : "", prepHandoff);

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

        /* The counter is a floor now, not the decision. The decision is whether
         * the evidence says this search is out of moves — and, before that,
         * whether it was ever in a position to have any. */
        const verdict = shouldStop({
          config: deps.config,
          functionName,
          returns: attempt,
          elapsedMs: Date.now() - tierStarted,
          residual,
        });
        if (verdict.parkNow === "blocked") {
          notify(deps, `${functionName} is blocked, not hard: ${verdict.detail}`, "warning");
          const parked = await park(deps, current, functionName, "blocked", reachedTier, lastReport, lastFindings);
          return { state: parked.state, outcome: { kind: "parked", functionName, record: parked.record } };
        }
        if (verdict.stop) {
          notify(deps, `${functionName}: ${tier.label} is done — ${verdict.detail}`, "info");
          break;
        }
        continue;
      }

      const gate = await finalize(oracle(current), functionName);
      if (gate.passed) {
        notify(deps, `${functionName} matched and finalized on ${tier.label}`, "info");
        const inputs = buildInputs(deps.projectRoot);
        current = await documentMatch(deps, current, functionName, { origin: "agent", verifiedIdentity: inputIdentity(inputs), verification: "passed", inputs, changedFiles: gate.changedFiles, documentation: "pending" });
        if (current.completions?.[functionName]?.verification === "invalidated") return { state: current,
          outcome: { kind: "environment-broken", functionName, detail: "Documentation changed verified build inputs; rerun finalization." } };
        const changedFiles = (await loopChangedFiles(oracle(current))).changedFiles;
        return {
          state: current,
          outcome: { kind: "matched", functionName, tier: tier.label, changedFiles, documentation: current.completions?.[functionName]?.documentation ?? "pending" },
        };
      }
      lastReport = gateReport(gate.gate);
      if (attempt >= deps.config.maxReturnsPerTier) break;
    }

    /* The tier is out of returns. Take its findings now, while its context and
     * its model are both still the ones that produced them. */
    if (tierIndex + 1 < deps.config.ladder.length) {
      handoff = (await captureHandoff(deps, functionName, tier.label)) ?? handoff;
      prepHandoff = undefined;
      if (deps.flag.aborted) return { state: current, outcome: { kind: "aborted", functionName } };
    }
  }

  /* Every rung was unreachable — no model, no key. That is an environment fault,
   * not a verdict on the function, and parking it here would hand back an
   * INCLUDE_ASM stub in place of work no tier ever looked at. */
  if (tiersRan === 0) {
    notify(deps, prepHandoff
      ? `No matching tier was reachable for ${functionName}; preserved the preparation output without parking it.`
      : `No escalation tier was reachable for ${functionName}; left the source untouched.`, "error");
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

/**
 * Close a function out: commit what the loop owes the tree, and stop charging
 * the rest of it to whoever comes next.
 *
 * Anything the loop dirtied while working a function belongs to that function.
 * Left in the tree it becomes indistinguishable from the next function's own
 * edits: it fails that function's scope gate, or rides into its `match` commit
 * under the wrong subject line — and either way one function's leftovers park
 * every function after it. So the committable part is committed here, and
 * whatever cannot be committed — paths outside the project's integration roots
 * — is reported and folded into the loop's baseline, where it stands as dirt
 * that pre-dates every remaining function, exactly as it now does.
 */
async function closeOut(
  deps: LoopDeps,
  state: LoopState,
  outcome: FunctionOutcome & { kind: "parked" },
): Promise<void> {
  const ctx = { projectRoot: deps.projectRoot, baseline: deps.baseline, state };

  if (deps.config.commitOnPark) {
    setStatus(deps, `◎ ${outcome.functionName} · commit park`);
    const { committable, outOfScope } = await scopedLoopChanges(ctx);
    if (outOfScope.length > 0) {
      notify(deps, `Left uncommitted (outside the integration roots): ${outOfScope.join(", ")}`, "warning");
    }
    const commit = await commitParkedFunction(
      deps.projectRoot,
      outcome.functionName,
      outcome.record.reason,
      outcome.record.reachedTier,
      noteRelativePath(deps.config, `${outcome.functionName}.md`),
      committable,
    );
    if (commit.committed) {
      outcome.commit = commit.detail;
      notify(deps, `Committed the park of ${outcome.functionName} as ${commit.detail}`, "info");
    } else {
      notify(deps, `Park not committed: ${outcome.functionName} — ${commit.detail}`, "warning");
    }
  }

  const remaining = (await loopChangedFiles(ctx)).changedFiles;
  if (remaining.length === 0) return;
  for (const file of remaining) deps.baseline.add(file);
  notify(
    deps,
    `Not charging the next function for what ${outcome.functionName} left behind: ${remaining.join(", ")}`,
    "warning",
  );
}

export async function runLoop(input: LoopDeps, options: LoopOptions = {}): Promise<FunctionOutcome[]> {
  /* The loop forgives its own leftovers as it goes, and it does so on its own
   * copy: what it stops charging to the next function is not thereby forgiven
   * for every other tool sharing the session's baseline. */
  const deps: LoopDeps = { ...input, baseline: new Set(input.baseline) };
  mkdirSync(deps.config.runtimeDir, { recursive: true });
  const savedModel = deps.ctx.model;
  const savedThinking = deps.pi.getThinkingLevel();
  const limit = options.maxFunctions ?? deps.config.maxFunctions;
  const outcomes: FunctionOutcome[] = [];

  let state = readState(deps.config);
  const skip = new Set(Object.keys(state.parked));
  /* Functions a park has implicated: same suspected translation unit, or a
     residual signature the parked function carried. Deferred rather than
     skipped — see nextTarget. */
  const defer = new Set<string>();

  try {
    for (let index = 0; index < limit; index++) {
      if (deps.flag.aborted) break;

      /* Each function starts on a clean conversation; the first one keeps
       * whatever the user was doing when they started the loop. */
      if (index > 0) await clearContext(deps);

      setStatus(deps, "↻ autoloop · selecting target");
      const target = index === 0 && options.firstTarget
        ? options.firstTarget
        : Object.entries(state.completions ?? {}).find(([name, c]) => c.documentation === "pending" && !skip.has(name))?.[0] ?? await nextTarget(deps.projectRoot, skip, defer);
      if (!target) {
        notify(deps, "No remaining clean-C decompilation targets.", "info");
        break;
      }
      skip.add(target);

      const run = await runFunction(deps, state, target);
      state = run.state;
      outcomes.push(run.outcome);
      if (run.outcome.kind === "aborted") break;

      if (run.outcome.kind === "matched" && run.outcome.documentation !== "pending" && deps.config.commitOnMatch) {
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
       * park changes the tree afterwards, so only a park needs re-checking. A
       * park that does not build is not committed: it is left in the tree,
       * where the human it is addressed to can see it. */
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
        for (const relative of implicatedByPark(deps.projectRoot, target)) {
          if (!skip.has(relative)) defer.add(relative);
        }
        await closeOut(deps, state, run.outcome);
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
    setPrepHandoffToolActive(deps.pi, false);
    setStatus(deps, undefined);
  }

  return outcomes;
}

export function summarize(outcomes: FunctionOutcome[]): string {
  const matched = outcomes.filter((outcome) => outcome.kind === "matched").length;
  const parked = outcomes.filter((outcome) => outcome.kind === "parked").length;
  const broken = outcomes.some((outcome) => outcome.kind === "environment-broken");
  const aborted = outcomes.some((outcome) => outcome.kind === "aborted");
  const committed = outcomes.filter(
    (outcome) => (outcome.kind === "matched" || outcome.kind === "parked") && outcome.commit,
  ).length;
  const parts = [`${matched} matched`, `${committed} committed`, `${parked} parked`];
  if (aborted) parts.push("aborted");
  if (broken) parts.push("environment guard tripped");
  return `autoloop: ${parts.join(", ")}`;
}
