# Autonomous PlayStation Decompilation Plan

## Purpose

Build a durable autonomous supervisor that continuously pulls eligible functions from the generated call graph, delegates each work unit to an isolated Pi agent session, verifies results mechanically, integrates only clean successful changes, schedules targeted and project-level refinements, revisits parked functions when new context becomes available, and terminates only when the configured project-completion criteria are satisfied.

The supervisor must be game-agnostic. It must derive binary facts, toolchain details, paths, compiler behavior, language constraints, and project policy from the active project's `AGENTS.md`, generated profile, configuration, and tool outputs. It must never embed assumptions from a particular game.

## Implementation status

Implemented under `.pi/extensions/psx-decomp/autonomous/`, with configuration in `.pi/autodecomp.json`, the `psx_finalize_function` gate, the standalone `tools/agent/sourcePolicy.ts` audit, `/autodecomp` controls, tests, and operator documentation. Runtime state remains under `run_output/autodecomp/`. The rollout phases below remain the design and acceptance reference for future hardening.

## Core design principle

Do not use one indefinitely growing LLM conversation as the orchestrator.

Use two layers:

1. A deterministic TypeScript supervisor owns scheduling, durable state, process lifecycle, isolation, validation, integration, retries, refinement cadence, and completion.
2. Short-lived Pi sessions perform individual matching and refinement work using project-local skills and custom tools.

Agent output, Pi exit status, and self-reported success are advisory. Only deterministic gates can change a work item to `matched`, `refined`, or `complete`.

## Current foundation

The repository already has:

- project-local Pi commands under `.pi/extensions/psx-decomp/`
- game-agnostic skills:
  - `psx-decompile-function`
  - `psx-refine-function`
  - `psx-project-refinement`
- Pi tool wrappers:
  - `psx_m2c`
  - `psx_explain_diff`
  - `psx_compiler_trace`
  - `psx_diff_function`
  - `psx_build_call_graph`
  - `psx_export_context`
  - `psx_verify_build`
- underlying TypeScript tools in `tools/agent/`
- a generated priority-ranked `build/callGraph.json`
- exact per-function and full-binary verification
- written clean-source policy and known workaround classifications

The missing layer is deterministic supervision across many isolated agent sessions.

## Required operator experience

### Interactive commands

Add extension commands with a consistent namespace:

```text
/autodecomp start [options]
/autodecomp status
/autodecomp pause
/autodecomp resume
/autodecomp stop
/autodecomp retry <function-or-vram>
/autodecomp skip <function-or-vram>
/autodecomp unblock <function-or-vram>
/autodecomp logs [function-or-vram]
```

If Pi command naming cannot cleanly support subcommands, use separate commands such as `/autodecomp-start` and `/autodecomp-status`.

### Headless entry point

Provide a TypeScript CLI for unattended runs:

```bash
npx tsx .pi/extensions/psx-decomp/autonomous/controller.ts start
npx tsx .pi/extensions/psx-decomp/autonomous/controller.ts status
npx tsx .pi/extensions/psx-decomp/autonomous/controller.ts pause
npx tsx .pi/extensions/psx-decomp/autonomous/controller.ts resume
npx tsx .pi/extensions/psx-decomp/autonomous/controller.ts stop
```

The extension command should invoke the same controller implementation rather than duplicate orchestration logic.

### Suggested files

```text
.pi/extensions/psx-decomp/
├── index.ts
├── tools/
└── autonomous/
    ├── controller.ts          main state machine and CLI
    ├── commands.ts            Pi command registration
    ├── config.ts              config loading and validation
    ├── state.ts               durable state model and atomic persistence
    ├── call-graph.ts          graph refresh, eligibility, stable identity
    ├── scheduler.ts           work selection and refinement cadence
    ├── worker.ts              Pi subprocess lifecycle and JSON event parsing
    ├── workspace.ts           isolated checkout/worktree lifecycle
    ├── integration.ts         patch creation, application, rollback
    ├── gates.ts               deterministic completion gates
    ├── source-policy.ts       forbidden-change and allowed-path checks
    ├── refinement.ts          neighbor hashes and refinement queues
    ├── reporting.ts           status, summaries, progress and cost
    ├── lock.ts                single-controller lock
    └── types.ts               shared types
```

