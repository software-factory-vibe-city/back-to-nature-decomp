# Plan: tree-sitter front end, loop-aware grammar, and a no-knob exhaustive interface

**Status: DELIVERED in full, all five phases. Superseded 2026-08-09 by
`plans/residual-source-search-completion.md`.**

The previous `not started` header was stale and caused a re-plan of work that
already existed. Verified in the tree on 2026-08-09:

| phase | evidence |
|---|---|
| 1, no-knob interface and cost report | `searchResidualSourceSpace.ts` accepts only `--source`, `--derive-only`, `--json`; `residual-source-search/cost-report.ts` supplies the per-axis breakdown, deterministic pilot, and projection; `checkpoint.ts` makes resume automatic |
| 2, tree-sitter front end | `residual-source-search/tree-sitter-c.ts` on `web-tree-sitter`, vendored grammar under `tools/vendor/tree-sitter-c`, `C_FRONTEND_IDENTITY` in the run manifest |
| 3, structural loops and switch | `SemanticBlock.kind` carries `loop-init`, `loop-update`, `loop-body`, `case` |
| 4, loop-carried dependencies | `topological-orders.ts: loopCarriedDependencies`, applied in `enumerate.ts` |
| 5, new grammar strata | loop-update placement and switch↔if/else-if are live in grammar schema 5; compound-assignment and loop-form were **measured and removed** under this plan's own "a stratum that never changes anything is removed" rule, and are recorded in `SUPPRESSED_BASE` with their fixtures |

The original body follows unchanged for the institutional record.

This plan superseded only the *front end* of
`plans/deprecated/automatic-residual-source-space-search.md`. That plan's causal closure,
exact counting, deterministic enumeration, canonicalization, and object oracle
stay exactly as they are. This plan replaces the hand-rolled C parser, adds loop
and switch support, and removes the tuning flags in favour of one honest cost
report.

## Purpose

Make `searchResidualSourceSpace` answer one question from one input:

> Is there an exact source form in the grammar for this function, or is there
> provably not one — and what will it cost to find out?

The operator supplies a function. A run always goes to exhaustion. There is no
ceiling and no partial sweep. `--derive-only` reports the exact domain size and
the projected time first, so the cost is known before the run starts.

## Motivation

The evidence is from `func_80016C08` and `func_800165D8` on 2026-08-03.

1. `func_80016C08` has a residual of **four instructions**. All four are inside
   the loop.
2. `func_800165D8` has the same defect at the same construct, also inside its
   loop.
3. The grammar freezes loops. `semantic-graph.ts` says so:
   *"Loop, switch, jump, or label constructs are frozen verbatim in this grammar
   version."* Only `if`/`else` is modelled.
4. A full run therefore derived **9 candidates** and returned
   `exhausted-no-exact`, with caveats naming both `for` statements. The domain
   never entered the region that holds the defect.
5. Three parser defects were found and repaired by hand the same day: the
   function name matched inside a banner comment, a `{` inside a comment read as
   a function body, and a forward prototype accepted as a definition. All three
   are impossible for a real parser.

The parser is 1009 lines of character state machine. It is the layer that blocks
the work, and it is the only layer with an off-the-shelf replacement.

## Principles

1. **No knobs.** The input is the function. Nothing tunes the grammar. Every
   stratum is always active.
2. **Exhaust.** A run always evaluates the whole domain. The cost is reported
   before the run, not discovered during it.
3. **Never unparse.** Candidates are made by splicing byte ranges of the
   original text. The tool does not print C from a tree.
4. **Every axis is counted.** An axis supplies an exact size, an unrank
   function, and validity checked before counting.
5. **Degrade, do not crash.** An unmodelled construct becomes a frozen node.

---

## Phase 1 — no-knob interface and the cost report

This phase comes first. Every later phase grows the domain. The estimate has to
exist before the growth, so that a large domain is visible in advance instead of
appearing as a run that will not finish.

### Interface

Current surface:

```text
<function> [--source <path.c>] [--derive-only] [--jobs <1..32>] [--shard <k/n>]
           [--start <index>] [--resume] [--max-candidates <n>]
           [--max-partitions <n>] [--json]
```

Target surface:

```text
searchResidualSourceSpace <function> [--derive-only] [--source <path.c>] [--json]
```

Disposition of each removed flag:

