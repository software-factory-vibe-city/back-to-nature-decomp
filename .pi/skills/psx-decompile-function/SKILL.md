---
name: psx-decompile-function
description: Decompile or repair one function in a PlayStation matching-decompilation project by running a measured experiment loop against the staged residual, using the pipeline reversal to locate the owning compiler pass and the reference sheets for the mechanism that pass obeys.
---

# PlayStation function decompilation

Work on exactly the target named in the invocation. Derive every game,
compiler, assembler, SDK, build, and layout fact from the current project, not
from memory. Do not commit or create a worktree unless asked.

## The one rule

**A turn is one experiment.** Observe, form one hypothesis, make one edit,
measure it. The measurement ends the turn.

Everything below serves that. The failure this guards against is not a wrong
edit — a wrong edit costs one cheap compile. It is a long chain of reasoning
about what the compiler *would* do, built on an unmeasured step, that survives
many edits before anything contradicts it. A compile takes under a second. Your
reasoning does not.

## Open the session

Run these three, in this order, before touching source. Each is one call.

1. `psx_experiment_ledger` — what has already been measured. Levers recorded
   here as closed are closed; sources listed as compiling to the same words are
   the same experiment however differently they read. Start from this, not from
   a research note.
2. `psx_triage` — a `blocker` means the current direction cannot ship whatever
   the residual says. Resolve it before anything else.
3. `psx_reverse_pipeline` — the pass that owns the residual, the per-block
   breakdown, and the independent decisions behind it.

If the target is a bare `INCLUDE_ASM` stub, generate a first source with
`psx_m2c` and clean it before step 3 has anything to read.

## The loop

Repeat until the residual is zero. The loop does not have a give-up condition:
when an axis runs out, the next section says what to reach for instead.

### 1. OBSERVE — one tool

Run exactly one tool. Write **at most three bullets**, each a fact the tool
printed. No inference, no consequences, no plan. If you catch yourself writing
"which means", you have left this step.

Three OBSERVE calls without an ACT is the ceiling. Reaching it means this class
of evidence is not going to name the edit; measure the best-supported guess, or
escalate to a heavier tool under "When it stalls". A measured wrong guess is
worth more than a fourth reading of the same report.

### 2. HYPOTHESISE — one sentence

Fill in every slot from step 1's bullets:

> `<edit>` should lower **`<term>`** in **block `<n>`**, because `<mechanism the
> tool named>`.

The terms are the staged residual's, in pass order: control flow, population,
schedule, allocation. A hypothesis that names no term and no block is not
testable and does not count.

If a slot will not fill, you do not have a hypothesis. Go back to OBSERVE once.
If it still will not fill, the evidence you have is too weak for this residual —
go to "When it stalls" and bring a heavier tool. Do not edit on a feeling and
reverse-engineer the reason afterwards.

Consult the reference sheet for the owning pass only now, and only the one:
`psx_reference population | schedule | allocation | declarations | flags | sdk`.
It carries the mechanism that pass obeys and the source levers that reach it.

### 3. ACT — one edit

Make the edit in the hypothesis. Nothing else — not a rename you noticed, not a
comment, not a second idea that arrived while typing. Two edits and one
measurement attribute to neither.

### 4. MEASURE — `psx_residual_objective`

No exceptions, including for edits you are sure about. Read the verdict, never
the word count:

| verdict | meaning | what to do |
|---|---|---|
| `better` | an earlier term fell | keep it; this is the new baseline |
| `worse` | an earlier term rose | revert; record why in the ledger note |
| `traded` | lost an earlier term, won a later one | keep as a branch, not as the baseline |
| `identical` | same compiled words | not an experiment; change axis, not spelling |
| `EXACT` | bytes match | go to Finish |

`ALREADY MEASURED` in the output means a previous session ran this experiment.
Believe it and move on.

### 5. RECORD

The ledger appends automatically. The turn is over. Do not begin the next
hypothesis in the same breath as reading this result — that is how an unmeasured
chain starts.

## When it stalls, go deeper — do not stop

Three consecutive measurements with no `better` and no `traded` means the *axis*
is exhausted, not the function. Every function here has clean C that matches it
100%; a residual that survives hand-authored variants is a signal to bring
heavier evidence, not to give up.

Stop re-spelling and escalate the class of evidence:

1. **Enumerate the source space instead of guessing at it.**
   `psx_search_residual_source_space` derives the semantics-preserving closure
   of the current source and prices it. A domain of one candidate is a finding:
   it says the residual is not reachable by rewriting this source, and points
   the search at declarations, flags or the translation unit instead.
   `psx_search_source_shapes` and `psx_synthesize_source_shapes` generate and
   score shapes from the target's own requirements rather than from a hunch.

2. **Solve for the compiler state, do not model it.**
   `psx_solve_local_allocation` solves for the local-alloc quantity priorities
   and lifetimes that would reproduce the target's assignment, and reports
   `UNSAT_WITHIN_BOUNDS` when none exists inside the bound — which is a real
   result that closes a direction. `psx_search_scheduler_state` does the same
   for the ready-list order. `psx_allocator_counterfactual` names which
   conflicting pseudo won a register and what would have had to differ.
   `psx_minimize_local_allocation` narrows a broad successful probe to the
   smallest region that still produces the effect.

   A solution is a **specification for a source shape**, never a solution by
   itself, and a solver witness is never promoted directly.

3. **Read the pass that decides it.** `psx_compiler_source` searches the exact
   patched compiler tree cc1 is built from. One read of the function that makes
   the choice can end a search outright: a proof that a form is unreachable is
   worth more than any number of failed experiments, and it is the only evidence
   that converts "we could not find it" into "it is not there".

4. **Audit the facts outside the function.** `psx_reference stuck` — the symbol
   boundary, the declarations in scope, the predicate, the idiom frame. Each has
   produced a wasted session in this project by presenting as a codegen
   impossibility.

5. **Test the flag hypothesis.** `psx_flag_probe`. Per-file overrides are per-TU
   facts of the original build, not hacks, and are permitted on the evidence bar
   in `psx_reference flags`. A matrix showing baseline equal to the delta kills
   the hypothesis cheaply, which is itself worth knowing.

Record what each of these closed. An axis proved empty is progress and belongs
in the ledger note, so the next session starts from it instead of re-deriving
it. Park a function only when a human decision is required — an allowlist
entry, a policy exception — never merely because it is hard.

## What ends a turn badly

- **Batching.** Two edits, one diff. Both are now unattributable.
- **Predicting instead of compiling.** Emission order, delay-slot occupancy and
  register assignment are decided by passes you cannot read off the source.
- **Chaining unmeasured steps.** "Move this store up, the load follows, which
  frees the temp, so then…" — everything past the first unmeasured step is
  fiction.
- **Reporting a number you did not just measure.**
- **Steering by the word count.** An edit that fixes a cause rotates everything
  downstream and can match fewer words while standing closer.

## Before you write source

Read `AGENTS.md` and `configs/project-profile.md`. The profile's header table
says which file each kind of declaration belongs in and which files are
generated outputs that must never be hand-edited.

Two things are worth checking once, up front, because getting them wrong
poisons every later reading:

- **Callee prototypes.** For an indirect call, inspect the plausible table
  members before accepting a callback signature. Values left in `$a1`–`$a3` at
  a `jalr` may be dead address-generation state, not arguments. A wrong
  prototype adds call-setup moves and corrupts every web and allocation
  analysis downstream.
- **SDK operation boundaries.** Run `psx_sdk_idioms`. Hand-rolled bitfield
  arithmetic where the SDK has a macro is a reconstruction error, not a style
  choice. Restore the operation boundary before reading allocation or
  scheduling at all — see `psx_reference sdk`.

## Finish

`psx_finalize_function` is the terminal gate: the exact diff, the linked build,
the scope check and the clean-source check together. A pre-link byte comparison
is not a finish line.

Embedded assembly, hard-register pinning and new assembly stubs are not
decompilation solutions. Where the target genuinely requires one, it needs an
allowlist entry, and that is a human decision — file it, do not grant it.

## Reporting

Report what you measured. If the function did not match, say so plainly with the
residual key and the axes tried; do not present a partial result as a finish.
If a step was skipped, say which.

## Going deeper

- `psx_reference <topic>` — the mechanism sheets, loaded one at a time
- `tools/agent/pipeline-reversal/README.md` — what each inverse pass proves and
  where the chain reports itself unreliable
- `notes/research/` — one case study per diagnosed phenomenon
- `notes/retros/` — solved-function post-mortems, including what was tried and
  did not work
- `notes/file-groupings.md` — translation-unit membership
