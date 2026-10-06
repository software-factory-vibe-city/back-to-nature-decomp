# `ovl_11_func_800E48CC` — a callee's unused trailing argument blocks caller coalescing

**Status:** matched, byte-verified 2026-10-06 (`psx_finalize_function` passed).
**Function:** `ovl_11_func_800E48CC` (ovl_11), 0x800E48CC, 0xD0 bytes.

## Symptom

The clean-C draft compiled with **exactly the same instruction multiset** as the
target (inventory and population exact) but was 32/52 words with
`sched 9 / alloc 6`, and every attempt at a semantics-preserving respelling
compiled to the *identical* object (`psx_residual_objective` reported
`ALREADY MEASURED` for a dozen variants; `psx_search_residual_source_space
--derive-only` priced the whole closure at **1 candidate**).

`psx_reverse_pipeline` localized it to a single surviving copy in block 0:

```
candidate: move a3,a0        ; parameter arg0 -> $a3
           ...
           move a2,a3        ; extra copy for the callee's 3rd argument
target:    addu a2,a0        ; parameter copy coalesced straight into $a2
```

`psx_reverse_pipeline` decision 1 named the mechanism precisely: local-alloc
tries the copy's destination hard register first (`qty_phys_copy_sugg`) and
fails only when that register is occupied across the source value's live range.
The `.lreg` dump confirmed `reg81` (arg0) dies at its last `lhu`, while the
call-argument copy `(set (reg:SI 6 a2) (reg/v:SI 81))` sits *inside* that range,
so `$a2` is live across reg81's range and coalescing is refused.

## Cause

The callee `ovl_11_func_800F5888` is declared with three parameters
(`u16 *, s32 *, s32`), but its **third parameter is never read** — its own
matched definition only touches `arg0`/`arg1`. Passing `arg0` as that dead third
argument made the compiler emit a pseudo→hard copy `$a2 = arg0` for the call,
scheduled inside the parameter's live range. Because the parameter pseudo is
block-local (used only in block 0), **global-alloc never sees it** and cannot
coalesce the copy; local-alloc refuses, and the copy survives to allocation,
rotating every downstream register.

## Fix

Call the callee with the arity its body actually uses — two arguments — and let
the record pointer live on for the field loads:

```c
s32 ovl_11_func_800F5888(u16 *arg0, s32 *arg1);

if (ovl_11_func_800F5888(sp38, sp28) != 0) { ... }
```

`arg0` then coalesces to `$a2` (no call-argument copy), the parameter copy
becomes the target's single `addu a2,a0`, and the whole function is byte-exact
(52/52). Both a direct-field form and a local `p = arg0` form compile to the
same exact words.

## Premise / conditional scope

- The callee's third parameter is genuinely unused: `psx_callee_truth` reports
  `ovl_11_func_800F5888` "reads 2 incoming argument(s), so arity >= 2", and its
  matched definition never references `arg2`.
- The parameter pseudo is block-local. If the same value were live in more than
  one block, global-alloc would own the copy and could coalesce it, and the
  three-argument spelling might have matched. This fix is therefore specific to
  a block-local parameter passed as a dead trailing argument.
- A two-argument call to a definition that declares three is ABI-clean here
  only because the third slot is not read; do not generalize it to callees that
  consume their trailing arguments.

## Evidence

- `build/pipelineReversal/ovl_11_func_800E48CC/` — decision list and `.lreg`
  (`insn 40` copy, `reg81` death at the last `lhu`).
- `build/preparation/ovl_11_func_800E48CC/<hash>/` — draft, diagnostics,
  `evidence.md`.
- `build/experimentLedger/ovl_11_func_800E48CC.jsonl` — every measured variant.
