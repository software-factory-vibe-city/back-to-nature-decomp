# gcse-PRE placement, loop movable order, and why a two-insn preheader transposition can be unreachable

**Compiled 2026-08-12 from the func_80017300 rework** (281/331 -> 318/331 words
by index across two sessions). **RESOLVED 2026-08-12, same day: the function is
matched (331/331, byte-exact). The closed argument in §7 was sound but
conditioned on a wrong CFG premise — see §11 for the escape and the general
mechanism.** Status: `notes/human-needed-approvals/func_80017300.md`.

This note exists because the *mechanism* generalizes and the specific
derivation is expensive to redo. The residual is two instructions in the wrong
order in three loop preheaders, and closing it turns out to require a fact
about `gcse.c`'s lazy-code-motion placement that is not visible from the
emitted code, only from `pre_lcm`'s dataflow. Everything below was read off the
GCC 2.95.2 source in `tools/vendor/gcc/2.95.2/src/gcc/` and confirmed against
`-da` dumps; nothing here is inferred from the assembly alone.

---

## 0. The shape of the problem

Each of the three decode branches ends up with a row loop whose preheader holds
three instructions. The target:

```
80017464: lui     t0,0x8006      # high(D_8005EE28)        -> pseudo A
80017468: andi    s6,a0,0x2      # flags2 = entry_data & 2 -> pseudo F
8001746C: move    s7,t0          # copy of A               -> pseudo B
80017470: addiu   a0,s7,-4568    # loop top: dst = D_8005EE28
```

The attempt emits `[andi, lui, move]`. Same three instructions, same three
registers, same everything else in the function — the `andi` is one slot too
early, in branches A and C. Branch B is correct.

Two words per branch, four words total. It survived every statement
permutation, every declaration permutation, and every flag column.

---

## 1. Rule out the scheduler first — it is not the actor

`schedulerTrace --pass sched2` on the preheader block:

```
;; -- basic block number 9 from 1106 to 1102 --
;; insn[1097]: priority =    1, ref_count =    0     <- andi
;; insn[1098]: priority =    1, ref_count =    2     <- lui
;; insn[1102]: priority =    1, ref_count =    0     <- move (depends on lui)
;; ready list at T-1: 1102 (1) 1097 (1), now 1102 1097
;; ready list at T-2: 1097 (1) 1098 (1), now 1098 1097
;; ready list at T-3: 1097 (1), now 1097
```

All three tie at priority 1 **even though `move` depends on `lui`**, because
`insn_cost` is 0 for these patterns on r3000, so a dependence edge contributes
nothing to the longest-path priority. `rank_for_schedule` then falls through to

```c
  return INSN_LUID (tmp) - INSN_LUID (tmp2);   /* tmp = *y, tmp2 = *x */
```

which sorts the ready list by **descending** LUID; the block is filled
bottom-up, so the incoming order is reproduced exactly. **A tied block is a
no-op for the scheduler.** Any reordering has to be present in the RTL that
reaches sched2.

*General form:* when `schedulerTrace` shows every candidate at the same
priority, stop looking at the scheduler and go find the pass that produced the
RTL order.

---

## 2. Where the RTL order comes from: `loop.c` movable emission

`move_movables` walks the movable list and emits each with
`emit_insn_before (..., loop_start)`, so the preheader ends up in **list
order**, and the list is built by `scan_loop` appending in **insn-stream
order** (`last_movable->next`). Confirmed in the `.loop` dump for branch A:

```
Insn 220:  regno 150 (life 1),   move-insn savings 1  not desirable
Insn 224:  regno 116 (life 342), global savings 1     moved to 1097   <- andi
Insn 1032: regno 274 (life 340), global savings 1     moved to 1098   <- lui
Insn 343:  regno 162 (life 1),   move-insn savings 1  not desirable
```

and in the second `loop_optimize` pass (`-frerun-loop-opt`):

