# Plan: CSE-aware repeated-expression source synthesis

**Status: SUPERSEDED 2026-08-09 by
`plans/residual-source-search-completion.md`. Never implemented.**

No `expression-reuse-form` axis exists; `rewrite-catalog.ts` still records
`expression-materialization` in `SUPPRESSED_BASE`. The design is carried
forward whole as Deliverable 2 of the successor plan, which keeps this
document's semantic proof obligations, two canonical forms, radix-2 group
counting, and pass-mechanism grading verbatim in intent.

The original body follows unchanged for the institutional record.

This plan adds one focused expression-materialization mechanism to the existing
compiler-trace, source-shape synthesis, and residual-source-search pipeline. It
is the concrete implementation of the currently suppressed "materialized common
subexpression versus repeated expression" part of rule 4.3 in
`plans/deprecated/automatic-residual-source-space-search.md`.

It does not add a general C optimizer, another compiler pipeline, or a source
promotion path.

## Problem

A target-only register-copy web can be produced by ordinary C that repeats a
nonvolatile memory expression across a control-flow boundary.

The pre-fix source for `func_80015AAC` named and reused the loaded value:

```c
value = *(u16 *)ptr;
if (value >= 0xFFFE) {
    return 0;
}
offset = value * 4;
```

GCC reused the same value pseudo and combined the copy and scale into one
instruction. The candidate reached 24/30 exact words but lacked the target's
one-use copy web:

```asm
move v0,a0
sll  v0,v0,2
```

The matching clean source instead repeats the expression:

```c
if (*(u16 *)ptr >= 0xFFFE) {
    return 0;
}

offset = *(u16 *)ptr * 4;
```

There is no call, store, volatile access, or pointer mutation between the two
reads. GCC's CSE pass replaces the repeated fall-through load with a fresh
register copy of the checked value. The control-flow boundary keeps that copy
separate from the scale, and delayed-branch scheduling places the copy in the
branch delay slot. The result is byte-identical, 30/30.

The previous residual search exhausted 8,060 candidates over web partitions and
statement orders, but its grammar did not contain this expression-repetition
axis. Its `exhausted-no-exact` result was honest for the serialized grammar, but
the grammar omitted the winning source family.

## Goal

Automatically recognize and exhaust the finite source choice between:

```text
materialize once into a named value
repeat the same safe expression at dominated uses
```

when compiler and target evidence indicate that CSE-created copy provenance may
explain a missing register web.

For the motivating mismatch class, the tool should turn a one-target-only-copy
web into a two-form, mechanism-graded source experiment and confirm the exact
candidate without mutating `src/`.

## Non-goals

- Recovering unique original source.
- Repeating calls, volatile reads, assignments, increments, or unknown macros.
- Adding dead arithmetic, volatile tricks, barriers, inline assembly, register
  pinning, pragmas, or flag changes.
- Inventing target RTL. All pass-level claims concern the compiled candidate.
- Treating every target `move` as a CSE problem.
- Enumerating arbitrary expression duplication or algebraic identities.
- Automatically promoting an exact generated candidate.

---

# Proposed architecture

Add a reusable analysis/recipe library:

```text
tools/agent/cse-source-forms/
├── expression-equivalence.ts
├── stability.ts
├── detect.ts
├── derive.ts
├── grade.ts
├── render-text.ts
├── types.ts
└── cse-source-forms.test.ts
```

Initially expose it through the existing solution layers rather than creating a
second evaluator:

- `synthesizeSourceShapes.ts` derives a small requirement-guided recipe;
- `searchResidualSourceSpace.ts` includes the form as an exactly counted grammar
  axis; and
- `fuzzVariants.ts`/the shared pass-diff code grades the predicted
  `rtl -> cse -> combine -> sched -> dbr` mechanism.

If a direct diagnostic is useful after the library stabilizes, add and register:

```text
analyzeCseSourceForms.ts
```

The direct tool must only report applicability and preserved generated
candidates. It must not accept arbitrary edits or modify source.

## Relationship to existing plans

- This plan implements one bounded subcase of expression materialization from
  `plans/deprecated/automatic-residual-source-space-search.md` rule 4.3.
