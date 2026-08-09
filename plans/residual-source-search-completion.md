# Plan: complete the residual source-representation search

**Status: proposed (2026-08-09).**

This plan consolidates four documents that all described one subsystem — the
search over semantics-preserving source representations of a function — and
that had drifted into disagreement about what exists:

| consolidated plan | real state on 2026-08-09 | carried here as |
|---|---|---|
| `deprecated/automatic-residual-source-space-search.md` | Deliverables 1-11 delivered, grammar schema 5 | the architectural spine; unchanged |
| `deprecated/tree-sitter-frontend-and-loop-aware-grammar.md` | all five phases delivered; header said "not started" | nothing open |
| `deprecated/instruction-survival-and-control-flow-source-synthesis.md` | never implemented | Deliverables 4 and 5 |
| `deprecated/cse-repeated-expression-source-synthesis.md` | never implemented | Deliverable 2 |

It changes no delivered layer. The causal closure, exact counting, unrank
enumeration, canonicalization, checkpointing, and byte-identical object oracle
are sound and are not touched.

## Why this consolidation exists

Two front ends search source representations, and the weaker one is the one the
skill routes to.

`tools/agent/synthesizeSourceShapes.ts` and `source-shape-synthesis/` model a
*contiguous top-level prologue* with hand-written regular expressions.
`tools/agent/searchResidualSourceSpace.ts` and `residual-source-search/` model
the *whole function* with tree-sitter. Measured across the 180 decompiled C
functions in `src/` (284 `INCLUDE_ASM` stubs excluded):

| | functions the model can represent |
|---|---|
| `source-shape-synthesis` prologue model | **35 of 180 (19.4%)** |
| `residual-source-search` semantic graph | whole function, unsupported regions frozen rather than truncating the model |

The 145 refusals are not "no safe recipe exists". They are the prologue grammar
declining to parse ordinary C: 20 functions blocked on a non-identifier
assignment target (`obj->f = 0`, `*p = x`, `a[i] = x`), 15 on a call that is not
one of the three entries in its macro registry, 10 on array declarators and
storage-class qualifiers, and 86 on the function's work living past the first
`{`. Every one of those constructs is already modelled by the semantic graph.
`func_80021484` is representative: the prologue model stops at `char
status[24];`, while the semantic graph resolves all eleven of its nodes,
including the four movable statements inside the `if` body where the mismatch
actually is.

The synthesizer's `no-safe-recipe-for-requirement` result therefore carries
almost no evidence, and its `Requirements with source-role coverage: n/m` line
carries none at all: `roles` is computed, serialized, and never read by
`configurations()` or by any ordering or pruning decision.

This was already recorded by hand in
`notes/research/func_80021E60-sched1-single-set-priority-gap.md`:
*"`psx_synthesize_source_shapes` refuses (mismatch is inside an `if` body,
outside the prologue subset)."*

## Delivered baseline (verified 2026-08-09, do not re-plan)

Anything in this table is done. A future plan that proposes it again is a
regression of institutional memory, which is the specific failure this
consolidation repairs.

| capability | evidence |
|---|---|
| tree-sitter C front end, vendored and hashed into run identity | `residual-source-search/tree-sitter-c.ts`, `web-tree-sitter` in `package.json`, `tools/vendor/tree-sitter-c`, `C_FRONTEND_IDENTITY` in the manifest |
| whole-function semantic graph, frozen-node degradation | `semantic-graph.ts`; node kinds `declaration`/`assign`/`store`/`call`/`known-macro`/`if`/`return`/`barrier`/`unknown`; `frozenNode()` |
| control-flow blocks | `SemanticBlock.kind` ∈ `entry`/`then`/`else`/`loop-init`/`loop-update`/`loop-body`/`case` |
| loop-carried dependence edges | `topological-orders.ts: loopCarriedDependencies`, applied per region in `enumerate.ts` |
| diff-seeded causal closure | `compiler-closure.ts` |
| grammar schema 5 | web split/merge, dependency-valid statement orders, declaration-birth forms, known-macro component forms, diff-named constant materialization, witness-activated administrative copies, loop-update placement, switch↔if/else-if |
| no-knob CLI, cost report, automatic checkpoint/resume | `searchResidualSourceSpace.ts` takes only `--source`, `--derive-only`, `--json`; `cost-report.ts`; `checkpoint.ts` |
| exact counting, unrank, sharding, full-object oracle | `enumerate.ts`, `evaluate.ts`, `run.ts` |
| Pi tool wrapper | `psx_search_residual_source_space`, registered from `diagnostics.ts` under `.pi/extensions/psx-decomp/tools/` |

Two strata were **measured and permanently retired**, not deferred. Do not
resurrect them without new measurement:

- `compound-assignment-form` — `x op= e` and `x = x op (e)` compile identically
  through the configured compiler across scalar, pointer, element, field,
  shift, multiply, divide, modulo, and increment fixtures.
- `loop-form` — `for (init; c; )` with a tail update and `init; while (c)`
  compile identically, and `do`/`while` is not an equivalence at all unless the
  body provably runs at least once, which the tree cannot establish.

## What remains

Three grammar strata and one diagnostic layer, plus the front-end
consolidation that makes any of it reachable from the normal workflow.

---

# Deliverable 1: one front end

The highest-value change in this plan requires no new search capability. It
routes the workflow to the model that can represent the function.

## 1.1 Route the skill

`.pi/skills/psx-decompile-function/SKILL.md` step 7 names
`psx_synthesize_source_shapes` and never names
`psx_search_residual_source_space`, although that wrapper is registered in
`diagnostics.ts` and has been for some time — Deliverable 11 of the spine plan
delivered its tool half and left the skill half undone. Invert the order: derive
and price the residual domain first, and treat an explicit
`psx_search_source_shapes` specification as the fallback for a hypothesis the
automatic closure does not reach.

The `--derive-only` price must be stated before a run is launched, so the step
must instruct pricing first and reading the per-axis breakdown, since the only
lever on a `domain-too-large` result is a smaller residual.

## 1.2 Parity gate, then retire the MVP

Do not delete `synthesizeSourceShapes.ts` on argument. Delete it on evidence.

Gate: for each of the 35 functions the prologue model can currently represent,
`searchResidualSourceSpace --derive-only` must derive a domain that contains
every statement-order and declaration-birth alternative the synthesizer derives
for that function. The comparison is over rendered candidate sources after
canonicalization, not over plan JSON.

When the gate passes, remove `tools/agent/synthesizeSourceShapes.ts`,
`tools/agent/source-shape-synthesis/`, and the
`psx_synthesize_source_shapes` wrapper, and update
`notes/tools-directory-structure.md` and `notes/potentially-useful-tools.md`
in the same change.

`searchSourceShapes.ts` **stays**. A hand-authored finite specification is a
legitimate operator tool for a hypothesis outside the automatic grammar, and
the residual search does not replace it.

Nothing operational is lost with the synthesizer: its one unique output, the
target-schedule requirement role binding, never influenced candidate selection.
If requirement-seeded scope is later wanted as an alternative to diff-seeded
scope, it belongs in `compiler-closure.ts` as a second seed set, with its own
evidence, not as a second front end.

## Acceptance

- Step 7 of the skill routes to residual search first, with pricing before
  launch, and names the fallback conditions for an explicit specification.
- The parity gate is a checked-in test over the 35-function list, not a manual
  comparison.
- After retirement, no document or tool registry references the removed module.

---

# Deliverable 2: expression-reuse form (rest of rule 4.3)

Carried from `deprecated/cse-repeated-expression-source-synthesis.md`, whose
motivating case is `func_80015AAC`: a target-only one-use copy web
(`move v0,a0` / `sll v0,v0,2`) that ordinary C produces by *repeating* a
nonvolatile memory expression across a control-flow boundary rather than naming
it once.

`rewrite-catalog.ts` currently records `expression-materialization` in
`SUPPRESSED_BASE` with the reason that only literal known-macro constant
arguments are materialized. This deliverable removes the general part of that
suppression.

## 2.1 Semantic proof obligations

Repetition of an expression `E` is admitted only when `E` contains no
assignment, increment, comma side effect, call, volatile access, or unknown
macro evaluation; reads only scalars whose definitions are unchanged between
evaluations; renders with identical casts, load width, signedness, address
expression, and field or array location at every use; and introduces no
undefined or implementation-defined behavior.

For a repeated memory read, the interval between evaluations must contain no
possibly-aliasing write, no call or unknown memory effect, no protected barrier
or volatile operation, and no mutation of any pointer or index forming the
address. Unknown aliasing suppresses the rule. Disjointness may be claimed only
where the existing memory-effect model proves it.

The proof artifact must state that the transformed source evaluates `E` twice
on one path and once on another, and why that is equivalent. **"CSE will remove
it" is not a semantic proof.** The refusal fixtures from the source plan
(`*volatile_ptr`, `*p++`, an intervening unknown call, an intervening write to
`*p`) ship as tests.

## 2.2 The axis

A new grammar axis `expression-reuse-form` with two canonical forms per proven
group: materialized-once (the baseline shape) and repeated-at-use (the
materialization removed, the exact expression substituted at both selected
uses). The renderer preserves C89 declarations, comments outside replaced
spans, parentheses, explicit casts, and surrounding statement order; where
removing the value would require unsafe declarator surgery, the form is
suppressed rather than approximated.