```
Insn 220:  regno 150 (life 2), move-insn savings 2  moved to 1102     <- move
```

So the preheader is `[pass-1 hoists in RTL order] ++ [pass-2 hoists]`, and
insn 220 (the `high` feeding the loop-top `lo_sum`) is hoisted only in pass 2
because it just misses the desirability test:

```c
threshold * savings * m->lifetime  >=  (moved_once[regno] ? insn_count * 2 : insn_count)
```

with `threshold = (loop_has_call ? 1 : 2) * (1 + n_non_fixed_regs)` ~ 61,
`savings = 1`, `lifetime = 1` (its only in-loop use is the immediately
following `lo_sum`), against `insn_count` ~ 70. In pass 2 cse2 has rewritten it
into a register copy, lifetime and savings double, and it moves.

**So the required order is: the `lui` must precede the `andi` in the loop
body's RTL.**

---

## 3. Insn 1032 is a PRE insertion, and PRE inserts at the *end* of a block

From the `.gcse` dump:

```
PRE: redundant insn 366 (expression 38) in bb 22, reaching reg is 274
PRE: redundant insn 407 (expression 38) in bb 23, reaching reg is 274
PRE: redundant insn 477 (expression 38) in bb 28, reaching reg is 274
PRE/HOIST: end of bb 9,  insn 1032, copying expression 38 to reg 274
PRE/HOIST: end of bb 27, insn 1041, copying expression 38 to reg 274
PRE/HOIST: end of bb 46, insn 1059, copying expression 38 to reg 274
```

Expression 38 is `high(D_8005EE28)`. `pre_insert` computes
`INSERT = pre_optimal & ~pre_redundant` per block and calls
`insert_insn_end_bb`, which places the new insn **before the block's closing
jump** — i.e. after every original instruction in that block.

**Consequence: an `and` written anywhere in the row-loop-top block is
necessarily earlier in the RTL than the PRE insertion, and therefore earlier in
the movable list, and therefore earlier in the preheader.** Source statement
order inside that block is inert for this residual — verified by permuting
`dst` / `flags2` / `next_row` in every order.

---

## 4. Why branch B is right: two PRE insertions in one block, ordered by index

Branch B's `flags2 = entry_data & 2` sits at its use site, and PRE relocates it
too:

```
PRE: redundant insn 609 (expression 40) in bb 39, reaching reg is 277
PRE/HOIST: end of bb 27, insn 1041, copying expression 38 to reg 274   <- lui
PRE/HOIST: end of bb 27, insn 1044, copying expression 40 to reg 277   <- andi
```

`pre_insert`'s inner loop walks the bitmap **by ascending expression index**:

```c
for (j = indx; insert && j < n_exprs; j++, insert >>= 1)
```

Expression 38 < expression 40, so the `lui` is emitted first and the `andi`
second — and `loop.c` then hoists both in that order. **When two values are
both PRE-relocated into the same block, their relative order is the expression
hash-table order, not the source order.**

The reason PRE could walk branch B's `and` all the way back to the row-loop top
is its nested channel loop: the delay chain (below) dies at a loop head, and
the last block of the chain is the row-loop top.

---

## 5. The lazy-code-motion placement, and the bb 10 trap

`compute_pre_data` calls

```c
pre_lcm (n_basic_blocks, n_exprs, s_preds, s_succs, transp,
         antloc, pre_redundant, pre_optimal);
```

— note **no `comp` (locally-available) bitmap**. Placement is decided from
transparency and anticipatability alone. Two further quirks matter:

- `compute_latein` degenerates. Its `temp_bitmap` is all-ones for every block
  except the last, so `LATEIN(bb) == DELAYIN(bb)` throughout.
- `LATEIN` is an entry-of-block property, but `pre_insert` inserts at the
  **end** of the block. The analysis and the rewrite disagree about where "the
  block" is.

The flow equations that decide everything here:

```
ANTIN(b)    = ANTLOC(b) | (TRANSP(b) & ANTOUT(b)),  ANTOUT(b) = AND over succ ANTIN
EARLYOUT(b) = ~TRANSP(b) | (EARLYIN(b) & ~ANTIN(b)), EARLYIN(b) = OR over pred EARLYOUT
DELAYIN(b)  = (ANTIN(b) & EARLYIN(b)) | (AND over pred DELAYOUT)
DELAYOUT(b) = ~ANTLOC(b) & DELAYIN(b)
OPTIMAL(b)  = DELAYIN(b) & ~ISOOUT(b)
REDUNDANT(b)= ANTLOC(b) & ~(LATEIN(b) | ISOOUT(b))
```

Branch A's CFG, from the `.gcse` BB table:

```
BB 8  (row-loop guard, `if (height != 0)`)      succs: 54, 9
BB 9  (row-loop top; dst, next_row, `if (row_width != 0)`)  succs: 19, 10
BB 10 (`row = row_width`)                        succs: 11
BB 11 (RLE loop head; join with the latch)       preds: 18, 10
BB 19 (flag test)                                preds: 9, 18
```

**Why the expr-38 insertion lands at bb 9.** `ANTIN(8)` is 0 because bb 8's
other successor (the height-skip) never computes the expression; that makes
bb 8 "earliest", so `EARLYIN(9) = 1`, and bb 9 is `ANTLOC` (it computes the
`high` for `dst`), so `DELAYOUT(9) = 0` and the chain stops there. Single
insertion, end of bb 9. Correct and unavoidable.

**Why moving `flags2` to the use site produces a second, fatal insertion.**
With no `and` in bb 9, `DELAYOUT(9) = 1`, so the delay flows into bb 10, whose
only predecessor is bb 9. The chain then dies at bb 11 (a loop head: a join
whose latch predecessor has `DELAYOUT = 0`). `OPTIMAL` is therefore set at both
bb 9 *and* bb 10 — measured:

```
PRE/HOIST: end of bb 9,  insn 1032, expression 38 -> reg 274
PRE/HOIST: end of bb 9,  insn 1035, expression 54 -> reg 277   <- wanted
PRE/HOIST: end of bb 10, insn 1038, expression 54 -> reg 277   <- fatal
PRE/HOIST: end of bb 46, insn 1065, expression 38 -> reg 274   (branch C)
PRE/HOIST: end of bb 46, insn 1068, expression 54 -> reg 277
PRE/HOIST: end of bb 47, insn 1071, expression 54 -> reg 277   <- fatal
```

Two sets of reg 277 inside the loop means `set_in_loop != 1`, so `scan_loop`
never lists it as a movable and the `andi` stays in the loop body — it lands in
the guard branch's delay slot. **328 instructions, 24/331.**

`pre_expr_reaches_here_p` cannot save it either: it walks back from the deleted
occurrence and stops only at a predecessor that generates (`comp`) or kills
(`~transp`) the expression, and `comp` is computed before the insertions exist.

---

## 6. Deleting bb 10 works, and is still a net loss

Hoisting `row = row_width` above the guard removes bb 10 entirely. The `.gcse`
dump then shows exactly the wanted pair in all three row-loop-top blocks
(bb 9, bb 26, bb 45) and nothing at bb 10 / bb 47, and the preheaders come out
`[lui, andi, move]` — **the target's order, in all three branches.** It is
still worse overall, for two independent reasons:

1. **Allocation.** With the assignment above the guard, the guard tests `row`
   instead of `row_width` (they hold the same value, so cse folds it), which
   removes two references at row-loop depth. `row_width`'s `REG_N_REFS` drops
   19 -> 13, its allocno priority 4108 -> 2108, and `$s4`/`$s6`/`$s5` rotate
   block-wide: about 20 words.
