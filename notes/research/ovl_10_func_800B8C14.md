# ovl_10_func_800B8C14 — mcard read-result renderer

**Status:** byte-exact 275/275 under baseline flags, clean C89.

## Summary

This is the top of the ovl_10 mcard debug/status chain: it fills the shared
label array `D_800BBB3C` (15 entries) with `&D_800B7E40`, re-targets
`D_800BBB3C[D_800BB7BC]` to `&D_800B7E48`, calls the menu printer
`ovl_10_func_800B9060`, and then after `McxSync(1, &sp10, &sp14)` selects one
of six card-recovery records and copies it into the shared `D_800BBAFC` buffer
before re-dispatching through `ovl_10_func_800B9108`.

## The six record copies are packed whole-object assignments

The target's `lwl/lwr` + `lb` tails are the mips `movstrsi_internal`
(`output_block_move`) emission for a **packed struct assignment**, not
per-field unaligned arithmetic. Each source buffer is its own record type read
into `D_800BBAFC` with a cast — the copy *width* is the record's own size:

| source | copy size | layout |
|---|---|---|
| `D_800B7E58`, `D_800B7E6C` | 0x12 (18) | 4×s32 + 2×s8 |
| `D_800B7E80` | 0x13 (19) | 4×s32 + 3×s8 |
| `D_800B7E94` | 0xF (15) | 3×s32 + 3×s8 |
| `D_800B7EA4` | 0x1E (30) | 7×s32 + 2×s8 = `McSaveData` (as in 800B9AA8) |
| `D_800B7EC4` | 0x21 (33) | 8×s32 + 1×s8 |

`D_800B7EA4` is a `s32[3]` in generated `globals.h`; reuse it via the
`&D_800B7EA4`-cast idiom already used by the matched neighbour 800B8A5C for
`D_800B7E24`, rather than fighting the generated macro.

**The 33-byte copy is the two-loop inline memcpy, not a call.** GCC 2.95
inlines `movstr` block moves through `expand_block_move` when
`2*MAX_MOVE_BYTES < size` (with `MAX_MOVE_BYTES = MAX_MOVE_REGS * 4 = 16` in
mips.c). A 0x21-byte packed record has `size % 16 == 1 → leftover 1`, so it
emits the runtime-alignment-test form: an `lwl/lwr` loop and an `lw/sw` loop
(0x20 bytes in 16-byte steps) plus a 1-byte tail — exactly the `beqz (src|dst)&3`
split in the target. The `m2c` draft had scalarized this into two separate
16-byte loops plus a byte copy; keeping it as one `*(T*)&dst = *(T*)&src;`
whole-object assignment restores the one-instruction block-move RTL that the
two branches and the tail all come from.

## Switch tree and case order

`McxSync`'s result switches over {0, 1}; inside `case 1` the code switches
over `sp14` with **all four** cases {0, 1, 2, 3}. The `sp14 == 1` test is
*inside* the switch (`case 1:`), not an `if/else` guard: GCC's case list is an
AVL / `balance_case_nodes` tree for 4 single values (cost-table off here
because case constants 0–3 are control characters) rooted at the middle value
{1}, and the first emission is `beq sp14, ret` where GCC reuses the outer
switch's still-`==1` value in `$v1` rather than materializing a constant.

The subtle trap: **case bodies are laid out in source case order**, so listing
the cases as `1,0,2,3` kept the correct dispatch tree but physically swapped
the `E80` and `E6C` copy bodies. That single swap moved `E80` into `E6C`'s
slot and changed the block-move scratch allocation (`E6C` then re-materialised
a fresh `lui %hi` where the target reuses the dispatch delay-slot's `lui`).
Writing the cases in natural order `0,1,2,3` restored both the body layout and
the register reuse. The residual at that point was 5 words, classified
"allocation" but actually caused by statement/case order, not by
web/allocation — the reverser's `= greg`/`= lreg` already said so.

## Calls / SDK

`McxSync(1, &sp10, &sp14)` returns into a saved temp used as the outer switch
index and as the `sp14 == ret` compare. `FntFlush`/`DrawSync`/`FntPrint`/
`McxSync` are SDK (`libmcx.h`, `libgpu.h`); `ovl_10_func_800B9060`/`800B9108`
are the cluster neighbours. All data is absolute-addressed (`-G0` overlay data)
and only declared extern here.
