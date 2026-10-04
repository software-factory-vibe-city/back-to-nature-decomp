# Validation — backtest both sessions and measure harness improvement

Status: **planned**. Existing artifact replays establish defects in the old path;
they do not establish savings from an implementation that does not yet exist.

This validates [Task 1](01-context-and-handoff.md) independently, then measures
[Task 2](02-declaration-integration.md) as an optional incremental addition.

## 1. Questions and experiment arms

Answer three different questions without conflating them:

1. **Historical reproduction:** what did the agent actually receive, change,
   compile and finalize in each session?
2. **Static counterfactual:** given only information available at that attempt's
   start, does the proposed preparation produce a better starting point than
   the old path and the agent's observed initial drafts?
3. **Harness counterfactual:** with the same agent configuration and budget, does
   that starting point reduce total time/tokens or improve solved outcomes?

| Arm | Purpose |
|---|---|
| H: recorded historical run | Observed outputs, trajectories and cost; not a rerun |
| C: pinned existing pipeline + controlled agent | Paired control, including old repair where that pipeline actually invokes it |
| A: Task 1 + same controlled agent | Faithful context, prepared m2c handoff, exact-match fast path, **no repair** |
| B: Task 1 + Task 2 + same controlled agent | Incremental effect of declaration integration |

Artifact-only C/A/B comparisons come before expensive agent runs. Preserve the
old implementation in an isolated pinned historical checkout for C; it must not
remain an executable fallback in the production tree after Task 1.

A draft compiling or matching earlier is useful evidence. It does not prove the
agent would have saved every preceding tool call or second of the old session.
Only controlled agent runs support that end-to-end claim.

## 2. Cohort and input identities

Use both exact user-selected session files:

```text
~/.pi/agent/sessions/--home-dave-Documents-code-btn-decompilation--/2026-10-04T07-32-28-677Z_01a105d4-1985-7664-8d15-efa4eed70e6f.jsonl
~/.pi/agent/sessions/--home-dave-Documents-code-btn-decompilation--/2026-10-03T20-23-15-805Z_01a1036f-6a5d-7202-b5ce-034cef59c181.jsonl
```

For readability, call these S1 and S2 respectively. S2 occurred first.

The planning-stage physical-record census is:

| Item | S1 | S2 |
|---|---:|---:|
| JSONL records | 12,356 | 6,861 |
| Assistant messages | 5,378 | 2,952 |
| Tool calls | 6,462 | 3,609 |
| `psx_m2c` calls | 27 | 6 |
| `psx_repair_m2c` calls | 15 | 1 |
| `psx_finalize_function` calls | 168 | 100 |

These are calls/messages, **not unique attempts or successful finalizations**.
The detailed S1 investigation identified 170 attempts and 167 successful
model-facing finalizations; do not infer an S2 attempt/success count from its
physical-record totals.

Session SHA-256 identities at planning time:

```text
S1 c2a78cd1726f04d8de3c70bfb7b1c844723055ac27b2bb2b602ad6c57b05236c
S2 90330cff7b1d1dfbf2ef91ff84963b35a6db3f2fadc88730a7c0aa544ade7563
```

Record identity drift explicitly if either session is later appended or changed.
Preserve frozen inputs rather than quietly substituting the current file.

The main cohort is **every attempted function**, including functions that never
used m2c, failed, were parked, resumed or exhausted a budget. Retain queued-but-
unstarted targets separately. Report per-attempt and unique-function results;
retries are not independent additional successes.

## 3. Turn the investigation scripts into reproducible evidence tooling

Existing investigation artifacts and scripts are under
`build/investigation/static-drafts/`; the detailed provenance is documented in
`notes/research/static-decompilation-session-2026-10-04.md`.

Reusable starting points:

- `extract.ts`: calls/results and initial target attribution; currently hardcoded <!-- doc-ref-ignore: local ignored investigation script in the directory above -->
  to S1, not a general session-backtest CLI.