2. **Loop-top emission.** The target emits
   `[addiu dst, beqz s4, addiu s2,a1,1 (delay)] + [move a1,s4]`. With bb 10
   gone the block becomes `[addiu s2,a1,1, move a1,s4, beqz, addiu dst
   (delay)]` — four words per branch. The best reachable variant of that shape
   (guard still on `row_width`, so the delay slot can take `move a1,s4`) still
   costs two words per branch, which is exactly what the transposition costs.
   **The trade can never be better than a wash.**

Measured: 292/331 for the whole family, against 318/331 for the shape that
keeps bb 10.

The delay slot is also positive evidence that bb 10 exists in the original.
`reorg` fills from the closest eligible insn backwards; if `move a1,s4` were in
the same block as the branch it would have been chosen over `addiu s2,a1,1`
(`a1` is dead at the branch target). It was not chosen, so it is not in that
block.

---

## 7. The closed argument

For the `and` to follow the `lui` in the movable list, it must be one of:

**(i) A PRE insertion at the end of bb 9.** Requires `OPTIMAL(bb10) = 0`, hence
`DELAYIN(bb10) = 0`, hence `DELAYOUT(bb9) = 0`, hence `ANTLOC(bb9) = 1` — an
*original* `and` in bb 9. But `loop.c` hoists that original insn, and it
precedes the insertion. Self-defeating.

**(ii) An original insn in a block after bb 9.** `scan_loop` refuses:

```c
else if (! reg_in_basic_block_p (p, SET_DEST (set))
         && (maybe_never || loop_reg_used_before_p (set, p, loop_start, scan_start, end)))
  ;  /* unsafe: not a movable */
```

`maybe_never` is 1 for every block after the guard jump (it is set at any
`CODE_LABEL` or `JUMP_INSN` and reset only at `NOTE_INSN_LOOP_VTOP` at
`loop_depth == 0`, which never occurs here). So `reg_in_basic_block_p` must
hold, and it requires `REGNO_FIRST_UID` to be this insn **and the register's
last use to be in the same basic block**, returning 0 at the first
`CODE_LABEL`. `flags2`'s use is the flag test, always a later block. Measured
at 83/331 for both placements inside the guard.

**(iii) PRE leaving the use-site occurrence alone.** `pre_delete` deletes it
whenever `~OPTIMAL & REDUNDANT`, i.e. whenever `LATEIN(19) = ISOOUT(19) = 0`.
`LATEIN(19) = DELAYIN(19) = 0` because bb 19's other predecessor is the RLE
loop exit and a delay chain cannot cross a loop. `ISOOUT(19) = 0` because
`ISOIN` only becomes 1 through a `LATEIN` block and none is downstream. Raising
`EARLYIN(19)` needs `~TRANSP` on the path, i.e. the operand written inside the
loop — which destroys loop invariance, so `loop.c` would not hoist it either.
Mutually exclusive.

Every source shape lands in one of those three buckets. **Either the original's
CFG differs from this reconstruction in a way not yet identified, or there is a
fourth path through `loop.c`/`gcse.c` not covered by this reading.**

---

## 8. The one lever identified and NOT exhausted

`scan_loop` does not always scan the loop in stream order:

```c
  /* If loop has a jump before the first label, the true entry is the target
     of that jump.  Start scan from there.
     But record in LOOP_TOP the place where the end-test jumps
     back to so we can scan that after the end of the loop.  */
  if (GET_CODE (p) == JUMP_INSN)
    {
      loop_entry_jump = p;
      if (simplejump_p (p) && JUMP_LABEL (p) != 0
          && INSN_IN_RANGE_P (JUMP_LABEL (p), loop_start, end))
        {
          loop_top = next_label (scan_start);
          scan_start = JUMP_LABEL (p);
        }
    }
```