Split further only when modules become difficult to review.

## Runtime storage

Do not place controller state under `build/`; clean builds may delete it.

Use a gitignored runtime directory such as:

```text
run_output/autodecomp/
├── state.json
├── state.backup.json
├── controller.lock
├── controller.pid
├── config.snapshot.json
├── events.jsonl
├── reports/
├── workspaces/
├── functions/
│   └── 8001B4E4/
│       ├── metadata.json
│       ├── attempts.jsonl
│       ├── diagnostics/
│       ├── patches/
│       ├── sessions/
│       └── logs/
└── refinements/
    ├── targeted/
    └── project/
```

Persist state atomically by writing a temporary file, syncing if practical, and renaming it over `state.json`. Keep a last-known-good backup. Append important transitions to `events.jsonl` so state can be audited or reconstructed.

## Stable function identity

Key functions by normalized VRAM address, not symbol name.

Project refinement may rename functions. The supervisor must resolve the current symbol name from the latest call graph before each work unit. A state entry should retain name history for reporting but never treat the current name as permanent identity.

Suggested identity:

```ts
interface FunctionIdentity {
  vram: string;
  currentName: string;
  previousNames: string[];
}
```

Normalize addresses to one canonical uppercase or lowercase fixed-width format.

## Call-graph eligibility

Refresh `build/callGraph.json` before initial scheduling and after every integrated function or rename batch.

An ordinary matching target is eligible only when:

```text
dead === false
handwritten === false
decompiled/clean status is not already accepted by the supervisor
not manually skipped
not currently running
```

Do not infer eligibility solely from source-file presence or absence of `INCLUDE_ASM`.

### Existing selector defect to correct

The current project-local `/decompile` selector omits the call graph's `dead` field. Its count therefore includes dead functions and it can eventually select them. The autonomous scheduler and interactive selector must explicitly exclude `dead === true`.

### Handwritten classifications

Preserve project-established handwritten assembly classifications. Do not send GTE/cop2 or pure-assembly functions to clean-source matching workers unless project policy explicitly reclassifies them.

## Durable state model

### Controller status

```text
idle
running
pausing
paused
stopping
stopped
blocked
complete
failed
```

### Function status

```text
pending
preparing
running
agent-finished
gating
matched
integration-failed
gate-failed
retry-ready
parked
refinement-due
refining
refined
manually-skipped
dead
handwritten
```

### Suggested function record

```ts
interface FunctionState {
  vram: string;
  currentName: string;
  previousNames: string[];
  status: FunctionStatus;
  priority: number;
  tier: number;
  dead: boolean;
  handwritten: false | "asm" | "gte";
  attempts: AttemptRecord[];
  activeAttemptId?: string;
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
```

### Attempt record

Track at least:

- attempt ID and timestamps
- function VRAM and name at attempt time
- mode: fresh, resume, escalation, targeted refinement, project refinement
- model/provider and thinking level
- Pi session directory and session file
- workspace path
- child PID and exit status
- turn count
- token and cost totals when available
- timeout or abort reason
- final assistant text
- tool calls and errors
- gate results
- generated patch path
- diff category and compiler-trace summary

## Configuration

Add a project-local autonomous config with defaults that can be overridden from the CLI. Keep secrets out of it.

Suggested location:

```text
.pi/autodecomp.json
```

Suggested shape:

```json
{
  "runtimeDir": "run_output/autodecomp",
  "parallelism": 1,
  "matching": {
    "models": [
      { "model": "provider/normal-model", "thinking": "high", "maxAttempts": 2 },
      { "model": "provider/strong-model", "thinking": "high", "maxAttempts": 2 }
    ],
    "turnLimit": 60,
    "timeoutMinutes": 90
  },
  "refinement": {
    "targetedEveryMatches": 5,
    "targetedBatchSize": 2,
    "projectEveryMatches": 25,
    "projectAtFinalization": true
  },
  "retry": {
    "retryParkedAfterEpoch": true,
    "retryOnNeighborHashChange": true,
    "blockedSleepMinutes": 30
  },
  "integration": {
    "mode": "patch",
    "allowCommits": false
  },
  "budgets": {
    "maxCostUsd": null,
    "maxRuntimeHours": null,
    "maxAttemptsPerFunctionPerEpoch": 4
  }
}
```

