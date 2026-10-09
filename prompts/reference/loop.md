# Loop residual — the loop optimizer hoisted something you did not, or somewhere else

The owning pass is `loop.c`, which runs twice at `-O2` (`flag_rerun_loop_opt`)
and does two separate jobs per loop: `move_movables` lifts loop-invariant
computations into the preheader, and `strength_reduce` turns derived index
expressions into induction variables and emits their initialisations into the
same preheader.

This is the one pass in the pipeline that prints its own decisions. `-dL` is in
the vendored cc1 and `psx_loop_trace` reads it. Read the log before modelling
the pass from its source — reasoning about `loop.c` from `loop.c` has produced
a wrong answer in this project, including an impossibility proof that one
twelve-second compile refuted.

Loaded on demand by `psx_reference`. Read the sheet the pipeline reversal
named, and only that one.

---

## 1. What the preheader is, and why the scheduler does not own it

Both halves of the pass emit with `emit_insn_before (..., loop_start)`, and
each call lands immediately before the loop, so emissions accumulate in the
order they were made. A loop's preheader is therefore, in this exact order:

```
[ whatever the source itself put before the loop ]
[ pass 1: movables, in the order move_movables moved them ]
[ pass 1: giv initialisations from strength_reduce      ]
[ pass 2: movables ]
[ pass 2: giv initialisations ]
```

Two consequences a residual reading depends on:

- **A position-only difference in a preheader is a loop.c decision.** If both
  programs contain the same preheader instructions and only their order
  differs, no scheduler or allocator model reaches it. `psx_triage`'s
  `loop-preheader-order` detector fires on exactly this shape.
- **A pass-2 hoist lands after pass 1's giv initialisations.** That is a
  preheader order no pass-1 movable can produce, and it is the usual
  explanation when a hoisted address sits *after* an induction variable's
  initialiser in the target and *before* it in your candidate. The question to
  ask is then not "how do I move this instruction" but "what makes this
  expression invariant only in pass 2".

An allocation term reported alongside the position difference is normally
downstream of it, not a second defect: moving one materialisation past another
rotates which register each lands in.

**Type every preheader insn by emission class before choosing a reading.**
Position is evidence about origin, and it is the only evidence there is: the
instruction itself says nothing about which phase emitted it. An insn sitting
*after* a giv initialisation cannot be a source statement, so an initialisation
that reads as obviously hand-written — a counter set to zero, a pointer set to a
base — proves the opposite when it is in that position: the variable is
compiler-created and the source does not name it.

**The final body's induction variables are not evidence of source variables.**
A walking pointer stepped by a constant, or a counter incremented alongside it,
is exactly what `strength_reduce` produces from an index expression the source
never named. Writing one into the C because the target's body walks one is how
a reconstruction acquires a variable the original did not have — and it moves
the initialisation into the source's own part of the preheader, which is a
position no pass can then correct. Apply the position test first.

**A phony loop is never scanned.** `Loop from A to B is phony.` in the dump
means `scan_loop` discarded that loop before recording anything, so its silence
about movables, bivs and givs is an absence and not a decision. Check for it
before reasoning about any per-iteration placement. `psx_triage`'s `phony-loop`
detector raises it as a blocker and names the cause; the common one is real
insns sitting between `NOTE_INSN_LOOP_BEG` and the loop's entry, which happens
when the loop is laid out with an entry jump and an earlier pass inserts into
the gap. A fallthrough entry — one condition tested at the bottom of the body,
the rest broken out of — leaves no gap.

## 2. The desirability test, and the number it hides

`move_movables` moves a movable when

```c
already_moved[regno] || flag_move_all_movables
  || (threshold * savings * m->lifetime) >= (moved_once[regno] ? insn_count*2 : insn_count)
  || (m->forces && m->forces->done && n_times_set[m->forces->regno] == 1)
```

Four things about this, each of which has misled a reading:

1. **`threshold` decays inside the loop.** It is a by-value parameter and
   `move_movables` does `threshold -= 3` after every movable it moves — "the
   more regs we move, the less we like moving them". Two movables with
   identical `savings` and `lifetime` in the *same* loop can therefore decide
   differently, and that is not a contradiction. It also means the decision for
   a movable depends on how many moved before it, which is a source-reachable
   quantity.
2. **A move is a disjunction, a refusal is not.** A movable that moved proves
   nothing about the product unless no other clause could have carried it.
   `not desirable` always proves every clause failed.
3. **`savings` and `lifetime` absorb their relatives.** `savings` starts at
   `n_times_set[regno]`; `lifetime` is the luid span of the register in the
   loop. A movable that `matches` another, or that `forces` it, has its savings
   and lifetime *added into* the one it matches or forces. A second
   materialisation of the same value inside the loop therefore feeds the hoist
   rather than competing with it, and a `%hi`/`%lo` pair is one unit whose
   product cannot fall below 2×2.
