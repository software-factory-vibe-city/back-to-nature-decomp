# ovl_11_func_800D1CFC — a nested-function definition changes how its parent is expanded

**Date:** 2026-10-08
**Outcome:** `ovl_11_func_800D1CFC` is EXACT under the residual oracle,
72/72 words, residual `[0, 0, 0, 0]`. The same translation unit emits the
nested comparator `ovl_11_func_800D1CD0`, which is EXACT at 11/11. The sibling
`ovl_11_func_800D062C` with its comparator `ovl_11_func_800D0600` has the same
cause and is EXACT at 27/27 in scratch. The sibling is not integrated (see §7).

The fix was not a spelling. The comparator has to be **defined** inside the
parent, as a real GNU C nested function. The project had been reconstructing it
as a separately compiled function plus a declaration-only
`DECLARE_NESTED_FUNCTION` (a caller-side macro, since removed). That reproduces
the calls and the static chain, but
not the compiler state the parent was compiled under.

---

## 1. The symptom

Earlier sessions reduced the function to residual `[cfg 0, pop 0, sched 1,
alloc 0]`, with one instruction displaced in the table-lookup tail:

```asm
/* target */                         /* every candidate before this note */
lui   v1,%hi(D_80123A18)             lui   v1,%hi(D_80123A18)
sll   v0,s5,1                        addiu v1,v1,%lo(D_80123A18)
addu  v0,v0,s5                       sll   v0,s5,1
addu  v0,v0,a0                       addu  v0,v0,s5
sll   v0,v0,1                        addu  v0,v0,a0
addiu v1,v1,%lo(D_80123A18)          sll   v0,v0,1
addu  v0,v0,v1                       addu  v0,v0,v1
lhu   a0,0(v0)                       lhu   a0,0(v0)
```

The sibling `ovl_11_func_800D062C` has the identical tail on its twin table
`D_80123A00` and was parked on the same residual. The sibling is straight-line
code with no branches. That later ruled out every branch-dependent explanation:
PRE copies, cross-jumping, and the delay-slot fill.

## 2. The scheduler is not the actor

MIPS in this GCC build does not use the Haifa scheduler. `configure.in` enables
it only for alpha/hppa/powerpc/rs6000/sparc/m32r. Both scheduling passes are
therefore the old backward list scheduler in `sched.c`:

- `priority` adds `insn_cost - 1` along each dependence, so a block of ALU
  instructions with latency 1 has every priority equal to 1.
- `rank_for_schedule` (`sched.c:1837`) breaks ties first by "class" and then by
  `INSN_LUID`. Class only matters for latency above 1, which here means loads.
  `INSN_LUID` is the original insn order, so a tied block replays its incoming
  order.
- `adjust_priority` (`sched.c:1958`) applies only before reload. It raises a
  newly ready "birthing" insn (`birthing_insn_p`, `sched.c:1922`: a single-set
  pseudo that is live) to `LAUNCH_PRIORITY`. In the lookup block the `lo_sum`
  and the final `sll` become ready together and are boosted to the same value.
  The `-dS` trace shows the tie being broken by LUID in favour of the `sll`.

So the target order had to exist in the RTL stream before sched1. Expansion
had to emit `high`, the index chain, then `lo_sum`.

## 3. Why no spelling could produce that order

With the comparator only *declared*, every expansion route keeps the two
halves adjacent:

- The `movsi` expander (`mips.md:5206`) emits `(set tem (high sym))` and the
  `lo_sum` move in one step.
- Array indexing expands the base first (`get_inner_reference`, then the
  `VAR_DECL` address forced through `memory_address`/`force_reg`), giving
  `high, lo, chain`. Pointer arithmetic forces the symbol inside
  `break_out_memory_refs`/`expand_binop`, giving `chain, high, lo`.
- Combine cannot help. `lo_sum (high X) X` simplifies to `X` (`combine.c:3890`),
  and `(set reg symbol)` is rejected by `move_operand` under split addresses.
  So the 3-insn split fails.
- A `lo_sum` can land late only by being combined into a *later copy* of the
  base. The matched `ovl_11_func_800FDFF4` shows this: its table address is a
  call argument, and combine merges the `lo_sum` into the move to `$a1`. CSE
  propagates a plain pseudo copy away before combine sees it, so a source copy
  does not survive.

About forty scratch spellings confirmed this, and all of them kept the halves
adjacent:

- 1-D and 2-D tables, and static-local tables;
- row pointers, struct-wrapped tables, and base-pointer variables;
- running offsets, variable reuse, and calls inside the index.

So did `-fno-schedule-insns`, `-fno-schedule-insns2` and both together. They are
in `build/d1cfc_claude/{forms,sibv,flags}/`.

## 4. The mechanism: `cse_not_expected` survives a nested compile

`memory_address` (`explow.c:444`) forces a constant address into a register
only when `! cse_not_expected`. When the flag is set it falls through to
`LEGITIMIZE_ADDRESS`. The MIPS version's first branch carries the comment
"??? Is this ever executed?" (`config/mips/mips.h:3046`). It emits **only** the
HIGH and returns `(lo_sum H sym)` as the address.

For an indexed access the address then becomes
`(plus (lo_sum H sym) (reg idx))`. `force_operand` (`expr.c:5025`) hands it to
`expand_binop`, which copies the `lo_sum` into a register at that point, after
the index chain has already been expanded. The stream is therefore
`high, chain, lo, add, load`, which is exactly the target. Sched1's LUID ties
then keep it.

The flag's lifecycle:

- `init_function_start` sets `cse_not_expected = ! optimize`
  (`function.c:5885`), so it is 0 at -O2.
