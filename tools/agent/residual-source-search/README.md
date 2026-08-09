# residual-source-search

Reusable logic behind `tools/agent/searchResidualSourceSpace.ts`: an automatic
exhaustive search over the finite space of supported equivalent source
representations that can causally affect one function's residual machine diff.
The operator supplies a function name; no permutation list, transform manifest,
or per-function grammar JSON is accepted. Generated JSON is evidence, not
input.

There are no tuning knobs. The command line is
`<function> [--derive-only] [--source <path.c>] [--json]`: worker count comes
from the CPU count, checkpointing and resume are automatic, and there is no
candidate cap. A run always goes to exhaustion, so `--derive-only` prices it
first — exact domain size, per-axis radix breakdown, and a projected wall time
measured from a real calibration and a real pilot.

## Pipeline

| Module | Responsibility |
|---|---|
| `align.ts` | The residual comparison. The target has been through maspsx, the assembler, and the linker; the cc1 stream has not. This module closes the stage differences exactly and aligns what is left, so the closure is seeded from real differences only. |
| `source-input.ts` | Eligibility gates and the immutable baseline bundle: configured compile with pass dumps, a codegen-verified `-g` diagnostic compile for source-line notes, target/candidate normalization, mismatch classification, compiler trace, and target-schedule analysis. |
| `macro-forms.ts` | Known PSY-Q macro effect registry validated against the exact normalized definition text in the configured header; a changed header deactivates an entry instead of inheriting stale semantics. |
| `tree-sitter-c.ts` | The C front end: `web-tree-sitter` over the vendored, hash-pinned `tools/vendor/tree-sitter-c` grammar. The grammar version and wasm hash enter the run identity next to the compiler's. |
| `semantic-graph.ts` | Lossless conservative whole-function C89 model built from the parse tree: blocks, statement nodes with exact spans, scalar def/use, path-aware memory-effect tokens, and frozen unsupported constructs. |
| `web-partitions.ts` | Value webs (reaching definitions + union-find), statement-level liveness, merge admissibility, and canonical restricted-growth-string partition enumeration with the baseline first. |
| `compiler-closure.ts` | Diff-seeded causal closure: seeds from mismatched instructions expand through uid correspondence, pseudo provenance, source-line and constant bindings, scheduler dependencies and ready-list competitors, allocation conflicts/order neighbors, delay-slot candidates, memory anchors, compatible webs, and controlling branches — every inclusion with a machine-readable reason path. |
| `witness.ts` | Discovery and source-level binding of SAT scheduler-constraint witnesses under `build/schedulerConstraint/<function>/`. The only binding channel is machine-derived: a phantom whose producer is the ABI argument-register entry copy binds to that parameter; everything else records an exact refusal. |
| `rewrite-catalog.ts` | Grammar schema 5 (see "Loops, switches, and strata" below): active rules `web-partition`, `statement-order`, `declaration-birth`, `known-macro-form` (composite macros split into registered component statements derived from the verified definition text), the constant subset of `expression-materialization` (literal known-macro arguments whose values appear in mismatched target instructions become assignments through synthetic webs that the partition rule may merge into compatible existing webs — the multi-set constant mechanism), and `administrative-form` (rule 4.7: a typed copy of a never-redefined parameter floated in an entry-block region, with every later read redirected to the copy; activated only by a discovered SAT witness phantom, bounded by the witness phantom count, and cited by run id in `grammar.json`). General expression and type/cast strata are recorded as suppressed with exact reasons. Records the semantic assumptions all equivalence proofs rely on. |
| `topological-orders.ts` | Web-aware conservative dependency edges and exact linear-extension counting/ranking/unranking (bitmask DP, bound `MAX_REGION_NODES`). |
| `enumerate.ts` | Exact hierarchical domain counting (partition x birth-subset x order), BigInt global ranks, deterministic lazy `candidateAt`, and disjoint `k/n` residue-class shards. |
| `render.ts` / `canonicalize.ts` | Span-replacement rendering (rank 0 reproduces the input byte-for-byte) and alpha-canonical source hashing used for proven-congruence dedup. |
| `evaluate.ts` | Staged exact evaluation: policy and barrier preservation, canonical/preprocessed/assembly dedup, configured cc1, and full maspsx/assembler object comparison for potentially exact classes; JSONL records per coordinate. |
| `cost-report.ts` | The no-knob cost report: derived worker count, per-axis radix breakdown, the deterministic stratified pilot sample, calibration of the per-candidate compile cost `c`, and the projection `T = N x (1 - d) x c / jobs`. The pilot's classes are persisted in `estimate.json` and reused by a later full run over the same domain. |
| `checkpoint.ts` / `coverage.ts` | Resume with identity-hash drift refusal; terminal states that never confuse an interrupted run with exhaustion. |
| `run.ts` | Orchestration used by the CLI and the tests. |