For a loop **entered near the bottom** — one whose first in-range insn is an
unconditional jump to a label inside the loop — `next_insn_in_loop` scans
`[scan_start .. end]` first and then wraps to `[loop_top .. scan_start]`. That
reorders the movable list relative to the stream, which is precisely the
degree of freedom section 7 says does not otherwise exist.

Two caveats before spending a session on it: `scan_loop` bails with "is phony"
unless `scan_start` is a `CODE_LABEL` and its UID is below `max_uid_for_loop`;
and the shape implies an extra entry jump the target does not appear to have.
But it is the only unexhausted mechanism, and it was found too late to test.

Related, also untested: `NOTE_INSN_LOOP_VTOP` resets `maybe_never` to 0, but
only at `loop_depth == 0`. `jump.c:duplicate_loop_exit_test` emits it via
`emit_note_before (NOTE_INSN_LOOP_VTOP, exitcode)` — inside the converted
loop's `LOOP_BEG`/`LOOP_END` range, so it is at depth >= 1 when an outer loop is
being scanned and does not help. Confirmed by reading; not worth re-deriving.

---

## 9. The second residual is arithmetic, not shape

`allocno_compare` (global.c):

```c
pri = (int) (((double) (floor_log2 (n_refs) * n_refs) / live_length) * 10000 * size);
/* ranked descending; exact ties broken by ascending allocno number */
```

`reorg`'s `fill_slots_from_thread` steals the join block's **first** insn into
the delay slot and redirects the branch past it, so the target's
`move s1,zero` at both 0x80017400 and 0x80017424 proves `count_rle = 0` is
written before `repeat = 0`. Writing it in that order costs `repeat` exactly 8
units of `REG_LIVE_LENGTH`:

| pseudo | role | n_refs | live_length | priority |
|---|---|---|---|---|
| 108 | `repeat`, written second | 29 | 544 | **2132** |
| 150 | branch-A `high(D_8005EE28)` | 8 | 114 | 2105 |
| 108 | `repeat`, written first | 29 | 552 | 2101 |

At 544 `repeat` outranks pseudo 150 and takes `$s7` first. The `.greg`
dispositions confirm the whole 13-word regression is that one swap and nothing
else: `108: 30 -> 23`, `150: 23 -> 30`, `189: 23 -> 30`.

Closing it needs `live_length(108) >= 552`, or `live_length(150) <= 112`, or
`n_refs(150) >= 9` — with the emission unchanged. See the approvals note for
the full sweep; nothing found.

### `REG_N_REFS` is the sum of loop depths, and that makes this computable

Verified twice against `.lreg`:

- `repeat` = 2 (entry-loop init) + 3x4 (branch A RLE, depth 4)
  + 3x5 (branch B RLE, depth 5 — one deeper for the channel loop) = **29**
- branch-A `%hi` pseudo = 2 (set in the row-loop preheader) + 3 (loop-top use)
  + 3 (flag-pass use) = **8**

Function body is depth 1 and each nesting adds 1. **This makes allocno
priorities hand-computable from the source shape**: you can decide before
writing a variant whether it can possibly win the tie, and which of the two
pseudos is cheaper to move. Recorded as a general imperative in the style
guide's allocator table.

---

## 10. What a next session should not redo

- Per-file flag overrides. `flagProbe --with-source`: baseline 314/331
  dominates every column, next best 253. Escalation bar not met.
- `-fmove-all-movables` (347 instructions), scheduling barriers, exhaustive
  residual search (2.14e15 candidates).
- A single pre-dispatch flag computation. LCM leaves it where it is
  (`ANTLOC` at its own block makes `DELAYOUT = 0`), so it stays one `andi`, not
  three — consistent with the target having three.
- Row loop written as `while (...)` instead of the guarded do-while:
  **byte-identical output**, 318/331. `jump.c` converts it back.
- Inner RLE loop written as `while (...)`: worse.
- `register T x asm("$N")` pinning. GCC 2.95 does **not** reserve the register;
  the probe emitted `lb $16,0($fp)` with `src` allocated to the pinned
  register. Hard-register pinning has no purchase on allocation residuals in
  this compiler, independent of project policy.
