# Plan: target-schedule analysis and deterministic source-shape search

**Status: completed.** Implemented with versioned analysis/search schemas, deterministic artifacts, tests, bounded Pi wrappers, and workflow documentation. This plan adds two complementary tools:

1. `tools/agent/analyzeTargetSchedule.ts` — convert a target/candidate mismatch
   into machine-checkable scheduler, allocator, and delay-slot requirements;
2. `tools/agent/searchSourceShapes.ts` — exhaustively evaluate a finite,
   explicitly justified grammar of clean-C source shapes against those
   requirements.

The implementation must extend the existing compiler-trace and variant-lab
modules rather than creating another compiler parser or compilation pipeline.

## Purpose

Some functions reach a state where semantics and instruction selection are
largely correct, but exact matching depends on several coupled GCC 2.95.2
mechanisms:

- sched1 backward ready-list selection;
- single-set birth-priority boosts;
- pseudo lifetime and global allocno order;
- hard-register conflicts introduced by allocation;
- sched2 anti/output hazards;
- delayed-branch candidate eligibility.

At that point, manually writing and compiling complete variants is slow, while
blind source mutation is both inefficient and contrary to project policy. The
new tools should split the problem into two stages:

```text
target + compiler trace
        |
        v
abstract compiler-state requirements
        |
        v
finite mechanism-backed source-shape search
        |
        v
preserved full-C hypotheses and exact candidates
```

The tools are diagnostic and experimental only. They must not patch GCC,
assign hard registers, generate inline assembly, alter compiler flags, mutate
`src/`, or promote a candidate automatically.

## Motivating case: `func_80019070`

The current clean source produces 81 instructions, matching 68 exactly. The
remaining differences are tightly localized:

- block 0 has the right operations but the wrong order;
- `move t3,a0` is chosen for the first branch delay slot instead of
  `srl a2,a2,4`;
- the low-nibble and arg9 live ranges receive `$t7` and `$t6`, respectively,
  while the target requires the reverse;
- the official `setSemiTrans` source shape fixes the second branch schedule,
  but its CFG changes the allocator ordering of those two long-lived values.

The current tools expose the evidence, but the operator must manually derive
requirements such as:

```text
sched1/sched2:
  move(ptr) must land before the arg2 chain, not next to the branch

dbr:
  srl(arg2,4) must be the first eligible instruction above the branch

greg:
  low-nibble role must allocate before arg9 role
  desired assignments: low-nibble -> t6, arg9 -> t7

preservation:
  the already-correct setSemiTrans branch window and matching suffix must not regress
```

The first tool should derive and serialize those requirements. The second
should search only source transformations predicted to affect them.

## Design principles

1. **Exact diff remains the oracle.** Counterfactual analysis and goal
   satisfaction are evidence, not completion gates.
2. **Mechanism before percentage.** Rank whether a predicted scheduler or
   allocator change occurred before raw instruction-match count.
3. **Finite and deterministic search only.** No random mutation, genetic
   search, percentage hill climbing, or unbounded statement permutation.
4. **Explicit semantic invariants.** Every search dimension must state why its
   alternatives preserve behavior.
5. **Compiler-state changes, not syntax novelty.** Deduplicate variants that
   become equivalent at preprocessing, RTL, combine, or final assembly.
6. **Confidence labels are mandatory.** Dumped UIDs, assignments, ready lists,
   and dependencies are exact observations; inferred target correspondences
   and counterfactual effects must remain labelled reconstructed or inferred.
7. **No source mutation.** All generated complete C files and reports belong
   under `build/`.
8. **No alternate toolchain path.** Reuse `decompToolchain.ts`; full-mode
   candidates must use the configured compiler, assembler shim, assembler,
   and flags.

---

# Tool 1: `analyzeTargetSchedule.ts`

## Responsibilities

Given one function, the tool should:

1. obtain or reuse its compiler trace;
2. align target machine instructions with candidate machine instructions;
3. connect candidate machine instructions back to GCC UIDs and pseudos;
4. identify target order, register-role, and delay-slot requirements;
5. replay the observed scheduler decisions before attempting counterfactuals;
6. search a bounded set of abstract compiler-state interventions;
7. emit typed JSON plus a concise human report.

