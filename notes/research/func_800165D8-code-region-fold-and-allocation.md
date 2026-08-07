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
- (2026-08-07) statement-birth-order batch, all at 204/361 masked, structure
  unchanged: explicit `s16 tpageYIn/clutYIn` locals initialized at entry;
  regrouped tpage else (arg11 uses before arg12 uses); flip/tp assignment
  swap; and all three combined.
- (2026-08-07) flip type batch: `u8 flip`, `s16 flip`, `u16 flip`,
  `u8 tp + u8 flip` — all 204/361. The birth copy `(set flipvar
  (zero_extend (subreg:QI (and-result))))` is forwarded by CSE in every
  tested type; the final asm keeps one flip web and the candidate's
  `bnez t1` direct chain. The type changes DO shuffle other allocations
  (e.g. the `-1` sentinel constant pseudo moved to stack in the .greg),
  but never spill arg12 or de-hoist 0xFF000000.
- (2026-08-07) expression-flip chain (no flip local; each comparison reads
  `ent->field_08 & 3`): 203/361 and THREE `lbu 8(ent)` loads against the
  target's two — the stores to `p->tpage/u/v` between the load site and the
  chain kill CSE's memory expression. This is positive evidence the original
  HAD a flip variable; do not retry expression chains.
- (2026-08-07) local-alloc tooling cannot reach the residue:
  instrumentCompilerOracle/localAllocationOracle replay the candidate's own
  86/86 local choices and its forced-local counterfactuals all score below
  baseline. The residue is decided by GLOBAL allocation.

## Allocation mechanism, established 2026-08-07 (vendored global.c)

- global_alloc processes the 42 allocnos in exact priority order
  (`refs^2/lifetime`-ish; ties by birth). The candidate tail is:
  `472 0xFFFFFF->t5, 83 arg2->t6, 101 arg10->t7, 94 arg6->t8, 90 arg5->t9,
  146 i->s0, 81 arg0->s1, 121 hdr->s2, 112 arg13->s3, 104 arg11->s4,
  99 arg8->s5, 98 arg7->s6, 493 0xFF000000->s7, 108 arg12->fp,
  116 arg14->stack 0(sp), 100 arg9->rematerialized from 84(sp)`.
- Register choice is the two-pass scan in numeric REG_ALLOC_ORDER with
  preference overrides: pass 0 only reuses already-used registers and skips
  registers someone prefers; pass 1 takes the lowest free; then a free
  same-class register in `hard_reg_preferences`/`hard_reg_copy_preferences`
  OVERRIDES the numeric pick. Entry-block local-alloc assignments propagate
  through copy preferences, so entry-block birth order can steer the whole
  tail permutation (this is why arg5/arg6 land in t8/t9 ahead of free s-regs
  in the candidate).
- For the target, the same deterministic machine must have had a different
  web population or priorities: it spilled arg12->0(sp) and arg14->4(sp)
  (slot order = spill order, arg12 first), rematerialized 0xFF000000 in the
  addPrim else branch, and gave fp to arg7. That needs at least one extra
  web allocated before ranks 38-39 (taking s7 and fp away from 493/108).
- The only visible target-only web is the flip copy: `andi t6,a0,3` (1 use)
  followed ~48 instructions later by `move a0,t6` where a0 serves all three
  chain branches (3 uses). In the candidate the corresponding RTL copy
  (insn 368, flip user-var) is forwarded by CSE into one web. The source
  shape that keeps this copy alive is still unknown; it is the leading
  candidate for the missing pressure web because its lifetime (uv region ->
  last flip branch) overlaps both the arg12 reload death and the
  0xFF000000/D_8005E3C0 use region.
- All 11 stack parameters get expansion-time sign/zero-extend copy chains
  (RTL uids 12-80); all survive to global allocation as the long-lived tail.
  arg9's pseudo keeps REG_EQUIV to its stack MEM and is rematerialized from
  84(sp); arg12/arg14 pseudos are sign-extend chains without REG_EQUIV and
  spill to fresh slots when they lose.

## CASCADE MODEL — proven later same day (second work block)

The entire target tail allocation derives from ONE condition via the exact
global.c find_reg mechanism (two-pass scan; pass 0 only reuses registers
already in `regs_used_so_far`, initialized to `regs_ever_live |
call_used_regs` — caller-save t0-t9 are cheap/pass-0-eligible, s0-s7/fp
are expensive/pass-1-only):

