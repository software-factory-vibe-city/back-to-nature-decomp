# Plan: instruction survival and control-flow-aware source synthesis

**Status: proposed (2026-08-08).**

This plan addresses the diagnostic and source-grammar gaps exposed while
matching `func_80015594`. It extends the existing compiler-trace,
`explainDiff`, source-shape synthesis, and residual-source-search layers. It
does not replace their compiler pipeline, semantic graph, scheduler model,
source policy, or exact object oracle.

## Problem

A target-only final instruction is not necessarily evidence that the source
omits an operation.

The resumed `func_80015594` candidate compiled to 38 instructions against a
44-instruction target. Inventory and web parity correctly identified missing
final `sll 16` / `sra 16` shapes, but described them as a semantic defect. The
candidate's initial RTL already contained signed-short conversions for the
coordinate parameters. GCC later removed them because `setXY0` was in the
entry block and its halfword stores needed only the low bits.

The exact clean source changed no coordinate value. It moved the single
`setXY0` operation after the conditional join. That basic-block boundary kept
the register-argument conversions alive while GCC still folded stack-argument
conversions for width and height into `lh` loads. Combined with the existing
shared-variable/crossjump branch form and `return p + 1`, this changed the
candidate from 38/44 instructions to an exact 44/44.

Three tools missed the shortest route:

1. inventory compared only final machine multisets and could not distinguish
   "never generated" from "generated and optimized away";
2. compiler trace had all required pass data, but did not answer which
   target-only shapes existed earlier or name their first loss pass; and
3. source synthesis stopped at the control-flow boundary, while the decisive
   representation was a safe movement from before an `if` to its join.

The intermediate branch-duplicated `setXY0` form also showed why score alone is
insufficient. It restored all 44 instructions and web parity but reached only
40/44 because crossjump retained early coordinate-store birth order. The common
post-join form fixed the schedule without changing semantics.

## Goals

1. For every target-only final shape, report whether the candidate never
   generated it or generated it and lost it at a named pass.
2. Cite observed candidate UIDs, pseudos, blocks, consumers, and pass files;
   never invent target RTL.
3. Replace blanket "semantic defect" wording with confidence-labelled
   semantic, structural, and pass-survival findings.
4. Derive safe branch/join source alternatives automatically, including the
   winning `setXY0` placement class.
5. Recognize the established crossjump diamond and generate its natural
   shared-result source representation.
6. Keep every generated candidate as complete policy-clean C under `build/`;
   never mutate or promote `src/` automatically.

## Non-goals

- Recovering unique original source.
- Explaining an optimization only from a disappearing UID. A causal statement
  requires a mechanically checked predicate and a citation to the configured
  compiler source.
- Treating an early candidate RTL match as proof that target source had the
  same RTL.
- Adding dead arithmetic, volatile tricks, inline assembly, barriers, register
  pinning, or flag changes.
- Searching arbitrary CFG rewrites, `goto`, irreducible control flow, or loop
  transformations in the first implementation.
- Weakening exact function comparison or finalization.

---

# Deliverable 1: candidate pass-survival analysis

Add a reusable library and one registered CLI:

```text
tools/agent/analyzeInstructionSurvival.ts

tools/agent/instruction-survival/
├── machine-shapes.ts
├── rtl-shapes.ts
├── pass-lineage.ts
├── idiom-packets.ts
├── lemma-catalog.ts
├── analyze.ts
├── render-text.ts
├── types.ts
└── instruction-survival.test.ts
```

Suggested CLI:

```bash
npx tsx tools/agent/analyzeInstructionSurvival.ts func_80015594
npx tsx tools/agent/analyzeInstructionSurvival.ts func_80015594 --json
```

It should reuse the immutable compiler-trace bundle when hashes match and
refresh it otherwise. It must not implement another compiler invocation.

## 1.1 Seed shapes

Start from target-only shapes reported by exact alignment, web parity, and
inventory. Preserve multiplicity and context. Model both individual machine
operations and bounded idiom packets, initially:

- sign extension: `sll r,r,16` followed through def/use by `sra r,r,16`;
- zero extension and masks;
- wide constant materialization (`lui` plus low-half operation);
- narrow and wide memory operations;
- copies and arithmetic operations already normalized by `webAnalysis.ts`;
- branch-value diamonds and their merge store.

