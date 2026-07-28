# Plan: exact scheduler tie provenance, non-emitting RTL alignment, and target-order counterfactual replay

**Status: completed.** Implemented with schema-v2 target-schedule artifacts,
zero-width-aware final RTL alignment, GCC 2.95.2 legacy `sched.c` comparator
provenance, baseline replay, candidate-DAG legality, bounded target-order
readiness replay, deterministic abstract intervention sets, regression tests,
Pi workflow guidance, and project documentation. For `func_80019070`, all
81 emitted instructions retain unique final UIDs through four zero-width RTL
nodes; the nine-instruction target prologue is DAG-legal and reproducible in
the bounded model through an explicit set of priority and LUID relations while
preserving the intervening already-matching operations.
Tooling verification passes 53/53 tests, Pi extension import, and
`git diff --check`. The repository-wide `make check` remains blocked by the
active, intentionally nonmatching `src/func_80019070.c` worktree state rather
than a tooling/build-system failure.

This is a focused follow-up to the completed
`target-schedule-and-source-shape-search.md` plan. It addresses the remaining
observability gap exposed by `func_80019070`: the target and candidate contain
the same operations and hard-register roles, but stock scheduler dumps did not
previously explain an equal-priority choice precisely enough to drive another
clean-C hypothesis.

## Purpose

Extend the existing compiler-trace and target-schedule tools so they can:

1. retain machine-to-UID correspondence when final RTL contains proven
   zero-width instructions such as empty memory barriers;
2. explain each scheduler selection using its exact observed comparator inputs,
   including pre-scheduler order/LUID and ready-list insertion order;
3. distinguish target-order legality from target-order reproduction;
4. replay a bounded target ordering only after reproducing the baseline block;
5. derive the smallest compiler-state changes that would make the target order
   win, without pretending those changes are source edits.

The intended flow is:

```text
final RTL, scheduler dumps, and emitted assembly
                    |
                    v
       emission-aware UID correspondence
                    |
                    v
        exact baseline tie provenance
                    |
                    v
 target-order DAG legality and bounded replay
                    |
                    v
 confidence-labelled minimal interventions
```

This remains diagnostic tooling. Exact function diff and full object/build
verification remain the only completion gates.

## Motivating case: `func_80019070`

The current source reaches 72/81 instructions. Allocation, delay slots, and
instructions 10–80 match. The remaining nine differences are independent
prologue instructions ordered differently by the scheduler.

Three policy-allowed empty memory barriers are needed to preserve already
solved scheduling windows. They create three `asm_operands/v ("")` RTL
instructions but emit no machine operation. A standalone final `USE` is also
zero-width. Implementation exposed a pre-existing parser omission for
`jump_insn/s`; after fixing it, the honest counts are:

```text
final .mach instruction RTL forms:    85
proven zero-width RTL forms:            4
normalized cc1 machine instructions:   81
```

`attachFinalUids` currently requires equal counts, so it disables positional
UID mapping for the whole function. The scheduler parser also labels
same-priority choices as `luid-or-list-order` without reconstructing which of
those inputs decided the observed order. Counterfactual replay is therefore
marked observational-only exactly where better evidence is needed.

The desired report should instead say, with appropriate confidence:

```text
Emission alignment:
  81 emitted machine instructions mapped to final UIDs
  3 RTL UIDs classified as proven zero-width empty memory barriers

Target-order legality, block 0:
  all nine reordered UIDs preserve the candidate dependency DAG

First scheduler divergence:
  desired UID N was ready at cycle C
  observed UID M won on <exact criterion or unresolved criterion>
  allocation, dependency, latency, and functional-unit state were otherwise equal

Minimal abstract requirement:
  change the pre-sched/LUID relation M:N
  preserve machine indexes 10:80 and all current hard-register assignments
```

The tool must not claim that changing a source statement order will necessarily
change LUID order. It should identify the compiler-state requirement and leave
source-shape testing to the existing finite search tools.

## Scope and non-goals

### In scope

- final RTL emission classification;
- ambiguity-preserving RTL-to-machine sequence alignment;
- exact reconstruction of scheduler comparator inputs available from stock
  dumps and pre-scheduler RTL order;