1. Candidate ranks 0-26 consume only {v0,v1,a0-a3,t0-t5} (12 cheap regs);
   t6/t7 (14/15) stay free.
2. Rank 27 arg2: pass 0, first free cheap = t6. Rank 28 arg10: t7.
3. Ranks 29/30 arg6/arg5: pass 0, first free cheap = t8/t9 (24/25 are
   cheap call-used, free, non-preferred). THIS is why arg5/arg6 sit in
   t8/t9 instead of s0/s1 — verified against allocno order and final asm.
4. Ranks 31-37 fill s0-s6 (i,arg0,hdr,arg13,arg11,arg8,arg7); rank 38
   493 (0xFF000000) -> s7; rank 39 arg12 -> fp; arg14/arg9 lose.

TARGET tail = same machine with TWO extra loop-spanning webs of priority
> 885 allocated before arg2, holding t6/t7 (must conflict with arg2).
Then arg2 -> t8 (pass 0), arg10 -> t9, arg6/arg5 fall through pass 0
(every cheap reg conflict-blocked) -> pass 1 -> s0/s1, tail shifts +2:
i->s2, arg0->s3, hdr->s4, arg13->s5, arg11->s6, arg8->s7, arg7: pass 0
empty, pass 1 skips occupied s0-s7 and conflict-blocked t8/t9 -> fp.
Then 493/arg12/arg14 find nothing -> rematerialize / spill to 0(sp),4(sp).
Reproduces the observed target layout exactly, including arg7->fp, slot
order (arg12 first), and 0xFF000000 remat.

Probe evidence (run e0e5d797 / a5eb8392):
- v_probe_pressure (extra entry-born web `scale = arg7+arg8` replacing the
  per-iteration addu): arg12 -> 0(sp), probe web -> 4(sp), both reloaded
  in-loop — the target's slot layout appeared for the first time.
  0xFF000000 stayed hoisted (probe web priority too low to evict s7).
- v_probe2webs (+ hoisted semi-trans flag): both probe webs took stack
  slots, arg12 returned to fp. Low-refs hoisted locals get priority ~99
  (late ranks); they spill instead of pressuring the s7/fp band. The two
  missing webs must have priority ~900-1200: refs ~9-11, live ~280-310
  = loop-spanning webs used several times per iteration.
- Frame constraint: exactly 2 var slots, filled by arg12/arg14 in the
  target, so the two extra webs must be register-allocated or
  rematerializable (arg9-style REG_EQUIV mem), not spilled.

Flip copy status: combine is the pass that erases the candidate's birth
copy (merges insn 366 into 368; single-use + adjacent). u8/s16/u16 flip
types and bitfield Entry all coalesce (bitfield also diverges loads:
201/361). The 80016280 redefinition-kill idiom cannot apply here: the kill
would have to sit between the copy and the first chain branch, where the
target has no instruction.

## Next steps (revised)
- Missing piece: the identity of the two high-priority (>885) loop-spanning
  webs allocated before arg2 in the target. They must leave no visible
  instruction delta: allocation-coalesced copies, or loop.c-hoisted
  MEM-equiv loads (indistinguishable from per-iteration loads in final asm,
  e.g. arg2->field_02/field_1C-family accesses if the original TU's alias
  picture let loop.c hoist them). Instrument: compare .greg web populations
  against the spec above, NOT the masked match score — the score is binary
  at this residue depth and cannot show partial progress.
- The flip-copy web question is coupled; solving either may solve both.
  Untested flip ideas: flip read through a second same-value variable born
  after a store barrier, or a chain structured so CSE's path does not visit
  the copy (block-boundary placement).
- Do NOT chase individual register renames — they cascade from the web
  population difference.
- Keep the setSemiTrans code region exactly as-is (it matches).
- Probe harness preserved under build/manualVariants/func_800165D8/ and
  build/fuzz/func_800165D8/{296f2cca,0858a811,9cbd7968,a5eb8392,e0e5d797}.
- Status unchanged: best clean-C 204/361 masked (LCS), 358 vs 361 instrs,
  count delta = arg12 slot store + arg12 reload + one nop. If the two webs
  stay unfindable, this residue is the same class as func_80016280's
  entry/guard region; the governed assembly-hybrid exception
  (.pi/autodecomp.json allowlist: register-asm + embedded-asm) is the
  documented last resort, owner-approved only — see that function's source
  header for the shape such an exception takes.

## RESOLVED 2026-08-06 — byte-verified match (361/361, VERIFIED, make check OK)

