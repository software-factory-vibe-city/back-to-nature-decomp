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
| `semantic-graph.ts` | Lossless conservative whole-function C89 model built from the parse tree: blocks, statement nodes with exact spans, scalar def/use, path-aware memory-effect tokens, and frozen unsupported constructs. A call keeps unknown memory effects but exact scalar ones — see "What a rule is allowed to be frozen by". |
| `web-partitions.ts` | Value webs (reaching definitions + union-find), statement-level liveness, merge admissibility, and canonical restricted-growth-string partition enumeration with the baseline first. |
| `compiler-closure.ts` | Diff-seeded causal closure: seeds from mismatched instructions expand through uid correspondence, pseudo provenance, source-line and constant bindings, scheduler dependencies and ready-list competitors, allocation conflicts/order neighbors, delay-slot candidates, memory anchors, compatible webs, and controlling branches — every inclusion with a machine-readable reason path. |
| `witness.ts` | Discovery and source-level binding of SAT scheduler-constraint witnesses under `build/schedulerConstraint/<function>/`. The only binding channel is machine-derived: a phantom whose producer is the ABI argument-register entry copy binds to that parameter; everything else records an exact refusal. |
| `rewrite-catalog.ts` | Grammar schema 8 (see "Loops, switches, and strata" below): active rules `web-partition`, `statement-order`, `declaration-birth`, `known-macro-form` (composite macros split into registered component statements derived from the verified definition text), the constant subset of `expression-materialization` (literal known-macro arguments whose values appear in mismatched target instructions become assignments through synthetic webs that the partition rule may merge into compatible existing webs — the multi-set constant mechanism), and `administrative-form` (rule 4.7: a typed copy of a never-redefined parameter floated in an entry-block region, with every later read redirected to the copy; activated only by a discovered SAT witness phantom, bounded by the witness phantom count, and cited by run id in `grammar.json`). General expression and type/cast strata are recorded as suppressed with exact reasons. Records the semantic assumptions all equivalence proofs rely on. |
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

Grammar schema 6 opens the body of a **sequential case**: one whose statements
terminate in `break` or `return` and where nothing else transfers control out
of them. Such a body has one entry at the label and one exit at the terminator,
which makes it a statement sequence exactly like a `then` block — so its
statements form order regions, enter the causal closure, and carry flow edges.

The switch construct itself is still never moved or reshaped, and it keeps its
unknown-effect summary. That summary is what makes opening a *subset* of the
cases sound: a case the predicate refuses stays frozen and contributes no flow
edges, and its reads and writes remain covered by the switch node, so the
analysis over-approximates rather than losing them.

`caseBodyIsSequential` is deliberately syntactic and refuses anything it cannot
see through. A nested `switch` or loop owns its own `break`, but deciding which
construct a given `break` belongs to is the control-flow modelling this schema
still lacks, so a body containing one is refused rather than assumed. A body
that declares a variable is refused too: that opens a scope the flat variable
model does not carry. Every refusal is recorded on the block and in the run's
caveats, naming the case and the reason.

Before schema 6 a `case` was never an order region, which meant the causal
closure could not bind a mismatch to any statement inside one. A function whose
residual lives in its case bodies would exhaust its domain without the search
ever having looked there. An exhaustion result from schema 5 or earlier on such
a function says nothing about the reachability of that residual.

## What a rule is allowed to be frozen by

An active rule with nothing to enumerate is the failure this module is easiest
to misread. The run reports `exhausted-no-exact` against the grammar it built,
which is true, and looks like a closure over rewrites the grammar never
contained. Schema 7 removed three exclusions that were producing exactly that.

**A call does not write what it reads.** An unregistered callee's *memory*
effects are unknown, and the summary keeps saying so. Its effect on the
caller's scalars is not unknown: C passes them by value, and the one channel
that would let a callee write one back is `&x` in the argument list, which the
model can see. Claiming instead to write every name read marked those names
touched by an unknown-effect node, which froze their webs — and a local passed
to some call is most locals. Reads stay over-approximate, because a spurious
read only merges webs; writes do not, because a spurious write invents a
definition and cuts the web at the call. Measured on `func_80020E58`, whose
residual is allocation-owned: `partitionWebIds` went from 0 of 4 to 2 of 4, and
the domain from 21,600 candidates of pure statement order to 43,200 over two
web partitions.