- observed baseline replay;
- target permutation extraction from machine correspondence;
- DAG legality checks;
- bounded counterfactual replay for supported scheduler blocks;
- minimal abstract tie/dependency/priority interventions;
- typed artifacts, concise rendering, fixtures, and workflow integration.

### Out of scope

- patching or replacing the configured compiler;
- adding compiler flags that change generated code;
- hard-register assignment or register dependency barriers;
- a general MIPS RTL recognizer or assembler implementation;
- random source mutation or unbounded statement permutation;
- automatically writing or promoting a generated candidate into `src/`;
- claiming target RTL dependencies from target machine order alone;
- solving allocator duels, which remain covered by the separate allocator plan;
- changing source-policy rules or broadening permitted inline assembly.

## Design principles

1. **Baseline replay before counterfactual replay.** Never simulate a target
   order in a block whose observed scheduler choices cannot be reproduced.
2. **Legality is not reproduction.** A target order can satisfy the candidate
   DAG without being selected by GCC's comparator.
3. **Zero-width classifications must be proved.** Unknown RTL forms remain
   ambiguous; they are never silently discarded to make counts agree.
4. **No forced correspondence.** Duplicate or weakly identified instructions
   retain candidate UID sets and confidence labels.
5. **Stock compiler evidence only.** Reconstruct the configured compiler's
   algorithm from its dumps and pinned source behavior; do not create an
   instrumented compiler as a second oracle.
6. **Exact, reconstructed, and inferred remain distinct.** Dumped ready lists
   are exact observations; LUID reconstruction is exact only after its model
   reproduces all observed ordering decisions in the relevant block.
7. **Backward scheduling must be explicit.** Reports must distinguish GCC's
   backward selection order from emitted forward machine order.
8. **Abstract interventions are not source mechanisms.** A required LUID
   reversal is a compiler-state fact, not proof that statement reordering will
   produce it.
9. **Exact diff remains the oracle.** A successful replay is diagnostic
   evidence, never promotion eligibility.

---

# Deliverable 1: emission-aware final RTL classification

Extend `rtl-parser.ts` and target-schedule UID correspondence with an explicit
classification for whether a final RTL instruction emits machine code.

Suggested types:

```ts
type EmissionClass =
  | "emits"
  | "zero-width"
  | "unknown";

interface RtlEmission {
  uid: number;
  stage: string;
  classification: EmissionClass;
  reason:
    | "recognized-machine-pattern"
    | "empty-volatile-asm"
    | "use-or-clobber"
    | "unknown-pattern";
  confidence: TraceConfidence;
  evidence: string[];
}
```

## Initial exact zero-width rules

The first release should recognize only forms whose lack of emitted bytes can
be established from both RTL shape and cc1 assembly:

- volatile `asm_operands` with an exactly empty template;
- its associated memory clobber/parallel wrapper when it is part of that same
  empty asm instruction;
- final `use` or `clobber` forms only when the configured backend emits no
  assembly line for the aligned position.

A non-empty asm template, an unrecognized `unspec`, or an unknown parallel must
remain `unknown`. The tool must fail closed rather than treating every asm or
`UNSPEC` as zero-width.

## Emission evidence

For each skipped UID record:

- complete normalized RTL operation/pattern signature;
- final-stage order and basic block;
- nearest source-line note when available;
- the absence of an emitted instruction between its aligned neighbors;
- whether the same UID appears in sched2/dbr/mach.

The ordinary compiler invocation and normalized assembly must remain unchanged.
Diagnostic comments may be evaluated during implementation only if a stock
non-codegen dump option is available and byte comparison proves that stripping
comments yields the identical instruction stream. The implementation must not
depend on such a flag unless that invariant is tested.

---

# Deliverable 2: non-emitting RTL-to-machine alignment

Replace the all-or-nothing equal-count mapping in `attachFinalUids` with a
layered deterministic sequence alignment.

## Alignment layers

1. **Direct emission annotation**, if the stock compiler exposes a verified UID
   annotation without changing machine output.