## The C front end

`semantic-graph.ts` used to be a 1009-line character state machine. It is now a
translation of a tree-sitter parse tree, which removed five classes of defect
that a real parser cannot have. Every one of them had been silently shaping
derived domains:

| defect | effect on the model |
|---|---|
| the function name matched inside a banner comment, and a `{` in a comment read as a body | the wrong region was parsed |
| a forward prototype was accepted as a definition | the wrong region was parsed |
| `return X;` as the first statement of a block matched the declaration pattern | invented a local `X` of type `return`, and its shadow caveat froze the real local of the same name |
| an array declarator (`s16 list[12];`) did not match the declaration pattern | the array was frozen **and every declaration after it in the block**, because the first frozen statement ended the block-top declaration window |
| `*p = x;` did not match the lvalue pattern | a pointer store was frozen with `*unknown*` effects instead of being modelled |

The last two moved real numbers. On `func_80016C08` the character scanner froze
all 28 block-top declarations behind `s16 clutList[12];`, and their `*unknown*`
memory effects pulled the whole function into the causal closure. With the
declarations modelled, that function derives 11 candidates over a 12-statement,
39-web closure where the scanner derived 9 over 39 statements and 44 webs. The
statement list, node ids, and spans are otherwise identical, and rank 0 still
renders the input byte-for-byte.

`(T)(x)` and `(T)&x` are a call and a bitwise and to a context-free grammar;
only a type name separates them. The front end reads the type names out of the
configured include path rather than guessing from the shape of the expression,
which is what the old `stripTypeSyntax` heuristic had to do.

## Comparing two stages of the same program

The target is the linked disassembly. The candidate is the cc1 stream. They
describe the same program at different stages, and four differences belong to
the stage rather than to the source:

| difference | why it is not a residual |
|---|---|
| `nop` delay-slot fills in the target | the assembler adds them; cc1 never emits them |
| `s8` against `fp` | two names for `$30` |
| `addiu sp,sp,-136` against `subu sp,sp,136` | the assembler's own rewrite |
| `%lo(sym)(gp)` against `sym`, and `0<encl>` against a callee name | small-data addressing and relocation, both resolved after cc1 |

Comparing the two by position charged all four to the source, and the first
unpaired nop desynchronized everything after it. On `func_80016C08` that read a
two-instruction difference as **266** mismatched instructions and seeded the
causal closure from all of them.

`align.ts` closes each difference exactly — the unresolved call target resolves
through its own relocation record, so nothing is masked — and aligns what is
left by longest common subsequence. The same function now reports 345/347 exact
in the category `allocation-or-operands`, and the closure seeds from the three
target positions that carry the real difference:

```
target   : lui v1,%hi(8005e3c0) ; lw v1,%lo(8005e3c0)(v1)      <- one register
candidate: lui v0,%hi(8005e3c0) ... lw v1,%lo(d_8005e3c0)(v0)  <- two, lui hoisted
```

`mismatchedTargetIndexes` is a **seed set, not an exactness measure**. It holds
every unpaired target instruction plus an anchor for anything the cc1 stream
adds, so a pure insertion still seeds the closure instead of reading as an
exact match. `exactInstructions` comes from the alignment, separately.

## Loops, switches, and strata

Grammar schema 5 opens loops. A loop's initialiser, body, and update are real
blocks with real statements; the flow analysis carries the back edge, so a
definition made in the body reaches the top of the next iteration; and body
statements form order regions like any other block.

A permutation of a loop body cannot move a statement across the iteration
boundary, so a conflict between iteration *i* and iteration *i+1* is preserved
by construction. `loopCarriedDependencies` computes those conflicts anyway and
returns any that the within-iteration edges do not already order — which is
none, because `nodesConflict` is symmetric in the pair. Checking beats assuming,
and anything it did find would become a real edge that can only shrink the
domain.

