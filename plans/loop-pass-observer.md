# Plan: observe the loop pass

Written 2026-08-22, from two sessions on `ovl_10_func_800BA394` that both ran
out of instruments in the same place.

The project can observe every pass that owns a residual except one.
`psx_reverse_pipeline` names the pass. `psx_allocator_counterfactual` states the
allocation requirement as a number. `psx_search_scheduler_state` solves the
sched1 state and returns SAT or UNSAT. For `loop.c` there is nothing, so a
residual owned by loop-invariant hoisting is reasoned about from the pass source
instead of measured — and the reasoning has already produced a wrong answer.

`-dL` is in the vendored cc1 and `loop.c` logs its own decisions. Nothing under
`tools/agent/` reads it.

---

## 1. The gap, and what it has cost

`ovl_10_func_800BA394` is 477/479 words with **no differing word**. The entire
residual is the position of one instruction in a loop preheader:

```
target                          candidate
  move  s7,zero                   move  s7,zero
  lui   v0,%hi(D_800BB86C)        lui   v0,%hi(D_800BB86C)
  addiu s4,v0,%lo(D_800BB86C)     addiu s4,v0,%lo(D_800BB86C)
  move  s3,zero                   lui   v1,%hi(D_800BB9BC)
  lui   v0,%hi(D_800BB9BC)        addiu s8,v1,%lo(D_800BB9BC)
  addiu fp,v0,%lo(D_800BB9BC)     move  s3,zero
```

`ovl_10_func_800B95F0` carries the same transposition, in the same cluster, with
the same four values. Both are one instruction from exact.

Two sessions reconstructed loop.c's decision variables — `savings`, `lifetime`,
`threshold`, `insn_count` — by reading the pass source, because there was no way
to read them off a compile. The second session built an impossibility proof on
those reconstructed numbers and closed the only remaining route.

One `-dL` compile refutes it. The real numbers, for the row loop:

```
Loop from 1194 to 1355: 55 real insns.                              <- pass 1
Insn 1213: regno 516 (life 5), move-insn savings 3  moved to 1645     &D_800BB86C
Insn 1225: regno 523 (life 2), move-insn savings 2  moved to 1647     %hi(D_800BB9BC)
Insn 1226: regno 522 (life 1), move-insn forces 1225 savings 1  moved to 1649
Insn 1298: regno 535 (life 1), done move-insn matches 1213
Insn 1325: regno 541 (life 3), done move-insn matches 1213
Insn 1211: giv reg 515 src reg 85 benefit 3 lifetime 12 ... mult 16 add 0
Insn 1635: giv reg 592 src reg 85 benefit 3 lifetime 61 ... mult 16 add 0
Insn 1329: giv reg 544 src reg 85 benefit 4 lifetime  1 ... mult 16 add 0
giv at 1329 combined with giv at 1211
giv at 1635 combined with giv at 1211
giv at 1211 reduced to (reg:SI 600)

Loop from 1194 to 1355: 42 real insns.                              <- pass 2
Insn 1652: possible biv, reg 600, const =16
Reg 600: biv verified
Biv 600 initialized at insn 1655: initial value 0
```

Four facts, none of which was known after two sessions of reading source:

1. **`1226 forces 1225`.** The `%lo` moves *because* the `%hi` moved. They are
   one unit and cannot be separated by any source change.
2. **`1298` and `1325` "match 1213".** Two further materialisations of the same
   address are eliminated by matching — which is why the named-variable variant
   collapsed into a `%hi` reuse and cost a word.
3. **The three `mult 16 add 0` givs combine and reduce to `reg 600`.** That is
   `off`, confirmed rather than inferred, and its init is emitted after the
   movables.
4. **Pass 2 hoists nothing, and `reg 600` is a *verified biv* there.**

Fact 4 is a live lever the impossibility proof dismissed. In pass 2 the offset
is a biv, so `&D_800BB9BC + off` would be a **giv of biv 600**, and
`emit_iv_add_mult` emits its init in the pass-2 giv batch — after the pass-1 giv
init of `reg 600`. That is exactly the target's order.

The proof also fails on its own terms. `threshold` is
`(loop_has_call ? 1 : 2) * (1 + n_non_fixed_regs)`; this loop has calls, and the
value was never stated. The dump bounds it without needing
`n_non_fixed_regs` — `1298` was *not desirable* at product 1 against 29 insns
(`threshold ≤ 28`), and `1225` moved at product 4 against 55 (`threshold ≥ 14`).
A pass-2 window needs `42 ≤ threshold × product < 55`, which is satisfiable at
thresholds 14–18 (product 3) and 21–27 (product 2), and empty only at 19, 20 and
28. The route is open for twelve of the fifteen possible values.