- `rest_of_compilation` sets it to 1 once CSE is finished
  (`toplev.c:4030`).
- `push_function_context_to` / `pop_function_context_from`
  (`function.c:551`, `:635`) do **not** save or restore it.

GCC compiles a nested function as soon as its definition is parsed, in the
middle of the parent. The parent therefore resumes with `cse_not_expected = 1`,
and every statement after the nested definition is expanded under it.

The parent's `.rtl` dump confirms this at expand time, before any
optimization:

- the threshold load is already `(mem (lo_sum (reg) D_80123754))`;
- the table gets `(high D_80123A18)` first, then the shifts and adds, then
  `(lo_sum … D_80123A18)`.

## 5. The comparator was never a register-capture idiom

Compiled as a real nested function, the comparator reproduces the target
exactly, including its entry `sw $v0,0($sp)` in an 8-byte frame. That store is
`expand_function_start` (`function.c:6080–6090`) saving the incoming static
chain into the nested function's own frame. It is dead because the comparator
reads no parent variables.

The separately compiled reconstruction reproduced it with `CAPTURE_PREV_RET`,
a user-approved register-pin exception. For this pair that construct is a
reconstruction artifact. It is likely the same for the other
`CAPTURE_PREV_RET` nested-function users (the `func_8001E878` /
`func_8001E9F8` / `func_8001EAE4` family), but that has **not** been measured.

## 6. The source

```c
s32 ovl_11_func_800D1CFC(Recon_ovl_11_func_800D2594_A0View *arg0, Recon800D0408A1View *arg1) {
    s32 ovl_11_func_800D1CD0(s32 a, s32 b) {
        if (a == b) {
            return 0;
        }
        if (a < b) {
            return 1;
        }
        return 2;
    }
    /* locals, the two __builtin_abs distances, two comparator calls ... */
    if (dx < D_80123754 && dy < D_80123754 && (dx < 50 || dy < 50)) {
        result = 0;
        arg0->unk34 &= ~0x2000;
    } else {
        result = D_80123A18[rank1 * 3 + rank2];
    }
    return result;
}
```

cc1 emits the nested function ahead of the parent under its private name
`ovl_11_func_800D1CD0.3`, and the calls `jal` to it. The bytes do not depend on
the name. An `auto` forward declaration with an asm label could restore the
plain project symbol, but it was removed as unnecessary: it is only a naming
device. The earlier session's `__builtin_abs` correction
still matters; the explicit `goto block_12` structure and the `(u32)` index
cast do not.

Sibling, EXACT 27/27 for `ovl_11_func_800D062C` (`build/d1cfc_claude/nest/s.c`).
For integration it should use the same plain nested definition:

```c
u16 ovl_11_func_800D062C(Ovl11RankPair *arg0) {
    s32 cmp(s32 a, s32 b) { /* same three-way body */ }
    s32 temp_s1;
    s32 second;

    temp_s1 = cmp(arg0->unk38, arg0->unk58);
    second = cmp(arg0->unk40, arg0->unk60);
    return D_80123A00[temp_s1 * 3 + second];
}
```

## 7. Integration in a one-function-per-file project

The parent's file now emits the comparator, so
`src/overlays/ovl_11/ovl_11_func_800D1CD0.c` defines nothing. It holds only a
comment naming where the definition lives. `configs/splat/ovl_11.yaml` is
unchanged and keeps one `c` subsegment per function. That is also what
`bootstrapOverlay.ts --write` regenerates, so a re-split does not undo the
integration.

- The comparator's object has an empty `.text`. The parent's object therefore
  links at `0x800D1CD0` and supplies both functions.
- Built-binary checks (`diffFunc`, `make check`) read by address and see both.
- Tools that compile one function's own file find no definition for
  `ovl_11_func_800D1CD0`.

At the time of writing, the integrated tree had not been through `make
check-all` or `psx_finalize_function`. The sibling pair was left as the parked
stub.

## 8. What the earlier sessions' closures were conditional on

Every closed direction in `build/experimentLedger/ovl_11_func_800D1CFC.jsonl`
rests on one unstated premise: that the declaration-only nested macro compiles
the parent under the same state as the original. That covers the allocator
and scheduler-state searches, the declaration audit, the container-origin
branch, the flag matrix and the residual-source grammar. Each proof was sound
for the program it measured. None of them could see that the program was
different, because they all take the translation unit as given.

## 9. Transferable rules

1. **A tied block replays its input.** When the scheduler trace shows the two
   competing insns at equal priority with the wrong one winning on LUID, stop
   working on the scheduler. Find the first dump where the order exists, which
   is usually `.rtl`, and ask what produced it.
2. **When expansion cannot produce an order from any spelling, look for state
   carried in from earlier in the translation unit.** GCC 2.95 keeps global
   flags across functions. A nested function compiled mid-parse changes how
   everything after its definition is expanded.
3. **Static chain plus an adjacent callee means one translation unit.** Look
   for three things together: the caller sets `$v0 = $sp + 16` before the
   call, the callee stores `$v0` to its own frame on entry, and the callee sits
   immediately before the caller. Then the callee was defined inside the caller.
   Reconstruct it that way before modelling any pass, and test the definition
   before any register-capture construct.
4. **Fingerprint of the expansion state** in the parent, after the nested
   definition: a constant address's `%lo` is applied after unrelated
   arithmetic, or a split address reaches a load as `(mem (lo_sum …))` in the
   `.rtl` dump itself, not only after combine.

Scratch artifacts: `build/d1cfc_claude/` holds the base traces, form sweeps,
nested sources and the address-split scanners `splitscan*.ts`.