Validate unknown fields and invalid values. Record the resolved config snapshot at run start.

Model authentication remains Pi's responsibility through its normal auth storage and provider environment variables. Do not revive the retired `AGENT`/`STRONGER_AGENT` JSON environment format.

## Worker process model

Each work unit runs in a fresh Pi subprocess and isolated session directory.

Example matching invocation:

```bash
npx pi \
  --mode json \
  --session-dir <attempt-session-dir> \
  --model <provider/model> \
  --thinking <level> \
  -p "/skill:psx-decompile-function Target: <name>. Mode: fresh or resume."
```

Example targeted refinement invocation:

```bash
npx pi \
  --mode json \
  --session-dir <attempt-session-dir> \
  --model <provider/model> \
  --thinking <level> \
  -p "/skill:psx-refine-function Target: <name>."
```

Example project refinement invocation:

```bash
npx pi \
  --mode json \
  --session-dir <attempt-session-dir> \
  --model <provider/model> \
  --thinking <level> \
  -p "/skill:psx-project-refinement Execute one coherent verified batch."
```

Use the project-local `npx pi` so behavior is pinned by the repository dependency.

### Worker event parser

Parse Pi JSON output incrementally. Record:

- session metadata
- assistant message boundaries
- text output
- tool starts, updates, and results
- turn starts and ends
- usage/cost fields
- stop reason and error message

The parser must tolerate unknown event types for forward compatibility. Preserve raw JSONL even when parsing fails.

### Watchdogs

The supervisor must enforce:

- wall-clock timeout
- turn limit
- idle-output timeout
- optional token or cost budget
- graceful termination followed by forced kill
- cancellation when the controller is paused or stopped

Send `SIGTERM`, wait a configured grace period, then send `SIGKILL` if needed. Kill the process tree, not only the immediate `npx` process.

### Session continuation

For an external-gate failure that appears recoverable, continue the same function session with explicit gate evidence. For example:

```bash
npx pi \
  --mode json \
  --session-dir <same-session-dir> \
  --continue \
  --model <possibly-stronger-model> \
  -p "The deterministic gate failed: <summary>. Reclassify and continue without forbidden workarounds."
```

Do not continue a corrupted, over-context, or repeatedly thrashing session forever. Start a fresh session with a concise structured handoff after configured thresholds.

## Workspace isolation

A failed worker must not leave the main checkout dirty.

### Default: isolated workspace plus patch integration

Because project policy forbids automatic commits unless explicitly authorized, use isolated workspaces and patch-based integration by default:

1. Verify the trunk baseline.
2. Create an isolated worktree or disposable checkout at the trunk HEAD.
3. Prepare required gitignored inputs, compiler builds, extracted binaries, dependencies, and generated build files.
4. Run the Pi worker with that workspace as its cwd.
5. Gate the result inside the workspace.
6. Generate a patch limited to allowed files.
7. Confirm the trunk has not changed since the attempt started.
8. Apply the patch to trunk without committing.
9. Rerun deterministic gates on trunk.
10. If the trunk gate fails, reverse the patch and mark integration failure.
11. Remove the workspace.

The implementation may reuse safe portions of the legacy worktree helper, but it must not call its commit or merge behavior in default mode.

### Optional commit integration

A commit/merge mode may exist only behind explicit user configuration such as `allowCommits: true`. Never infer authorization from starting an autonomous run.

### Baseline identity

Record trunk HEAD plus hashes of relevant dirty files before each work unit. Decide and document whether autonomous runs require a clean tracked tree. The safest initial implementation should refuse to start when unrelated tracked changes are present.

### Generated and ignored dependencies

Workspace preparation must account for:

- extracted original binaries
- `node_modules`
- compiler build directories
- submodules
- generated split/build artifacts
- optional local configuration required by the project

Do not copy secrets into committed paths or logs.

## Deterministic matching gate

A matching worker succeeds only if all required checks pass.

### Per-function byte gate

Run the exact function diff independently of the agent and require an explicit exact-match result. Avoid relying indefinitely on parsing human text; add or standardize structured JSON output for the function-diff tool.

