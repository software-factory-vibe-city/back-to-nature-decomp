# Defeating jump.c's conditional-return block swap with a labelled return

**Function.** `ovl_11_func_800E1F9C` (ovl_11, 0x11C bytes, 71 insns), byte-exact
this session from candidate `build/candidates/ovl_11_func_800E1F9C/v32.c`.

**Mismatch signature.** A guarded tail of the shape

```
if (i == 3) { return 0; }     /* return-0 block */
call(...);                    /* call block, falls through to epilogue */
return p;
```

compiled with the two trailing blocks *swapped*: the candidate emitted
`call` first with the return-0 block after it, and the test's polarity was
inverted (`beq i,3,ret0` instead of the target's `bne i,3,call`). No amount
of respelling the same statements moved it: `return 0;`/`return NULL;`, an
explicit `else`, a `goto block;` placed after the call, and a three-way
if/else all compiled to byte-identical words (recorded as one experiment
each in the ledger). The residual was 4-6 words in blocks 11-13 plus one
delay-slot value, and `psx_search_residual_source_space` exhausted its
CFG-frozen domain without an exact candidate.

**Mechanism (GCC 2.95.2 `jump.c`, `jump_optimize`, ~line 1814).** The pass
recognises `if (foo) bar; else break;` and swaps the two branch ranges so the
"else" becomes the fall-through. The rewrite is gated on `!first` (so it runs
in a later sweep, not the first) and on the condition that the conditional
jump's target equals `next_label(insn)` — i.e. the block the jump targets is
the next `CODE_LABEL` after the test. In the mis-swapped builds the
fall-through return-0 block carried **no label**, so `next_label(test)` was the
call block and the swap fired. The target's return-0 block carried a label
(it is also the destination of the function's *outer* early-exit), so
`next_label(test)` was the return-0 block, the precondition failed, and the
target kept return-0 first with the call falling through to the epilogue.

**Source fix.** Give the fall-through return block a real label at the point
the branch reaches it, and route the function's other early exit through it:

```c
    if ((u32) (arg0 - 0x109) >= 2U) {
        goto ret;                 /* outer guard shares the return block */
    }
    ...
    if (var_s1 == 3) {
ret:                              /* label on the fall-through return-0 */
        return 0;
    }
    ovl_11_func_800E2968(...);
    return (s16 *) var_s0_2;
```

The forward `goto ret` into the `if` body is deliberate; it is what makes the
return block a branch target at RTL time. Measured effect: `v19` (same body,
no shared label) 65/71 with population 7, all of it in the tail; `v31` (same
body, shared label) 70/71 with population 1, leaving only the first branch's
return value; `v32` (`v31` plus `if (var_s0 == 0) return 0;` early form)
EXACT. Note the source must use literal `0`, not `NULL`: the ovl_11 TU
includes only `common.h`, which does not define `NULL`.

**Second, independent trap in the same function.** Reusing one source
variable for both the call-result temp and the loop counter (`s1`) was
necessary to match allocation; merging them drove allocation and scheduling
residuals to zero. See the experiment ledger for the sequence.

**Reuse.** When a tail's two blocks are swapped with inverted polarity and
every statement-level respelling is a no-op, suspect this `jump.c` swap rather
than the scheduler or allocator, and look for an unlabelled fall-through
return block. Cross-jump notes (`func_8001A284-crossjump-equiv-orphan.md`) and
`func_800154CC-polyf4-diamond-crossjump.md`) cover the related
`find_cross_jump` rewrite; this note covers the conditional-return swap.