- `recover.ts`: raw draft recovery, timelines and surviving artifact snapshots. <!-- doc-ref-ignore: local ignored investigation script -->
- `replay.ts`: compiler replay of preserved historical preprocessed inputs. <!-- doc-ref-ignore: local ignored investigation script -->
- `ast-evidence.ts`, `probe-repairs.ts`, `context-probe.ts`: focused reproductions <!-- doc-ref-ignore: local ignored investigation scripts -->
  of declaration, repair and context failures.

Promote reusable logic into tested TypeScript under the existing diagnostics/
library structure. Do not check in private full sessions, generated binaries or
hardcoded home-directory paths. Store immutable runs and large artifacts under
`build/`; check in only redacted fixtures, schemas and concise reports.

### Extractor requirements

- Accept multiple explicit session paths and produce hash-keyed manifests.
- Parse entry IDs, parent/branch relationships, tool-call IDs, results, timestamps,
  model settings and usage. Distinguish branch visits, resumed attempts, solver
  turns and documentation turns; do not merely scan all lines as one live path.
- Recognize target selection from controller messages with explicit ambiguity
  states. Normalize wrapped/namespaced tool calls and shell invocations without
  counting a tool's textual mention as its execution.
- Recover observed raw/repaired drafts, first handwritten drafts, subsequent
  measurements and final source plus accompanying declaration/header changes.
- Preserve full text and JSONL references; distinguish observed output from
  recreated output, scratch files from live files, and successful process exit
  from successful compilation or finalization.
- Classify truncated/missing results as incomplete evidence. Do not execute
  arbitrary historical shell commands to reconstruct their effects.
- Record unrelated work and changes outside the target source: useful header
  discovery often precedes the first detected function-body edit.

Test shuffled/delayed results, multiple tool calls in one message, duplicate
returns, branch navigation, partial writes, failed writes, missing results,
truncation and a queued target with no assistant response. Hand-audit a sample
and all ambiguous attempt boundaries before treating totals as a benchmark.

## 4. Reconstruct history without future-knowledge leakage

For each attempt, freeze the state immediately before its initial preparation:

- Target bytes/assembly/data and active project/container/toolchain configuration.
- Known source, declarations, SDK inputs, global aliases and ownership facts.
- Available matched signatures/types/donors and their actual verification state.
- Relevant notes, grouping evidence, ledgers and recovered-artifact overlays.
- Current target source: stub, partial attempt or resumed work.

Prefer a verified repository snapshot plus recorded dirty changes. Where needed,
replay observed file edits against known bases with hash checks. Never assume
mtime alone proves historical content, or that a session filename identifies the
precise repository state. Missing base content makes reconstruction incomplete.

Assign separate reproducibility statuses:

1. **Historical output observed:** exact draft/result appears in the session.
2. **Compiler replayable:** preserved `.i` freezes its actual compiler input.
3. **m2c replayable:** assembly, context, invocation and decompiler revision are
   recoverable together.
4. **Full attempt replayable:** repository/build inputs and relevant starting
   agent knowledge can be restored in isolation.

A `.scope.i` file can reproduce compiler failure but does not reconstruct the
original m2c context. Current declarations cannot fill that gap unnoticed.
Report unreplayable cases in the cohort and analyze them separately; a clearly
labelled current-context sensitivity run is permitted, not a historical result.

### Availability rules

- Original binary evidence, configured SDK and original related assembly are
  permitted static inputs, including functions the agent had not decompiled.
- Game C/types/signatures/donors become available only when they were known at
  the relevant point. Later matched code is not initial context.
- A target's eventual C and associated final header patch are expected-result
  artifacts accessible to the evaluator, **not the preparing tool or agent**.
- Apply the same restrictions to generated context, recovered overlays, caches,
  idiom/family indexes, notes, ledgers and prior experiment artifacts. Clearing
  one header while leaving a future donor cache is not a cold evaluation.
- SDK/callee truth must retain its independent provenance; do not launder a
  later inferred declaration through a generated header.

Use isolated workspaces with only the allowed inputs available to tools/agents,
not a working directory that can accidentally read the modern target source or
session answer files. Audit file access where practical. Keep compiler/byte
oracles and private expected results outside agent-readable evidence.