2. **Proven zero-width filtering**, retaining skipped RTL nodes as explicit
   alignment records.
3. **RTL/machine role signatures** for emitted forms:
   - control, load, store, constant, move, arithmetic, and logical family;
   - hard-register SET/use roles;
   - memory width and stable offset/relocation;
   - immediate value where recoverable;
   - branch/call/return role.
4. **Order-preserving dynamic programming** across final RTL and normalized cc1
   instructions.
5. **Exact unchanged anchors** around mismatch windows.
6. **Ambiguity sets** when duplicate signatures admit more than one UID.

Suggested types:

```ts
interface EmissionAlignmentEntry {
  rtlUid?: number;
  rtlOrder?: number;
  machineIndex?: number;
  kind: "emitted" | "zero-width" | "rtl-only-unknown" | "machine-only";
  score?: number;
  confidence: TraceConfidence;
  evidence: string[];
}

interface MachineUidLink {
  machineIndex: number;
  uid?: number;
  candidateUids: number[];
  confidence: TraceConfidence;
  evidence: string[];
}
```

`MachineInstructionRef.uid` should only be populated when one UID is uniquely
supported. Ambiguous links remain represented in `candidateUids`; downstream
analysis must not select the first candidate silently.

## Alignment validation

The resulting alignment must satisfy:

- every machine index appears exactly once;
- an RTL UID appears in at most one emitted link;
- all skipped UIDs have an explicit classification;
- order is monotonic outside explicitly reported ambiguity windows;
- stripping zero-width nodes from a fully reconstructed alignment yields the
  exact normalized cc1 instruction count;
- canonical machine instructions are still compared by the existing parser,
  not generated from RTL and treated as an oracle.

The old equal-count positional mapping may remain as a high-confidence fast
path, but it must use the same alignment result type.

---

# Deliverable 3: exact scheduler order inputs and tie provenance

Extend `scheduler-dag.ts` to retain all comparator inputs rather than only the
rendered priority and final `now` ordering.

## Compiler-algorithm evidence

Before implementing comparator claims, inspect the exact scheduler implementation
used by the configured compiler and document the applicable ready-list sorting
branches in a research note or code comments with source references. The model
must cover only behavior demonstrated by the pinned compiler version.

At minimum reconstruct:

- pre-scheduler RTL chain order;
- block-local order and candidate LUID relation;
- base priority and reference count;
- displayed priority and single-set birth adjustment;
- ready-list insertion rank before sorting;
- final rank after each printed `now` update;
- launch/blocking/greater-hazard events;
- dependency and latency availability;
- scheduling group or other explicit flags if they affect the comparator.

Suggested types:

```ts
interface SchedulerOrderKey {
  uid: number;
  preScheduleOrder?: number;
  blockOrder?: number;
  luid?: number;
  insertionRank?: number;
  basePriority?: number;
  displayedPriority?: number;
  birthAdjusted: boolean;
  group?: number;
  confidence: TraceConfidence;
  evidence: string[];
}

type TieCriterion =
  | "sole-ready"
  | "priority"
  | "birth-priority"
  | "dependency-availability"
  | "latency"
  | "functional-unit-hazard"
  | "scheduling-group"
  | "luid"
  | "ready-insertion-order"
  | "unresolved";

interface PairwiseSchedulerComparison {
  winnerUid: number;
  loserUid: number;
  criterion: TieCriterion;
  equalCriteria: string[];
  confidence: TraceConfidence;
  evidence: string[];
}

interface SchedulerSelectionExplanation {
  stage: "sched" | "sched2";
  block: number;
  cycle: number;
  selectedUid: number;
  orderKeys: SchedulerOrderKey[];
  decisiveComparisons: PairwiseSchedulerComparison[];
  confidence: TraceConfidence;
  caveats: string[];
}
```

## LUID reconstruction discipline

Do not equate array index with `INSN_LUID` without validation. Reconstruct LUID
from the exact pre-scheduler RTL chain according to the configured compiler's
algorithm, including whether notes, deleted instructions, barriers, and block
boundaries consume order positions.