Solved in a later session. Every residue item above fell to seven source
levers plus one TU-level flag. The cascade model's conclusion ("two extra
loop-spanning webs of priority > 885") was directionally right — the
allocation population differed — but wrong in detail: the missing pressure
was ONE reused-variable web plus preference steering, and the flip web was
the second "insertion".

1. **flip copy (`move a0,t6`)**: `flip2 = flip; flip = 0;` before the chain,
   chain on flip2. The dead redefinition invalidates flip's CSE equivalence
   class (blocking in-block copy forwarding onto the branch) and kills gcse
   copy-prop availability; flow deletes the dead store before RA, so it costs
   no instruction. Same mechanism as func_80016280's `tmp = work; work = X`
   kill, but exploiting deletion timing: cse/gcse run before flow removes it.
   A bare join-head copy is CSE-forwarded; `(flip & 3)` comparisons survive
   as a real `andi` (combine has no cross-block log_links to reduce it).

2. **The "missing web" is `sx` reused for both texture sums** (X then Y),
   80016280 work-variable style. One multi-set local web holds a1 across
   [sx-birth .. v-def], so global-alloc's set_preference chain
   (renumber[sx]=a1 → u prefers a1, blocked by sx itself → u→a2; u2 inherits
   → a1 free after sx dies → u2→a1; v's pref blocked by u2 → v→t1) lands
   every uv-region web on the target register. With separate sx/sy the
   preference seed lands elsewhere and the whole cheap band packs one
   register short (the +1/+2 prologue shift).

3. **u2/v2 are fresh variables** (`u2 = u & 0x3F; v2 = v & 0xFF;`), bodies
   read u2/v2: u and v die at the masks, splitting webs as the target does.

4. **tpage else-arm order**: `u = arg11; v = arg12; tpageX = arg11;
   tpageY = arg12;` — CSE turns the tpage pair into copies FROM u/v
   (target's `move a2,s6 / lw t1,0(sp) / move t2,a2 / move a3,t1`), and the
   spilled arg12 reloads straight into v.

5. **then-arm statement order is X-group then Y-group**
   (sx; tpageX; u; sx=Y-sum; tpageY; v) — keeps the schedule's load pairs
   grouped and positions the local-alloc qty births like the target.

6. **grp/ent construction**: `grp = (Group *)(hdr->field_00 * 4 +
   (u32)arg2->field_20)` — integer addition keeps the scaled index first
   (spelling it as pointer arithmetic lets c-typeck's pointer_int_sum
   canonicalize the pointer operand first, emitting base-first addu);
   `ent = (Entry *)(arg2->field_24 + grp->field_02); ent += count - 1;`
   builds ent in place (target's `addu t5,t5,v0`).

7. **`-mno-split-addresses` per-file flag** (configs/flag_overrides.mk,
   PENDING ALLOWLIST APPROVAL): the D_8005E3C0 load in the tag-insert arm is
   the unsplit assembler-macro form — adjacent `lui a0 / lw a0,%lo(a0)`
   self-clobber plus an unfillable load-delay nop. Under split addresses the
   lui is an independent RTL insn whose dest (a0) has no hazard in the arm,
   so sched2 always lifts it into the `lw v0,0(s3)` load shadow (it has the
   deepest height in the ready list); no allocation can pin it, because the
   pin in 16C08's section 12(c) requires an intervening writer/reader of the
   lui's register and this arm has none for a0. The macro form is one
   scheduler object, so it cannot be lifted, and maspsx's expansion reuses
   the destination register — both target signatures at once. Two functions
   in the TU (this one and func_80016C08) now carry the flag on independent
   evidence: it is the TU's true flag, not a per-function debt. This
   resolves the section 16/19.7 question in the 16C08 note: the "witness"
   does NOT prove a no-override idiom exists; it proves the opposite.

8. **arg7/arg8 s7/fp order**: their allocno priorities are
   `floor_log2(7)*7*10000/live_length` with live lengths 2 apart; the
   integer quotients tie or split depending on total RTL length (140000/622
   vs /620 both floor to 225; one insn shorter and they split 225/226). The
   flag change in (7) removed one RTL insn and flipped the tie to the
   target's order for free. Do not chase this with source edits; it is a
   floor-boundary artifact of function length.

Registers: every diagnosis above was made against
`;; Register dispositions` + `;; N conflicts/preferences` in the .greg dump
and global.c's allocno_compare/find_reg/set_preference in the vendored
source, then confirmed by diffFunc. The final source is in
src/func_800165D8.c with a summary header.