| flag | disposition |
|---|---|
| `--jobs` | derived from CPU count. A machine property, not a choice. |
| `--shard`, `--start`, `--resume` | automatic. The run always checkpoints and always resumes, so a long run is safe to interrupt. |
| `--max-candidates`, `--max-partitions` | removed. A run is exhaustive by definition. A count-based cap turns an exhaustive search into a partial one that still reports a terminal state, which is the failure mode this plan exists to remove. |

`--derive-only` stays and takes on the cost report. `--source` stays: it names
which reconstruction to search, which is an input, not a knob. `--json` stays.

### Terminal states

Unchanged. No state is added.

| state | meaning |
|---|---|
| `exact` | a byte-identical candidate was found. The run stops early. |
| `exhausted-no-exact` | the whole domain was evaluated. Nothing matched. |
| `unsupported-*` | the source or the correspondence cannot be modelled. |
| `too-large` | the exact count exceeds the enumerable bound. |

### The cost report

`--derive-only` already counts the domain. It gains a projection.

1. **Count.** The exact domain size `N` is already produced.
2. **Calibrate.** Compile the baseline five times. Take the median as the
   per-candidate cost `c`. On this machine `c` is about 46 ms for
   `func_80016C08` through cc1, maspsx, and the assembler.
3. **Pilot.** Evaluate a deterministic stratified sample of `min(64, N)`
   coordinates chosen by unrank. Measure the real cost and the
   canonical-duplicate rate `d`. The last run collapsed 9 candidates into 3
   distinct assembly classes, so `d` is large and must not be ignored.
4. **Project.** `T = N × (1 − d) × c / jobs`.

The report prints:

- the exact domain size `N`;
- the per-axis radix breakdown, largest axis first;
- the projected wall time `T`;
- the measured `c` and `d` the projection came from.

The per-axis breakdown is the useful part. It says *which* axis made the domain
large, which is what an operator needs to decide whether to launch.

It also names the one lever that is not a knob: **reduce the residual first.** A
smaller machine diff produces a smaller causal closure, which produces a smaller
domain. That is real work rather than a flag.

`--derive-only` currently reports "no variants were compiled". With a pilot that
is no longer true, so the wording must change to state how many coordinates were
sampled. The pilot is not wasted: results are keyed by canonical hash and are
reused when a full run reaches those coordinates.

The pilot sample must be deterministic and recorded in the run manifest, so an
estimate is reproducible.

### Estimate honesty

A real run records its actual wall time next to the estimate that `--derive-only`
produced for the same domain. A projection that is repeatedly wrong is a defect,
and this is how it becomes visible.

### Acceptance

- The CLI accepts a function, `--derive-only`, `--source`, and `--json`.
  Nothing else.
- `--derive-only` prints `N`, the per-axis breakdown, `T`, `c`, and `d`, and
  states the pilot size.
- A run with no flags goes to exhaustion and reports its real time against the
  projection.
- A small fixture returns the same result it returns today.
- All existing tests pass.

---

## Phase 2 — tree-sitter front end, behaviour identical

`buildSemanticGraph(functionName, sourcePath, source, registry)` keeps its exact
signature and return type. Only the inside changes.

### Dependency

- `web-tree-sitter` (WASM runtime). No native toolchain, no `node-gyp` at
  install time.
- A vendored `tree-sitter-c.wasm` under `tools/vendor/`, version-pinned and
  hashed.

The grammar version and the wasm hash enter the run manifest. A grammar change
must change run identity, exactly as a compiler change does.

### Translation

| tree-sitter node | becomes |
|---|---|
| `function_definition` | the graph root |
| `compound_statement` | a `SemanticBlock` |
| `declaration` | node kind `declaration`, `declName` from the declarator |
| `expression_statement` → `assignment_expression` | assignment, with `lhs`, `rhs`, `operator` |
| `call_expression` | node kind `call` |
| `if_statement` | `condition`, `condSpan`, `thenBlock`, `elseBlock` |
| `ERROR`, or anything unmodelled | frozen node, `movable: false`, `memoryReads: ["*unknown*"]` |

### What this fixes structurally

Reads and writes come from the tree, not from regular expressions over
comment-stripped text. `stripTypeSyntax` currently contains a guess:

> A parenthesized single identifier is treated as a cast only when it is not a
> known variable and is followed by the start of an operand.