A `switch` stays a summary node: fall-through and `break` are control flow this
schema does not model, so a `case` block is never an order region.

Four strata were proposed for this schema. Two earned their place and two did
not, on the rule that a stratum which cannot be shown to change generated
assembly is removed rather than kept:

| stratum | outcome |
|---|---|
| loop update placement | **active.** A `for` header's updates may sit at the body tail instead, where they join the body's order region. Legal only when no `continue` belongs to the loop, which tree-sitter reports directly. Measured to change the emitted code, including instruction count. |
| switch ↔ if/else-if | **active.** Admissible only when every case is a distinct integer constant that terminates without falling through. Measured: the switch builds a balanced `slti` tree and the chain compiles to a compare chain. |
| compound assignment | **removed.** `x op= e` and `x = x op (e)` reach identical assembly on scalar, pointer, element, field, shift, multiply, divide, modulo, and increment fixtures. Recorded as suppressed with the measurement; a regression test fails if the compiler ever starts distinguishing them. |
| loop form | **removed.** `for (init; c; )` with the update at the tail and `init; while (c)` compile identically. `do`/`while` is not an equivalence at all unless the body provably runs at least once, which the tree cannot establish. |

Opening loops makes domains much larger. On `func_80016C08` and
`func_800165D8` — both with residuals large enough that the causal closure
covers the whole function — the web-partition axis alone passes the enumerable
bound, and the run reports `domain-too-large` with the per-axis breakdown
rather than attempting it. That breakdown is the actionable part: it names the
axis responsible and, with it, how much the residual has to shrink first.

## Honesty rules

- `exhausted-no-exact` is a claim about grammar schema 1 plus the recorded
  assumptions in `grammar.json`, never about all clean C.
- A run is exhaustive by definition. There is no count-based cap, because a
  cap turns an exhaustive search into a partial one that still reports a
  terminal state. An interrupted run reports `incomplete-budget` and resumes
  from its checkpoint on the next invocation.
- The projection is published before the run and the run's real evaluation
  time is reported next to it, so a repeatedly wrong projection is visible as
  the defect it is.
- Class ids and representative ranks follow the domain's own rank order, not
  worker completion order, so the same domain always produces the same report.
- Candidates stay under `build/residualSourceSearch/<function>/<run-id>/`;
  exact candidates still require the normal export and finalization workflow.

## Remaining plan phases

Tracked by `plans/residual-source-search-completion.md`, which consolidates the
four plans that used to describe this subsystem (all now under
`plans/deprecated/`). Still open, and reported as suppressed by the catalog so
exhaustion claims stay correctly scoped:

- general expression materialization beyond diff-named literal constants
  (rest of rule 4.3) — successor Deliverable 2;
- type and cast representations (rule 4.4) — successor Deliverable 3;
- control-flow placement across a branch or its join — successor Deliverable 5.

Two candidate strata were **measured and permanently retired** rather than
deferred: compound-assignment form and loop form both compile identically
through the configured compiler. Their fixtures are in the test file.

The bounded Pi wrapper `psx_search_residual_source_space` is registered. Skill
integration is not: `.pi/skills/psx-decompile-function/SKILL.md` still routes
source-shape work to the superseded `synthesizeSourceShapes.ts` prologue MVP.
That is successor Deliverable 1.

Empirical notes from the `func_80019070` campaigns: the entire baseline web
partition and the full entry-window sweep (orders, births, setSprt component
splits with the tail fixed) contain no exact match and are almost entirely
assembly-equivalent to the baseline — sched1 normalizes statement order until
a web-structure rule changes the priority landscape. Materializing setSprt's
length constant through the existing `code` web (schema 3's merged form)
reproduces the target's `li v0,4` first instruction exactly; the residual
front then moves to the early fresh `li v1,100` birth. Schema 4 activates on
the function's SAT witness (`78a4fff2edfe3681`), whose phantom binds to the
`ordering_table` parameter, and the copy-bearing candidates make the entry
copy `move t2,a0` survive into the scheduled block — the same instruction
class as the target's `move t3,a0`.