The first version admits only independently proven two-use groups, each
contributing radix 2. Overlapping or interacting groups are combined into one
validated axis or frozen. Exact counting and unrank are mandatory, as for every
existing axis.

## 2.3 Grading

A compiled repeated expression does not guarantee the copy survives. Grade each
candidate through the existing pass chain with machine-readable statuses
(`generated-no-distinct-provenance`, `repeated-load-survived-cse`,
`cse-copy-born`, `cse-copy-folded`, `cse-copy-survived`, `schedule-diverged`,
`exact`) so a failure names the pass that decided it.

## Acceptance

- Every refusal fixture is refused with its reason recorded.
- `func_80015AAC` derives a domain containing the repeated-at-use form.
- Exact counting agrees with brute-force enumeration on small fixtures.
- The grammar schema version is bumped; `exhausted-no-exact` now covers a
  larger grammar and must say so.

---

# Deliverable 3: type and cast representations (rule 4.4)

Currently suppressed as *"not implemented in grammar schema 4; fresh
materialized temps use one canonical type and local type/cast forms are not
searched."*

Infer a finite type set from ABI mode, load and store widths, signed
operations, field and global declarations, and proven value ranges. Enumerate
only representation-preserving forms: supported `u8`/`u16`/`u32`/`s8`/`s16`/
`s32` local modes, and cast-at-definition versus cast-at-use.

Rules must account for C integer promotion and must reject any equivalence
involving signed overflow or implementation-defined behavior that is not proven
under the configured compiler and target. A form that cannot be proven is
suppressed with its reason, never admitted optimistically.

This deliverable is sequenced after Deliverable 2 because it multiplies the
domain on an axis that interacts with materialization: a fresh temp's type is
only a free choice once fresh temps exist in more than one form.

## Acceptance

- Each admitted form has a promotion-correctness unit test and a compiler
  fixture demonstrating it changes generated assembly on at least one case.
  A form that never changes anything is removed, not kept.
- The domain report names the inferred type set and its evidence.

---

# Deliverable 4: pass-survival diagnostics

Carried from `deprecated/instruction-survival-and-control-flow-source-synthesis.md`
Deliverables 1-3. Its motivating case is `func_80015594`, where a target-only
final instruction was reported as a semantic defect although the candidate's
initial RTL contained the operation and a later pass removed it.

A target-only final instruction is not evidence that the source omits an
operation. Add `tools/agent/analyzeInstructionSurvival.ts` and
`tools/agent/instruction-survival/`, reusing the immutable compiler-trace
bundle and adding no second compiler invocation.

## 4.1 What it must answer

For every target-only final shape: did the candidate never generate it, or
generate it and lose it — and at which named pass. Claims cite observed
candidate UIDs, pseudos, blocks, consumers, and pass files. Target RTL is never
invented.

Seed shapes are typed, not string-matched — operation, mode, constant, memory
width, and def/use role. Register names are allocation, not shape identity.
Start with sign extension (`sll 16` followed through def/use by `sra 16`), zero
extension and masks, wide constant materialization, narrow and wide memory
operations, normalized copies and arithmetic, and branch-value diamonds with
their merge store.

## 4.2 Lemma catalog

A disappearing shape identifies a pass, not a cause. Each lemma names its
deciding pass and cites the exact vendored compiler source file, symbol, and
lines, verified with `psx_compiler_source`. A prose recollection is not a
citation and does not ship. Lemma results are `applies`,
`does-not-apply`, or `unknown`; `unknown` is never rendered as a
recommendation, and a lemma alone never prescribes a source edit.

The first lemma is signed narrowing into a narrow store. Later lemmas are added
only from validated cases: crossjump-merged duplicate branch stores, constant
birth moved by jump optimization, copy propagation deleting an administrative
web before sched1, load-plus-extension folded into a narrow load, address and
mask formation folded into a memory operation.

## 4.3 Classifier honesty

Replace blanket "semantic defect" wording with confidence-labelled semantic,
structural, and pass-survival findings. Offsets, constants, and shifts are
invariant to scheduling and allocation but not to optimization, and the
inventory must stop implying otherwise.

## Acceptance

- Each lemma has unit tests, a synthetic compiler fixture, and one real-case
  replay.
- `func_80015594` reports its sign-extension loss with the deciding pass named.
- No finding is emitted at a confidence the evidence does not support.

---

# Deliverable 5: control-flow placement axis

Carried from the same plan's Deliverables 4-5, retargeted from the retired
prologue synthesizer to `residual-source-search/`.

`func_80015594` matched exactly when one `setXY0` operation moved from before
an `if` to after its join. No value changed; the basic-block boundary kept
register-argument conversions alive. The semantic graph already models the
blocks. What is missing is an axis that varies membership across them.