Do not compare strings alone. Machine and RTL shapes need typed operation,
mode, constant, memory width, and def/use roles. Register names are allocation,
not shape identity.

## 1.2 Candidate lineage

For every seed, search the candidate's ordered dump chain:

```text
rtl -> jump -> cse -> gcse -> loop -> cse2 -> addressof -> flow ->
combine -> regmove -> sched -> lreg -> greg -> flow2 -> sched2 -> jump2 ->
dbr -> mach
```

Reuse `compiler-trace/rtl-parser.ts`, pseudo transitions, stage metadata, and
final `-dp` emission attribution. Record:

- earliest candidate occurrence;
- last stage where it exists;
- first stage where it is absent or transformed;
- UID and pseudo lineage when exact;
- source line and basic block when available;
- consumers at the last surviving stage;
- replacement instruction(s), if a typed transition can be reconstructed;
- ambiguity and competing candidate occurrences.

Terminal classifications:

```ts
type SurvivalStatus =
  | "never-born"
  | "born-and-emitted"
  | "born-then-deleted"
  | "born-then-folded"
  | "born-then-substituted"
  | "ambiguous-lineage";
```

`born-then-*` is a claim only about the candidate. The target has no RTL dump.

## 1.3 Confidence

- **exact:** same UID/pseudo lineage or compiler `-dp` attribution proves the
  transition;
- **reconstructed:** typed def/use and expression correspondence identify one
  transition but UIDs changed;
- **inferred:** the shape exists in the relevant pass window but multiple
  lineages are possible.

Ambiguity must remain visible. Never choose the nearest UID merely because it
produces a useful explanation.

## 1.4 Artifacts

Write:

```text
build/instructionSurvival/<function>/<run-id>/
├── baseline.json
├── seeds.json
├── lineages.json
├── lemmas.json
├── summary.json
└── summary.txt
```

The run identity includes source, preprocessed source, compiler, flags, dump,
target object, and analysis schema hashes.

---

# Deliverable 2: proof-backed optimization lemma catalog

A disappearing candidate shape identifies a pass, not a cause. Add a small
catalog of mechanically checked pass-survival lemmas. Every lemma contains:

```ts
interface SurvivalLemma {
  id: string;
  decidingPass: string;
  compilerSource: { file: string; symbol: string; lines: string };
  applies(context: CandidateTransitionContext): LemmaResult;
  sourceMechanisms: SourceMechanism[];
}
```

A lemma result is `applies`, `does-not-apply`, or `unknown`. `unknown` is never
rendered as a recommendation.

## Initial lemma: signed narrowing into a narrow store

Use the vendored GCC source to identify and cite the exact `combine.c` rule(s)
that allow a sign-extension chain to disappear when only a low subreg reaches a
narrow memory destination. The implementation gate is not complete until the
exact function/rule and source lines have been verified with
`psx_compiler_source`; a prose recollection is insufficient.

The checked context should include:

- `ashift 16` / `ashiftrt 16` or equivalent `sign_extend` RTL;
- the final consumer's mode and memory width;
- whether producer and consumer are available to the deciding combine window;
- block membership and intervening uses;
- the exact replacement narrow store or load when reconstructed.

Its source suggestions may include "move an already-independent consumer to an
existing successor/join block" only when Deliverable 4 proves that movement
semantically safe. The lemma alone must not prescribe a source edit.

## Later lemmas

Add only from validated cases:

- duplicate branch stores merged by crossjump;
- constant birth removed or moved by jump optimization;
- copy propagation that deletes an administrative web before sched1;
- load plus extension folded into a signed/unsigned narrow load;
- address and mask formation folded into a memory operation.

Each lemma needs unit tests, a synthetic compiler fixture, and at least one
real-case replay. A catalog entry without a deciding source citation does not
ship.

---

# Deliverable 3: correct inventory and classifier semantics

The current doctrine overstates what a final multiset proves. Offsets,
constants, and shifts are invariant to scheduling and allocation, but not to
jump optimization, CSE, combine, crossjump, or dead-store elimination.

Change reporting to distinguish:

1. **semantic-content evidence:** for example, a unique target field offset and
   access width absent from every candidate pass/source binding;
2. **structural-content difference:** final multiplicity differs, but an
   optimization or control-flow representation may explain it;
