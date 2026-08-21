import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.ts";
import { ControllerLock } from "./lock.ts";
import { keyOf, loadCallGraph, parseFunctionKey, rebuildCallGraph, reconcileState, updateNeighborHashes } from "./call-graph.ts";
import { runBuildCheck, runGate } from "./gates.ts";
import { runCommand } from "./process.ts";
import { checkSourcePolicy } from "./source-policy.ts";
import {
  beginNewEpoch,
  completionReady,
  nextMatchingWork,
  nextTargetedRefinement,
  pendingEligible,
  projectRefinementDue,
} from "./scheduler.ts";
import { addUsage, StateStore } from "./state.ts";
import type {
  AttemptRecord,
  AutodecompConfig,
  CallGraph,
  ControllerState,
  ControlRequest,
  FunctionKey,
  FunctionState,
  GateResult,
  WorkItem,
  WorkMode,
} from "./types.ts";
import { runPiWorker } from "./worker.ts";
import {
  applyPatch,
  changedFilesBetweenTrees,
  cleanupRuntimeWorkspaces,
  createTreeFromWorktree,
  createWorkspace,
  headRevision,
  patchHash,
  removeWorkspace,
  reversePatch,
  trackedDirtyFiles,
  treePatch,
  workspaceChangedFiles,
} from "./workspace.ts";

/** The container an unqualified identity belongs to. */
const EXE_CONTAINER = "exe";

export interface ControllerOptions {
  dryRun?: boolean;
  once?: boolean;
  forceLock?: boolean;
  /**
   * Pin this run to these containers, overriding the configured scope.
   *
   * The scheduling shape the overlay plan argues for: one worker per container,
   * coordinating through nothing but the shared engine symbol export.
   */
  containers?: string[];
}

export function findProjectRoot(start = process.cwd()): string {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, "AGENTS.md")) && existsSync(join(current, "tools", "agent"))) return current;
    const parent = dirname(current);
    if (parent === current) throw new Error(`Unable to find a decompilation project above ${start}`);
    current = parent;
  }
}

function now(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function truncate(value: string, bytes = 16_384): string {
  const buffer = Buffer.from(value, "utf8");
  return buffer.length <= bytes ? value : buffer.subarray(buffer.length - bytes).toString("utf8");
}

function compactGate(gate: GateResult): GateResult {
  if (gate.diff) {
    gate.diff.output = truncate(gate.diff.output);
    gate.diff.command.stdout = truncate(gate.diff.command.stdout, 4096);
    gate.diff.command.stderr = truncate(gate.diff.command.stderr, 4096);
  }
  if (gate.build) {
    gate.build.stdout = truncate(gate.build.stdout, 4096);
    gate.build.stderr = truncate(gate.build.stderr, 4096);
  }
  return gate;
}

/**
 * Where one function's sessions and candidate patches live.
 *
 * Keyed by container and address, because the address alone names two different
 * functions when two overlays share a RAM slot. A run that predates containers
 * wrote to the bare-address directory; that directory is still used when it is
 * the one that exists, so the layout change does not orphan a run's history or
 * invalidate the absolute paths its attempt records already hold.
 */
function functionDir(config: AutodecompConfig, key: FunctionKey): string {
  const { container, vram } = parseFunctionKey(key);
  const address = vram.replace(/^0x/i, "");
  const scoped = join(config.runtimeDir, "functions", container, address);
  if (existsSync(scoped) || container !== EXE_CONTAINER) return scoped;
  /* Only the executable's history can live at a bare address: it is the only
     container whose addresses were unambiguous when those directories were
     written, and an overlay reusing one would adopt a different function's
     sessions and patches. */
  const legacy = join(config.runtimeDir, "functions", address);
  return existsSync(legacy) ? legacy : scoped;
}

function requestDir(config: AutodecompConfig): string {
  return join(config.runtimeDir, "requests");
}

function controlPath(config: AutodecompConfig, name: "pause" | "stop"): string {
  return join(config.runtimeDir, `control.${name}`);
}

export function writeControl(projectRoot: string, control: "pause" | "resume" | "stop"): void {
  const config = loadConfig(projectRoot);
  mkdirSync(config.runtimeDir, { recursive: true });
  if (control === "resume") {
    rmSync(controlPath(config, "pause"), { force: true });
    rmSync(controlPath(config, "stop"), { force: true });
  } else {
    writeFileSync(controlPath(config, control), `${now()}\n`);
  }
}

export function writeRequest(projectRoot: string, action: ControlRequest["action"], target: string): void {
  const config = loadConfig(projectRoot);
  const dir = requestDir(config);
  mkdirSync(dir, { recursive: true });
  const request: ControlRequest = { id: randomUUID(), action, target, createdAt: now() };
  writeFileSync(join(dir, `${request.id}.json`), `${JSON.stringify(request, null, 2)}\n`);
}

export function readStatus(projectRoot: string): ControllerState {
  const config = loadConfig(projectRoot);
  return new StateStore(config.runtimeDir, projectRoot).load();
}

/** `--container a --container b`, or a single comma-separated list. */
export function parseContainerArgs(argv: string[]): string[] | undefined {
  const ids: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] !== "--container") continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("--container requires a container id");
    ids.push(...value.split(",").map((entry) => entry.trim()).filter(Boolean));
  }
  return ids.length > 0 ? [...new Set(ids)] : undefined;
}