- It reuses the whole-function semantic graph, causal closure, exact counting,
  enumeration, compiler pipeline, and object oracle from residual search.
- It complements `plans/deprecated/instruction-survival-and-control-flow-source-synthesis.md`:
  that plan asks where a candidate operation disappears; this plan asks whether
  a repeated source expression causes CSE to create a missing copy operation.
- It does not depend on completion of the broader tree-sitter or instruction-
  survival plans. The first implementation may support only source regions the
  active semantic graph can prove safe.

---

# Deliverable 1: detect the mismatch signature

Derive a confidence-labelled candidate when all of the following evidence is
available.

## 1.1 Machine/web evidence

The preferred activation signature is:

1. web parity reports one target-only, one-use register-copy web;
2. the target copy feeds an arithmetic, shift, address, or conversion operation
   in a successor/fall-through block;
3. the candidate performs the corresponding consumer directly from the
   checked/previous value, or combine has fused the copy with that consumer;
4. target/candidate value provenance aligns the copy source with a candidate
   value produced by a load or other repeatable pure expression; and
5. instruction correspondence is unambiguous enough to bind the candidate
   producer, branch use, and fall-through consumer.

This evidence activates and prioritizes the recipe. It is not a claim about the
target's original RTL.

## 1.2 Source evidence

Bind the machine roles to a source shape equivalent to:

```c
T value;
value = E;
if (guard(value)) {
    /* exit or alternate path */
}
result = consume(value);
```

The first implementation supports:

- one definition `value = E`;
- one guard use;
- one dominated fall-through use;
- an `if` with an early return or an exhaustive branch whose selected use is
  reached only on the stable path; and
- `E` as a side-effect-free scalar expression or nonvolatile memory read.

More uses, joins, loops, and switches remain frozen and are reported as
unsupported rather than guessed.

## 1.3 Output

The analysis records:

- target copy and consumer indexes;
- candidate final UIDs and pseudo provenance where available;
- source definition, guard use, and fall-through use spans;
- canonical expression `E` and its memory effects;
- the exact safety proof or suppression reason;
- expected pass effect; and
- confidence: `exact`, `reconstructed`, or `inferred`.

Ambiguous machine alignment may still permit the general residual grammar to
include a semantically safe expression axis, but it must not be presented as a
target-directed CSE diagnosis.

---

# Deliverable 2: prove that repetition is semantically safe

The transformation is admitted only when repeating `E` preserves observable C
behavior under the configured source model.

## 2.1 Expression requirements

`E` must:

- contain no assignment, increment/decrement, comma side effect, call, volatile
  access, or unknown macro evaluation;
- read only scalar values whose definitions are unchanged between evaluations;
- use the same casts, load width, signedness, address expression, and field or
  array location at every rendered use; and
- have no undefined or implementation-dependent behavior introduced by the
  repetition.

## 2.2 Memory stability

For a repeated memory read, the interval between the guard evaluation and the
fall-through evaluation must contain:

- no write that may alias the read region;
- no call or unknown memory effect;
- no protected barrier or volatile operation; and
- no mutation of any pointer/index value used to form the address.

Disjoint fixed-field/global regions may be accepted only when the existing
memory-effect model proves them disjoint. Unknown aliasing suppresses the rule.

## 2.3 Path behavior

The transformed source may evaluate `E` twice on the fall-through path and once
on the exit path. This is equivalent only because `E` is proven repeatable and
stable. The proof artifact must state this explicitly; "CSE will remove it" is
not a semantic proof.

Negative examples that must be refused:

```c
if (*volatile_ptr >= limit) { ... }
result = *volatile_ptr * 4;

if (*p++ >= limit) { ... }
result = *p++ * 4;

value = *p;
unknown_call();
result = value * 4;

value = *p;
*p = replacement;
result = value * 4;
```

---

# Deliverable 3: finite source recipe

Add a grammar axis named `expression-reuse-form` with two canonical forms.

## 3.1 Materialized-once form

Preserve the baseline representation:

```c
value = E;
if (guard(value)) {
    return fallback;
}
result = consume(value);
```

## 3.2 Repeated-at-use form

