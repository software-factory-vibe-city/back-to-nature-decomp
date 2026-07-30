# Plan: baseline-aware variants and per-variant schedule comparison

**Status: focused source-shape-search path implemented.** Source-shape search
can protect inherited empty memory barriers, parse preserved compiler traces
without rerunning cc1, analyze target schedules from isolated variant artifacts,
fingerprint normalized trace classes, derive target-relative profiles and
baseline deltas, and rank supported causal progress before match percentage.
Generated synthesis specifications enable this path for every distinct
preprocessed class. Variant-lab integration, shared lexical policy extraction,
transformation-spec admission, richer cache/admission metadata, and broader
profile-driven causal composition remain proposed.

This plan groups the two highest-priority gaps recorded in
`notes/potentially-useful-tools.md`:

1. allow deterministic exact-edit experiments to inherit approved constructs
   already present in the baseline without permitting new matching hacks;
2. compare each traced variant's target-schedule mechanism, not only its final
   instructions and first pass divergence.

The work extends the implemented variant lab, source-shape search, compiler
trace, and target-schedule analyzer. It must not create a parallel compiler
pipeline or weaken the final source-policy gate.

## Purpose

A difficult function can have a strong current baseline whose compiler state
depends on an established, project-approved construct. It can also have two
source alternatives that produce identical final assembly while reaching that
assembly through materially different compiler mechanisms.

The current tools do not handle that combination well:

```text
actual baseline source
    contains configured empty memory barriers
             |
             | blanket variant-lab asm rejection
             v
cannot run exact-edit search against the real baseline

machine-equivalent variants
    differ in RTL/scheduler replay support
             |
             | final score and first divergence only
             v
causal regression is hidden
```

The desired workflow is:

```text
approved baseline source
        |
        | protected exact-edit generation
        v
variants that cannot alter inherited constructs
        |
        | existing compiler trace artifacts
        v
variant-specific target-schedule analyses
        |
        v
baseline-relative mechanism deltas and explanatory ranking
```

## Motivating case: `func_80019070`

The current function matches 72/81 instructions. Three empty memory barriers
preserve already-solved store and delay-slot behavior. The active autonomous
configuration permits that exact construct, but
`variant-lab/manifest.ts::validateVariantSource` rejects every embedded asm
form. Searches therefore cannot use the actual 72/81 source as their base.

A later experiment changed `arg2` from an explicitly masked `u32` to a `u16`
formal and reused `arg8` directly. It still produced the same 72/81 machine
stream. A simple final-assembly comparison therefore called it equivalent.
The compiler evidence was not equivalent:

- early RTL changed and later converged by combine;
- the original baseline admitted a reproducible target-order replay with a
  bounded relation set;
- the alternative target replay was unsupported because the desired selection
  was functional-unit blocked.

The tooling should report the alternative as machine-equivalent but
mechanistically regressed, without requiring manual comparison of separate
trace and target-schedule reports.

## Design principles

1. **Inheritance is not permission to generate constructs.** A variant may
   retain only the approved constructs already present in its exact base.
2. **Provenance over heuristics.** Baseline inheritance is initially available
   only when the tool itself applies exact edits. Arbitrary complete source
   files do not receive a heuristic exemption.
3. **Configuration remains authoritative.** A construct is inheritable only if
   the active source policy permits that kind.
4. **Normal finalization remains mandatory.** Inherited-mode results are
   diagnostic and non-promotable until rerun through the ordinary source
   policy, exact function diff, and full verification path.
5. **Target-relative comparison.** Variant UIDs and pseudo numbers are not
   compared directly across traces unless correspondence proves identity.
6. **Replay support before intervention count.** An unsupported replay never
   outranks a reproducible replay merely because it lists fewer interventions.
7. **Mechanism before percentage.** Hard preservation and supported causal
   progress rank before exact-instruction count.
8. **No source mutation.** Generated sources and analyses remain under
   `build/`; no tool in this plan writes to `src/`.