Tree-sitter does not guess. It gives distinct node types:

| construct | node type | meaning |
|---|---|---|
| `p->tag` | `field_identifier` | a struct member, never a variable |
| `(SpriteTex *) x` | `type_descriptor` | a type, never a read |
| `func_80016B7C(...)` | `function` field of `call_expression` | a callee, not a variable read |
| `sizeof(T)` | `sizeof_expression` | not a value read |

Constructs that break the current prologue model and are in the grammar:
K&R definitions, bitfields, designated initializers, function pointers, nested
declarators, varargs, and `//` comments.

### Acceptance

This phase adds **no capability**. It is a refactor with a hard gate.

- All 116 tests pass, unchanged.
- `func_800165D8` derives the same domain it derives today (4 candidates,
  10 statements, 43 value webs).
- `func_80016C08` derives the same domain it derives today (9 candidates,
  39 statements, 44 value webs).
- New tests: a source whose banner comment names the function and contains
  braces still parses to the real definition; a forward prototype is skipped; a
  file with an unparsable region yields a frozen node instead of an exception.

If the derived numbers move, the translation is wrong. Do not adjust the
expectations to match.

---

## Phase 3 — structural loops and switch, still frozen

`SemanticBlock.kind` grows:

```ts
kind: "entry" | "then" | "else" | "loop-init" | "loop-update" | "loop-body" | "case"
```

`SemanticNode` gains the fields a loop needs: the init span, the condition span,
the update span, and the body block index.

Loops and switches become real blocks with real child nodes. They stay
`movable: false`. Behaviour does not change.

This phase exists so Phase 4 has something to stand on, and so it can be tested
on its own.

### Acceptance

- Behaviour is unchanged. Domains do not move.
- The caveat text changes from "Unsupported control construct frozen" to a
  statement that names the construct.
- New tests assert that a `for`, a `while`, a `do`/`while`, and a `switch`
  produce the expected block and node structure.

---

## Phase 4 — loop-carried dependencies

This is the hard part of the plan.

Reordering inside a loop body needs three edge classes.

| edge class | rule |
|---|---|
| intra-iteration | as today: definition→use, use→definition, definition→definition |
| loop-carried scalar | if a variable is read and written in the body, and the read must see the previous iteration's value, the read stays before the write |
| loop-carried memory | `memoryEffectsConflict` is applied again across the back edge: a write in iteration *i* may alias a read in iteration *i+1* |

### Worked example

This is the tail of `func_80016C08`, where the whole residual lives:

```c
poly->tag = (*ot & 0xFFFFFF) | 0x09000000;   /* reads *ot, poly    writes poly->tag */
*ot = (s32) poly & 0xFFFFFF;                 /* reads poly         writes *ot       */
total += size;                               /* reads total, size  writes total     */
poly++;                                      /* reads poly         writes poly      */
D_8005E3C0->field_118 += 0x28;               /* global field                        */
```

The edges:

- statement 1 reads `*ot` and statement 2 writes it. The order is forced.
- statements 1 and 2 read `poly`; statement 4 writes it. Statement 4 stays after
  both.
- `total += size` touches only scalars that no other statement touches. Free.
- the global field has a different base object from `*poly` and `*ot`. Free.

Three statements in a forced chain and two free statements to interleave give
**20 dependency-valid orders in this region alone.**

Today this region contributes exactly 1, because the loop is frozen. That is why
the last run produced 9 candidates and found nothing.

### Bounds

`MAX_REGION_NODES` is 16 and `RegionTooLargeError` already exists. Loop bodies
fragment naturally at calls and at `*unknown*` memory nodes, so most regions stay
small. Where a region does exceed the bound, the existing error path applies. For
domains that are merely large rather than uncountable, the Phase 1 cost report is
what makes the size visible before a run starts.

### Acceptance

- A fixture loop with a known dependency structure produces the exact expected
  number of orders, verified by hand.
- A fixture where a loop-carried anti-dependence forbids a swap does not produce
  that swap.
- `func_80016C08` derives a domain that contains the 20 tail orders.
- Exact counting still agrees with brute-force enumeration on small fixtures.

---

## Phase 5 — new grammar strata

Each is a new independent axis in the existing mixed-radix coordinate.