3. **pass-survival difference:** the target-only final shape exists in
   candidate RTL and is lost at a named pass; and
4. **unknown:** insufficient trace or correspondence.

`triage` remains cheap. Before a compiler trace exists it may report inventory
as a structural blocker for allocation/scheduling work, but it must not claim
that every target-only constant or shift proves different runtime semantics.
After a survival report exists, `explainDiff` should refine the finding.

Example target output for the pre-fix `func_80015594` source:

```text
RTL SURVIVAL
  target-only packet: sll 16 -> sra 16 (x0)
  candidate: born in .rtl, last present before combine
  first loss: combine
  last consumer: HI store to TILE.x0
  CFG: conversion block 0, consumer block 0
  lemma: signed-narrow-store (applies; compiler source cited)
  safe source region: candidate setXY0 may move after join block 3
```

Update the mandatory style guide and skill only after this distinction is
implemented and tested. Until then, existing workflow text remains unchanged.

---

# Deliverable 4: branch/join semantic regions

Extend the active semantic graph and source-role binding with explicit
control-flow regions:

```ts
interface JoinRegion {
  conditionNode: string;
  predecessorBlocks: string[];
  joinBlock: string;
  beforeBranch: string[];
  thenTail: string[];
  elseTail: string[];
  afterJoin: string[];
  evidence: string[];
}
```

The model must prove scalar and memory dependencies across the branch. Known SDK
macros remain atomic operations with effects derived from their configured,
hashed definitions.

## 4.1 Safe cross-boundary movement

Admit movement from immediately before a branch to immediately after its join
only when:

- the condition is pure with respect to the moved operation;
- every path reaches the join exactly once;
- there is no early return, call, unknown memory effect, protected barrier, or
  exceptional control edge;
- moved scalar definitions dominate all resulting uses;
- intervening operations access disjoint proven memory regions or commute by a
  typed semantic rule; and
- observable volatile behavior is absent.

For `func_80015594`, `setXY0` writes TILE offsets `0x8` and `0xA`, while the
branch writes code offset `0x7` and reads only `cond`. The field map proves the
movement safe.

## 4.2 Factor and duplicate across arms

Admit these inverse forms when their proof obligations hold:

```c
/* Common after join. */
if (c) { A; } else { B; }
S;

/* One execution, duplicated text. */
if (c) { A; S; } else { B; S; }
```

The operation still executes exactly once. Unknown macros, aliasing memory, and
non-exhaustive control flow freeze the form.

This axis is useful both for preserving a web through combine and for changing
which UIDs crossjump retains. It must be ranked by mechanism evidence, not match
percentage.

## 4.3 Shared branch result and crossjump form

Recognize a target branch-value diamond with one merge store and derive:

```c
if (cond) {
    value = A;
    store(value);
} else {
    value = B;
    store(value);
}
```

The shared variable is required: direct constants may leave non-identical store
tails. Validate the candidate pass sequence:

- early jump optimization does not collapse the desired diamond;
- final crossjump merges identical store tails;
- delayed-branch filling places the branch constants as expected.

The detector should cite the sibling/target shape but remain function-generic.

---

# Deliverable 5: synthesis and residual-search integration

Extend `source-shape-synthesis` to consume applicable survival lemmas and join
regions. Add recipe families:

- `before-branch` versus `after-join` placement;
- `common-after-join` versus `duplicated-in-arms`;
- shared branch result/crossjump form;
- branch arm source order when the final values are equivalent;
- known macro retained as one operation versus an already-supported verified
  component form.

Extend `residual-source-search` with a versioned `control-flow-placement` axis.
The axis must provide exact counting and rank/unrank like every existing axis.
If a join cannot be proved safe, record the suppressed axis and reason.

The synthesizer's current `no-safe-recipe-for-requirement` result should become
an honest handoff to this region model rather than a terminal refusal whenever
the mismatch is tied to a supported `if`/join.

Generated candidates stay under `build/`; exact candidates still require manual
inspection, `diffFunc`, context export, and finalization.

---

# Deliverable 6: sibling structural similarity

After the survival and join work is useful, add an advisory nearest-neighbour
report to the call-graph/context layer. Rank matched functions by:

- normalized opcode n-grams and exact common prefixes/suffixes;
- CFG shape and branch diamonds;
- SDK primitive/known-macro fingerprints;
- constants, field offsets, and packet stride;
- address adjacency and file-grouping evidence.

For this case it should identify `func_800154CC` as the strongest matched
primitive-initializer analogue. This report is advisory only: similarity does
not prove same TU, source, or compiler state.

Do not block Deliverables 1-5 on this phase.

---

# Tests

## Unit tests

- machine-to-RTL shape normalization;
- multi-instruction sign-extension packet recognition;
- UID-preserving and UID-changing pass lineage;
- ambiguous lineage remains ambiguous;
- first-loss-pass calculation;
- lemma three-way verdicts and compiler-source citations;
- join discovery with exhaustive and non-exhaustive branches;
- disjoint and aliasing field effects;
- factor/duplicate semantic proof;
- exact count and rank/unrank for control-flow-placement axes;
- no source mutation and clean-source policy enforcement.

## Synthetic compiler fixtures

1. a signed-short conversion folded into a halfword store;
2. the same conversion retained when its consumer is in a successor block;
3. a stack load plus conversion folded into `lh`, to prevent an over-broad
   "all cross-block conversions survive" rule;
4. a branch whose direct constant assignments collapse;
5. the shared-variable branch-store form whose tails crossjump;
6. a duplicated-arm operation that changes birth order but remains semantically
   identical;
7. an aliasing or side-effecting branch where movement is correctly refused.

## Real integration gate: `func_80015594`

Preserve a pre-fix source fixture under the test tree or `build/` test setup; do
not rewrite production source during the test.

The tooling must:

- reproduce the 44-target/38-candidate structural delta;
- find the coordinate `sll/sra` packets in initial RTL;
- identify combine as their first loss pass with checked evidence;
- distinguish the coordinate-register case from stack width/height folding;
- derive the common `setXY0`-after-join candidate automatically;
- preserve `setTile`, `setRGB0`, `setXY0`, `setWH`, and `addPrim` idioms;
- produce a full configured 44/44 exact object;
- leave `src/func_80015594.c` untouched.

Production UIDs, hard registers, and source line numbers must not be hardcoded in
the implementation.

---

# Implementation phases

## Phase 1: survival report, no recommendations

Implement typed shape normalization, lineage, artifacts, and text/JSON output.
Integrate a bounded `RTL SURVIVAL` section into compiler trace and
`explainDiff`.

Gate: the real fixture reports `born-then-*` and the first loss pass without a
causal claim.

## Phase 2: initial proof-backed lemmas

Verify the exact GCC rules, implement the narrow-store and crossjump lemmas, and
add synthetic fixtures.

Gate: every recommendation cites compiler source and passes its applicability
predicate; unsupported cases remain `unknown`.

## Phase 3: inventory/classifier correction

Introduce semantic/structural/survival confidence classes and update output,
documentation, and workflow gates.

Gate: missing unique field accesses remain strong semantic evidence, while the
pre-fix coordinate shifts are no longer mislabeled as necessarily missing
semantics.

## Phase 4: join-aware semantic model and synthesis

Implement safe movement, factor/duplicate forms, shared branch results, exact
counting, and complete-source rendering.

Gate: the `func_80015594` fixture derives and finds the exact post-join form
without a hand-authored variant manifest.

## Phase 5: workflow and sibling support

Register the CLI/Pi wrapper, update `README.md`,
`notes/tools-directory-structure.md`, the mandatory skill/style guide, and add
the advisory sibling report.

Gate: registration tests, tool tests, source policy, exact fixture checks, and
`make check` all pass.

# Acceptance criteria

The plan is complete when:

1. target-only shapes are classified as never born, emitted, deleted, folded,
   substituted, or ambiguous across the candidate pass chain;
2. the first loss pass and all candidate-side evidence are reproducible from
   typed artifacts;
3. causal explanations and source suggestions require checked compiler-source
   lemmas;
4. inventory no longer equates every final multiset difference with different
   runtime semantics;
5. branch/join source alternatives are generated only under explicit semantic
   proofs and exact finite accounting;
6. the pre-fix `func_80015594` fixture automatically yields the exact clean-C
   post-join form;
7. no tool mutates or promotes source, and all generated forms obey clean-source
   policy; and
8. repository tests and full binary verification pass.