Suggested CLI:

```bash
npx tsx tools/agent/analyzeTargetSchedule.ts func_80019070
npx tsx tools/agent/analyzeTargetSchedule.ts func_80019070 --block 0
npx tsx tools/agent/analyzeTargetSchedule.ts func_80019070 --max-interventions 3
npx tsx tools/agent/analyzeTargetSchedule.ts func_80019070 --json
```

Artifacts:

```text
build/targetSchedule/<function>/
├── analysis.json
├── summary.txt
├── target.json
├── candidate.json
└── correspondence.json
```

## Deliverable 1: target/candidate/UID correspondence

The existing normalized assembly comparison is index-oriented. Scheduling
analysis needs a stable relationship among:

- target machine index;
- candidate machine index;
- final `.mach` or `.dbr` UID;
- predecessor UIDs in `.sched2`, `.sched`, and earlier passes;
- pseudo and hard-register roles.

### Alignment strategy

Use a layered deterministic alignment:

1. exact canonical instruction and relocation matches;
2. opcode plus normalized operand-role matches;
3. consistent target-to-candidate hard-register rename maps;
4. order-preserving LCS for unchanged regions;
5. bounded bipartite matching inside mismatch windows;
6. ambiguity reporting when duplicate instructions cannot be distinguished.

Do not force a correspondence merely to make the report complete.

Suggested types:

```ts
interface MachineInstructionRef {
  index: number;
  canonical: string;
  mnemonic: string;
  operands: string[];
  uid?: number;
  block?: number;
}

interface InstructionCorrespondence {
  targetIndex: number;
  candidateIndex?: number;
  candidateUid?: number;
  confidence: TraceConfidence;
  evidence: string[];
}

interface RegisterRoleMap {
  targetRegister: string;
  candidateRegister: string;
  targetIndexes: number[];
  candidateIndexes: number[];
  pseudos: number[];
  confidence: TraceConfidence;
}
```

The correspondence layer should be reusable by compiler trace, structural diff,
and source-shape search.

## Deliverable 2: scheduler replay

Build a replay engine for sched1 and sched2 using the existing parsed
`SchedulerStage` data.

### Baseline validation

Before producing a counterfactual claim, replay every decision in the selected
basic block and compare it with the dump:

- dependency readiness;
- base priority;
- birth-priority adjustment;
- backward selection order;
- LUID/list ordering where recoverable;
- R3000 functional-unit hazard reranking;
- launch and blockage events.

A block is counterfactual-eligible only if replay reproduces its observed
selection sequence. If an inferred tie-break cannot be reproduced, report the
block as observational only.

Suggested result:

```ts
interface SchedulerReplayResult {
  stage: "sched" | "sched2";
  block: number;
  reproduced: boolean;
  matchedCycles: number;
  totalCycles: number;
  firstMismatch?: string;
  caveats: string[];
}
```

### Counterfactual intervention vocabulary

Search only bounded abstract changes that correspond to known source
mechanisms:

- toggle single-set birth eligibility for one pseudo;
- move a pseudo birth or death within an observed safe window;
- change LUID/birth order among already-independent instructions;
- add a true, anti, output, or memory dependency between selected UIDs;
- remove only a dependency proven allocation-created rather than semantic;
- change one allocno ordering relation;
- change one hard-register assignment and replay resulting sched2 hazards;
- move a delay-slot candidate earlier or later in the eligible scan order.

These are diagnostic counterfactuals, not source edits. Each intervention must
name a source mechanism family that could plausibly produce it.

## Deliverable 3: allocator requirements

Extend allocation parsing to retain the observed global allocno order from the
`.greg` header and expose pairwise register contests.

For each target/candidate register-role mismatch, report:

- involved pseudos and semantic roles;
- observed allocno order;
- exact assignments, conflicts, and preferences;
- reconstructed reference/set/live-length evidence;
- the minimum ordering or conflict change needed for the target assignment;
- source mechanism families capable of changing that property.

Suggested types:

```ts
interface AllocationOrderEntry {
  pseudo: number;
  rank: number;
  assignedRegister?: string;
}

interface AllocationRequirement {
  id: string;
  roles: string[];
  pseudos: number[];
  observedOrder: number[];
  desiredOrder?: number[];
  observedAssignments: Record<string, string>;
  desiredAssignments: Record<string, string>;
  requiredChanges: AbstractIntervention[];
  confidence: TraceConfidence;
  evidence: string[];
}
```

The initial release need not claim to emulate all of `global.c`. It should
produce exact pairwise requirements where the dump proves a conflict and
assignment order, and reconstructed priority explanations otherwise.

## Deliverable 4: delayed-branch analysis

Model the relevant behavior of `reorg.c` for each mismatching branch:

- own-block backward scan order;
- load/store delay-slot eligibility;
- register resources needed and set below the branch;
- memory-resource blocking;
- target/fall-through thread candidates when visible;
- the first eligible candidate in target and candidate order.

Suggested output:

```text
Branch target index 18 / candidate UID 81:
  candidate first eligible: UID 4 move ptr
  desired candidate: UID 77 srl arg2,4
  UID 77 is eligible but appears earlier in the scan
  requirement: move UID 4 before UID 77 or make UID 4 ineligible
```

Do not infer target RTL dependencies. State target-side conclusions only in
terms of observed machine order and delay-slot legality.

## Deliverable 5: requirement and intervention report

Serialize a stable schema consumed by the second tool:

```ts
interface AbstractIntervention {
  id: string;
  stage: "rtl" | "sched" | "greg" | "sched2" | "dbr";
  kind:
    | "birth-eligibility"
    | "birth-order"
    | "lifetime-endpoint"
    | "dependency-add"
    | "allocation-order"
    | "hard-register-assignment"
    | "delay-candidate-order";
  uids: number[];
  pseudos: number[];
  expectedEffect: string;
  sourceMechanisms: VariantMechanism[];
  confidence: TraceConfidence;
  evidence: string[];
}

interface TargetScheduleRequirement {
  id: string;
  stage: string;
  description: string;
  targetIndexes: number[];
  candidateUids: number[];
  pseudos: number[];
  hardConstraint: boolean;
  interventions: AbstractIntervention[];
}
```

The human report should prioritize:

1. first remaining target divergence;
2. first compiler pass capable of explaining it;
3. minimal abstract intervention sets;
4. already-solved ranges that should be preserved;
5. unsupported or ambiguous portions.

## Suggested implementation layout

```text
tools/agent/analyzeTargetSchedule.ts

tools/agent/target-schedule/
├── types.ts
├── machine-alignment.ts
├── uid-correspondence.ts
├── scheduler-replay.ts
├── allocation-requirements.ts
├── delay-slot.ts
├── intervention-search.ts
├── render-text.ts
└── artifacts.ts
```

Refactor and reuse, rather than duplicate:

- `variant-lab/compile.ts` for normalized assembly;
- `compiler-trace/rtl-parser.ts` for final-pass UIDs and register access;
- `compiler-trace/scheduler-dag.ts` for ready lists and dependencies;
- `compiler-trace/local-allocation.ts` for assignments/conflicts;
- `explainDiff.ts` for mismatch windows and hard-register rename maps;
- `decompToolchain.ts` for target assembly and configured compilation.

---

# Tool 2: `searchSourceShapes.ts`

## Responsibilities

Given a target-schedule analysis and an explicit finite search specification,
the tool should:

1. generate complete C89 variants under `build/`;
2. validate every variant with source policy before compilation;
3. compile variants deterministically and in isolated artifact directories;
4. deduplicate equivalent variants at progressively later compiler stages;
5. evaluate hard preservation constraints and target-schedule requirements;
6. preserve every distinct experiment and its transformation lineage;
7. fully assemble exact or explicitly selected candidates;
8. never modify `src/` or claim a cc1-only result is promotable.

Suggested CLI:

```bash
npx tsx tools/agent/searchSourceShapes.ts func_80019070 \
  --analysis build/targetSchedule/func_80019070/analysis.json \
  --spec build/search/func_80019070.json

npx tsx tools/agent/searchSourceShapes.ts func_80019070 \
  --spec build/search/func_80019070.json --jobs 8 --resume
```

Artifacts:

```text
build/sourceShapeSearch/<function>/<run-id>/
├── search-manifest.json
├── checkpoint.json
├── summary.json
├── summary.txt
├── equivalence-classes.json
└── variants/<variant-id>/
    ├── source.c
    ├── lineage.json
    ├── source.i
    ├── function.s
    ├── selected dumps
    ├── comparison.json
    └── function.c.o       # full-mode finalists only
```

## Deliverable 1: explicit finite search schema

The searcher must not invent arbitrary mutations. A search specification
provides exact source anchors and a finite set of mechanism-labelled
alternatives.

Example:

```json
{
  "schemaVersion": 1,
  "function": "func_80019070",
  "baseSourcePath": "src/func_80019070.c",
  "analysisPath": "build/targetSchedule/func_80019070/analysis.json",
  "maxVariants": 5000,
  "dimensions": [
    {
      "id": "transparency-cfg",
      "mechanism": "alias-dependency",
      "expectedPass": "jump",
      "invariants": ["the sprite code is 0x64 or 0x66 according to arg9"],
      "alternatives": [
        { "id": "sdk-macro", "edits": [] },
        { "id": "explicit-arms", "edits": [] }
      ]
    },
    {
      "id": "uv-web",
      "mechanism": "fresh-vs-reused-web",
      "expectedPass": "greg",
      "invariants": ["u equals the low nibble multiplied by eight"],
      "alternatives": [
        { "id": "direct", "edits": [] },
        { "id": "named-result", "edits": [] },
        { "id": "split-mask", "edits": [] }
      ]
    }
  ],
  "constraints": {
    "preserveTargetRanges": [[20, 35], [40, 80]],
    "preserveOpcodeStream": true,
    "forbidInstructionCountGrowth": true
  }
}
```

The actual edits use the existing exact-edit representation with required
occurrence counts. Empty edit arrays above are illustrative only; validation
must reject alternatives that do not specify a concrete generation action.

### Search dimensions

Initial supported finite dimensions should cover mechanisms already recognized
by the variant lab:

- direct expression versus named temporary;
- fresh result versus input/result reuse;
- single-set versus explicitly supplied multi-set source shape;
- fused versus split natural expression;
- approved local type/cast alternatives;
- SDK macro versus supplied natural expansion;
- supplied branch/CFG alternatives;
- constant birth at supplied anchors;
- natural array versus struct-field address family;
- supplied partial orders of independent statements;
- supplied result-carry positions;
- optional loop-depth weighting after the existing allocator-duel plan is
  implemented.

Do not generate algebraic no-op expressions, volatile accesses, inline asm,
register variables, synthetic flag overrides, or arbitrary casts merely to
perturb the compiler.

## Deliverable 2: deterministic product generation

Generate the Cartesian product of explicit dimensions in stable dimension and
alternative order. Apply constraints before compilation:

- incompatible-alternative exclusions;
- required alternatives;
- maximum variant count;
- exact source-anchor occurrence checks;
- C89 and source-policy validation;
- duplicate source-content elimination.

If the product exceeds the budget, stop at a deterministic checkpoint and
report the unvisited suffix. Do not select a percentage-based beam or mutate
only the current best candidate.

Suggested lineage type:

```ts
interface VariantLineage {
  variantId: string;
  baseSourceHash: string;
  choices: Array<{
    dimension: string;
    alternative: string;
    mechanism: VariantMechanism;
    expectedPass: string;
  }>;
  invariants: string[];
}
```

## Deliverable 3: staged compilation and deduplication

Use progressively more expensive stages:

### Stage A: source and preprocessing

- validate source policy;
- hash complete source;
- preprocess through the configured CPP;
- deduplicate identical preprocessed C.

### Stage B: cc1 assembly triage

- compile without `-da` into an isolated variant directory;
- normalize final cc1 assembly;
- compare opcode stream, instruction count, target ranges, register-role goals,
  and exact instruction count;
- deduplicate identical normalized assembly.

### Stage C: pass tracing

For each distinct assembly class that satisfies a requested mechanism goal or
improves a hard requirement:

- rerun the preserved source with `-da`;
- load `rtl` through `dbr` snapshots;
- evaluate the predicted pass effect;
- derive updated pseudo/UID correspondence;
- classify the mechanism as confirmed, partially confirmed, rejected, or
  inconclusive.

A configuration option may request tracing for all unique preprocessed sources,
but it must be explicit because of cost.

### Stage D: full-mode confirmation

- assemble every exact cc1 candidate;
- optionally assemble all unique dbr outputs when requested;
- compare the object with the target object;
- mark cc1-only exact results as non-promotable until this stage succeeds.

No candidate is copied to `src/`; reports only provide its preserved path and
normal verification commands.

## Deliverable 4: requirement-aware evaluation

Evaluate variants against the first tool's requirements rather than only final
percentage.

Suggested result fields:

```ts
interface RequirementResult {
  requirementId: string;
  status: "satisfied" | "regressed" | "unchanged" | "ambiguous";
  evidence: string[];
}

interface SearchVariantResult {
  variantId: string;
  policyPassed: boolean;
  compiled: boolean;
  requirementResults: RequirementResult[];
  mechanismVerdicts: HypothesisClassification[];
  preservedRanges: Array<{ start: number; end: number; exact: boolean }>;
  opcodeStreamExact: boolean;
  exactInstructions: number;
  totalInstructions: number;
  fullObjectExact: boolean;
}
```

Ranking is lexicographic and explanatory:

1. policy and semantic-generation checks pass;
2. hard preservation constraints pass;
3. target-schedule requirements are satisfied;
4. predicted compiler mechanisms are confirmed;
5. opcode stream and instruction count remain correct;
6. exact instruction count breaks ties;
7. full object identity is the only successful terminal state.

A lower percentage must outrank a higher percentage when it uniquely confirms
a required mechanism, but it must remain visibly non-promotable if solved
regions regress.

## Deliverable 5: caching, concurrency, and resume

Compilation is deterministic and expensive, so caching is a core feature.

Cache keys must include:

- complete source or preprocessed hash;
- function name;
- compiler flags and flag-override policy;
- compiler and assembler-shim hashes;
- trace/full-mode selection;
- search schema version.

Run variants through a bounded worker pool. Each worker gets a separate output
directory because cc1 writes dump files beside the preprocessed source.

Checkpoint after every completed equivalence class. `--resume` must verify the
search specification and toolchain hashes before reusing results.

## Deliverable 6: source-shape minimization

When multiple variants produce the same useful compiler effect, report the
smallest transformation lineage by:

1. fewest changed dimensions;
2. fewest exact-edit regions;
3. smallest changed source span;
4. most natural mechanism family priority;
5. source hash as a deterministic final tie break.

This is not token-level delta debugging. Test only alternatives already present
in the explicit search specification. Preserve all equivalent sources in the
artifact manifest even when one representative is displayed.

## Suggested implementation layout

```text
tools/agent/searchSourceShapes.ts

tools/agent/source-shape-search/
├── types.ts
├── schema.ts
├── generator.ts
├── constraints.ts
├── lineage.ts
├── cache.ts
├── worker-pool.ts
├── evaluator.ts
├── equivalence.ts
├── checkpoint.ts
├── render-text.ts
└── artifacts.ts
```

Reuse and extend:

- `variant-lab/manifest.ts` for hypothesis and policy validation;
- `variant-lab/transformations.ts` for exact source edits;
- `variant-lab/compile.ts` for compilation and normalization;
- `variant-lab/pass-diff.ts` for pass snapshots;
- `variant-lab/classify-hypothesis.ts` for mechanism verdicts;
- `variant-lab/artifacts.ts` for deterministic hashes and manifests;
- `compiler-trace` types and parsers for requirement evaluation.

The new tool should call library functions directly rather than spawning
`fuzzVariants.ts` once per variant.

---

# Shared implementation work

## Shared schema and versioning

Both tools should emit schema-versioned JSON. Put cross-tool requirement,
correspondence, confidence, and role types in a small shared module under
`tools/agent/target-schedule/types.ts`; source-search-only types remain under
`source-shape-search/`.

Reject newer unsupported schemas with a useful error. Include project-relative
artifact paths in JSON and absolute paths only in transient process state.