9. **Bounded work.** Schedule analysis is opt-in for traced variants and is
   deduplicated by compiler-state fingerprints.
10. **Confidence remains explicit.** Exact observations, reconstructed links,
    inferred roles, and unsupported cases must retain their current confidence
    and caveat labels.

---

# Part A: baseline-aware approved-construct variants

## A1. Shared source-construct classifier

The project currently has two policy implementations with different behavior:

- `.pi/extensions/psx-decomp/autonomous/source-policy.ts` recognizes a
  configured empty memory barrier;
- `tools/agent/variant-lab/manifest.ts` rejects any embedded asm spelling.

Extract a pure, reusable source-construct scanner, for example:

```text
tools/agent/source-constructs.ts
```

It should lex enough C to distinguish code from comments, string contents, and
character literals, and classify at least:

```ts
type SourceConstructKind =
  | "empty-memory-barrier"
  | "embedded-asm"
  | "register-asm"
  | "include-asm"
  | "pragma"
  | "generated-global"
  | "c99";

interface SourceConstruct {
  kind: SourceConstructKind;
  start: number;
  end: number;
  line: number;
  normalized: string;
  policy: "approved" | "forbidden";
}
```

The initial approved grammar should be only the exact configured zero-width
memory-clobber form, allowing insignificant whitespace and the spellings
already recognized by source policy:

```c
__asm__ volatile ("" ::: "memory");
__asm__ ("" ::: "memory");
```

No operands other than the memory clobber, non-empty templates, output/input
constraints, named registers, or extra clobbers qualify. Approval must also
require `sourcePolicy.allowEmptyMemoryBarrier` in the active configuration.

Both autonomous source policy and variant validation should consume this
classifier. The scanner should be pure; callers pass policy options rather
than the low-level module loading `.pi/autodecomp.json` itself.

## A2. Protected baseline template

Add a protected-template layer for exact-edit generators:

```ts
interface ProtectedConstructRef {
  id: string;
  kind: "empty-memory-barrier";
  originalText: string;
  baselineStart: number;
  baselineEnd: number;
  normalized: string;
}

interface ProtectedSourceTemplate {
  markedSource: string;
  constructs: ProtectedConstructRef[];
}
```

Generation should proceed as follows:

1. scan and fully validate the base source;
2. replace each approved inherited construct with an internal unique marker;
3. apply existing exact edits to the marked source;
4. reject any edit whose find or replacement text contains the reserved marker
   prefix;
5. require every marker to remain exactly once and in original ordinal order;
6. restore the byte-exact original construct text;
7. rescan the candidate and reject added, removed, reordered, moved, or modified
   approved constructs and every forbidden construct;
8. write only the restored complete source into variant artifacts.

Because exact edits are applied after marker insertion, an edit that attempts
to encompass, move, delete, or rewrite a protected barrier will fail its
occurrence check. Edits elsewhere may change byte offsets, but the protected
construct remains at the same point in the source statement stream.

Do not infer unchanged barriers in arbitrary complete manifest sources by
counting identical strings. That would fail to prove that an identical barrier
was not moved. The first implementation should support inheritance only in:

- `searchSourceShapes.ts` exact-edit alternatives;
- `fuzzVariants.ts --transform-spec` exact-edit outputs.

Plain `--manifest` and positional complete-source inputs remain under strict
validation unless a future schema adds equally strong edit provenance.

## A3. Schema and result changes

Bump the affected schemas while continuing to read version 1 as strict mode.
A source-shape or transformation specification may request:

```json
{
  "constructAdmission": {
    "mode": "inherit-approved-baseline",
    "kinds": ["empty-memory-barrier"]
  }
}
```

Rules:

- omitted means `strict`;
- unknown kinds are rejected;
- requested kinds not approved by active configuration are rejected;
- no CLI flag silently overrides the persisted specification;
- checkpoints and run IDs include the admission mode, approved kinds, baseline
  hash, and normalized protected-construct manifest.

Add structured admission state rather than overloading one Boolean:

```ts
type VariantAdmission =
  | "strict-clean"
  | "inherited-approved-baseline"
  | "failed";

interface ProtectedConstructResult {
  id: string;
  kind: "empty-memory-barrier";
  retained: boolean;
  evidence: string[];
}
```

`policyPassed` continues to describe source-policy validity. Admission records
how the experimental source was accepted. Even a full-object exact result from
inheritance mode has `promotionEligible: false` and a reason directing the
operator to copy and verify it manually through `psx_finalize_function`.

This conservative promotion block is specific to the experimental mode; it
does not change whether the normal project source policy permits an unchanged
empty memory barrier.

## A4. Reports and artifacts

Each generated variant should record:

```text
variants/<id>/
├── source.c
├── lineage.json
├── source-admission.json
└── ... existing compile artifacts
```

`source-admission.json` should include:

- admission mode;
- active policy setting relevant to each construct;
- base source hash;
- protected construct IDs, kinds, normalized forms, and source anchors;
- validation outcome and promotion block reasons.

The bounded text report should distinguish:

```text
policy  admission              promotion
pass    inherited-approved     blocked: requires normal finalization
```

It must not print inherited barriers as newly generated source mechanisms.

---

# Part B: per-variant target-schedule mechanism comparison

## B1. Refactor target-schedule analysis into a library

`analyzeTargetSchedule.ts` currently owns the entire workflow: it compiles the
current `src/<function>.c`, assembles the target, analyzes the resulting trace,
and writes to one fixed function directory. Split the pure analysis from the
CLI orchestration.

Suggested layout:

```text
tools/agent/analyzeTargetSchedule.ts       # existing CLI, compatibility shell

tools/agent/target-schedule/
├── analyze.ts                             # artifact-driven analysis entry point
├── profile.ts                             # target-relative mechanism profile
├── compare-profiles.ts                    # baseline/variant delta
└── ... existing modules
```

Suggested library boundary:

```ts
interface TargetScheduleInputs {
  functionName: string;
  sourcePath: string;
  trace: CompilerTraceReport;
  candidateAssemblyPath: string;
  target: MachineInstructionRef[];
  outputDirectory: string;
  block?: number;
  maxInterventions: number;
}

function analyzeTargetScheduleFromArtifacts(
  inputs: TargetScheduleInputs,
): TargetScheduleAnalysis;
```

The existing CLI should still:

1. call `buildTraceReport` for the current source;
2. assemble/load the target once;
3. call the new artifact-driven function;
4. write the same standard artifacts and bounded report.

Its current output schema and ordinary command behavior should remain
compatible except for an intentional schema bump if new fields are necessary.

## B2. Reuse variant trace artifacts

`variant-lab/compile.ts` already invokes the configured compiler with dumps and
loads normalized pass snapshots. Target-schedule analysis needs richer
scheduler, pseudo, allocation, and final RTL information from those same dump
files. Refactor `compilerTrace.ts` so report construction can parse an existing
compile directory instead of necessarily compiling `src/` again.

Suggested API:

```ts
interface ExistingTraceArtifacts {
  functionName: string;
  sourcePath: string;
  assemblyPath: string;
  dumpDirectory: string;
  outputDirectory: string;
}

function buildTraceReportFromArtifacts(
  artifacts: ExistingTraceArtifacts,
): CompilerTraceReport;
```

Requirements:

- never rerun cc1 when a complete compatible trace already exists;
- validate the source, assembly, flags, compiler identity, and dump hashes;
- fail as `inconclusive` when required scheduler dumps are absent or truncated;
- keep all current exact/reconstructed/inferred labels;
- do not write over `build/compilerTrace/<function>/report.json` when analyzing
  a variant; write inside that variant's artifact directory.

Assemble and normalize the archived target once per run, then reuse it across
variants.

## B3. Target-relative mechanism profile

Raw `TargetScheduleAnalysis` contains candidate-specific UIDs and pseudos.
Cross-variant comparison needs a compact profile keyed primarily by target
indexes, canonical machine roles, stages, and confidence.