| axis | what varies | why it is expected to matter |
|---|---|---|
| loop update placement | which updates sit in the `for` header and which sit at the body tail | changes live ranges exactly at the tail, which is the standing "one more live value" hypothesis for both functions |
| loop form | `for` ↔ `while` ↔ `do`/`while` | different RTL entry shape |
| switch ↔ if/else-if | jump table against compare chain | already measured on `func_800165D8`: `switch` built a balanced `slti` tree and if/else-if was correct |
| compound assignment | `total += size` ↔ `total = total + size` | different tree-to-RTL path |

Validity comes from the tree, not from a guess. Loop update placement is legal
only when the body has no `continue_statement`, and tree-sitter reports that
directly.

### Acceptance

- Each stratum has its own fixture with a hand-verified exact size.
- Each stratum can be shown to change generated assembly on at least one
  fixture. A stratum that never changes anything is removed, not kept.

---

## What "shuffling" means

The tool does not mutate a tree and print it. The domain is a **mixed-radix
product of independent axes**. Each axis has an exact radix. A candidate is a
coordinate. `candidateAt(domain, rank)` decodes a rank into a coordinate by
dividing out each radix in turn.

Rendering a coordinate is **text splicing**. Tree-sitter nodes carry
`startIndex` and `endIndex`; `SemanticNode` carries a `SourceSpan`. They are the
same thing. A reorder is a permutation of text ranges. A form change uses a
template, which `rewrite-catalog.ts` already does for the existing strata.

This is why comments, spacing, and macro spellings survive, and why the
canonical-hash deduplication keeps working.

## Completeness invariants

These are not negotiable. They are what makes `exhausted-no-exact` mean
something.

1. Every axis reports an **exact** size. Not an estimate.
2. Every axis supports **unrank**: coordinate *N* without building 1…*N*−1.
3. Validity is checked **before** counting. A count that includes invalid
   coordinates is a false claim.
4. An exhausted result is a claim about the grammar schema and its recorded
   assumptions. It is never a claim about all clean C. The existing caveat text
   stays.

## Explicitly out of scope

- **A fuzzer.** Random search cannot say "exhausted". The completeness claim is
  the most valuable property this tool has.
- **`goto` and labels.** They stay frozen. Irreducible control flow is not worth
  the cost yet.
- **Expression-level and type/cast rewriting.** Already recorded as suppressed
  in schema 4. Unchanged here.
- **Replacing the closure, counting, enumeration, or oracle.** Those layers are
  sound and are not touched.

## Risks

| risk | handling |
|---|---|
| a macro that expands to a statement fragment does not parse | it becomes an `ERROR` node and freezes, which matches today's behaviour |
| domain explosion once loops are unfrozen | the Phase 1 cost report, which is why Phase 1 is first. The per-axis breakdown names the axis responsible. A run has no ceiling, so the operator must be able to see the size before launching. |
| a long run is interrupted | checkpoint and resume are automatic. Distribution across machines is not covered here; if a real domain needs it, reintroduce sharding as its own decision rather than as a tuning flag. |
| grammar version drift changes results silently | the wasm hash and grammar version enter the run manifest and change run identity |
| pilot sampling bias makes the estimate wrong | the sample is deterministic, stratified by unrank, and recorded; the estimate is reported next to the real time on completion so drift is visible |
| translation changes derived numbers | Phase 2 gates on the exact current numbers for both functions |

## Size

| work | estimate |
|---|---|
| Phase 1, interface and cost report | +350, −200 |
| Phase 2, tree-sitter translation | +700, −1000 |
| Phase 3, structural loops and switch | +250 |
| Phase 4, loop-carried dependencies | +400 |
| Phase 5, four new strata | +500 |

## Scope decision

**All five phases are in scope** (operator decision, 2026-08-03). They run in
order, 1 through 5, and each phase must pass its own acceptance gate before the
next one starts.

Phases 1, 2, and 3 are mechanical and have hard gates. Phase 2 in particular
gates on reproducing today's derived numbers exactly, so a translation error
cannot pass unnoticed.

Phase 4 is real engineering and carries the schedule risk. It is the only phase
whose correctness is not checkable by "nothing changed". Its gate is therefore a
hand-verified order count on fixtures, plus agreement between exact counting and
brute-force enumeration on small cases.

Phase 5 is additive. A stratum that cannot be shown to change generated assembly
on at least one fixture is removed rather than kept.