## Structured expectations

This work should coordinate with
`plans/allocator-duel-loop-metadata-discovery.md`. In particular, semantic
pseudo-role alignment and structured variant expectations are prerequisites
for robust searches where pseudo numbers shift between alternatives.

An MVP may use exact pseudo IDs only when a variant's role alignment is exact.
It must mark shifted or ambiguous roles rather than comparing unrelated pseudo
numbers.

## Documentation and Pi integration

After CLI schemas and tests stabilize:

1. document both tools in `README.md` and
   `notes/tools-directory-structure.md`;
2. add bounded Pi wrappers such as `psx_analyze_target_schedule` and
   `psx_search_source_shapes`;
3. expose only safe bounded arguments (`function`, analysis/spec paths,
   variant budget, jobs, resume, focused block);
4. update the function-decompilation skill so search is used only after a
   classified trace and explicit mechanism requirements exist;
5. keep generated output bounded before returning it to model context.

Do not expose a command that accepts arbitrary shell fragments or silently
promotes a generated candidate.

---

# Phased implementation

## Phase 1: shared correspondence and allocation evidence

1. Refactor normalized target/candidate instruction loading into reusable
   library functions.
2. Parse final-pass UID-to-machine correspondence.
3. Implement instruction alignment with confidence and ambiguity.
4. Parse global allocno order from `.greg`.
5. Add semantic role hooks compatible with the allocator-duel plan.
6. Add fixture tests before changing CLI behavior.

**Exit criterion:** a report can map each remaining `func_80019070` mismatch to
candidate UIDs/pseudos and state the `$t6/$t7` pairwise allocation requirement.

## Phase 2: scheduler and delay-slot requirements

1. Implement sched1/sched2 replay.
2. Require exact baseline replay before counterfactual search.
3. Implement bounded abstract interventions.
4. Add delayed-branch eligibility/resource analysis.
5. Emit `analysis.json` and bounded text output.

**Exit criterion:** the motivating trace identifies the pointer move versus
arg2-shift delay-slot problem and produces source-mechanism categories without
manual dump reading.

## Phase 3: source-shape search MVP

1. Validate finite search specifications.
2. Generate deterministic complete source products.
3. Add source-policy checks and preprocessed/source deduplication.
4. Add isolated parallel cc1 compilation.
5. Evaluate hard target ranges, register-role goals, opcode stream, and exact
   count.
6. Preserve lineage and checkpoint state.

**Exit criterion:** a supplied fixture search explores every declared
alternative exactly once, resumes deterministically, and ranks the known
mechanism-changing variant ahead of syntax-equivalent variants.

## Phase 4: trace-aware evaluation and full confirmation

1. Trace unique promising equivalence classes.
2. Evaluate structured mechanism expectations against pass snapshots.
3. Deduplicate at RTL/combine/dbr.
4. Assemble exact or selected unique outputs.
5. Enforce full-mode promotion eligibility.
6. Add minimization among explicitly supplied alternatives.

**Exit criterion:** a known exact fixture is rediscovered, preserved, assembled,
and reported as eligible for manual promotion, while cc1-only and policy-failing
variants are not.

## Phase 5: integration and hardening

1. Add bounded Pi wrappers.
2. Update documentation and skill routing.
3. Add cancellation and graceful checkpoint handling.
4. Add disk-usage summaries and optional cleanup of duplicate nonrepresentative
   compile artifacts while retaining manifests and sources.
5. Run the motivating function's bounded search and record its mechanism-level
   findings in research notes, whether or not it finds an exact match.

---

# Test plan

Use committed text/JSON fixtures derived from small synthetic excerpts. Do not
commit generated objects, complete compiler dumps, or extracted binary data.

## Target correspondence tests

- exact instruction stream;
- one scheduling-only window;
- consistent `$t6`/`$t7` role swap;
- duplicate identical loads with one ambiguous correspondence;
- relocation-aware `lui`/`addiu` pair;
- branch targets normalized without losing branch identity;
- dbr-to-mach UID continuity and deleted instructions.

## Scheduler replay tests