A block's LUID model is promoted from `reconstructed` to `exact` only when:

1. all required source UIDs are present;
2. the modeled comparator reproduces every observed final `now` order in that
   block;
3. observed birth and hazard events agree with the model;
4. no unknown emission or scheduler form participates in the decision.

If LUID and insertion order are observationally indistinguishable, report the
pair as unresolved rather than selecting one by assumption.

---

# Deliverable 4: baseline scheduler replay gate

Replace the current “selected UID equals `ranked[0]`” check with a real bounded
baseline replay.

For each supported block, replay:

- initial dependency counts;
- backward ready-set membership;
- candidate release after a selection;
- dependency cost and load latency where represented;
- cycle advancement and launch/blocking events;
- comparator ordering from Deliverable 3;
- final forward order as the reverse of backward selection where applicable.

Suggested result:

```ts
interface BaselineReplayResult {
  stage: "sched" | "sched2";
  block: number;
  status: "exact" | "partial" | "failed";
  matchedSelections: number;
  totalSelections: number;
  matchedReadySets: number;
  firstDivergence?: string;
  unsupportedFeatures: string[];
  confidence: TraceConfidence;
  evidence: string[];
}
```

## Bounded support tiers

The first implementation should be honest rather than pretending to reproduce
every scheduler feature:

1. **Tier A — independent tie window:** all relevant UIDs are co-ready, no
   resource events occur, and the comparator alone decides their order.
2. **Tier B — dependency release:** true/anti/output edges and represented
   latency costs alter readiness, but no unsupported functional-unit behavior
   occurs.
3. **Tier C — observed resource events:** launch/blocking events are replayed
   only where the dump contains enough information to determine their effect.
4. **Unsupported:** scheduling groups or backend hazards lacking sufficient
   state remain observational-only.

Counterfactual replay is permitted only for `status: "exact"` within the
implemented tier. Partial baseline reproduction may still render diagnostics,
but it cannot produce a “target reproducible” verdict.

---

# Deliverable 5: target-order extraction and DAG legality

Use target/candidate machine correspondence plus unique machine/UID links to
construct a desired candidate-UID permutation for each mismatch block.

## Preconditions

A target-order window is suitable only when:

- target and candidate contain the same uniquely corresponding operation set;
- every participating candidate machine instruction has one UID;
- all UIDs belong to one scheduler block and stage;
- allocation and operand-role differences are either absent or separately
  excluded;
- delayed-branch movement is not being mistaken for sched1/sched2 movement;
- no unmatched target instruction is forced into the permutation.

## Legality analysis

Check the desired forward and backward order against every candidate DAG edge.
Report:

```ts
type TargetOrderLegality =
  | "legal-under-candidate-dag"
  | "violates-candidate-dependency"
  | "ambiguous-correspondence"
  | "cross-block"
  | "wrong-stage"
  | "unsupported";

interface TargetOrderConstraint {
  beforeUid: number;
  afterUid: number;
  source: "target-machine-order" | "candidate-dependency";
  confidence: TraceConfidence;
  evidence: string[];
}
```

“Legal under candidate DAG” means only that the candidate dependencies do not
forbid the target order. It does not imply that GCC would select it or that the
target had the same RTL graph.

---

# Deliverable 6: bounded target-order counterfactual replay

Starting from an exact baseline replay, request the uniquely mapped target UID
at each backward scheduling cycle and simulate the resulting state transition.

At every divergence classify the desired UID:

1. selected already;
2. ready but loses a comparator tie;
3. not ready because of a named dependency;
4. delayed by represented latency;
5. blocked by a functional-unit event;
6. absent or ambiguous.

Suggested types:

```ts
interface CounterfactualStep {
  cycle: number;
  observedUid?: number;
  desiredUid?: number;
  desiredReady: boolean;
  outcome:
    | "same"
    | "tie-lost"
    | "dependency-blocked"
    | "latency-blocked"
    | "resource-blocked"
    | "ambiguous";
  decidingCriterion?: TieCriterion;
  blockers: number[];
  evidence: string[];
}

interface TargetOrderReplay {
  stage: "sched" | "sched2";
  block: number;
  legality: TargetOrderLegality;
  status:
    | "reproduced-with-current-state"
    | "reproducible-with-interventions"
    | "impossible-under-current-dag"
    | "baseline-not-exact"
    | "unsupported";
  steps: CounterfactualStep[];
  confidence: TraceConfidence;
  caveats: string[];
}
```