Add a versioned `control-flow-placement` axis over proven-safe movements:

- before-branch versus after-join placement for an operation independent of the
  condition and of both arms;
- common-after-join versus duplicated-in-arms;
- the shared branch result / crossjump form, where one variable set in both
  arms lets crossjump merge identical store tails;
- branch-arm statement order where the final values are equivalent.

Safety comes from the existing dependence and memory-effect model applied
across the boundary, exactly as loop-carried dependence is applied across the
back edge. A movement that cannot be proven safe is recorded as a suppressed
axis with its reason, not admitted.

Exact counting and unrank are mandatory. The intermediate `func_80015594`
branch-duplicated form is the standing warning that score is not distance:
it restored every instruction and reached only 40/44, while the post-join form
reached 44/44.

## Acceptance

- A fixture with a hand-verified placement count enumerates exactly that many.
- A movement forbidden by a cross-boundary dependence is not generated.
- `func_80015594` derives a domain containing the post-join placement.

---

# Deliverable 6: sibling structural similarity (advisory, lowest priority)

Only after Deliverables 4 and 5 are useful. An advisory nearest-neighbour
report over the call-graph/context layer, ranking matched functions by
normalized opcode n-grams and exact common prefixes/suffixes, CFG shape and
branch diamonds, SDK primitive and known-macro fingerprints, constants, field
offsets and packet stride, and address adjacency plus file-grouping evidence.

Advisory means advisory: it ranks reading material for an operator. It never
gates, prunes, or seeds a search.

---

# Phases and gates

| phase | content | gate |
|---|---|---|
| 1 | Deliverable 1.1, skill routing | the workflow reaches residual search first; no code deleted yet |
| 2 | Deliverable 4, survival diagnostics | first lemma cites verified compiler source lines; `func_80015594` replay |
| 3 | Deliverable 5, control-flow placement | hand-verified fixture counts; `func_80015594` domain contains the post-join form |
| 4 | Deliverable 2, expression reuse | refusal fixtures refused; `func_80015AAC` domain contains the repeated form |
| 5 | Deliverable 1.2, parity gate and MVP retirement | checked-in parity test over 35 functions passes |
| 6 | Deliverable 3, type and cast forms | every admitted form changes assembly on a fixture |
| 7 | Deliverable 6, sibling report | advisory only |

Phase 1 is first because it is the only phase that improves outcomes today and
costs no new search capability.

Phase 2 precedes both new strata deliberately. A stratum that fails without
survival diagnostics fails mysteriously; one that fails with them names the
pass that decided it, which is what turns a negative result into evidence.

Phase 5 retires the MVP only after the axes in phases 3 and 4 exist, so the
parity gate compares against a grammar that has already grown rather than
freezing the retirement behind unrelated work.

Phase 6 is last among the strata because a type choice is only free once fresh
temps exist in more than one form, which Phase 4 delivers.

# Non-goals

- Replacing the causal closure, counting, enumeration, canonicalization, or
  object oracle. Those layers are sound.
- A fuzzer. Random search cannot say "exhausted", and the completeness claim is
  the most valuable property the tool has.
- A general C rewriter. Unsupported semantics are refused, not approximated.
- `goto`, labels, and irreducible control flow. Still frozen.
- Algebraic identities added to create syntax volume.
- Any weakening of the clean-source policy. Generated candidates stay under
  `build/` and are never promoted automatically.

# Risks

| risk | handling |
|---|---|
| domain explosion once placement and reuse axes open | the delivered cost report prices before launch and names the responsible axis; the only lever is a smaller residual |
| a "proof" of repetition safety that is really an appeal to CSE | the refusal fixtures ship as tests; the artifact must state the double-evaluation explicitly |
| a lemma that cites a pass from recollection | no lemma ships without verified `psx_compiler_source` file/symbol/line citation |
| parity gate becomes a reason never to retire the MVP | Phase 5 is scheduled, and the gate is a test, not a judgement call |
| status headers drift again | each deliverable's acceptance is a checked-in test, so delivery is observable from the tree rather than from a header |

# Acceptance criteria

The plan is complete when:

1. The decompilation skill routes source-representation search to
   `searchResidualSourceSpace.ts`, and `synthesizeSourceShapes.ts` and
   `source-shape-synthesis/` are removed with the parity gate green.
2. `expression-reuse-form`, `control-flow-placement`, and the type/cast forms
   are live axes with exact counting, unrank, and recorded suppression reasons,
   at a bumped grammar schema version.
3. `analyzeInstructionSurvival.ts` reports, for every target-only final shape,
   whether it was never generated or lost at a named pass, with cited evidence.
4. `func_80015594` and `func_80015AAC` each derive a domain containing the
   representation known to match them.
5. No plan document in `plans/` claims a status the tree contradicts.