- exact replay of a single ready instruction;
- birth-priority winner over equal base priority;
- functional-unit hazard reranking;
- load blockage/launch event;
- sched2 hard-register WAR edge absent in sched1;
- inferred LUID tie causing replay to be marked non-counterfactual;
- malformed or incomplete scheduler dump producing a useful error.

## Allocation requirement tests

- two conflicting allocnos assigned adjacent temporary registers;
- desired target map requiring their order to reverse;
- preference preventing a simple order reversal;
- no conflict, where a pairwise duel must not be claimed;
- shifted pseudo numbers aligned by semantic role;
- ambiguous role alignment preventing a false requirement.

## Delay-slot tests

- eligible ALU candidate selected by own-block backward scan;
- load rejected by target dslot attributes;
- store rejected after a lower load requires memory;
- candidate rejected because it sets a register needed below the branch;
- target-thread candidate versus own-block candidate;
- target order requiring one candidate to move ahead of another.

## Search-generation tests

- deterministic Cartesian product ordering;
- compatibility exclusions;
- exact occurrence-count enforcement;
- maximum-budget checkpoint and deterministic resume;
- duplicate source and duplicate preprocessed-source elimination;
- C99, inline asm, register pinning, generated-global redeclaration, and flag
  override rejection;
- no mutation of the base source or `src/`.

## Search-evaluation tests

- solved target range preserved;
- mechanism confirmed while exact count regresses;
- percentage improves but a hard preservation range regresses;
- equivalent through combine despite different source;
- distinct RTL converging to identical dbr assembly;
- cc1-only exact result remains non-promotable;
- full assembled exact result becomes manually promotable;
- deterministic representative selection among equivalent variants.

## Motivating regression

Create compact fixtures from the relevant `func_80019070` evidence sufficient
to assert that the tools:

1. identify block 0 as scheduling-only;
2. map the candidate pointer move and arg2 shift to their UIDs;
3. report the wrong delay-slot candidate and desired candidate;
4. identify the low-nibble and arg9 roles as a conflicting `$t6/$t7` allocation
   requirement;
5. preserve the already-correct transparency branch and matching suffix as hard
   search constraints;
6. classify source-order alternatives that are equivalent through combine as
   redundant rather than independent progress.

The regression does not require the search tool to solve the real function in
its unit test. It requires the real problem to be represented honestly and the
known no-effect variants to be pruned correctly.

---

# Acceptance criteria

## `analyzeTargetSchedule.ts`

- Maps target mismatch windows to candidate UIDs and pseudos with confidence.
- Replays observed scheduler decisions before offering counterfactuals.
- Produces explicit scheduler, allocation, and delay-slot requirements.
- Distinguishes exact observations from reconstructed/inferred explanations.
- Emits stable typed JSON and bounded human output.
- Never changes source, compiler, assembler, or flags.

## `searchSourceShapes.ts`

- Searches only a finite, explicit, mechanism-labelled source grammar.
- Generates complete C89 sources under `build/` and applies source policy before
  compilation.
- Deduplicates compiler-equivalent variants and records their lineages.
- Supports bounded concurrency, deterministic checkpoints, and resume.
- Evaluates mechanism goals and hard preservation ranges before percentage.
- Requires full assembly/object equality before marking a result promotable.
- Never writes to `src/`, generates forbidden constructs, or performs random or
  hill-climbing search.

## End-to-end

- An investigator can run analysis, author a finite search spec from its
  requirements, execute or resume the search, and inspect every distinct source
  and compiler outcome.
- A no-effect source family is proven equivalent at the first common compiler
  pass rather than repeatedly retried.
- A mechanism-confirming but nonmatching variant remains useful and clearly
  non-promotable.
- Exact per-function diff, full binary verification, modification-scope checks,
  and clean-source policy remain the final acceptance path.

# Non-goals

- General C semantic equivalence proving.
- Arbitrary C AST mutation or a general-purpose C parser in the first release.
- Random fuzzing, genetic search, or percentage hill climbing.
- Compiler or assembler modification to obtain matching output.
- Hard-register assignment, embedded assembly, volatile perturbation, or flag
  overrides.
- Automatic source promotion, commits, or autonomous acceptance.
- A guarantee that every scheduling/allocation mismatch has a searchable clean-C
  source shape.