## 5. Historical baseline and static counterfactual

### Historical reconstruction

For each attempt, report the observed timeline:

```text
selection → preparation/context discovery → first generated/handwritten draft
    → first compile → first compiling candidate → residual iterations
    → model-facing finalization → controller gate → documentation
```

A missing stage stays missing. Compare the actual code the agent produced, not
just a final tool verdict: raw m2c, repaired draft where observed, first agent
rewrite, first compiling candidate and final accepted source, including the
declaration changes each required.

S1 already provides a useful replay gate: 14 preserved raw repair inputs all
fail compilation, while 11 preserved repaired compiler inputs reproduce nine
failures and two mismatches. Reproduce these before trusting the generalized
replay harness. They are a selected repair cohort, not an overall failure rate.

### Frozen per-attempt preparation experiment

On each fully eligible attempt-start snapshot, run:

1. Pinned old preparation, measuring raw m2c separately from old repair.
2. Task 1 preparation with the same available knowledge.
3. Task 1 plus declaration integration, with identical upstream inputs.

Preserve source/context/preprocessed/object hashes, full diagnostics, unsupported
reasons, staged residual and byte verdict. Record body changes separately from
declaration-only changes; compile success alone can conceal ABI or pointer
arithmetic errors.

Compare the new seed against both the old generated seed and the agent's observed
first draft. When the historical first draft relied on discoveries made later
in that attempt, preserve its actual context and timing as an observational
reference; do not pretend that knowledge was free at the starting snapshot.
A separate common-context comparison may isolate source quality, but must name
that intervention and cannot count it as measured harness savings.

Raw exact candidates must still survive integrated source policy/scope and full
build gates. A successful build containing the untouched original assembly
stub is not evidence that the candidate finalized. If a full historical build
cannot be reconstructed, report byte-exact-only evidence and withhold the full
finalization claim.

### Two distinct chronology modes

- **Fixed attempt snapshots:** each function starts from its historical known
  state. Best for paired attribution of preparation changes.
- **Sequential campaign replay:** begin from the recoverable historical starting
  state and let each arm publish only its own accepted results. Use the recorded
  target order for attribution, counting failures and missing prerequisites.
  This measures cascading context improvements and failures.

Do not borrow historical successful discoveries into a sequential arm that did
not produce them. Report a natural-worklist campaign separately if also tested.
For cross-session sequential replay, respect S2-before-S1 ordering and verify the
intervening state; do not assume the two files are one uninterrupted campaign.

## 6. Controlled agent experiments

Run C versus A first; add B only once A is stable. Use the same isolated starting
snapshot, target order, tool permissions, solver model/provider version,
thinking settings, turn/time/token budgets and final gates. Keep documentation
model/settings and cache policy consistent too.

Pin the tested implementation/prompt versions and capture their complete config.
The historical census names `runinfra/deepseek-v4-1-flash`; verify availability
and settings rather than assuming a matching name reproduces the old service.
If it is unavailable, run a controlled current-model C/A/B comparison and label
it as such; it cannot establish exact historical counterfactual behavior.

Randomize arm order and use repeated runs where model nondeterminism matters.
Predeclare the number of repetitions, affordable paired subset if needed, and
strata before inspecting outcomes. All static cases still remain in the full
cohort; a paired subset cannot silently become the denominator for a claim
about every function.

The agent remains open-ended, with normal discovery/rewrite tools. Preparation
changes what it starts with, not its authority to investigate a wrong premise.
Do not tell it the historical final answer or constrain it to the proposed draft.

Measure the actual fast path: finalized static matches must use zero solver
turns, but preparation, full gate and documentation costs still count. Failed
finalization must become a normal evidence-bearing agent attempt, not disappear
from the results. Test the path independently with exact/non-exact fixtures so
its correctness does not depend on a lucky benchmark function.

## 7. Development versus validation

S1 has already been examined in detail and is a development/regression set,
not a blind holdout. Before further semantic inspection of S2:

1. Freeze its manifest and predeclare the evaluation protocol.
2. Identify cross-session duplicates/families using permitted target-side facts.
3. Mark overlapping cases as non-independent and report them separately.
4. Use the remaining S2 cases as held-out validation for changes developed on S1.

The planning census read only S2 record/tool/model counts; it did not classify
its draft failures. Once S2 results guide a fix, that subset becomes development
data. Record the transition and require a fresh unseen cohort for any subsequent
claim of generalization. Still report both complete user-requested sessions.

## 8. Metrics and success criteria

Report per session, per arm, by container and useful difficulty/failure strata,
with all attempted cases and their terminal outcomes visible.

### Correctness and seed quality

- Generation, destination-context compilation, unresolved/conflict and unsupported
  rates, with complete denominators and replayability coverage.
- Staged per-block residuals, including population/CFG differences before
  allocation/scheduling differences; no ranking by raw byte-match percentage.
- Relocated-byte exact candidates versus actually full-gate-finalized functions.
- Incorrect ABI slots, pointer scaling, fabricated declarations and false merges.
- Previously matched dependents preserved after shared declaration changes.
- Solver success, parked/failed/budget-exhausted and documentation-pending outcomes.

### Agent and runtime cost

- Static preparation and optional integration wall time, cold and warm.
- Time to measured usable seed, first agent experiment, first compile and full
  finalization; median, tail and aggregate costs, not successful cases alone.
- Total tool calls, classified discovery/declaration calls, source edits,
  compilations, solver turns, escalations and documentation work.
- Provider usage: input, cache read/write, output and reasoning categories, using
  provider-specific accounting. Reasoning included within output must not be
  counted twice. Report missing usage explicitly; do not estimate it from text
  length and present it as measured provider usage.
- Total end-to-end cost including preparation, retries, final gates and
  documentation. Failed attempts remain charged; report cost per attempted
  function as well as per finalized function.

Define the discovery/declaration-call taxonomy before classifying savings. A
header read may be real semantic discovery, not rote work. Hand-audit that
classification and keep ambiguous calls separate. Historical time before the
first source edit is an observation, not an “avoidable time” total.

### Predeclared release decision

Before implementation tuning, freeze numeric practical-improvement thresholds,
repetition count, confidence/non-inferiority rules and permitted preparation
latency in a versioned evaluation manifest, using the reproduced baseline to
choose meaningful values. Do not choose a threshold after seeing the new arm.

Hard gates are unconditional:

- Zero false finalizations or accepted source-policy/scope violations.
- Zero accepted false merges/fabricated facts and zero collateral loss of known
  matches from automatic declaration publication.
- No future-context leakage in results labelled historical/cold.
- Every eligible failure, timeout and unreplayable case remains accounted for.
- Task 1 works independently and has no active repair path.

A passes the harness objective only if paired runs meet the predeclared solve-
outcome non-inferiority condition and materially reduce end-to-end cost or improve
solved outcomes under the same budget. B must demonstrate incremental benefit
over A. Report trade-offs and uncertainty; compile-rate gains alone do not meet
either criterion. If confidence is insufficient, the conclusion is inconclusive,
not a default rollout recommendation.

## 9. Deliverables and execution order

1. Tested multi-session extractor; frozen manifests and coverage/ambiguity report.
2. Reproduced historical artifact baseline and per-attempt knowledge snapshots.
3. Versioned preregistration of thresholds, strata and agent-run budgets.
4. Task-1-only static report and regression fixtures, including unknown cases.
5. Paired C/A agent report with actual final-gate and documentation costs.
6. Optional A/B declaration report, including merge refusals and dependent checks.
7. Sequential replay report if its historical starting state is recoverable.
8. Concise checked-in conclusions with links to local artifact manifests and
   reproducible commands; no private raw sessions or extracted/generated binaries.

No backtest writes into the live source/header tree, invokes automatic commits,
or changes production configuration. Run relevant diagnostics/controller tests,
TypeScript checks, documentation-reference checks and full configured build gates
for the implementation itself. Historical and controlled-run gates execute in
their own isolated workspaces and must not borrow current live build outputs.