**A declaration may live outside the entry block.** Web partition and
declaration-birth required `block === 0`, which predates opened case bodies.
What they actually require is that the declaration sit somewhere the renderer
can rewrite, and a sequential case body qualifies: it is renamed where it
stands, text and initializer together. An initializer still freezes an
*entry-block* declaration, because those are emitted from the declaration
cluster, which rebuilds the line and cannot carry renamed reads into it.

**Administrative-form still requires the entry block**, and this one is not an
oversight. Its redirection picks the reads a copy covers by program-order
position, which equals "the reads it reaches" only when the host region runs on
every path to them. A copy in one opened case body would capture reads in a
sibling case that never runs after it. Lifting it needs dominance rather than a
position compare; until then the refusal is recorded per phantom.

`triage.ts` carries a `search-domain` detector for the general shape: an active
rule whose axis is empty, reported with the exclusion reasons the run recorded,
as a blocker when the run also reached a terminal state.

Five strata were proposed across schemas 5 and 6. Three earned their place and
two did not, on the rule that a stratum which cannot be shown to change
generated assembly is removed rather than kept:

| stratum | outcome |
|---|---|
| loop update placement | **active.** A `for` header's updates may sit at the body tail instead, where they join the body's order region. Legal only when no `continue` belongs to the loop, which tree-sitter reports directly. Measured to change the emitted code, including instruction count. |
| switch ↔ if/else-if | **active.** Admissible only when every case is a distinct integer constant that terminates without falling through. Measured: the switch builds a balanced `slti` tree and the chain compiles to a compare chain. |
| sequential case body | **active.** A case that terminates in `break` or `return` with no interior control transfer is a one-entry, one-exit statement sequence; its statements order and partition like any other block's. Independent of the switch-form stratum above, which decides how the *dispatch* is spelled — this one decides whether the *bodies* are modelled at all. |
| compound assignment | **removed.** `x op= e` and `x = x op (e)` reach identical assembly on scalar, pointer, element, field, shift, multiply, divide, modulo, and increment fixtures. Recorded as suppressed with the measurement; a regression test fails if the compiler ever starts distinguishing them. |
| loop form | **removed.** `for (init; c; )` with the update at the tail and `init; while (c)` compile identically. `do`/`while` is not an equivalence at all unless the body provably runs at least once, which the tree cannot establish. |

Opening loops makes domains much larger. On `func_80016C08` and
`func_800165D8` — both with residuals large enough that the causal closure
covers the whole function — the web-partition axis alone passes the enumerable
bound, and the run reports `domain-too-large` with the per-axis breakdown
rather than attempting it. That breakdown is the actionable part: it names the
axis responsible and, with it, how much the residual has to shrink first.

## Honesty rules

- `exhausted-no-exact` is a claim about the grammar schema named by the run's
  own `grammarSchemaVersion` plus the recorded assumptions and caveats in
  `grammar.json`, never about all clean C. Read the caveats before reading the
  verdict: a construct the schema refused is a place the search did not look,
  and an exhaustion over a domain that excludes the residual's location is not
  evidence about that residual.
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

## Reading a run without over-reading it

Two shapes of output look like results and are not, and both have produced a
confident wrong conclusion in this repository.

**A counted axis that does not move the program.** The domain is a mixed-radix
odometer and its size is the product of the radices, which is a count of
programs only if every digit changes the program. A digit that renders the same
source at every value still gets visited, evaluated, deduplicated and reported
as covered, multiplies the projected cost by its radix, and afterwards reads as
an axis that was searched — "exhausted over 15 web partitions" is a true
sentence about an odometer and a false one about the program. So every run
probes each axis against the baseline coordinate with all other digits held,
counts the distinct canonical sources, and prints the result before the class
table. Rendering is span replacement over a string, so this costs no
compilation. `axis-effect.json` holds the per-axis record. An axis probed at
every value and found to produce one program is reported as inert with its
inflation factor; a sampled axis that produced one program is reported as
unmeasured, never as proven inert.

**A pilot's class table.** `--derive-only` samples coordinates to time a
compile, and it used to print them under the same `Distinct assembly classes
(best first)` heading an exhaustive run uses. A ranked leaderboard reads as
"these are the outcomes" whatever the prose above it says, and 64 of 486,000
coordinates was read once as a domain-wide verdict. The heading now carries its
own coverage, says it is not a ranking, and is followed by a statement that the
domain has not been searched. `summary.json` carries `classesSource.sampled`
with the evaluated and total counts, so a reader that never sees the text can
still tell the two apart.