**Nobody should have to do that arithmetic in a chat window.** It is a tool.

> **Correction, 2026-08-22, after implementing this plan.** The bracket above is
> superseded, and by the tool's own output. It missed that `move_movables` takes
> `threshold` by value and does `threshold -= 3` after every movable it moves
> (`loop.c:1934`, `:2138`), so `1262` and `1298` deciding differently on
> identical inputs is the decay, not a second clause — and both inequalities are
> sound. With the decay modelled, and with rejected givs contributing
> divisibility constraints, the threshold is not a range: `n_non_fixed_regs = 28`
> uniquely, so `move_movables` uses **29** in a loop with a call and
> `strength_reduce` uses **31**. The pass-2 window for `&D_800BB9BC` is then one
> product value wide rather than twelve threshold values: fail in pass 1 at
> effective threshold 26 needs `product <= 2`, move in pass 2 at 29 needs
> `product >= 2`. The route is open; §2.4's soundness filter and the decay model
> are what made it computable. This paragraph is left in place because the plan
> is the record of what was known when it was written.

---

## 2. What the tool is

`tools/agent/loopTrace.ts`, exposed as `psx_loop_trace`. Compile the function's
source with `-dL` through the provenance layer, parse the dump, and report what
the loop optimizer decided.

### 2.1 Scope, stated honestly

This is a **candidate-side** instrument. `psx_reverse_pipeline` can compare
against the target because it lifts the original's bytes; there is no loop dump
for a binary nobody compiled. `psx_loop_trace` says what *this* program's loop
pass did. The residual says what the target's must have done differently, and
the two together are what a search steers by.

That asymmetry is the reason to report *decision variables* rather than
conclusions: `savings 2, life 2, moved` is a fact a reader can act on, where
"the hoist happened in pass 1" is a fact they cannot.

### 2.2 The dump's grammar

Complete, from the `loop_dump_stream` calls in `loop.c`. The parser must cover
all of it or say which line it did not recognise.

| line | meaning |
|---|---|
| `;; Function <name>` | start of a function's log |
| `Loop from %d to %d: %d real insns.` | loop header; the third number is `insn_count`, the desirability denominator |
| `Loop from %d to %d is phony.` | loop discarded |
| `Loop at %d ignored due to setjmp \| multiple entry points \| unknown exit jump` | loop not optimised at all |
| `Continue at insn %d.` | the loop's continue point |
| `Insn %d: regno %d (life %d), ` | a movable; followed by any of `consec %d, `, `cond `, `force `, `global `, `done `, `move-insn `, `matches %d `, `forces %d `, `savings %d `, `halved since already moved ` |
| … ` moved to %d` / `not desirable` / `not safe` | **the decision** |
| `Insn %d: possible biv, reg %d, const =…` | biv candidate |
| `Reg %d: biv verified \| biv discarded, %s \| biv eliminated` | biv outcome |
| `Biv %d initialized at insn %d: initial value …` | biv init site — the preheader position that matters |
| `Insn %d: giv reg %d src reg %d benefit %d lifetime %d …` with ` mult `/` add `/` replaceable`/` ncav` | a giv and its cost |
| `giv at %d combined with \| recombined with \| derived from %d` | giv merging |
| `giv at %d reduced to <rtx>` | the pseudo the giv became |
| `Cannot eliminate biv %d[: biv used in insn %d]` | biv survives |
| `giv of insn %d not worth while, %d vs %d.` | giv rejected, with both sides of the test |
| `Sorted combine statistics:` + ` {%d, %d}` | the combine ranking |

The file also carries the post-pass RTL, which the parser skips.

**Pass boundaries are derived, not assumed.** `-O2` sets
`flag_rerun_loop_opt`, so `loop_optimize` runs twice and both logs land in one
file under one `;; Function` header. A pass boundary is where a `Loop from A to
B` range that has already been seen reappears. The tool reports how many passes
it found rather than hard-coding two, because `-O1` runs one.

### 2.3 What it reports

Per function, per pass, per loop:

- the loop's range and `insn_count`;
- every movable with `regno`, `life`, `savings`, its flags (`cond`, `force`,
  `global`, `consec`, `matches`, `forces`), the **decision**, and — where it
  moved — the insn it moved to;
- every biv, its increment, its init insn, and whether it was verified,
  eliminated or discarded;
- every giv with `src reg`, `benefit`, `lifetime`, `mult`/`add`, and the
  combine/reduce chain to the pseudo it became;