export function statusText(state: ControllerState, config?: AutodecompConfig): string {
  const functions = Object.values(state.functions);
  const count = (status: string) => functions.filter((fn) => fn.status === status).length;
  const active = state.activeFunctionKey ? state.functions[state.activeFunctionKey] : undefined;
  const scope = config?.containers ? `containers ${config.containers.join(", ")}` : "all containers";
  return [
    `Autodecomp: ${state.status} (epoch ${state.epoch}, ${scope})`,
    `Matched ${count("matched")}; pending ${pendingEligible(state, config).length}; parked ${count("parked")}; dead ${count("dead")}; handwritten ${count("handwritten")}`,
    active ? `Active: ${active.currentName} (${keyOf(active)})` : "Active: none",
    `Attempts ${Object.keys(state.attempts).length}; turns ${state.totalUsage.turns}; cost $${state.totalUsage.costUsd.toFixed(4)}`,
    state.lastError ? `Last error: ${state.lastError}` : "",
  ].filter(Boolean).join("\n");
}

/**
 * The one function a control request names.
 *
 * A name or a `<container>:<address>` key identifies exactly one function. A
 * bare address does not, once two overlays share a RAM slot, so an ambiguous
 * one is refused with the candidates listed rather than resolved to whichever
 * entry the iteration order reached first — retrying or skipping the wrong
 * function is a silent wrong answer, not a mis-ordering.
 */
function resolveTarget(state: ControllerState, target: string): FunctionState {
  const lowered = target.toLowerCase();
  const matches = Object.values(state.functions).filter((fn) =>
    fn.currentName.toLowerCase() === lowered ||
    keyOf(fn).toLowerCase() === lowered ||
    fn.vram.toLowerCase() === lowered);
  if (matches.length === 0) throw new Error(`Unknown target ${target}`);
  if (matches.length > 1) {
    throw new Error(
      `${target} names ${matches.length} functions (${matches.map((fn) => keyOf(fn)).join(", ")}). ` +
        "Use the container-qualified key or the function name.",
    );
  }
  return matches[0]!;
}

export class AutodecompController {
  readonly config: AutodecompConfig;
  readonly store: StateStore;
  readonly lock: ControllerLock;
  private state: ControllerState;
  private graph?: CallGraph;
  private abortController = new AbortController();
  private progressThisEpoch = 0;
  private targetedBatchRemaining = 0;
  private stopping = false;

  constructor(readonly projectRoot: string, readonly options: ControllerOptions = {}) {
    const configured = loadConfig(projectRoot);
    /* A `--container` on the command line pins this run without editing the
       project config, which is what lets thirteen runs work thirteen overlays
       from one checkout. */
    this.config = options.containers ? { ...configured, containers: [...options.containers] } : configured;
    this.store = new StateStore(this.config.runtimeDir, projectRoot);
    this.lock = new ControllerLock(this.config.runtimeDir, projectRoot);
    this.state = this.store.load();
  }

