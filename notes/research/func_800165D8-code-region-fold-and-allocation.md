# func_800165D8 — code-region CSE fold and whole-function allocation

**Status:** decompiled to clean C; instruction selection SOLVED; best exact
match **204/361 (56.5%)** with the entire POLY_FT4 code region matching.
NOT byte-matching. Work-in-progress source lives in `src/func_800165D8.c`.

Sibling of `func_80016280`; see `notes/sprite-renderer-family-campaign.md`.

## BREAKTHROUGH: the semi-trans code is `setSemiTrans`, not a raw ternary

The single biggest unlock. With `p->code = cond?0x2E:0x2C` (raw ternary), CSE
forwards the `setShadeTex` getcode load onto the ternary pseudo (REG_EQUAL
44/46), combine proves `&0xFE` identity via nonzero_bits (44|46=0x2E, bit0
clear) and merges the shade-store into the ternary store — collapsing three
offset-7 stores + the reload into two stores. Switching to the SDK macro
`setSemiTrans(p, cond)` changes the CSE region/table structure so the
`setShadeTex` getcode load is NOT forwarded. Result: memory-offset inventory
becomes IDENTICAL (all three `sb@0x7`, the `lbu@0x7`, and `andi 0xFE` now
present). The sibling `func_80016280` also uses `setSemiTrans` — consistent.

Working code region (verified matching):
```c
setPolyFT4(p);
setSemiTrans(p, (arg2->field_02 & 0x20) || ((ent->field_08 >> 4) & 1));
setShadeTex(p, 0);
setRGB0(p, 0x80, 0x80, 0x80);
```
(Order setShadeTex before setRGB0 also fixes the 0x2C/0x80 constant counts.)

## Decoded semantics (all confirmed against the target)

15-param POLY_FT4 renderer, leaf, frame 0x30. `setPolyFT4`; semi-trans
`setSemiTrans` on `(src->field_02 & 0x20) || ((ent->field_08>>4)&1)`;
`setShadeTex(p,0)`; `setRGB0(p,0x80,0x80,0x80)`; `getClut`/`getTPage` from
`uv0`/`uv1` = `field_1C[ent->field_00/02]` with `-1`-sentinel overrides
(arg11/arg13 = tpage/clut X, arg12/arg14 = tpage/clut Y, copied to frame
slots 0x0/0x4 at entry and reloaded in-loop); 4-way uv flip on
`field_08 & 3`; fixed-point `*argN / 4096` coordinate scaling when
`arg7+arg8 != 0x2000` else plain offsets; arg10 bits 0x18/0x8/0x10 corner
select, bit 0x40 picks `addPrim` vs `0x09000000|getaddr` tag-insert +
`D_8005E3C0->field_118 += 0x28`; backward 12-byte Entry walk.

## Remaining residue (all register-pressure / allocation)

Count delta is exactly `lw, sw, nop` (3 insns). Concretely:
1. **arg12/arg14 spill.** Target copies arg12→0(sp) and arg14→4(sp) at entry
   and reloads them in the tpage/clut else branches (`lw t1,0(sp)`,
   `lw v1,4(sp)`). Candidate keeps arg12 in a callee-saved register and spills
   only arg14 (to 0(sp)). Target spills both because its register pressure is
   one higher.
2. **0xFF000000 constant.** Target rematerializes it inside the addPrim-else
   branch (`lui a0,0xff00`); candidate hoists it into a callee-saved register
   pre-loop. Same pressure root cause.
3. **Register permutation cascade.** All other diffs are register renames
   flowing from (1)/(2): e.g. candidate assigns the `$fp`-class register to
   arg12 where the target gives it to arg7.

These are coupled: reproducing the original's exact live-value count/pressure
would unspill/rematerialize correctly and align every register. The source
semantics are correct; only the allocation doesn't yet match.

## Hypotheses ruled out
- Raw ternary for semi-trans (folds the shade region) — use setSemiTrans.
- setRGB0/setShadeTex order variants — settled (shade-first fixes constants).
- Explicit `tpageYIn`/`clutYIn` s32 locals — removed; use arg12/arg14 directly.
- switch for the flip chain (builds a balanced slti tree) — use if/else-if.
- Compiler/flag differences — identical cc1, baseline flags.

## Next steps
- The residue is a register-pressure match. Options: (a) bounded variant search
  over structures that add one live value / change lifetimes to raise pressure
  so arg12 spills and 0xFF000000 isn't hoisted; (b) searchSchedulerState-style
  allocation analysis. Do NOT chase individual register renames — they cascade
  from the pressure difference.
- Keep the setSemiTrans code region exactly as-is (it matches).