- **the preheader emission order**: movables in decision order, then giv inits,
  per pass — which is the thing the residual is about, assembled from the log
  rather than read off the assembly.

### 2.4 The threshold bracket

`threshold` is never printed, and it is the denominator of every desirability
decision. It can be *solved for* from the decisions themselves, because each one
is an inequality:

```
moved via the product          →  threshold × savings × life ≥ insn_count
not desirable                  →  threshold × savings × life <  insn_count
```

`(moved_once ? insn_count * 2 : insn_count)` on the right, and the tool reads
`halved since already moved` to know which.

**Only decisions the product actually decided may be used.** `move_movables`
moves on four OR'd conditions:

```c
if (already_moved[regno]
    || flag_move_all_movables
    || (threshold * savings * m->lifetime) >= (moved_once[regno] ? insn_count * 2 : insn_count)
    || (m->forces && m->forces->done && VARRAY_INT (n_times_set, m->forces->regno) == 1))
```

so a movable carrying `forces`, or one whose regno was already moved, proves
nothing about `threshold`. A `not desirable` decision is always sound — it means
every disjunct failed. This matters: in `ovl_10_func_800BA394`'s inner loop,
`1262` and `1298` have identical `savings 1, life 1` in the same loop and one
moved while the other did not, so `1262` moved through another clause and its
inequality is worthless. A tool that used it would produce a bracket that
excludes the truth.

The bracket tightens with every function dumped, so it accumulates:
`build/loopTrace/threshold.json` holds the running interval and the decisions
that produced each bound, and the tool reports it with its witnesses. Once the
interval is a single value it is a project constant, and the desirability test
becomes arithmetic anyone can check.

---

## 3. Deliverables

**D1 — the dump, through the provenance layer.**
Compile with `-dL` into `build/loopTrace/<function>/`, stamped like every other
derived artifact so a stale dump cannot be read as a current one. Reuse
`ensureArtifact`; the inputs are the source, the toolchain identity and this
tool's own sources.

**D2 — the parser.** Every line in §2.2, with unrecognised lines *reported*
rather than dropped — a silently skipped line is a decision the reader thinks
they saw. Colocated tests over a captured dump fixture.

**D3 — the report.** §2.3, as text and `--json`. Ordered by pass, then by loop,
innermost first, matching the order `loop_optimize` scans them.

**D4 — the threshold bracket.** §2.4, with the soundness filter, the running
interval under `build/loopTrace/`, and the witnessing decisions printed beside
the bound they set.

**D5 — `psx_loop_trace`.** Registered in `.pi/extensions/psx-decomp/tools/diagnostics.ts`,
with a description that says what it observes and that it is candidate-side.

**D6 — a triage detector.** `loop-preheader-order`: when the residual's open
block is a loop preheader and the difference is instruction *position* rather
than population, say so, name the movables and giv inits the dump attributes to
that preheader, and point at `psx_loop_trace`. This is what would have put both
sessions on the right question on turn one.

**D7 — doctrine.** `prompts/reference/` gains the loop pass alongside the
existing mechanism sheets, and `stuck.md` names the tool where it currently
sends a reader to read `loop.c`.

---

## 4. Definition of done

1. `psx_loop_trace ovl_10_func_800BA394` reports, without hand-editing:
   the three movables with their decisions, `1226 forces 1225`, `1298`/`1325`
   matching `1213`, the three givs combining into `reg 600`, and that pass 2
   hoists nothing while `reg 600` is a verified biv there.
2. The threshold bracket is published with its witnesses, and is narrower than
   the 14–28 derived by hand here.
3. The tool answers the question that has blocked both `ovl_10` functions —
   *what must change for `&D_800BB9BC` to leave pass 1's movable list* — as a
   number, not an argument.
4. `psx_record_closed` rows for both functions are re-derived from measurements
   rather than from source-reading, and the impossibility claim in
   `notes/human-needed-approvals/ovl_10_func_800BA394.md` is corrected or
   confirmed on evidence.
5. `npm test` and `make check-all` pass.

The functions matching is the *point*, not the definition of done: the
instrument is worth having whether or not these two fall to it, and 5 of the 11
parked functions have loop-shaped residuals.

---

## 5. What this does not do

- It does not observe the target. See §2.1.
- It does not change codegen. It is an observer, and no output of it is a
  licence to edit anything the clean-source policy forbids.
- It does not replace `psx_search_residual_source_space`. That enumerates source
  spellings; this explains why a spelling landed where it did. The two answer
  different halves of the same question, and the second session's misreading —
  treating a grammar-limited domain of 1 as "the source space is exhausted" —
  is a good argument for having both.
