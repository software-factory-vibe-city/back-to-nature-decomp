export type HandwrittenKind = false | "asm" | "gte";

/**
 * `<container>:<VRAM>` — the identity of one function in the work queue.
 *
 * A VRAM address alone is not an identity here. Overlays that share a RAM slot
 * hold different functions at the same address and are never resident together,
 * so a queue keyed by address carries one entry for two functions and hands the
 * agent the wrong target — a wrong answer that presents as a bad match rather
 * than a bad address. Build one with `functionKey`; never concatenate by hand.
 */
export type FunctionKey = string;

export interface CallGraphEntry {
  name: string;
  /** The container whose image defines this function. */
  container: string;
  /** Project-relative C file that defines it, whether or not it exists yet. */
  source?: string;
  /** First argument of its `INCLUDE_ASM` stub: `<asmDir>/nonmatchings/<name>`. */
  includeAsmPath?: string;
  vram: string;
  size: number;
  tier: number;
  priority: number;
  callerCount: number;
  calls: string[];
  calledBy: string[];
  instructionCount: number;
  decompiled: boolean;
  handwritten: HandwrittenKind;
  dead: boolean;
}

export interface CallGraph {
  functions: CallGraphEntry[];
  stats?: Record<string, number>;
}

export type ControllerStatus =
  | "idle"
  | "running"
  | "pausing"
  | "paused"
  | "stopping"
  | "stopped"
  | "blocked"
  | "complete"
  | "failed";

export type FunctionStatus =
  | "pending"
  | "preparing"
  | "running"
  | "agent-finished"
  | "gating"
  | "matched"
  | "integration-failed"
  | "gate-failed"
  | "retry-ready"
  | "parked"
  | "refinement-due"
  | "refining"
  | "refined"
  | "manually-skipped"
  | "dead"
  | "handwritten";

export type WorkMode = "match" | "targeted-refinement" | "project-refinement" | "audit";

export interface CommandResult {
  command: string;
  code: number;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface DiffResult {
  functionName: string;
  matchedInstructions: number;
  totalInstructions: number;
  matchPercent: number;
  /**
   * The oracle's own verdict. `undetermined` is a real third outcome — a word
   * whose relocation could not be resolved — and must never be folded into
   * either of the others.
   */
  verdict: "match" | "mismatch" | "undetermined" | "unknown";
  exact: boolean;
  instructionCountDelta: number;
  output: string;
  command: CommandResult;
}

export interface PolicyFinding {
  kind: string;
  file: string;
  line?: number;
  message: string;
  text?: string;
}

export interface SourcePolicyResult {
  pass: boolean;
  hardFailures: PolicyFinding[];
  warnings: PolicyFinding[];
  changedFiles: string[];
  outOfScopeFiles: string[];
  newlyAddedForbiddenConstructs: PolicyFinding[];
}

export interface GateResult {
  pass: boolean;
  mode: WorkMode;
  functionName?: string;
  diff?: DiffResult;
  build?: CommandResult;
  policy: SourcePolicyResult;
  failures: string[];
  checkedAt: string;
}

export interface WorkerUsage {
  turns: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

export interface WorkerResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  idleTimedOut: boolean;
  turnLimitReached: boolean;
  stoppedByController: boolean;
  startedAt: string;
  finishedAt: string;
  sessionDir: string;
  stdoutLog: string;
  stderrLog: string;
  finalText?: string;
  usage: WorkerUsage;
  parseErrors: number;
}

export interface AttemptRecord {
  id: string;
  mode: WorkMode;
  functionContainer?: string;
  functionVram?: string;
  functionName?: string;
  model?: string;
  thinking: string;
  modelTier: number;
  startedAt: string;
  finishedAt?: string;
  sessionDir: string;
  workspacePath?: string;
  worker?: WorkerResult;
  gate?: GateResult;
  patchPath?: string;
  status: "running" | "passed" | "failed" | "interrupted";
  summary?: string;
}

export interface FunctionState {
  /** The container whose image defines this function. */
  container: string;
  vram: string;
  currentName: string;
  previousNames: string[];
  status: FunctionStatus;
  priority: number;
  tier: number;
  graphDecompiled: boolean;
  dead: boolean;
  handwritten: HandwrittenKind;
  attempts: string[];
  attemptsThisEpoch: number;
  matchedAt?: string;
  lastGate?: GateResult;
  lastDiffCategory?: string;
  lastRemainingDiff?: string;
  lastNeighborHash?: string;
  lastRefinedNeighborHash?: string;
  parkedReason?: string;
  nextEligibleAt?: string;
  manuallySkipped?: boolean;
}

export interface ControllerState {
  /**
   * 1 — `functions` keyed by VRAM alone.
   * 2 — keyed by `<container>:<VRAM>`; every entry carries its container.
   */
  schemaVersion: 2;
  projectRoot: string;
  status: ControllerStatus;
  controllerPid?: number;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
  epoch: number;
  baselineHead?: string;
  baselineTree?: string;
  graphHash?: string;
  lastProjectRefinedGraphHash?: string;
  matchesSinceTargeted: number;
  matchesSinceProject: number;
  functions: Record<FunctionKey, FunctionState>;
  attempts: Record<string, AttemptRecord>;
  activeAttemptId?: string;
  activeFunctionKey?: FunctionKey;
  totalUsage: WorkerUsage;
  lastError?: string;
}

export interface ModelTierConfig {
  model?: string;
  thinking: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  maxAttempts: number;
}

export interface AutodecompConfig {
  runtimeDir: string;
  /**
   * Containers this run may take work from; `null` means every container.
   *
   * The engine API is the dependency frontier and the overlays sit behind it,
   * so a run pinned to one container needs no coordination with any other
   * beyond the shared engine symbol export. One documented exception exists in
   * this game and will exist in others: an overlay that calls into another
   * overlay. `tools/agent/callGraph.ts` reports those edges per container.
   */
  containers: string[] | null;
  parallelism: 1;
  requireCleanTrackedTree: boolean;
  matching: {
    models: ModelTierConfig[];
    turnLimit: number;
    timeoutMinutes: number;
    idleTimeoutMinutes: number;
  };
  refinement: {
    targetedEveryMatches: number;
    targetedBatchSize: number;
    projectEveryMatches: number;
    projectAtFinalization: boolean;
  };
  retry: {
    retryParkedAfterEpoch: boolean;
    retryOnNeighborHashChange: boolean;
    blockedSleepMinutes: number;
  };
  integration: {
    mode: "patch";
    allowCommits: false;
    allowedRoots: string[];
  };
  budgets: {
    maxCostUsd: number | null;
    maxRuntimeHours: number | null;
    maxAttemptsPerFunctionPerEpoch: number;
  };
  sourcePolicy: {
    allowEmptyMemoryBarrier: boolean;
    allowlist: Record<string, string[]>;
  };
}

export interface WorkspaceInfo {
  id: string;
  path: string;
  baseHead: string;
  baselineTree: string;
}

export interface WorkItem {
  mode: WorkMode;
  /** `functionKey(container, vram)` — set for every function-scoped mode. */
  functionKey?: FunctionKey;
  functionContainer?: string;
  functionVram?: string;
  functionName?: string;
  modelTier: number;
  continuationSessionDir?: string;
}

export interface ControlRequest {
  id: string;
  action: "retry" | "skip" | "unblock";
  target: string;
  createdAt: string;
}