The replay must recompute later ready sets after every forced choice. It may not
reuse the rest of the observed ready-list transcript as if the earlier choice
had not changed scheduler state.

For an independent Tier A window, this primarily tests comparator order. For a
Tier B window, it must update dependency release and latency before making a
claim. Unsupported resource behavior terminates the counterfactual at the
first affected cycle.

---

# Deliverable 7: minimal abstract intervention synthesis

For a target order that is DAG-legal but not selected, produce a bounded set of
compiler-state requirements.

Supported intervention families:

- reverse one LUID/pre-scheduler order relation;
- reverse one ready-insertion relation;
- raise or lower one base-priority relation;
- enable or disable one birth-priority adjustment;
- add or remove one natural dependency edge;
- change one represented lifetime endpoint that creates an anti/output edge;
- alter one resource/hazard relation only when exact evidence exists.

Suggested type additions:

```ts
type SchedulerInterventionKind =
  | "luid-order"
  | "ready-insertion-order"
  | "priority-relation"
  | "birth-eligibility"
  | "dependency-add"
  | "dependency-remove"
  | "lifetime-endpoint"
  | "resource-relation";

interface SchedulerInterventionSet {
  interventions: AbstractIntervention[];
  targetReplayStatus: TargetOrderReplay["status"];
  changedSteps: number[];
  preservesObservedConstraints: string[];
  minimalWithinBound: boolean;
  confidence: TraceConfidence;
  evidence: string[];
}
```

Search intervention sets in deterministic size order and stop at the configured
`maxInterventions`. Minimize compiler-state changes, not source syntax. If both
LUID and insertion order explain the same observed choice, emit separate
alternatives or one explicitly ambiguous alternative.

Recommendations may map an exact requirement to existing mechanism families
such as `statement-birth-order`, `constant-birth-site`, or
`single-vs-multi-set`, but the mapping remains inferred until a complete source
variant demonstrates the predicted pass change.

---

# Deliverable 8: schema, artifacts, and rendering

Bump the target-schedule artifact schema and extend, rather than replace, the
existing report.

Suggested additions to `TargetScheduleAnalysis`:

```ts
interface TargetScheduleAnalysis {
  /* existing fields */
  emissionAlignment: EmissionAlignmentEntry[];
  machineUidLinks: MachineUidLink[];
  schedulerSelections: SchedulerSelectionExplanation[];
  baselineReplay: BaselineReplayResult[];
  targetOrderConstraints: TargetOrderConstraint[];
  targetOrderReplays: TargetOrderReplay[];
  interventionSets: SchedulerInterventionSet[];
}
```

Artifacts remain under:

```text
build/targetSchedule/<function>/
├── analysis.json
├── summary.txt
├── target.json
├── candidate.json
├── correspondence.json
├── emission-alignment.json
├── scheduler-ties.json
└── counterfactual-replay.json
```

The schema validator must reject unsupported newer versions. The source-shape
search consumer must either support both the previous and new schema explicitly
or fail with a clear regeneration message. Resume checkpoints must include the
analysis schema and content hash so stale requirements cannot be reused.

## Human report priorities

Keep the default output bounded:

1. emission alignment summary and ambiguities;
2. baseline replay status by block/stage;
3. first target-order divergence;
4. exact or unresolved tie criterion;
5. target DAG legality;
6. smallest intervention sets;
7. preservation ranges and caveats.

A focused block should show pairwise comparator values, but not dump every RTL
form into model context. Full evidence remains in JSON and raw trace artifacts.

---

# Implementation layout

Extend existing modules rather than creating a parallel parser or compiler
pipeline:

```text
tools/agent/compiler-trace/
├── rtl-parser.ts                 add emission signatures/classes
├── scheduler-dag.ts              retain comparator inputs and events
├── scheduler-order.ts            LUID/order reconstruction and comparisons
├── render-text.ts                focused exact tie provenance
└── types.ts                      typed trace additions

tools/agent/target-schedule/
├── uid-correspondence.ts         replace equal-count all-or-nothing mapping
├── emission-alignment.ts         zero-width-aware sequence alignment
├── scheduler-replay.ts           exact baseline replay gate
├── target-order.ts               desired UID permutation and DAG legality
├── counterfactual-replay.ts      bounded alternative scheduler execution
├── intervention-search.ts        minimal tie/dependency intervention sets
├── render-text.ts                bounded report
├── artifacts.ts                  versioned output
└── types.ts                      schema additions

tools/agent/analyzeTargetSchedule.ts
                                  orchestration only
```

Do not duplicate assembly normalization, RTL parsing, compilation, source
policy, or artifact path logic.

## CLI and Pi wrapper

Keep the existing command usable:

```bash
npx tsx tools/agent/analyzeTargetSchedule.ts func_80019070
npx tsx tools/agent/analyzeTargetSchedule.ts func_80019070 --block 0
npx tsx tools/agent/analyzeTargetSchedule.ts func_80019070 --max-interventions 3
```

If additional controls are needed, prefer bounded options such as:

```text
--replay-stage sched|sched2
--scheduler-window <start:end>
```

The Pi wrapper should expose only validated function, block, stage, window, and
intervention bounds. It must not accept shell fragments, compiler flags, source
text, or promotion options.

---

# Phased implementation

## Phase 0: scheduler algorithm evidence

1. Identify the exact ready-list comparator and LUID initialization behavior in
   the configured compiler source.
2. Document which notes/forms consume LUID positions.
3. Record birth-priority and hazard ordering relative to the comparator.
4. Create small stock-dump fixtures for every supported comparator branch.
5. Mark any backend/resource behavior not recoverable from dumps as unsupported.

## Phase 1: emission-aware UID links

1. Parse final RTL emission signatures.
2. Implement exact empty-memory-barrier classification.
3. Add monotonic RTL/machine sequence alignment with ambiguity sets.
4. Replace the equal-count mapping gate.
5. Add the `func_80019070` 85-RTL/4-zero-width/81-machine regression fixture.

This phase alone restores useful UID and pseudo evidence for the current source.

## Phase 2: exact tie provenance

1. Reconstruct pre-scheduler order and LUID candidates.
2. Retain insertion, priority, birth, group, and hazard inputs.
3. Implement pairwise comparator explanations.
4. Validate every explanation against observed final `now` ordering.
5. Downgrade indistinguishable LUID/list cases instead of guessing.

## Phase 3: baseline and target replay

1. Implement Tier A independent-window baseline replay.
2. Add target UID permutation extraction and DAG legality.
3. Add Tier A counterfactual replay.
4. Implement Tier B dependency release and represented latency.
5. Gate resource-event replay on complete evidence.

Tier A is the minimum useful counterfactual release for `func_80019070`.

## Phase 4: interventions and integration

1. Search bounded minimal compiler-state intervention sets.
2. Render concise target-order explanations.
3. Bump and validate artifact schemas.
4. Update source-shape analysis consumption and checkpoint hashes.
5. Update the Pi wrapper, decompilation skill, README, and tools note.
6. Add motivating-function text fixtures without committing generated objects.

---

# Test plan

Use committed text fixtures and synthetic typed inputs. Do not commit compiler
objects, binaries, or generated `build/` artifacts.

## Emission classification

- one ordinary emitted RTL instruction;
- an empty volatile asm memory barrier classified zero-width;
- three barriers interleaved with 81 emitted instructions;
- non-empty asm remains unknown;
- unknown `UNSPEC` remains unknown;
- a parallel containing both emitted and zero-width forms is not discarded;
- source-line and basic-block metadata survive classification.

## RTL/machine alignment

