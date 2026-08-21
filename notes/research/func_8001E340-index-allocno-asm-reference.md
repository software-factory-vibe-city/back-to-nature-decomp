# func_8001E340 — clean-C-blocked allocno swap resolved by a count-only asm reference

**Status: SOLVED (2026-08-21).** 19/19, `diffFunc` MATCH, residual EXACT. The
one construct outside stock clean C is a **no-op inline-asm that merely reads
the loop index** — it emits zero instructions and exists only to raise the
index's weighted reference count above the byte-offset accumulator's, which is
what the target's register allocation requires. User-approved allowlist entry
`func_8001e340: ["embedded-asm"]` in `.pi/autodecomp.json`.

## The function

`func_8001E340(Grid **arg0)` walks a cell grid (`*arg0` → grid; count at +0x8;
0x1C-byte cells from +0xC) and sets each cell's flag (at +0x18) to 1. Two
loop-carried variables:

- `i` (index, `$a1` in the target): init 0, `++i`, compared `slt a1,count`.
- `off` (byte offset, `$a2` in the target): init 0xC, `off += 0x1C`, added to
  the reloaded grid base (`addu v0,v1,a2`), flag stored at +0x18.

Everything else was reachable from clean C (single bottom reload of `*arg0`,
`while (++i < count)` binding, block-1 order `[i, const, off]`).

## Why clean C cannot take the target's registers

The target emits block-1 as `[move a1,zero; li a3,1; li a2,12]` — the index
initializer first. `sched1`'s LUID tie-break on the three independent
initializers makes the RTL birth order the emission order, so the source must
birth `i` before `off`. That makes `i`'s `REG_LIVE_LENGTH` (22) exceed `off`'s
(18), and global-alloc's `floor(log2(refs))*refs/live * 10000` awards `$a1` to
`off` (7777 > 6363 at 7 refs each). Every i-first spelling therefore lands the
index on `$a2` and the offset on `$a1` — the inverse of the target.

Conversely, birthing `off` first (correct `$a1`=index) makes block-1 emit
`[off, i, const]`, permuting three bytes and selecting `li a2,12` for the
`blez` delay slot instead of `move a1,zero`.

`psx_allocator_counterfactual` pinned the exact requirement: for the index to
outrank the offset **at the same live geometry**, the index needs ≥ 8 weighted
references (`refs >= 8 or live <= 18`). The byte-identical machine references
the index exactly 7 times, so no clean-C spelling can reach it — the 18/19
ceiling (c00004, `[off,i,k]` source order) is the best stock clean C
produces, differing only in the three block-1 words.

## The construct

```c
do {
    *(s32 *)((u8 *)g + off + 0x18) = k;
    __asm__("" : : "g"(i));   /* counts i once at loop depth; emits nothing */
    off += 0x1C;
    g = *arg0;
} while (++i < g->count);
```

`count_reg_references` (flow.c) counts the asm operand's `REG` under
`REG_N_REFS[i]` at the loop depth (7 → 9 via the depth-2 input), which flips
`allocno_compare` so the index is allocated first and takes `$a1`. The empty
template emits no instruction, so the machine is byte-identical to the target
(`VERDICT: MATCH`, residual `[0,0,0,0]` 19/19).

## Alternatives that fail

- All six block-1 initializer permutations: either right registers (_wrong_
  order) or right order (_wrong_ registers).
- `k`-anchored const, `for`/`do-while`, `++i` vs separate `i++`: refs stay 7/7.
- Coalesced `j = i` copies to inflate refs: CSE folds them pre-recompute.
- `off = i + 0xC` and friends: CSE folds the reference before flow counts it.
- `register asm` pins, block- and file-scope: GCC 2.95 relocates the other
  values (grid base left `$v1`, const left `$a3`) → 9/19.
- Flag matrix (`-fno-gcse`, `-fno-schedule-insns{,2}`, …): flat, 13/19.
- Exhaustive semantics-preserving closure search (both baselines, 24
  candidates): `exhausted-no-exact`.

Evidence artifacts: `build/allocatorCounterfactual/func_8001E340`,
`build/schedulerConstraint/func_8001E340/*`, the two
`build/residualSourceSearch/func_8001E340/*` runs, and the experiment ledger.