Add a versioned type such as:

```ts
interface ScheduleMechanismProfile {
  schemaVersion: 1;
  function: string;
  variantId: string;
  sourceHash: string;
  assemblyHash: string;
  traceBundleHash: string;
  baselineReplay: Array<{
    stage: "sched" | "sched2";
    block: number;
    status: "exact" | "partial" | "failed";
    confidence: TraceConfidence;
  }>;
  targetOrder: Array<{
    targetIndexes: number[];
    stage: "sched" | "sched2";
    legality: TargetOrderReplay["legality"];
    status: TargetOrderReplay["status"];
    unsupportedOutcomes: CounterfactualStep["outcome"][];
    bestSupportedInterventionCount?: number;
    interventionKinds: InterventionKind[];
    confidence: TraceConfidence;
  }>;
  allocationRoles: Array<{
    targetRegister: string;
    targetIndexes: number[];
    candidateRegister?: string;
    requirementSatisfied: boolean | "ambiguous";
    confidence: TraceConfidence;
  }>;
  delaySlots: Array<{
    branchTargetIndex: number;
    desiredTargetIndex?: number;
    selectedTargetIndex?: number;
    status: "satisfied" | "unsatisfied" | "ambiguous";
    confidence: TraceConfidence;
  }>;
  preservationRanges: Array<{ start: number; end: number; exact: boolean }>;
  firstDivergence?: TargetScheduleAnalysis["firstDivergence"];
  caveats: string[];
}
```

`traceBundleHash` must cover normalized pass snapshots and scheduler provenance,
not only final assembly. Two variants with identical assembly but different RTL
or scheduler support must remain distinct mechanism classes.

Do not compare raw pseudo IDs across profiles. Pseudos may be displayed as
variant-local evidence, but cross-variant keys should use target indexes,
register roles, branch indexes, and requirement descriptions aligned separately
inside each variant analysis.

## B4. Baseline-relative profile delta

Add a deterministic profile comparator:

```ts
type ScheduleDeltaVerdict =
  | "improved"
  | "regressed"
  | "mechanistically-equivalent"
  | "changed-inconclusive";

interface ScheduleMechanismDelta {
  baselineVariantId: string;
  variantId: string;
  finalAssemblyEquivalent: boolean;
  verdict: ScheduleDeltaVerdict;
  replayChanges: string[];
  allocationChanges: string[];
  delaySlotChanges: string[];
  preservationChanges: string[];
  confidence: TraceConfidence;
  reasons: string[];
}
```

Comparison order should be explicit and lexicographic:

1. required traces exist and baseline scheduler replay is exact enough for the
   compared blocks; otherwise return `changed-inconclusive`;
2. hard preservation ranges must not regress;
3. target-order legality and supported replay status are compared;
4. target register-role/allocation requirements are compared;
5. delay-slot requirements are compared;
6. only among comparable supported replays are intervention cardinality and
   intervention kinds used;
7. opcode stream, instruction count, and exact count remain later tie breakers
   in the surrounding variant/search ranking.

A suggested replay preference for comparable evidence is:

```text
reproduced-with-current-state
  > reproducible-with-interventions
  > impossible-under-current-dag
  > baseline-not-exact / unsupported
```

This ordering is not a universal compiler theorem. The report must retain the
specific legality, blockers, intervention evidence, and confidence rather than
reducing the result to one number.

Special cases:

- Identical final assembly plus identical profiles is
  `mechanistically-equivalent`.
- Identical final assembly plus reproducible-to-unsupported replay is
  `regressed`.
- A lower exact score may be `improved` if it uniquely proves the requested
  mechanism while preserving declared hard ranges; it remains nonmatching.
- Fewer interventions do not count as improvement if requirement coverage or
  correspondence confidence decreased.

## B5. Variant-lab integration

Add an opt-in schedule-analysis mode to `fuzzVariants.ts`, available only with
pass tracing, for example:

```bash
npx tsx tools/agent/fuzzVariants.ts func_80019070 \
  --transform-spec build/hypotheses.json \
  --trace-passes --compare-target-schedule
```

For each distinct trace mechanism class:

1. load the preserved trace artifacts;
2. run artifact-driven target-schedule analysis;
3. derive `schedule-profile.json`;
4. compare it with the declared baseline profile;
5. attach the delta to the variant result;
6. reuse the result for variants with the same verified trace-bundle hash.

Artifacts:

```text
build/fuzz/<function>/<run-id>/
├── schedule-summary.json
└── variants/<id>/
    └── target-schedule/
        ├── analysis.json
        ├── profile.json
        ├── delta.json
        └── summary.txt
```

Extend mechanism classification so a hypothesis expecting `sched`, `lreg`,
`greg`, `sched2`, or `dbr` can cite structured profile evidence. Do not replace
the existing first-pass divergence report; the two views answer different
questions.

The bounded table should make machine-equivalent causal changes visible:

```text
variant       exact    asm class    schedule delta   replay
baseline      72/81    A            reference        reproducible (7 relations)
u16-direct    72/81    A            regressed        unsupported: resource blocked
```

## B6. Source-shape-search integration

Add persisted schedule-comparison controls to the search schema rather than an
unrecorded CLI behavior:

```json
{
  "scheduleComparison": {
    "enabled": true,
    "analyze": "traced-classes",
    "maxInterventions": 8
  }
}
```

Version 1 specifications migrate to disabled behavior. Validation should bound
`maxInterventions` consistently with `analyzeTargetSchedule.ts`.

Important deduplication rule: final assembly hash alone is insufficient. If
schedule comparison is enabled, traced variants are deduplicated by a trace
mechanism fingerprint. Machine-equivalent variants with different early RTL,
scheduler decisions, or replay support must receive separate profiles.

The existing `traceAllPreprocessed` option remains the explicit expensive way
to discover mechanism differences among final-assembly-equivalent source
classes. Without a trace, the result must say `not analyzed`, not infer
schedule equivalence from assembly equality.

Extend `SearchVariantResult` with optional profile/delta fields and rank:

1. source admission and source policy;
2. declared hard preservation constraints;
3. non-regressed target-schedule requirements and profile delta;
4. predicted mechanism verdict;
5. opcode stream and instruction count;
6. exact instruction count;
7. full object equality as the terminal success condition.

Inherited-mode candidates remain non-promotable as specified in Part A.

## B7. Cache and reproducibility

Schedule analysis can be expensive. Cache keys must include:

- target object/instruction hash;
- candidate assembly hash;
- normalized trace-bundle hash;
- compiler flags and toolchain identity;
- target-schedule/profile schema versions;
- selected block and maximum interventions;
- source admission metadata where relevant.

A cache hit must verify artifact hashes before reuse. Resume should reject
changed baseline source, protected-construct manifests, search specifications,
or toolchain identities.

---

# Shared CLI and Pi behavior

After the CLI and schemas stabilize:

- extend the existing `psx_fuzz_variants` wrapper with bounded Boolean schedule
  comparison and only when trace mode is enabled;
- let `psx_search_source_shapes` obtain behavior solely from its persisted spec,
  preserving its safe path/budget interface;
- keep target-schedule output under the existing 50 KB / 2000-line bounds;
- display artifact paths rather than embedding complete analyses;
- update the decompilation skill to explain that inherited mode preserves an
  existing baseline construct and cannot introduce one;
- do not add a wrapper that accepts source text, arbitrary shell commands, or
  unbounded intervention counts.

The standard `psx_analyze_target_schedule` command must retain its current
source-based behavior.

---

# Phased implementation

## Phase 1: source-policy parity and protected templates

1. Add lexical source-construct fixtures before changing policy behavior.
2. Implement the shared pure source-construct classifier.
3. Migrate autonomous source policy and variant validation to it without
   changing ordinary policy outcomes.