`triage.ts` reports both as `search-domain` findings, so an agent picking up a
function meets them before it starts reasoning from a stale conclusion.

## Base pointers

`D_80049370[i]`, `D_80049370[i + 1]` and `D_80049370[i + 2]` are three
addresses computed off one base. A source can recompute each of them or name
the base once — `s32 *p; p = &D_80049370[i];` and then `*p`, `p[1]`, `p[2]` —
and the two spellings are different programs to the allocator: the second keeps
one pointer live across the uses where the first keeps an index and rebuilds
each address. Which one the original author wrote is visible in the residual.

This rule exists because of where the sessions were going. Across two attempts
on `func_80020E58` about twenty variants were authored by hand, and the only
ones that moved the allocation term were of exactly this shape, while the
search exhausted hundreds of thousands of candidates on statement order and web
partition and found nothing better than baseline. The productive axis was the
one the grammar could not spell, so the agents spelled it themselves, one
compile at a time.

Admissibility is checked rather than assumed. The index must be pure. Every use
must sit in one block, because the pointer is declared in one — the same shared
base in three cases is three independent decisions, and the site key carries
the block to keep them apart. The element type comes from a declaration on the
include path, including the generated `#define NAME (*((T*)_NAME))` form the
source indexes as `(&NAME)[i]`; a symbol whose type cannot be read is refused
rather than typed by guess. A write to anything the index reads disqualifies
the range. Unknown memory effects disqualify it too, but only in the gaps
between uses: a call that holds a use among its arguments evaluates that
subscript before it runs, while a call sitting between two uses can genuinely
move the address.

An `if` owns its condition and not its branches, which is where the uses on
this function turned out to live. Sites are ranked before the site bound
applies — most distinct offsets first, since that is a shared base rather than
plain redundancy — so the bound drops the least interesting groups instead of
whichever sorted last.

The pointer is spelled as a block-top declaration plus an assignment where the
index is ready. That is the general form: an index computed inside the block is
not available at the block top. The initializer spelling is a different program
to GCC and is recorded on each site as unsearched rather than pretended.

Rendering composes with the rest of the grammar rather than fighting it. A
lifted use is rewritten in the statement's own text, next to renaming, because
a region emits its statements as one replacement and two replacements over the
same bytes is how a renderer corrupts a candidate silently. An assignment that
lands inside a region joins that region's statement list for the same reason.

## The residual is a direction, not a score

A run that finds no exact candidate still evaluated every program in its
domain, and reporting that as one bit throws the rest away. Each class now
carries which *kind* of difference it has and where, and the ranking uses it.

Three axes, worst first. **Population** is an instruction one side computes and
the other does not — the programs differ, so nothing downstream is meaningful
yet. **Schedule** is an instruction both sides have, in different positions.
**Allocation** is a value both sides compute, in a different register. Every
unpaired instruction is charged to exactly one, by elimination: identical keys
the alignment could not pair are transpositions; of what is left, matching
shapes with the registers wildcarded are allocation; anything still unmatched
is population. An added instruction is charged, not ignored.

`rankClasses` orders on those axes before it looks at the match count, and this
is the point of the change rather than a detail of it. A count ranks a lucky
register assignment above a fixed cause: an edit that removes the reason for a
difference rotates everything downstream of it, so it matches fewer words while
standing closer. Measured on a live run, the two classes a count called the
best in the sample were the two that bought their extra matches with three and
eight more population differences; the axes put the baseline back on top and
say what the trade was.

Each class also prints its delta from the baseline, per axis and per run:

```
c00002 [pop 20, sched 2, alloc 27] +3pop +1sched -8alloc
    moved: run16(pop +3, sched +1, alloc -8)
```

That is a direction. It names the axis that moved, the size of the trade, and
the one run it happened in, which is what decides where to look next.

A *run* is not a basic block. It ends after a control transfer and its delay
slot, and it does not begin at a branch target: the normalized stream carries
no labels, and resolving one needs a lift this reading does not otherwise
require. So a run is a union of one or more basic blocks — no run spans a
control transfer, but a join point inside one is invisible. That is enough to
localize a residual, and the name says what it is.