4. **`threshold` is never printed.** `psx_loop_trace` solves for it. Both
   thresholds come from one compilation-wide constant —
   `move_movables` uses `(loop_has_call ? 1 : 2) * (1 + n_non_fixed_regs)` and
   `strength_reduce` uses `(loop_has_call ? 1 : 2) * (3 + n_non_fixed_regs)` —
   so every decision in every function constrains the same unknown, and the
   tool keeps a running record.

Once the threshold is a number, every decision is arithmetic: the tool prints
the product a movable needed against the product it had. **Use that number.**
An argument about whether a hoist "should" have happened is not a substitute
for the inequality that decided it.

Fifth, and it bounds all four: **the test only ran if the pass could see the
insn.** `scan_loop` skips insns a loop pass created — they have no luid, so
`loop_reg_used_before_p` cannot be asked about them, and their registers are at
or above `max_reg_before_loop`. A product that cannot clear the bar therefore
refutes a hoist *only* for values the scan actually examined. See §3.1.

## 3. Strength reduction

`strength_reduce` finds basic induction variables (registers stepped by a
constant each iteration) and general induction variables (`biv * mult + add`).
Several givs over the same biv with the same `mult` and `add` **combine** into
one, and the survivor is *reduced* to a fresh pseudo whose initialisation goes
in the preheader and whose increment goes in the loop.

The reduced pseudo becomes a biv of its own in the next pass. That is the only
place the log prints the UID of the initialisation insn it created, which is
why `psx_loop_trace` can name it for pass 1 at all.

A giv is rejected when `lifetime * threshold * benefit < insn_count`, and the
log prints both sides. The printed product is the one place `threshold` reaches
the log as a number, which is what makes the constant solvable.

**Benefits sum when identical givs combine.** `combine_givs` folds givs with the
same `mult` and `add` into one and adds their benefits together, and the sum is
what the reduce gate sees. An expression that declines as a single occurrence —
a mult-1 giv over a single-register add carries benefit 4 against an `add_cost`
of 4, so its combined benefit is 0 and it is refused — can clear the gate as
two. Spelling the same expression at a second consumer is therefore a **lever**,
not a redundancy, and it is a lever with no cost in the final code: the two
occurrences become one reduced pseudo.

### 3.1 The cascade: a pass-2 movable with no pass-1 story

`scan_loop` records a movable by asking `loop_reg_used_before_p` about the
candidate, and that question cannot be asked about an insn a loop pass created:
it has no luid, and the scan skips registers at or above `max_reg_before_loop`.

So a value that **pass 1 hoisted out of a nested loop** is invisible to pass 1's
scan of the enclosing loop, and when pass 2 comes round it is an ordinary
loop-invariant set in the outer body with no history. It hoists again, into the
outer preheader, after everything pass 1 emitted.

This is a third route to a pass-2 emission, and the one that is easiest to miss
because the other two are about *decisions*: break pass-1 invariance, or become
an induction expression. This one is about *visibility*. It follows that:

- **a desirability floor refutes the decline route only.** A forced `%hi`/`%lo`
  pair cannot get its product below 2×2, which closes "it declined at pass 1"
  — and says nothing at all about the cascade, where pass-1-outer never ran the
  test. An impossibility proof that does not state which route it is about is
  conditional on a premise it has not written down;
- **it needs a real nested loop.** `psx_target_loop_emission` reports whether the
  loop nests another, which is target-side and available on a stub;
- **it needs the inner loop to be scanned.** A phony inner loop silently converts
  the whole cascade back into the outer-level regime — the one the floor already
  refuted — so the experiment comes back agreeing with the refutation.

`psx_loop_trace` prints observed cascades outright, joining the pass-1 landing
UID to the pass-2 movable that re-hoisted it.

## 4. The requirement, and the objective to iterate on

`psx_loop_trace` observes *your* loop pass. `psx_target_loop_emission` derives
what the **original's** must have done, from the target's bytes alone — so it
works on a bare `INCLUDE_ASM` stub, before the first line of source. Every other
pass in this pipeline has both halves; `loop` had only the observer, and that
absence is why a preheader residual had nothing to steer by.

The derivation is §1 read backwards. A preheader is a non-decreasing sequence of
emission classes, so each group's own evidence — an address the loop only reads
*can* be a movable; a register the loop steps by a constant *can* be an
induction init; a call argument can be neither — is cut down by the ordering
until only some classes remain. A group that lands after an induction
initialisation cannot be a pass-1 movable, and that is a fact about the
original, derived without compiling anything.