4. Implement protected baseline templates for exact-edit generation.
5. Add schema fields, artifact metadata, checkpoint identity, and reporting.
6. Keep strict mode as the default and complete-source manifests strict.

**Exit criterion:** an exact-edit search can compile the unchanged
`func_80019070` baseline with its three configured empty memory barriers, while
adding, removing, changing, or moving any barrier is rejected before cc1.

## Phase 2: artifact-driven compiler trace and target-schedule analysis

1. Refactor compiler trace parsing to consume existing compatible dumps.
2. Refactor target-schedule analysis into an artifact-driven library.
3. Preserve the current standalone CLI behavior and artifact schema.
4. Add isolated output directories so variant analyses cannot overwrite the
   standard function analysis.
5. Add target reuse and deterministic cache identities.

**Exit criterion:** analysis of current `src/` through the refactored CLI is
semantically identical to the pre-refactor report, and a preserved variant can
be analyzed without replacing `src/` or rerunning cc1.

## Phase 3: schedule profiles and deltas

1. Define and version target-relative profile and delta schemas.
2. Derive replay, intervention, allocation, delay-slot, preservation, and
   confidence summaries from `TargetScheduleAnalysis`.
3. Implement conservative baseline-relative comparison.
4. Add trace-bundle fingerprinting that distinguishes machine-equivalent but
   causally different variants.
5. Add bounded human rendering.

**Exit criterion:** synthetic fixtures classify reproducible-to-unsupported
replay as a regression even when assembly hashes are identical.

## Phase 4: variant-lab integration

1. Add opt-in target-schedule comparison to traced variant runs.
2. Analyze one representative per trace mechanism class.
3. Preserve per-variant profiles and deltas.
4. Incorporate structured schedule evidence into mechanism verdicts and
   ranking.
5. Add inherited approved-construct support to transformation specs.

**Exit criterion:** one variant-lab command reproduces the relevant
`func_80019070` baseline versus `u16` comparison and explains why equal 72/81
scores are not causally equivalent.

## Phase 5: source-shape-search and Pi integration

1. Add source admission and schedule-comparison schema fields.
2. Make tracing/deduplication aware of trace mechanism classes.
3. Extend checkpoints, summaries, and ranking.
4. Add bounded wrapper options where needed.
5. Update `README.md`, `notes/tools-directory-structure.md`, the two tool
   READMEs, and the matching skill.
6. Run unit tests, focused integration tests, source policy, and full project
   verification.

**Exit criterion:** a bounded exact-edit search against the real 72/81 baseline
can retain all established barriers, compare target-schedule profiles for
traced classes, resume deterministically, and leave `src/func_80019070.c`
unchanged.

---

# Test plan

Use committed compact TypeScript/text/JSON fixtures. Do not commit generated
objects, proprietary compiler binaries, extracted game data, or complete raw
compiler dumps.

## Source-construct scanner tests

- exact empty volatile memory barrier;
- accepted non-volatile spelling already recognized by policy;
- insignificant whitespace and multiline formatting;
- `asm` text inside comments and strings ignored;
- non-empty template rejected;
- input/output operands rejected;
- extra or non-memory clobber rejected;
- hard-register declaration rejected;
- C99 and generated-global findings preserved;
- `allowEmptyMemoryBarrier: false` rejects inheritance;
- autonomous and variant validators return consistent classifications.

## Protected-template tests

- baseline with one protected barrier retained;
- baseline with three identical barriers retains stable ordinal IDs;
- exact edit wholly before or after barriers succeeds;
- edit adding a barrier rejected;
- edit removing or modifying a barrier fails occurrence/protection checks;
- edit spanning a barrier rejected;
- edit attempting to reorder barriers rejected;
- reserved marker text in a spec rejected;
- restored generated source contains no marker bytes;
- strict mode behavior remains unchanged;
- generated artifacts never modify the base source;
- inherited exact result remains non-promotable in the experimental report.

## Artifact-driven trace tests

