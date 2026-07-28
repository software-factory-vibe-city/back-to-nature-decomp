# Potentially useful decompilation tools

This note records tooling ideas exposed by difficult matching attempts. It is an
idea inventory, not a claim that the tools exist or a commitment to implement
them in this order. Any implementation must reuse the configured toolchain,
write generated artifacts under `build/`, preserve the clean-source policy, and
leave exact object and full-binary comparison as the final oracles.

## Priority summary

| Priority | Idea | Main benefit |
|---|---|---|
| P0 | Requirement-guided clean-C source-shape synthesis | Derive and search natural C mechanisms directly from target-schedule requirements |
| P0 | Baseline-aware approved-construct variant mode | Run finite experiments against the actual source baseline without permitting new matching hacks |
| P0 | Per-variant target-schedule mechanism comparison | Distinguish machine-equivalent variants that have materially different compiler causality |
| P1 | Experiment ledger and query tool | Prevent repeated hypotheses and make scattered search artifacts discoverable |
| P1 | Same-input ASPSX versus maspsx differential | Prove whether a remaining mismatch belongs at the assembler boundary |
| P2 | Concrete dependency probe | Test whether abstract scheduler interventions survive real allocation and later passes |
| P2 | Analogous-function finder | Find source precedents by normalized machine behavior rather than names or macros |
| P2 | Indexed-global shape inference | Suggest defensible global type/extent overrides from access and bounds evidence |

The direct solution-seeking tool has an implementation plan in
`plans/requirement-guided-clean-c-source-synthesis.md`; its conservative
prologue MVP is now implemented. The next two supporting ideas are grouped in
`plans/baseline-aware-variant-schedule-comparison.md`.

## 1. Requirement-guided clean-C source-shape synthesis

### Motivation

`analyzeTargetSchedule.ts` can state the compiler relations required by the
target, and `searchSourceShapes.ts` can execute an explicit finite grammar, but
a human previously had to invent and encode every source alternative between
them. That is the remaining solution-discovery bottleneck rather than merely an
experiment-management problem.

### Proposed behavior

Derive confidence-labelled source roles from the current C, compiler trace, and
target correspondence; map abstract scheduler/allocation interventions to a
curated catalog of semantics-checked C89 rewrites; emit deterministic exact-edit
grammars; and execute bounded atomic and compatible combined mechanisms through
the existing search engine. Expansion must follow requirement satisfaction and
compatibility rather than match-percentage hill climbing.

The implemented MVP models a conservative top-level prologue and derives
proof-oriented statement orders, declaration initializers, verified `setSprt`
expansions/named constants, and typed pointer-copy forms. Broader CFG,
expression, alias, and schedule-profile-driven composition remains planned.

### Implementation and plan

- `tools/agent/synthesizeSourceShapes.ts`
- `tools/agent/source-shape-synthesis/`
- `plans/requirement-guided-clean-c-source-synthesis.md`

## 2. Baseline-aware approved-construct variant mode

### Motivation

`func_80019070` reached a 72/81 baseline containing three already-established
empty memory barriers. The autonomous source policy can permit that exact
construct through `sourcePolicy.allowEmptyMemoryBarrier`, but the variant lab's
standalone validator currently rejects every embedded-assembly spelling. As a
result, `fuzzVariants.ts` and `searchSourceShapes.ts` cannot test ordinary C
changes against the real baseline without first deleting the barriers and
changing the compiler state being investigated.

### Proposed behavior

Add an explicit, conservative inheritance mode for exact-edit-generated
variants:

- identify approved constructs already present in the base source;
- protect them before applying exact edits;
- require every generated candidate to retain the same constructs in the same
  source positions and order;
- reject edits that add, remove, move, or alter a protected construct;
- continue rejecting all other embedded assembly, hard-register variables,
  pragmas, flag changes, and non-C89 source;
- mark inherited-mode results as diagnostic and non-promotable until they pass
  the normal final source-policy gate outside the experiment mode.

This should be implemented through shared source-construct classification so
that variant admission and the autonomous source policy cannot silently drift.
It must not become a general `allow asm` switch. Complete arbitrary manifest
sources should remain strict unless they carry verifiable exact-edit lineage.

### Likely integration points

- `tools/agent/variant-lab/manifest.ts`
- `tools/agent/variant-lab/transformations.ts`
- `tools/agent/source-shape-search/generator.ts`
- `.pi/extensions/psx-decomp/autonomous/source-policy.ts`

## 3. Per-variant target-schedule mechanism comparison

### Motivation

Several `func_80019070` alternatives compiled to the same 72/81 final machine
stream but were not equally useful. In particular, a `u16 arg2` formal and
direct `arg8` reuse changed early RTL, converged by combine, and retained the
same final instructions, yet changed target-order replay from a reproducible
intervention profile to an unsupported functional-unit-blocked profile. Final
instruction count and first pass divergence do not expose that regression.

### Proposed behavior

Refactor target-schedule analysis so it can consume a preserved variant's own
assembly and trace artifacts, then emit a target-relative mechanism profile for
each traced variant. Compare profiles using:

- baseline scheduler replay confidence and completeness;
- target-order legality and replay status;
- minimal bounded intervention sets and intervention kinds;
- unsupported dependency, latency, and resource outcomes;
- target/candidate register-role mappings and allocation requirements;
- delay-slot eligibility and desired-candidate state;
- preserved exact machine ranges and first divergence.

The report should explicitly identify cases such as:

```text
final assembly: equivalent to baseline
compiler mechanism: regressed
target replay: reproducible-with-interventions -> unsupported
reason: desired normalization selection is resource-blocked
```