Required fields should include:

```ts
interface FunctionDiffResult {
  functionName: string;
  vram?: string;
  matchedInstructions: number;
  totalInstructions: number;
  matchPercent: number;
  exact: boolean;
  instructionCountDelta: number;
  diffSummary?: string;
}
```

### Full binary gate

Run the project's full verification command independently and require the configured success condition. Prefer a structured wrapper result rather than matching one log phrase.

### Clean-source gate

Compare the attempt against its baseline and reject newly introduced forbidden constructs unless they are explicitly allowlisted by project policy:

- hard-register pinning
- top-level or embedded assembly for ordinary compiled functions
- new assembly stubs
- per-file compiler flag overrides
- copied raw target assembly
- changes to generated or protected files outside the approved workflow

Check added lines and semantic file state, not only whether the final file contains a token. Existing sanctioned exceptions must be represented by an explicit allowlist keyed by stable function identity and construct type.

### Allowed-path gate

For ordinary per-function matching, enforce the project's allowed modification scope. The gate should reject unrelated source, configuration, documentation, logs, package files, and vendor changes.

Refinement workers receive a broader but still explicit path policy. Project refinement receives the broadest policy and must report every touched function and symbol.

### Source-standard gate

Implement mechanical checks available from project policy, including where applicable:

- forbidden C standard features
- comment style
- generated-global redeclarations
- forbidden internal symbol spelling
- modification of SDK/vendor headers
- new unapproved flag overrides

Do not treat heuristic style checks as byte gates; report clearly which checks are hard failures and which are warnings.

### Context export gate

After a successful match, export the function's signature/context and verify that export does not break the build.

### Final trunk gate

After patch integration, rerun at least:

1. per-function exact diff
2. full binary verification
3. source-policy checks

Only then mark the function `matched`.

## Structured finalization tool

Add a `psx_finalize_function` Pi tool that agents call when they believe a function is done. It should:

- accept function name or VRAM
- run function diff
- run full verification
- inspect forbidden modifications and allowed paths
- return structured pass/fail details
- use `terminate: true` only when every required check passes

This improves agent behavior and closes the reward loophole inside a session. The external supervisor must still rerun the same gates independently.

Add corresponding structured finalization/report tools for targeted and project refinement if useful.

## Matching scheduler

### Initial ordering

Use the call graph's priority and tier ordering after eligibility filtering. Pass an explicit target to every worker; do not ask the worker to select its own function.

### Dynamic reprioritization

After every successful integration:

1. export context
2. regenerate the call graph
3. resolve current names by VRAM
4. refresh eligibility and priority
5. update neighbor hashes
6. enqueue newly useful refinements

The next function should be selected from the refreshed graph, not a stale startup snapshot.

### Epochs

An epoch is one pass over all currently eligible functions under the configured model tiers and attempt limits.

At epoch end:

- retry parked functions whose neighbor context changed
- run due targeted refinements
- optionally run a project-refinement checkpoint
- emit an epoch report
- if no progress occurred and incomplete functions remain, enter `blocked` state and sleep rather than spinning

## Retry and escalation policy

A recommended sequence per function:

1. normal model, fresh isolated session
2. normal model, continuation with exact external-gate evidence
3. stronger model, continuation or fresh structured handoff
4. one final attempt after re-reading compiler trace and parked candidate notes
5. park the function with a complete failure record

A parked record must include:

- classifier category
- first divergence
- instruction-count difference
- remaining instruction diff
- compiler-trace findings
- tested source-shape classes
- best clean-source patch or candidate
- session and log paths
- reason for retry eligibility

Do not reward an agent for bypassing the clean-source gate.

## Parked-function reactivation

Reactivate a parked function when any configured trigger occurs:

- matched caller/callee set changes
- neighbor hash changes
- a relevant shared type changes
- a symbol rename affects its context
- compiler/assembler tooling changes
- diagnostic tool version changes
- a new model tier becomes available
- operator explicitly retries it
- a new epoch begins, if configured

Record the trigger so repeated attempts can be evaluated for usefulness.

## Targeted refinement scheduling

Recreate neighbor-hash invalidation as durable supervisor behavior.

For every cleanly matched function:

1. Collect stable VRAM identities of cleanly matched callers and callees.
2. Sort and hash them.
3. Compare with `lastRefinedNeighborHash`.
4. Enqueue targeted refinement when the hash changes and useful context exists.

Run targeted refinement:

- after a configurable number of newly matched functions
- before retrying parked functions whose neighbors changed
- at epoch boundaries
- during finalization

Each refinement must baseline the function at exact match, run in isolation, and pass per-function plus full-trunk gates. A no-change refinement is a valid successful outcome and should update the neighbor hash marker.

## Project refinement scheduling

Project-wide refinement is higher risk and should run less frequently.

Recommended triggers:

- every 20–25 successful function integrations
- after a major call-graph region becomes fully decompiled
- at epoch boundaries when there is meaningful new context
- once during final completion

Each project-refinement worker must perform one coherent bounded batch, not an open-ended rewrite.

The gate must:

- enumerate touched files and affected function VRAMs
- verify every touched function still matches
- regenerate split/build artifacts when symbol/configuration changes require it
- run full binary verification
- rerun source-policy checks
- rebuild the call graph
- reconcile renamed symbols by VRAM
- roll back the whole batch on failure

Do not allow project refinement to run concurrently with function workers.

## Concurrency

Start with `parallelism: 1`.

Sequential execution avoids conflicts involving:

- generated function signatures
- shared type headers
- symbol names
- split configuration
- global declarations
- call-graph priority
- trunk patch integration

Future parallelism may prepare independent function candidates in separate workspaces, but integration must remain serialized and each candidate must be rebased or regenerated against current trunk before acceptance. Do not implement parallelism until the sequential controller is reliable.

## Completion criteria

The project is complete only when all of the following hold against a freshly regenerated graph and build:

1. Every `dead === false` and `handwritten === false` function has a supervisor-accepted clean-source match.
2. No eligible function is pending, running, gate-failed, retry-ready, or parked.
3. Every due targeted refinement has been processed for the current neighbor hash.
4. The configured final project-refinement pass has completed or explicitly produced no safe changes.
5. Context export is current.
6. Clean regeneration succeeds.
7. Full binary verification succeeds.
8. The clean-source policy audit passes.
9. Progress metrics agree with supervisor state.
10. No workspace or child process remains active.

Do not use the call graph's `decompiled` boolean alone as proof of clean completion; files containing legacy hacks may appear decompiled.

Emit a final machine-readable and Markdown report containing:

- matched/handwritten/dead counts
- bytes and function coverage
- refinement counts
- attempts and model usage
- cost and runtime totals
- all allowlisted exceptions
- final hashes and verification output

## Blocked behavior

Literal nonstop retrying is unsafe and expensive. If no progress is possible:

1. mark the controller `blocked`
2. persist all state
3. emit a report listing blockers
4. sleep for the configured interval
5. watch for operator action, source/tool changes, or retry triggers
6. resume only when something relevant changes

This preserves the "do not stop until complete" service behavior without repeatedly spending tokens on unchanged evidence.

## Pause, resume, and stop semantics

### Pause

- stop scheduling new work
- optionally allow the active worker to finish its gate
- persist state
- enter `paused`

### Resume

- validate state and workspace consistency
- refresh trunk baseline and call graph
- recover interrupted work items
- continue scheduling

### Stop

- stop scheduling
- terminate the active child according to the configured grace period
- clean disposable workspaces
- persist a resumable `stopped` state

### Crash recovery

On startup:

- acquire the singleton lock
- detect stale controller PID/lock
- inspect any `running` attempts
- determine whether child processes or workspaces remain
- preserve logs and patches
- return interrupted functions to `retry-ready` unless their gates can be safely completed
- verify trunk before resuming

## Locking

Allow one controller per project runtime directory. The lock should include PID, hostname, start time, repository root, and controller version.

Handle stale locks conservatively. Do not delete a lock belonging to a live process. Provide an explicit force-unlock command with a warning.

## Observability

### Live status

Report:

- controller state and uptime
- active function and attempt
- active model and turn count
- current diff percentage/category when known
- matched, pending, parked, dead, handwritten counts
- targeted/project refinement queues
- epoch progress
- token/cost totals
- last successful integration
- next scheduled item