- load a complete compatible dump directory;
- reject missing `.sched` or final RTL with a useful inconclusive result;
- reject source/assembly/hash mismatch;
- produce the same normalized report as compile-and-parse mode;
- write two variants into isolated directories;
- reuse target artifacts without recompilation.

## Schedule-profile tests

- exact baseline replay profile;
- reproducible-with-interventions profile;
- resource-blocked unsupported profile;
- allocation role preserved versus changed;
- delay-slot requirement preserved versus regressed;
- ambiguous target correspondence remains inconclusive;
- pseudo renumbering with stable target-role alignment compares correctly;
- identical final assembly and identical trace profile is equivalent;
- identical final assembly and different replay support is regressed;
- smaller unsupported intervention set does not outrank a supported set;
- reduced confidence prevents a false improvement claim;
- deterministic trace-bundle hash and cache reuse.

## Variant/search ranking tests

- hard-range regression outranks no mechanism score improvement;
- supported replay improvement outranks raw exact-count tie breaking;
- equal 72/81 assembly classes remain distinct when trace bundles differ;
- untraced assembly-equivalent variants report `not analyzed`;
- schedule comparison requires trace mode;
- checkpoint resume verifies admission and profile schema identities;
- cc1-only, inherited-mode, and policy-failing candidates remain
  non-promotable;
- full ordinary finalization remains the only terminal acceptance route.

## Motivating regression

Preserve compact fixture evidence sufficient to model the two
`func_80019070` states:

1. baseline source admission retains three approved barriers;
2. both variants normalize to the same 72/81 machine stream;
3. the baseline target-order replay is reproducible with the known bounded
   relation profile;
4. the `u16`/direct-input shape is unsupported because the desired selection is
   resource-blocked;
5. the profile comparator labels the variant machine-equivalent but regressed;
6. allocation and target indexes 10..80 remain reported as preserved;
7. no generated source is copied into `src/`.

The committed regression should use reduced normalized fixtures rather than the
full generated function dumps.

---

# Acceptance criteria

## Baseline-aware variants

- Exact-edit experiments can use a baseline containing configured approved
  empty memory barriers.
- Generated variants cannot add, remove, change, reorder, or move inherited
  barriers.
- All other forbidden constructs remain rejected.
- Admission behavior is persisted in schemas, run IDs, checkpoints, and
  artifacts.
- Strict mode remains the default and existing version 1 specs remain strict.
- Arbitrary complete source manifests receive no heuristic baseline exemption.
- Experimental inheritance never bypasses normal finalization.

## Schedule comparison

- Target-schedule analysis can consume preserved variant compile/trace
  artifacts without mutating source or recompiling unnecessarily.
- Each traced mechanism class receives a target-relative profile with explicit
  confidence and caveats.
- Machine-equivalent variants with different replay support remain distinct.
- Reproducible-to-unsupported replay is reported as a causal regression.
- Raw pseudo/UID equality is never assumed across variants.
- Hard preservation and supported mechanisms rank before match percentage.
- Exact object comparison remains the only successful function oracle.

## End to end

- One bounded workflow can evaluate clean C edits against the actual
  `func_80019070` baseline, preserve its established barriers, and explain the
  schedule-mechanism consequences of each traced variant.
- Generated artifacts are deterministic, resumable, isolated under `build/`,
  and queryable without changing `src/`.
- The existing exact function diff, modification-scope check, source policy,
  and full byte-identity verification remain unchanged as final gates.

# Non-goals

- General permission for inline assembly in variants.
- Generation or optimization of barrier placement.
- Promotion of diagnostic dependency probes as decompilation solutions.
- General C parsing or semantic-equivalence proof.
- Comparison of raw pseudo numbers across independent compilations.
- Full emulation of GCC's allocator or scheduler beyond the existing bounded,
  confidence-labelled replay model.
- Random mutation, hill climbing, or match-percentage beam search.
- Compiler patches, hard-register pinning, per-function flag changes,
  automatic source promotion, or commits.