  async run(): Promise<void> {
    this.lock.acquire(this.options.forceLock);
    const onSignal = () => {
      this.stopping = true;
      this.abortController.abort();
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    const stopPoll = setInterval(() => {
      if (existsSync(controlPath(this.config, "stop"))) onSignal();
    }, 2_000);
    stopPoll.unref();

    try {
      await this.initialize();
      if (this.options.dryRun) {
        console.log(statusText(this.state, this.config));
        const next = nextMatchingWork(this.state, this.config);
        console.log(next ? `Next: ${next.functionName} (${next.functionKey})` : "No matching target ready");
        this.state.status = "stopped";
        this.store.save(this.state);
        return;
      }

      let completedUnits = 0;
      while (!this.stopping) {
        if (this.budgetExceeded()) {
          this.state.status = "paused";
          this.store.event("budget_reached", { costUsd: this.state.totalUsage.costUsd });
          this.store.save(this.state);
          break;
        }
        await this.processControlRequests();
        if (existsSync(controlPath(this.config, "stop"))) {
          this.state.status = "stopping";
          this.store.save(this.state);
          break;
        }
        if (existsSync(controlPath(this.config, "pause"))) {
          this.state.status = "paused";
          this.store.save(this.state);
          await sleep(2_000);
          continue;
        }
        if (this.state.status !== "running") {
          this.state.status = "running";
          this.store.save(this.state);
        }

        this.graph = await rebuildCallGraph(this.projectRoot);
        reconcileState(this.state, this.graph);
        updateNeighborHashes(this.state, this.graph, this.config.retry.retryOnNeighborHashChange);
        this.store.save(this.state);

        if (this.targetedBatchRemaining === 0 && this.state.matchesSinceTargeted >= this.config.refinement.targetedEveryMatches) {
          this.targetedBatchRemaining = this.config.refinement.targetedBatchSize;
        }
        const targeted = this.targetedBatchRemaining > 0
          ? nextTargetedRefinement(this.state, this.graph, this.config, true)
          : undefined;
        if (targeted) {
          await this.executeWork(targeted);
          this.targetedBatchRemaining--;
          if (this.targetedBatchRemaining === 0) this.state.matchesSinceTargeted = 0;
          completedUnits++;
          if (this.options.once) break;
          continue;
        }
        if (this.targetedBatchRemaining > 0) {
          this.targetedBatchRemaining = 0;
          this.state.matchesSinceTargeted = 0;
        }

        if (projectRefinementDue(this.state, this.config)) {
          await this.executeWork({ mode: "project-refinement", modelTier: 0 });
          this.state.matchesSinceProject = 0;
          completedUnits++;
          if (this.options.once) break;
          continue;
        }

        const work = nextMatchingWork(this.state, this.config);
        if (work) {
          const fn = this.state.functions[work.functionKey!]!;
          if (fn.graphDecompiled && fn.attempts.length === 0 && fn.status === "pending") {
            const imported = await this.auditExisting(fn);
            completedUnits++;
            if (imported) this.progressThisEpoch++;
          } else {
            const matched = await this.executeWork(work);
            completedUnits++;
            if (matched) this.progressThisEpoch++;
          }
          if (this.options.once) break;
          continue;
        }

        const finalTargeted = nextTargetedRefinement(this.state, this.graph, this.config, true);
        if (finalTargeted) {
          await this.executeWork(finalTargeted);
          completedUnits++;
          if (this.options.once) break;
          continue;
        }

        if (projectRefinementDue(this.state, this.config, true)) {
          await this.executeWork({ mode: "project-refinement", modelTier: 0 });
          completedUnits++;
          if (this.options.once) break;
          continue;
        }

        if (completionReady(this.state, this.graph, this.config)) {
          const final = await this.finalAudit();
          if (final) break;
        }

        if (this.progressThisEpoch > 0 && this.config.retry.retryParkedAfterEpoch) {
          this.writeEpochReport();
          const reactivated = beginNewEpoch(this.state, this.config);
          this.progressThisEpoch = 0;
          this.store.event("epoch_started", { epoch: this.state.epoch, reactivated });
          this.store.save(this.state);
          continue;
        }

        this.state.status = "blocked";
        this.store.event("controller_blocked", { pending: pendingEligible(this.state, this.config).length, containers: this.config.containers });
        this.store.save(this.state);
        if (this.options.once) break;
        await this.waitWhileBlocked(this.config.retry.blockedSleepMinutes * 60_000);
        if (!this.stopping && !existsSync(controlPath(this.config, "pause")) && !existsSync(controlPath(this.config, "stop"))) {
          beginNewEpoch(this.state, this.config);
        }
      }

      if (!["complete", "paused", "failed"].includes(this.state.status)) this.state.status = "stopped";
      this.state.controllerPid = undefined;
      this.state.activeAttemptId = undefined;
      this.state.activeFunctionKey = undefined;
      this.store.save(this.state);
      console.log(statusText(this.state, this.config));
      void completedUnits;
    } catch (error) {
      this.state.status = "failed";
      this.state.lastError = error instanceof Error ? error.stack ?? error.message : String(error);
      this.store.event("controller_failed", { error: this.state.lastError });
      this.store.save(this.state);
      throw error;
    } finally {
      clearInterval(stopPoll);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      this.lock.release();
    }
  }

  private async waitWhileBlocked(durationMs: number): Promise<void> {
    const deadline = Date.now() + durationMs;
    while (Date.now() < deadline && !this.stopping) {
      if (existsSync(controlPath(this.config, "pause")) || existsSync(controlPath(this.config, "stop"))) return;
      await sleep(Math.min(2_000, deadline - Date.now()));
    }
  }

  private budgetExceeded(): boolean {
    if (this.config.budgets.maxCostUsd !== null && this.state.totalUsage.costUsd >= this.config.budgets.maxCostUsd) {
      this.state.lastError = `Configured cost budget reached ($${this.config.budgets.maxCostUsd})`;
      return true;
    }
    if (this.config.budgets.maxRuntimeHours !== null && this.state.startedAt) {
      const elapsedHours = (Date.now() - Date.parse(this.state.startedAt)) / 3_600_000;
      if (elapsedHours >= this.config.budgets.maxRuntimeHours) {
        this.state.lastError = `Configured runtime budget reached (${this.config.budgets.maxRuntimeHours} hours)`;
        return true;
      }
    }
    return false;
  }

  private async initialize(): Promise<void> {
    mkdirSync(this.config.runtimeDir, { recursive: true });
    writeFileSync(join(this.config.runtimeDir, "config.snapshot.json"), `${JSON.stringify(this.config, null, 2)}\n`);
    rmSync(controlPath(this.config, "stop"), { force: true });

    const head = await headRevision(this.projectRoot);
    const currentTree = await createTreeFromWorktree(this.projectRoot, this.projectRoot, this.config.integration.allowedRoots);
    if (!this.state.baselineHead) {
      if (this.config.requireCleanTrackedTree) {
        const dirty = await trackedDirtyFiles(this.projectRoot);
        if (dirty.length > 0) throw new Error(`Autodecomp requires a clean tracked tree. Dirty paths:\n${dirty.join("\n")}`);
      }
      this.state.baselineHead = head;
      this.state.baselineTree = currentTree;
    } else {
      if (this.state.baselineHead !== head) {
        throw new Error("Repository HEAD changed since this autonomous run was initialized; archive/reset runtime state before starting a new baseline");
      }
      if (this.state.baselineTree && this.state.baselineTree !== currentTree) {
        const interrupted = this.state.activeAttemptId ? this.state.attempts[this.state.activeAttemptId] : undefined;
        if (interrupted?.patchPath && existsSync(interrupted.patchPath)) {
          try {
            await reversePatch(this.projectRoot, interrupted.patchPath);
            const recoveredTree = await createTreeFromWorktree(this.projectRoot, this.projectRoot, this.config.integration.allowedRoots);
            if (recoveredTree !== this.state.baselineTree) throw new Error("Rollback did not restore the accepted tree");
            interrupted.status = "interrupted";
            this.store.event("interrupted_patch_rolled_back", { attemptId: interrupted.id });
          } catch (error) {
            throw new Error(`Tracked source differs from accepted state and interrupted-patch recovery failed: ${String(error)}`);
          }
        } else {
          throw new Error("Tracked source differs from the controller's last accepted integration tree");
        }
      }
    }

    await cleanupRuntimeWorkspaces(this.projectRoot, this.config.runtimeDir);

    for (const fn of Object.values(this.state.functions)) {
      if (["preparing", "running", "agent-finished", "gating", "refining"].includes(fn.status)) fn.status = "retry-ready";
    }
    for (const attempt of Object.values(this.state.attempts)) {
      if (attempt.status === "running") attempt.status = "interrupted";
    }

    const build = await runBuildCheck(this.projectRoot);
    if (build.code !== 0) throw new Error(`Baseline make check failed:\n${build.stderr || build.stdout}`);
    this.graph = await rebuildCallGraph(this.projectRoot);
    reconcileState(this.state, this.graph);
    updateNeighborHashes(this.state, this.graph, false);
    this.state.status = "running";
    this.state.controllerPid = process.pid;
    this.state.startedAt ??= now();
    this.state.lastError = undefined;
    this.store.event("controller_started", { pid: process.pid, epoch: this.state.epoch });
    this.store.save(this.state);
  }

  /**
   * The name-keyed tables the policy gate needs to place a function.
   *
   * All three come from the call graph, which is the authority on where a
   * function lives. Reconstructing a source path from a naming convention is
   * exactly the failure this replaces: `src/<name>.c` is the executable's
   * layout, and using it for an overlay scans a file that does not exist, which
   * a policy checker reports as a clean function rather than an unscanned one.
   */
  private graphTables(): {
    functionVrams: Record<string, string>;
    functionContainers: Record<string, string>;
    functionSources: Record<string, string>;
  } {
    const functionVrams: Record<string, string> = {};
    const functionContainers: Record<string, string> = {};
    const functionSources: Record<string, string> = {};
    for (const entry of this.graph?.functions ?? []) {
      functionVrams[entry.name] = entry.vram;
      functionContainers[entry.name] = entry.container;
      if (entry.source) functionSources[entry.name] = entry.source;
    }
    return { functionVrams, functionContainers, functionSources };
  }

  private async auditExisting(fn: FunctionState): Promise<boolean> {
    fn.status = "gating";
    this.store.save(this.state);
    const gate = compactGate(await runGate({
      projectRoot: this.projectRoot,
      config: this.config,
      mode: "audit",
      functionName: fn.currentName,
      functionVram: fn.vram,
      functionContainer: fn.container,
      ...this.graphTables(),
      changedFiles: [],
      patch: "",
      runBuild: false,
      signal: this.abortController.signal,
    }));
    fn.lastGate = gate;
    if (gate.pass) {
      this.acceptMatched(fn, "Existing clean exact match imported by deterministic audit");
      return true;
    }
    fn.status = "retry-ready";
    fn.parkedReason = `Import audit failed: ${gate.failures.join("; ")}`;
    this.store.event("function_audit_failed", { key: keyOf(fn), name: fn.currentName, failures: gate.failures });
    this.store.save(this.state);
    return false;
  }

  private async executeWork(work: WorkItem): Promise<boolean> {
    const fn = work.functionKey ? this.state.functions[work.functionKey] : undefined;
    if (fn) fn.status = work.mode === "targeted-refinement" ? "refining" : "preparing";
    this.state.activeFunctionKey = work.functionKey;
    this.store.save(this.state);

    const groupId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    /* The workspace splits the executable plus whichever containers this run can
       reach, so the target's `INCLUDE_ASM` stubs and its container's link inputs
       exist there. Splitting only the executable left an overlay's assembly
       absent and its link failing on a symbol the workspace had never seen. */
    const workspace = await createWorkspace(this.projectRoot, this.config, groupId, this.workspaceContainers(work));
    let success = false;
    let lastGate: GateResult | undefined;
    const sessionDir = work.mode === "project-refinement"
      ? join(this.config.runtimeDir, "refinements", "project", groupId, "sessions")
      : work.mode === "targeted-refinement"
        ? join(this.config.runtimeDir, "refinements", "targeted", work.functionContainer ?? EXE_CONTAINER, work.functionVram!.replace(/^0x/i, ""), groupId, "sessions")
        : join(functionDir(this.config, work.functionKey!), "sessions", groupId);

    try {
      const maxAttempts = work.mode === "match"
        ? Math.min(
          this.config.budgets.maxAttemptsPerFunctionPerEpoch - (fn?.attemptsThisEpoch ?? 0),
          this.config.matching.models.reduce((sum, tier) => sum + tier.maxAttempts, 0) - (fn?.attemptsThisEpoch ?? 0),
        )
        : 1;

      for (let localAttempt = 0; localAttempt < Math.max(1, maxAttempts); localAttempt++) {
        const modelTier = work.mode === "match" ? this.modelTierForCount(fn!.attemptsThisEpoch) : 0;
        if (modelTier === undefined) break;
        const model = this.config.matching.models[modelTier];
        const attemptId = randomUUID();
        const attempt: AttemptRecord = {
          id: attemptId,
          mode: work.mode,
          functionContainer: work.functionContainer,
          functionVram: work.functionVram,
          functionName: work.functionName,
          model: model.model,
          thinking: model.thinking,
          modelTier,
          startedAt: now(),
          sessionDir,
          workspacePath: workspace.path,
          status: "running",
        };
        this.state.attempts[attemptId] = attempt;
        this.state.activeAttemptId = attemptId;
        if (fn) {
          fn.status = work.mode === "targeted-refinement" ? "refining" : "running";
          fn.attempts.push(attemptId);
          if (work.mode === "match") fn.attemptsThisEpoch++;
        }
        this.store.event("worker_started", { attemptId, mode: work.mode, key: work.functionKey, model: model.model });
        this.store.save(this.state);

        const worker = await runPiWorker({
          workspace: workspace.path,
          sessionDir,
          mode: work.mode,
          functionName: work.functionName,
          model,
          continueSession: localAttempt > 0,
          timeoutMs: this.config.matching.timeoutMinutes * 60_000,
          idleTimeoutMs: this.config.matching.idleTimeoutMinutes * 60_000,
          turnLimit: this.config.matching.turnLimit,
          signal: this.abortController.signal,
          mirrorOutput: true,
          handoff: localAttempt === 0 && fn?.parkedReason
            ? `${fn.parkedReason}${fn.attempts.at(-2) && this.state.attempts[fn.attempts.at(-2)!]?.patchPath ? `; previous candidate patch: ${this.state.attempts[fn.attempts.at(-2)!].patchPath}` : ""}`
            : undefined,
        });
        attempt.worker = worker;
        addUsage(this.state.totalUsage, worker.usage);
        attempt.finishedAt = now();
        if (worker.stoppedByController) {
          attempt.status = "interrupted";
          this.store.save(this.state);
          break;
        }

        const exportArgs = work.mode === "project-refinement"
          ? ["tsx", "tools/agent/contextExport.ts", "--all"]
          : work.functionName ? ["tsx", "tools/agent/contextExport.ts", work.functionName] : undefined;
        const exportResult = exportArgs
          ? await runCommand("npx", exportArgs, { cwd: workspace.path, timeoutMs: 60_000 })
          : undefined;

        const candidateTree = await createTreeFromWorktree(this.projectRoot, workspace.path, this.config.integration.allowedRoots);
        const patch = await treePatch(this.projectRoot, workspace.baselineTree, candidateTree, this.config.integration.allowedRoots);
        const treeChanged = await changedFilesBetweenTrees(this.projectRoot, workspace.baselineTree, candidateTree);
        const workspaceChanged = await workspaceChangedFiles(workspace.path);
        const changedFiles = [...new Set([...treeChanged, ...workspaceChanged])].sort();
        const patchDir = work.mode === "project-refinement"
          ? join(this.config.runtimeDir, "refinements", "project", groupId)
          : functionDir(this.config, work.functionKey!);
        mkdirSync(join(patchDir, "patches"), { recursive: true });
        const patchPath = join(patchDir, "patches", `${attemptId}.patch`);
        writeFileSync(patchPath, patch);
        attempt.patchPath = patchPath;

        const gate = compactGate(await runGate({
          projectRoot: workspace.path,
          config: this.config,
          mode: work.mode,
          functionName: work.functionName,
          functionVram: work.functionVram,
          functionContainer: work.functionContainer,
          ...this.graphTables(),
          changedFiles,
          patch,
          signal: this.abortController.signal,
        }));
        if (exportResult && exportResult.code !== 0) {
          gate.pass = false;
          gate.failures.push(`Context export failed: ${truncate(exportResult.stderr || exportResult.stdout, 4096)}`);
        }
        attempt.gate = gate;
        lastGate = gate;
        this.store.save(this.state);

        if (gate.pass) {
          success = await this.integrate(work, workspace.baselineTree, candidateTree, patch, patchPath, changedFiles, gate);
          attempt.status = success ? "passed" : "failed";
          attempt.summary = success ? "Candidate passed workspace and trunk gates" : "Trunk integration gate failed";
          this.store.save(this.state);
          break;
        }

        attempt.status = "failed";
        attempt.summary = gate.failures.join("; ");
        this.store.event("worker_gate_failed", { attemptId, failures: gate.failures, patchHash: patchHash(patch) });
        this.store.save(this.state);
        if (work.mode !== "match") break;
      }
    } finally {
      await removeWorkspace(this.projectRoot, workspace.path);
      this.state.activeAttemptId = undefined;
      this.state.activeFunctionKey = undefined;
    }

    if (work.mode === "match" && fn) {
      fn.lastGate = lastGate;
      if (success) this.acceptMatched(fn, "Agent candidate passed deterministic workspace and trunk gates");
      else {
        const tier = this.modelTierForCount(fn.attemptsThisEpoch);
        fn.status = tier === undefined || fn.attemptsThisEpoch >= this.config.budgets.maxAttemptsPerFunctionPerEpoch ? "parked" : "retry-ready";
        fn.parkedReason = lastGate?.failures.join("; ") || "Worker stopped without an acceptable candidate";
      }
    } else if (work.mode === "targeted-refinement" && fn) {
      fn.status = "matched";
      fn.lastGate = lastGate;
      fn.lastRefinedNeighborHash = fn.lastNeighborHash;
      this.state.matchesSinceTargeted = 0;
      this.store.event("targeted_refinement_processed", { key: keyOf(fn), accepted: success });
    } else if (work.mode === "project-refinement") {
      this.state.lastProjectRefinedGraphHash = this.state.graphHash;
      this.state.matchesSinceProject = 0;
      this.store.event("project_refinement_processed", { accepted: success });
    }
    this.store.save(this.state);
    return success;
  }

  /**
   * The containers a workspace has to split before it can build.
   *
   * The executable is implicit — every container links against its symbol
   * export. Beyond that: the work item's own container, or, when a work item
   * names none (a project-wide refinement), whatever the run is scoped to.
   * `null` scope means every container, which the workspace expresses by
   * splitting all of them.
   */
  private workspaceContainers(work: WorkItem): string[] | null {
    if (work.functionContainer) return [work.functionContainer];
    return this.config.containers;
  }

  private modelTierForCount(attempts: number): number | undefined {
    let remaining = attempts;
    for (let index = 0; index < this.config.matching.models.length; index++) {
      if (remaining < this.config.matching.models[index].maxAttempts) return index;
      remaining -= this.config.matching.models[index].maxAttempts;
    }
    return undefined;
  }

  private async integrate(
    work: WorkItem,
    baselineTree: string,
    candidateTree: string,
    patch: string,
    patchPath: string,
    changedFiles: string[],
    workspaceGate: GateResult,
  ): Promise<boolean> {
    const currentTree = await createTreeFromWorktree(this.projectRoot, this.projectRoot, this.config.integration.allowedRoots);
    if (currentTree !== baselineTree || this.state.baselineTree !== baselineTree) {
      this.store.event("integration_stale", { expected: baselineTree, actual: currentTree });
      return false;
    }

    let applied = false;
    try {
      if (patch.trim()) {
        await applyPatch(this.projectRoot, patchPath);
        applied = true;
      }
      const trunkGate = compactGate(await runGate({
        projectRoot: this.projectRoot,
        config: this.config,
        mode: work.mode,
        functionName: work.functionName,
        functionVram: work.functionVram,
        functionContainer: work.functionContainer,
        ...this.graphTables(),
        changedFiles,
        patch,
        signal: this.abortController.signal,
      }));
      if (!trunkGate.pass) {
        this.store.event("integration_gate_failed", { key: work.functionKey, failures: trunkGate.failures });
        if (applied) await reversePatch(this.projectRoot, patchPath);
        return false;
      }
      this.state.baselineTree = candidateTree;
      this.store.save(this.state);
      this.store.event("patch_integrated", {
        mode: work.mode,
        key: work.functionKey,
        changedFiles,
        patchHash: patchHash(patch),
        workspaceGate: workspaceGate.pass,
      });
      return true;
    } catch (error) {
      if (applied) {
        try {
          await reversePatch(this.projectRoot, patchPath);
        } catch (rollbackError) {
          this.state.status = "failed";
          throw new Error(`Integration failed and rollback also failed: ${String(error)}; rollback: ${String(rollbackError)}`);
        }
      }
      this.store.event("integration_error", { error: String(error) });
      return false;
    }
  }

  private acceptMatched(fn: FunctionState, reason: string): void {
    fn.status = "matched";
    fn.matchedAt = now();
    fn.parkedReason = undefined;
    this.state.matchesSinceTargeted++;
    this.state.matchesSinceProject++;
    this.store.event("function_matched", { key: keyOf(fn), name: fn.currentName, reason });
    this.store.save(this.state);
  }

  private async finalAudit(): Promise<boolean> {
    const clean = await runCommand("make", ["clean"], {
      cwd: this.projectRoot,
      timeoutMs: 5 * 60_000,
      signal: this.abortController.signal,
    });
    if (clean.code !== 0) {
      this.state.lastError = `Final clean failed: ${truncate(clean.stderr || clean.stdout)}`;
      this.store.save(this.state);
      return false;
    }
    const split = await runCommand("make", ["split-all"], {
      cwd: this.projectRoot,
      timeoutMs: 10 * 60_000,
      signal: this.abortController.signal,
    });
    if (split.code !== 0) {
      this.state.lastError = `Final split failed: ${truncate(split.stderr || split.stdout)}`;
      this.store.save(this.state);
      return false;
    }
    const build = await runBuildCheck(this.projectRoot, 10 * 60_000, this.abortController.signal);
    if (build.code !== 0) {
      this.state.status = "failed";
      this.state.lastError = `Final make check failed: ${truncate(build.stderr || build.stdout)}`;
      this.store.save(this.state);
      return false;
    }
    this.graph = await rebuildCallGraph(this.projectRoot);
    reconcileState(this.state, this.graph);
    if (!completionReady(this.state, this.graph, this.config)) return false;

    const currentTree = await createTreeFromWorktree(this.projectRoot, this.projectRoot, this.config.integration.allowedRoots);
    if (currentTree !== this.state.baselineTree) {
      this.state.lastError = "Final source tree differs from the last accepted integration tree";
      this.store.save(this.state);
      return false;
    }
    const patch = await treePatch(this.projectRoot, "HEAD", currentTree, this.config.integration.allowedRoots);
    const changedFiles = [...new Set([
      ...await changedFilesBetweenTrees(this.projectRoot, "HEAD", currentTree),
      ...await trackedDirtyFiles(this.projectRoot),
    ])].sort();
    const policy = checkSourcePolicy({
      projectRoot: this.projectRoot,
      config: this.config,
      scanFunctions: this.graph.functions
        .filter((entry) => !entry.dead && entry.handwritten === false)
        .map((entry) => entry.name),
      ...this.graphTables(),
      changedFiles,
      patch,
    });
    if (!policy.pass) {
      this.state.lastError = `Final clean-source audit failed: ${policy.hardFailures.map((finding) => `${finding.file}: ${finding.message}`).join("; ")}`;
      this.store.save(this.state);
      return false;
    }

    this.state.status = "complete";
    this.state.completedAt = now();
    this.state.controllerPid = undefined;
    this.store.event("project_complete", { functions: Object.keys(this.state.functions).length });
    this.store.save(this.state);
    this.writeFinalReport();
    return true;
  }

  private writeEpochReport(): void {
    const functions = Object.values(this.state.functions);
    const report = [
      `# Autonomous decompilation epoch ${this.state.epoch}`,
      "",
      `- Generated: ${now()}`,
      `- Matched: ${functions.filter((fn) => fn.status === "matched").length}`,
      `- Containers: ${this.config.containers?.join(", ") ?? "all"}`,
      `- Pending eligible: ${pendingEligible(this.state, this.config).length}`,
      `- Parked: ${functions.filter((fn) => fn.status === "parked").length}`,
      `- Attempts: ${Object.keys(this.state.attempts).length}`,
      `- Turns: ${this.state.totalUsage.turns}`,
      `- Estimated cost: $${this.state.totalUsage.costUsd.toFixed(4)}`,
      "",
    ].join("\n");
    const path = join(this.config.runtimeDir, "reports", `epoch-${String(this.state.epoch).padStart(4, "0")}.md`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, report);
  }

  private writeFinalReport(): void {
    const functions = Object.values(this.state.functions);
    const count = (status: string) => functions.filter((fn) => fn.status === status).length;
    const report = [
      "# Autonomous decompilation final report",
      "",
      `- Completed: ${this.state.completedAt}`,
      `- Baseline HEAD: ${this.state.baselineHead}`,
      `- Accepted source tree: ${this.state.baselineTree}`,
      `- Matched: ${count("matched")}`,
      `- Dead: ${count("dead")}`,
      `- Handwritten: ${count("handwritten")}`,
      `- Attempts: ${Object.keys(this.state.attempts).length}`,
      `- Turns: ${this.state.totalUsage.turns}`,
      `- Estimated cost: $${this.state.totalUsage.costUsd.toFixed(4)}`,
      "",
      "Final call-graph regeneration and full byte-identity verification passed.",
      "",
    ].join("\n");
    const path = join(this.config.runtimeDir, "reports", `final-${Date.now()}.md`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, report);
  }

  private async processControlRequests(): Promise<void> {
    const dir = requestDir(this.config);
    if (!existsSync(dir)) return;
    for (const name of readFileNames(dir)) {
      const path = join(dir, name);
      try {
        const request = JSON.parse(readFileSync(path, "utf8")) as ControlRequest;
        const fn = resolveTarget(this.state, request.target);
        if (request.action === "skip") {
          fn.manuallySkipped = true;
          fn.status = "manually-skipped";
        } else {
          fn.manuallySkipped = false;
          fn.status = "retry-ready";
          fn.attemptsThisEpoch = 0;
          fn.parkedReason = undefined;
        }
        this.store.event("control_request", { action: request.action, target: request.target, key: keyOf(fn) });
      } catch (error) {
        this.store.event("control_request_failed", { file: name, error: String(error) });
      } finally {
        rmSync(path, { force: true });
      }
    }
    this.store.save(this.state);
  }
}

function readFileNames(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
}

export async function runController(projectRoot: string, options: ControllerOptions = {}): Promise<void> {
  await new AutodecompController(projectRoot, options).run();
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "start";
  const root = findProjectRoot();
  if (command === "start" || command === "run") {
    const containers = parseContainerArgs(process.argv.slice(3));
    await runController(root, {
      dryRun: process.argv.includes("--dry-run"),
      once: process.argv.includes("--once"),
      forceLock: process.argv.includes("--force-lock"),
      ...(containers ? { containers } : {}),
    });
    return;
  }
  if (command === "status") {
    console.log(statusText(readStatus(root), loadConfig(root)));
    return;
  }
  if (command === "logs") {
    console.log(loadConfig(root).runtimeDir);
    return;
  }
  if (["pause", "resume", "stop"].includes(command)) {
    writeControl(root, command as "pause" | "resume" | "stop");
    console.log(`Autodecomp ${command} requested.`);
    return;
  }
  if (["retry", "skip", "unblock"].includes(command)) {
    const target = process.argv[3];
    if (!target) throw new Error(`${command} requires a function name or a <container>:<address> key`);
    writeRequest(root, command as ControlRequest["action"], target);
    console.log(`Autodecomp ${command} requested for ${target}.`);
    return;
  }
  if (command === "force-unlock") {
    ControllerLock.forceUnlock(loadConfig(root).runtimeDir);
    console.log("Autodecomp lock removed.");
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