### Event log

Append structured events for:

- controller transitions
- work selection
- worker start/stop
- model escalation
- tool and gate summaries
- patch creation/application/rollback
- function status transitions
- refinement enqueue/completion
- call-graph refresh
- blocked/complete states

### Human reports

Generate periodic Markdown reports under `run_output/autodecomp/reports/`, including an epoch report and final report.

## Budgets and safety controls

Even when configured to run until completion, support optional limits:

- maximum total cost
- maximum cost per function
- maximum runtime per worker
- maximum controller runtime
- maximum turns per attempt
- maximum attempts per function per epoch
- maximum consecutive no-progress attempts
- disk-space threshold
- load-average threshold

When a budget is reached, pause or block rather than silently weakening gates.

Never log credentials, API keys, raw auth files, or secret environment variables.

## Tooling improvements

### Structured outputs

Add or standardize `--json` output for controller-facing tools:

- function diff
- diff explanation
- compiler trace summary
- call-graph generation summary
- context export
- full build verification
- clean-source policy audit

The Pi wrappers and supervisor should consume typed JSON rather than scrape human logs where possible.

### Cancellation

Ensure wrapped commands and underlying tools honor abort signals and terminate subprocess trees.

### Output limits

Keep model-visible tool output bounded. Preserve full command output in attempt logs and return only the relevant tail/summary to the agent.

### Version fingerprints

Record hashes or versions of:

- supervisor code
- skills
- Pi extension/tool wrappers
- call-graph generator
- function diff tool
- classifier and compiler trace
- compiler and assembler configuration

Use version changes as optional parked-function retry triggers.

## Source-policy audit tool

Implement a standalone TypeScript audit command usable by humans, Pi, and the controller. It should compare a baseline and candidate and return structured findings.

Suggested command:

```bash
npx tsx tools/agent/sourcePolicy.ts --baseline <ref-or-dir> --candidate <dir> --json
```

Checks should be driven by project configuration and explicit allowlists, not hidden assumptions.

Suggested result:

```ts
interface SourcePolicyResult {
  pass: boolean;
  hardFailures: PolicyFinding[];
  warnings: PolicyFinding[];
  changedFiles: string[];
  outOfScopeFiles: string[];
  newlyAddedForbiddenConstructs: PolicyFinding[];
}
```

## Integration patch format

Store a patch and manifest for every accepted or rejected candidate:

```ts
interface PatchManifest {
  attemptId: string;
  baseHead: string;
  functionVrams: string[];
  changedFiles: string[];
  fileHashesBefore: Record<string, string>;
  fileHashesAfter: Record<string, string>;
  gateResult: GateResult;
  createdAt: string;
}
```

Before applying, verify trunk files still match expected before-hashes. On mismatch, mark the candidate stale and rerun or rebase it rather than applying blindly.

## Refinement and matching interaction

When a successful refinement changes shared types or context:

1. identify affected functions
2. rerun exact diffs for all touched functions
3. rebuild the call graph
4. update current names by VRAM
5. recompute neighbor hashes
6. reactivate parked functions whose evidence changed
7. invalidate stale pending patches built against old shared context

This dependency invalidation is essential once project refinement begins renaming symbols or consolidating types.

## Testing strategy

### Unit tests

Test pure modules for:

- config validation and defaults
- VRAM normalization and rename reconciliation
- call-graph eligibility, especially dead and handwritten exclusions
- priority selection
- state transitions
- atomic persistence and backup recovery
- lock behavior
- retry/escalation decisions
- neighbor hashing
- refinement cadence
- output truncation
- JSON event parsing
- policy findings
- completion criteria

### Integration tests with fake Pi

Create a fake Pi executable that emits fixture JSON events and configurable exit behavior. Cover:

- successful worker
- model error
- tool error
- timeout
- malformed JSON mixed with valid events
- process-tree cancellation
- continuation
- escalation
- no final assistant message
- claimed success with failing external gate

### Workspace/integration tests

Use temporary git repositories to test:

- isolated workspace creation
- dirty-trunk refusal
- patch generation
- stale-base detection
- successful apply
- rollback after trunk gate failure
- rename handling
- cleanup after crash
- no automatic commits in patch mode