Remove the now-unused materialization and substitute the exact expression at
both selected uses:

```c
if (guard(E)) {
    return fallback;
}
result = consume(E);
```

The renderer must preserve C89 declarations, comments outside replaced spans,
parentheses, explicit casts, and surrounding statement order. If removing the
value would require unsafe declarator surgery, retain the declaration only when
that is valid and compiler-inert; otherwise suppress the form.

## 3.3 Bounds and counting

The first grammar version admits only independently proven two-use groups. Each
group contributes radix 2. Groups whose source spans overlap or whose
transformations interact are combined into one validated axis or frozen.

The domain report lists:

```text
expression-reuse-form:
  group value-<id>: materialized-once | repeated-at-use
  activation: target-only-copy-web | general-causal-closure
  proof: <stability evidence>
```

No per-function transform manifest or tuning knob is accepted. A schema bump is
required because an `exhausted-no-exact` result now covers a larger grammar.

---

# Deliverable 4: pass-mechanism grading

Compiling a repeated expression does not guarantee the desired copy survives.
Grade each complete candidate through the existing pass chain.

Expected successful progression:

```text
rtl      repeated expression has a distinct evaluation/result provenance
cse      redundant memory evaluation is replaced by a register copy
combine  copy remains distinct from its consumer
sched    copy and consumer remain in the intended blocks/order
sched2   allocation hazards do not destroy the target-relative order
dbr      copy occupies the required branch delay slot when applicable
object   exact byte comparison succeeds
```

Machine-readable statuses:

```ts
type CseFormStatus =
  | "not-applicable"
  | "generated-no-distinct-provenance"
  | "repeated-load-survived-cse"
  | "cse-copy-born"
  | "cse-copy-folded"
  | "cse-copy-survived"
  | "schedule-diverged"
  | "exact";
```

A causal `cse-copy-born` claim requires observed candidate pass data. A source
shape plus an improved match score is insufficient.

Reports rank the mechanism status before instruction score and cite the first
meaningful pass divergence from the materialized baseline.

---

# Deliverable 5: synthesis and residual-search integration

## 5.1 Requirement-guided synthesis

When target-schedule/web analysis reports a target-only one-use copy tied to a
repeatable expression, `synthesizeSourceShapes` should emit the two-form recipe
before trying unrelated statement permutations, allocator changes, or scheduler
state search.

Generated source remains under `build/sourceShapeSearch/` and is never copied to
`src/` automatically.

## 5.2 Automatic residual search

The residual semantic graph should discover every applicable group inside the
causal closure. `grammar.json` records:

- admitted expression groups;
- suppressed groups and exact reasons;
- activation evidence;
- safety proof summaries;
- axis radix and interaction constraints; and
- the new grammar schema version.

This closes the specific coverage gap in the 8,060-candidate
`func_80015AAC` run: the winning repeated expression must be a coordinate in the
new domain.

## 5.3 Exact-candidate handling

An exact generated candidate is evidence, not a promotion. Normal workflow
still requires:

1. inspect the complete source;
2. deliberately apply the clean-C edit;
3. rerun triage after the structural edit;
4. run exact `diffFunc`;
5. export context; and
6. run the full finalizer.

---

# Deliverable 6: artifacts and reporting

Reuse residual-search artifacts. If the optional direct diagnostic is added,
write:

```text
build/cseSourceForms/<function>/<run-id>/
├── baseline.json
├── groups.json
├── safety-proofs.json
├── variants.json
├── pass-grades.json
├── summary.json
└── summary.txt
```

The run identity includes source, preprocessed source, target object, compiler,
flags, semantic-graph schema, and recipe schema hashes.

Example report:

```text
CSE SOURCE FORM
  source value: value_1
  expression: nonvolatile u16 load through ptr_1
  uses: guard in block 0; scale in fall-through block 1
  stability: proven; no calls, writes, volatile operations, or address mutation
  target evidence: one target-only copy web feeding the scale
  repeated form:
    rtl      distinct provenance
    cse      copy born
    combine  copy survived
    dbr      copy selected for branch delay slot
    object   exact
```

---

# Tests

## Unit tests