Ranking should put hard preservation constraints first, then supported
mechanism progress, then opcode/count identity, with exact instruction count
only as a later tie breaker. Confidence and ambiguity must remain visible; a
smaller intervention count is not automatically better if the replay is
unsupported or based on weaker correspondence.

### Likely integration points

- `tools/agent/analyzeTargetSchedule.ts`
- `tools/agent/target-schedule/`
- `tools/agent/compilerTrace.ts`
- `tools/agent/variant-lab/`
- `tools/agent/source-shape-search/`

## 4. Experiment ledger and query tool

### Motivation

A resumed function can accumulate variant-lab runs, source-shape searches,
compiler traces, custom result JSON, and research notes across many sessions.
During `func_80019070`, determining whether pointer multi-set, header constant,
formal-type, and branch-shape hypotheses had already been tested required
manual searches through many unrelated artifact directories.

### Proposed behavior

Build `tools/agent/experimentLedger.ts` to index existing generated artifacts
without recompiling them. A per-function ledger could record:

- source, preprocessed, pass-bundle, DBR, assembly, and object hashes;
- mechanism and expected effect;
- exact score and mismatch classification;
- first divergence and later convergence stages;
- hard-register role signature;
- target-schedule profile and replay status when available;
- artifact paths, run IDs, and toolchain identity.

Useful queries include:

```text
Was single-vs-multi-set tested for the pointer role?
Which variants preserved target indexes 10..80?
Which variants retained t3/t6/t7 allocation?
Which source-distinct candidates converged to the same assembly?
```

The ledger should treat free-text semantic search as advisory and rely on
stable mechanism IDs and hashes for exact deduplication. It should never copy a
candidate to `src/` or infer that two C programs are semantically equivalent.

## 5. Concrete dependency probe

### Motivation

`analyzeTargetSchedule.ts` can propose abstract dependency, priority, lifetime,
and allocation interventions. It cannot currently prove that a source/compiler
mechanism realizing one relation will preserve the already-solved allocation
and suffix. Manual `func_80019070` probes showed that changing pointer or header
single-set eligibility could produce the intended early relation while
breaking `$t3` or swapping `$v0/$v1`.

### Proposed behavior

Add a strictly diagnostic tool, for example
`tools/agent/probeScheduleDependencies.ts`, that realizes a bounded set of
abstract interventions in temporary sources under `build/` and reports an
intervention realizability matrix:

- whether the requested dependency/priority relation appeared;
- whether sched1 target order improved;
- whether allocation changed;
- whether sched2 or delayed-branch behavior regressed;
- which exact target ranges survived.

Temporary zero-width dependencies may be useful as measurement instruments,
but their output must be labelled non-promotable and must never be written to
`src/`. The purpose is to learn which compiler-state relation a natural C shape
would need, not to synthesize a matching workaround.

## 6. Analogous-function finder

### Motivation

Source searches based on macro names miss useful precedents. A function may
implement a PSY-Q primitive constructor through direct field stores while
another uses `setSprt` or `setSemiTrans`, even though their machine-level field
layout and tag-linking suffix are strongly related.

### Proposed behavior

Build a target/source family finder that fingerprints functions using:

- normalized opcode and memory-offset patterns;
- constants with configurable wildcard roles;
- branch/diamond shape;
- relocation and global-access families;
- primitive length/code stores;
- common call or tag-link suffixes;
- call-graph neighborhood and function size.

It should return ranked precedents with the exact matching regions and links to
both source and assembly. It must remain a retrieval tool rather than assuming
that structurally similar functions had identical original source.

## 7. Same-input ASPSX versus maspsx differential

### Motivation

A pure instruction-order mismatch can tempt continued C-source search even
when an assembler emulation difference is plausible. Conversely, blaming
maspsx without feeding both assemblers identical cc1 output can hide a compiler
or source-web problem.

### Proposed behavior

Compile once, feed the exact same assembly text to real ASPSX and to
maspsx/GNU as, compare section bytes and relocations, and classify the
assembler boundary. Real ASPSX absence must produce `unavailable`, not a false
pass.

This idea already has a detailed implementation plan in
`plans/aspsx-same-input-differential.md`.

## 8. Indexed-global shape inference

### Motivation

Indexed global accesses often begin with an automatically generated scalar or
undersized declaration. For `func_80019070`, access width, index scaling, and a
six-element clamp supported the override `u16 D_80049044[6]`; its 12-byte size
also affected whether the expected absolute addressing family was selected.

### Proposed behavior

Build a read-only inference tool that combines target assembly, compiler trace,
control-flow bounds, and cross-function accesses to propose:

- element width and signedness evidence;
- array versus scalar/struct candidates;
- minimum proven extent;
- alignment evidence;
- expected GP-relative versus absolute addressing consequence;
- conflicting uses that make an override unsafe.

Suggestions should carry confidence and cite every contributing instruction or
bound. The tool may emit a proposed declaration in its report, but must never
edit generated headers or `globals_override.h` automatically.

## Shared constraints

All of these tools should follow the repository's established diagnostic
architecture:

- TypeScript run through `npx tsx`;
- active paths and toolchain facts from configuration, not hardcoded game data;
- generated outputs under `build/`;
- stable, versioned JSON plus bounded human-readable summaries;
- no random mutation or percentage hill climbing;
- no compiler patching, hard-register assignment, source flag hacks, automatic
  promotion, or commits;
- exact function diff, source policy, modification scope, and full build remain
  the acceptance gates.