### Gate tests

Fixture candidates should include:

- exact clean match
- byte mismatch
- full-build regression
- newly added register pin
- newly added embedded assembly
- new assembly stub
- new flag override
- sanctioned handwritten exception
- out-of-scope file modification
- generated-header-only change from context export

### End-to-end dry run

Add a dry-run mode that selects and reports work without spawning agents or editing files.

Then run a controlled end-to-end test on:

1. an already matching function, expecting no unsafe changes
2. a known small unmatched function
3. a parked difficult function
4. one targeted refinement
5. one intentionally failing project-refinement patch

Do not start an unbounded production run until these pass.

## Rollout phases

### Phase 1: deterministic state and dry-run scheduler

- define types and config
- implement state persistence and lock
- load/filter call graph correctly
- select by stable VRAM and priority
- expose status and dry-run commands
- test dead/handwritten exclusions

Exit criterion: repeated dry runs produce a stable correct queue and survive restart.

### Phase 2: single worker without integration

- spawn one Pi process
- parse and persist JSON events
- enforce watchdogs
- capture sessions and logs
- run gates read-only
- never apply worker changes to trunk

Exit criterion: worker lifecycle and failure handling are deterministic.

### Phase 3: isolated patch integration

- create disposable workspace
- prepare ignored/generated dependencies
- gate candidate in workspace
- generate and manifest patch
- apply transactionally to trunk
- rerun trunk gates and roll back on failure

Exit criterion: no failed worker can dirty trunk and no successful integration bypasses gates.

### Phase 4: retries, escalation, and parking

- continue sessions with exact gate feedback
- switch model tiers
- create fresh handoff sessions when needed
- persist classified parked records
- implement epoch behavior

Exit criterion: difficult functions do not cause infinite immediate thrashing.

### Phase 5: targeted refinement

- compute matched-neighbor hashes by VRAM
- enqueue and execute targeted refinements
- accept no-change refinements
- reactivate parked functions on context change

Exit criterion: refinement scheduling survives graph rebuilds and renames.

### Phase 6: project refinement

- schedule bounded project batches
- reconcile symbol renames by VRAM
- invalidate stale candidates
- gate all touched functions and full build

Exit criterion: failed broad changes roll back atomically.

### Phase 7: autonomous service controls

- interactive start/status/pause/resume/stop commands
- headless daemon behavior
- blocked sleep/wake behavior
- budget controls
- progress/cost reports
- crash recovery

Exit criterion: the controller can operate unattended and resume after interruption.

### Phase 8: completion audit

- implement exact project-completion criteria
- final refinements
- clean regeneration and verification
- clean-source audit
- final report

Exit criterion: `complete` is mechanically justified and reproducible.

## Acceptance criteria

The autonomous system is ready for an unrestricted run when:

- it never selects dead or handwritten functions
- it uses stable VRAM identity across renames
- it runs each work unit in an isolated Pi session and workspace
- it survives controller and worker crashes
- it never trusts agent claims as completion
- it rejects forbidden source workarounds mechanically
- it never commits unless explicitly authorized
- it can apply and roll back patches transactionally
- it periodically schedules targeted and project refinements
- it parks and later reactivates blocked functions based on changed evidence
- it exposes useful status, logs, cost, pause, resume, and stop controls
- it cannot mark the project complete while pending, parked, or due-refinement work remains
- its final clean regeneration and byte-identity verification pass

## Open decisions before implementation

1. Should autonomous startup require a completely clean tracked tree, or may it preserve a documented operator patch baseline?
2. Should isolated workspaces use git worktrees, disposable clones, or a configurable backend?
3. Is patch integration sufficient, or will the user explicitly authorize autonomous commits?
4. Which normal and escalation models should be configured initially?
5. What are the initial turn, timeout, cost, and retry limits?
6. What exact cadence should targeted and project refinement use?
7. Which existing handwritten or assembler-gap cases belong in the explicit source-policy allowlist?
8. Should blocked mode sleep indefinitely, exit with a special code, or support both daemon and batch behavior?
9. Which files may each worker class modify?
10. What structured JSON changes are required in the existing TypeScript tools before controller implementation begins?

Resolve these in configuration or explicit policy before enabling an unbounded run.