- identify a two-use materialized expression across an early-return guard;
- canonical expression equality through harmless parentheses;
- preserve load width, signedness, and casts;
- prove fixed-region stability with no intervening effects;
- reject volatile reads, calls, side effects, pointer mutation, and aliasing
  stores;
- exact source-span replacement and safe unused-declaration handling;
- exact radix/count and unrank for one and multiple independent groups;
- overlapping groups are combined or suppressed, never double-edited;
- ambiguity remains visible rather than selecting a useful correspondence.

## Synthetic compiler integration tests

Create a fixture pair where:

1. the target is compiled from a repeated nonvolatile load across a guard;
2. the baseline materializes the load once;
3. the baseline lacks one copy web because combine fuses the consumer;
4. the tool derives both forms without a hand-authored manifest;
5. the repeated form produces a CSE-created copy and exact object; and
6. the materialized form remains in the domain as the baseline coordinate.

Also include fixtures where:

- CSE does not eliminate the repeated load;
- CSE creates a copy but combine deletes it;
- an intervening aliasing store suppresses the recipe;
- an unknown call suppresses the recipe; and
- an unrelated target `move` does not falsely activate this mechanism.

## Real integration gate: `func_80015AAC`

Preserve the pre-fix clean source as a test fixture; do not rewrite production
source during the test.

The tooling must:

- reproduce the 30-instruction target and 24/30-word baseline;
- identify the single target-only one-use copy web at the first fall-through
  operation;
- bind the checked loaded value to the guard and scale uses;
- prove the repeated `u16` load stable;
- derive the repeated-expression candidate automatically;
- observe the copy's birth/survival through candidate pass artifacts;
- produce a full configured 30/30 exact object; and
- leave `src/func_80015AAC.c` untouched.

Production pseudo numbers, UIDs, hard registers, and source line numbers must not
be hardcoded.

---

# Implementation phases

## Phase 1: derivation-only safety report

Implement expression equivalence, source-role detection, memory/path stability,
and suppression reasons. Emit no source variants.

Gate:

- positive and negative semantic fixtures pass;
- the pre-fix real fixture derives one safe group; and
- no compiler mechanism is claimed before compiling a variant.

## Phase 2: bounded recipe and pass grading

Render the two canonical forms under `build/`, compile them through the shared
pipeline, and grade `rtl` through `dbr`.

Gate:

- the synthetic positive fixture reaches `cse-copy-born` and exact;
- negative fixtures are refused or honestly graded; and
- no generated source violates policy.

## Phase 3: source-shape synthesis integration

Teach requirement-guided synthesis to prioritize this recipe for a target-only
copy web with matching provenance.

Gate:

- the real fixture is solved without an operator-authored variant manifest;
- generated candidates remain inspectable and unpromoted.

## Phase 4: residual-source-search integration

Add the exactly counted `expression-reuse-form` axis, schema versioning,
checkpoint/run-identity coverage, and domain reporting.

Gate:

- the former 8,060-candidate real fixture's new domain contains an exact
  coordinate;
- an exhausted result includes this axis in its serialized coverage claim; and
- exact counting, resume, and canonical deduplication tests pass.

## Phase 5: workflow and documentation

If a direct analyzer is added, register its Pi wrapper and update:

- `README.md`;
- `notes/tools-directory-structure.md`;
- the decompilation skill; and
- the C style guide's web-parity and repeated-expression guidance.

The workflow should route this mismatch class to the CSE recipe before broad
scheduler or allocator searches.

---

# Acceptance criteria

The plan is complete when:

1. safe named-reuse versus repeated-expression forms are derived automatically
   from the semantic graph and causal closure;
2. every repeated form carries a conservative semantic stability proof;
3. target-directed activation requires a supported target-only-copy/provenance
   signature and never invents target RTL;
4. candidate pass reports distinguish copy birth, folding, survival,
   scheduling, and exact output;
5. the grammar is finite, exactly counted, schema-versioned, deterministic, and
   resumable;
6. the pre-fix `func_80015AAC` fixture automatically yields the exact repeated-
   load source form;
7. generated candidates remain policy-clean under `build/` and are never
   promoted automatically; and
8. repository tests and full verification pass for the tooling change.