The output is a goal per constrained address, scored `MET` / `NOT MET` /
`UNDETERMINED`, and a distance. Each goal also lists the **routes** by which the
original can have reached a pass-2 emission — decline at pass 1, cascade out of
a nested loop (§3.1), or become a reduced giv — with the target-side evidence
that opens or closes each one here and what the source has to do for it. They
are different mechanisms, not rewordings of one, and an argument that refutes
one says nothing about the others.

**Minimise that distance, not the byte score.** On a preheader residual the byte
score is flat across the entire family of source spellings — the same
`[0,0,1,1]` for twenty-odd distinct programs — and worse than flat, it is
*inverted*: the one variant that puts the address on the required side of the
pass boundary can score dozens of words worse than variants that get the
mechanism wrong, and be recorded as closed on that basis. A search steered by
the residual cannot find the answer in this family however long it runs.

Scoring a candidate narrows the requirement as well as the candidate. The report
lists the readings of the target's preheader that hold every class your program
actually produced; when exactly one survives it says **PINNED**, and what the
original's loop pass did has stopped being a range. Zero surviving readings is
the opposite and a distinct failure: every group is individually possible and no
reading holds them together, so the *combination* has to change.

`UNDETERMINED` is a real outcome and counts against a candidate. The two sides
name symbols differently — the target lift renders an unnamed datum as an offset
from the nearest known symbol, the compiler's RTL names it outright — so the
match is by address, and a name neither side resolves means the tool does not
know. It is not a pass.

## 5. What to do with the reading

- **Position-only preheader residual** → §1. Establish which pass emitted each
  instruction, in both programs, before touching source.
- **A movable the target emits in pass 2 and yours in pass 1** is a
  **desirability flip**. Both sides of the test belong to the **pass-1 body**,
  before hoisting. Change the invariant work inside the window between the
  last movable that must still move and the one that must decline. A moved
  group costs the threshold 3 and adds its instructions to `insn_count`;
  matching groups may merge and absorb savings/lifetime, so measure rather
  than predict. `psx_target_loop_emission` prints the conditional goals, slack
  and source-line window; `psx_hoist_knob_sweep` measures the finite product of
  local-copy versus direct-global access routes (including constant-offset
  copies, with original casts/units preserved) in and ahead of it. It also
  enumerates compatible named record-array views already in the input context,
  measuring their layouts with the production compiler and proving guarded
  byte-affine read equivalence before preparing and re-tracing each family.
  The raw family stays in the search; larger combined products are explicitly
  sampled. Meeting the hoist goals does not prove EXACT: keep the byte oracle's
  separate verdict. Identical final loops do **not** imply identical pass-1
  counts. A closure based on those counts has an open source-side premise until
  the measured context/representations and window/site sets are exhaustively
  searched with no goal-meeting variant. That closes only the recorded domain,
  not every source representation.
- **A hoist the target does not have** → §2. Read the product and the
  threshold it was compared to. If the product cannot be lowered — an
  inseparable `%hi`/`%lo` pair is the common case — the lever is not
  desirability but *invariance*: the expression must not be a movable at that
  pass at all.
- **A hoist the target has and you do not** → the same reading in reverse, plus
  the possibility that the target's expression was invariant where yours is
  not. Check what varies in your loop body that need not.
- **An induction variable in one program and not the other** → §3, and read
  `psx_triage`'s `loop-idiom` finding: a hand-written countdown byte-matches
  the loop body while putting the pass-time geometry somewhere unreachable.
- **A giv the target reduced and yours declined** → §3. Read the combined
  benefit, not the individual one, and check whether the target's expression has
  a second occurrence yours lacks. `psx_triage`'s `cluster-donor` finding pairs
  the two sides automatically when a cluster-mate reduced the shape you were
  refused, and quotes the lines of its C that produce it. Note which refusals it
  does *not* report: a giv the pass valued below zero is not a near miss, because
  the lever is combining and combining sums benefits.
- **Nothing about your loop's own decisions explains the target's order** →
  §3.1. Check whether the loop nests another and whether that inner loop is
  scanned; the pass-1-outer scan you are reasoning about may never have run on
  the value at all.

## 6. What these tools do not do

`psx_target_loop_emission` reads the target's *final machine order*, which
`sched2` could in principle have permuted after `loop.c` emitted it. It says so
in its own caveats; `psx_search_scheduler_state` settles whether the scheduler
could have produced a different preheader order for that block, and until it
does the requirement is conditional on the scheduler not being the lever.

`psx_loop_trace` is candidate-side. There is no loop dump for a binary nobody
compiled, so unlike `psx_reverse_pipeline` it cannot compare the two sides. It
reports what *your* program's loop pass decided; the residual reports how the
original's must have decided differently. Nothing in its output licenses an
edit the clean-source policy forbids.