- equal-count positional fast path;
- 85 RTL forms aligned to 81 machine instructions after four proved skips;
- duplicate identical moves produce an ambiguity set;
- immediate, memory width, offset, and branch role disambiguate neighbors;
- unknown RTL-only form prevents an exact global claim but preserves exact
  anchors on both sides;
- no UID is assigned twice;
- relocation-bearing machine instructions retain their relocation identity.

## Scheduler order provenance

- sole-ready selection;
- unequal base priority;
- displayed birth-priority boost;
- equal priority decided by modeled LUID;
- equal priority where LUID and insertion order are indistinguishable;
- greater-potential-hazard reordering;
- blocking/launch event;
- scheduling group if supported;
- observed `now` order contradicting the model downgrades the whole block.

## Baseline replay

- independent Tier A block reproduces exactly;
- dependency release changes the next ready set;
- load latency delays a consumer;
- backward selection reverses to the expected forward order;
- missing selected UID fails at the exact cycle;
- unsupported resource state produces `partial`, never `exact`;
- a partial block cannot enter counterfactual replay.

## Target-order analysis

- same UID multiset in a different legal order;
- target order violating a true dependency;
- target order violating an anti/output dependency;
- cross-block permutation rejected;
- delay-slot-only movement assigned to dbr, not sched2;
- ambiguous machine/UID correspondence prevents replay;
- target register-role mismatch is not misclassified as ordering.

## Counterfactual replay

- desired UID already selected;
- desired UID ready but loses on LUID;
- desired UID not ready because of a named dependency;
- forcing an earlier choice recomputes all later ready sets;
- one LUID relation makes an independent target order reproducible;
- multiple interventions are tested in deterministic cardinality order;
- intervention bound truncation is reported;
- unsupported hazards terminate replay without a false success.

## Motivating regression

Commit reduced text fixtures representing the current `func_80019070` trace:

- 81 normalized machine instructions;
- 85 final RTL instruction forms;
- three empty volatile asm barriers and one standalone zero-width `USE`;
- exact machine/UID links for all 81 emitted instructions;
- exact hard-register roles;
- exact preservation range 10–80;
- nine reordered prologue instructions in one block;
- target order legal under the candidate DAG;
- baseline Tier A replay exact, if the stock dump supports that conclusion;
- first losing comparator relation and minimal interventions reported with the
  strongest defensible confidence.

If the real trace does not satisfy Tier A after implementation, the fixture must
record the unsupported feature rather than weakening the gate to force the
expected result.

---

# Acceptance criteria

- Empty memory barriers no longer disable all machine/UID correspondence.
- Every skipped final RTL UID has a proved zero-width classification or remains
  explicitly unknown.
- Duplicate/ambiguous instructions never receive a silently guessed UID.
- Scheduler decisions report the observed comparator inputs and either a
  validated decisive criterion or `unresolved`.
- LUID claims reproduce every observed ready-list ordering in the analyzed
  block before receiving exact confidence.
- Baseline replay models ready-set evolution rather than checking only
  `ranked[0]`.
- Counterfactual replay never runs on a partial or failed baseline block.
- Target DAG legality is reported separately from target scheduler
  reproducibility.
- Forced target choices recompute subsequent scheduler state.
- Minimal intervention sets are bounded, deterministic, confidence-labelled,
  and expressed as compiler-state requirements rather than source edits.
- `func_80019070` receives complete UID links through its three zero-width
  barriers and a concrete explanation of the nine-instruction prologue tie, or
  an explicit unsupported-state report identifying the exact missing evidence.
- Existing allocation and delay-slot analyses continue to work.
- Generated artifacts remain under `build/`; no tool modifies `src/` or promotes
  a candidate.
- Unit tests, Pi extension import, exact function checks, source-policy checks,
  and the repository's full verification gate pass before completion is
  reported.

## Recommended cut lines

- **Minimum observability release:** Phases 0–2. Restores UID links and explains
  observed scheduler ties.
- **Current-function release:** Tier A of Phase 3. Determines whether the
  `func_80019070` target prologue is reachable by tie-order changes alone.
- **Reusable replay release:** Tier B plus Phase 4. Supports dependency-release
  windows and emits bounded minimal intervention sets for future functions.