- Splitting `repeat` into per-branch variables: needs its own initialiser,
  334 instructions.

---

## 11. RESOLUTION — the CFG premise was wrong; the loops are reversed count-ups

§7's closed argument was correct *given its premise*: a hand-written countdown
(`if (row_width != 0) { row = row_width; do { ... } while (row != 0); }`).
Under that source, bb 10 (`row = row_width`) exists from RTL expansion onward,
and the two-insertion trap in §5 is genuinely unavoidable. The original did not
write that source. Per the period prior the style guide already stated
("countdown loops in targets are check_dbra_loop reversals of count-up
source"), the original inner byte loops are **count-up loops**:

```c
row = 0;
while (row < row_width) {         /* branch A; branch C is the plain for */
    ...decode one byte...
    row++;
    count_rle--;
}
```

Under this source, at gcse time the guard's fall-through block holds the dead
`row = 0` / check_dbra's own `row = row_width` init, and the lazy-code-motion
delay chain for `flags2 = entry_data & 2` (written at its USE SITE, as in
branch B) produces exactly **one** insertion per branch, at the end of the
row-loop-top block, after the `high()` insertion (expression index 38 < 54).
All three preheaders come out `[lui, andi, move]` — the target order — and
`repeat`'s REG_LIVE_LENGTH comes out 552 even with `count_rle = 0` written
first, which flips `allocno_compare` back to the target allocation (150/189
take $s7, repeat takes $fp). Residuals 1, 2, and 3 were one defect: the wrong
loop idiom.

Mechanism facts established (all read from `loop.c:check_dbra_loop` and
verified by compile):

- **Reversal requires a signed `LT` comparison.** An unsigned bound (`u32
  row_width` against `s32 row`) makes the exit test `LTU` and check_dbra
  refuses; the loop stays count-up with an extra `sltu` (+2 insns). So
  `row_width` must be `s32` here.
- **The `beqz` guard is combine's work.** The duplicated exit test is signed
  `0 < row_width`; combine's `simplify_comparison` rewrites `LE/GT 0` to
  `EQ/NE 0` because `nonzero_bits` proves `(w*2) & 0xFFFF` non-negative. A
  `beqz` guard on a signed loop bound is therefore *consistent with* a signed
  count-up source, and is positive evidence for a masked/nonneg bound.
- **Reversal needs the VTOP note** (`loop_info->vtop`) when the bound is a
  register: only jump.c's while/for conversion emits it. A source do-while can
  never take this path — do-while and reversed-while are NOT the same
  experiment even when they emit the same loop body.
- **The rewritten decrement keeps the increment's RTL position.** check_dbra
  edits the `row++` insn in place, so `for (...; row++)` puts `row--` after
  the whole body (after `count_rle--`), while `while` + explicit trailing
  `row++; count_rle--;` puts it before — that one-slot difference was the last
  3-word residual (loop-bottom order `[row--, count_rle-1, sll]`).
- **check_dbra's `row = row_width` init is emitted `emit_insn_before(...,
  loop_start)`** during loop pass 1 — same emitted position as the
  hand-written init, but created after expansion, which is what changes the
  gcse-time story.
- **REG_LIVE_LENGTH is overwritten by sched1** (`sched.c` end of
  `schedule_insns`: `REG_LIVE_LENGTH (regno) = sched_reg_live_length[regno]`),
  accumulated +1 per scheduled insn while the reg is live, segment flushed at
  the (bottom-up) birth. Consequence: with emission fixed, a pseudo's live
  length is pinned — the lever on an allocno_compare inequality is never the
  losing pseudo's own stats, it is the competitor's refs/live-length via
  pre-allocation RTL that later passes delete (or, as here, a different loop
  idiom that changes the block geometry).
