# The cross-jump equivalence rewrite: dead lui before a shared la-const

**Mismatch signature.** A jump-table case block whose entry instruction is a
dead `lui` (a HIGH with zero uses), immediately followed by a self-form
`lui rX / addiu rX,rX` pair that a conditional branch from another region
enters directly (a label between the dead lui and the pair), ending
`j <join>; nop`. `explainDiff` reports a single target-only web
(`def ... (0 uses)`) and a count delta of exactly the orphan.

**Mechanism (GCC 2.95.2, all measured on func_8001A284).**

1. Two source paths compute the same symbolic constant (`&SYM + K`). One is
   an inline expression (the expander splits the illegitimate constant into
   HIGH + LO_SUM; combine normally merges the pair back into one
   `movsi` const move). The other can be a plus over a pointer/temp holding
   `&SYM` — CSE's related-value rule rewrites any same-page inline spelling
   into that add form when a register already holds a related constant, so
   both shapes occur naturally.
2. cc1's dead-code sweeps run before reload; after reload only jump2
   (`jump_optimize` with cross-jump) edits this code. `find_cross_jump`
   compares the two `j <join>` tails backward. When the instruction pair
   does not match textually but **both carry the same constant
   REG_EQUAL/REG_EQUIV note and their destinations renumber equal**, it
   rewrites BOTH instruction sources to the constant (`validate_change`,
   jump.c ~2955) and treats them as matching. These rewrites persist even
   when the overall match later fails the minimum.
3. On a successful match, `do_cross_jump` deletes the processed jump's own
   matched copy and redirects it to a fresh label placed immediately before
   the survivor (`get_label_before`), then jump threading converts the
   branch-around-jump into the direct conditional branch seen in the target.
4. The rewrite orphans the feeder of the rewritten instruction: the
   expander HIGH (case 10's `lui v0,%hi`) loses its only consumer after
   every dead-code pass has already run, so it survives to output. That is
   the "impossible" dead lui.

**The load-bearing source structure.** The merge direction (arm deleted,
case-10 copy kept, label at the la) requires `find_cross_jump`'s minimum to
be met on the arm's side only. The minimum decrements when the backward walk
hits a CODE_LABEL on the processed jump's own side — which is why the arm
must be a **case of a nested switch** (case blocks get real labels;
an if-arm entered by fallthrough has none). A three-case inner switch also
explains the target's balanced compare order (==1 first, then <2, ==0, ==2)
— GCC's small-switch dispatch, not a hand-written if-chain.

**What was measured and rejected.**
- Dead statements before a shared label (constants, address-ofs, split
  pairs): flow deletes them whole, cascade included.
- A `>-G8` override to force the split form: the unfillable `nop` after the
  `j` proves the pair is an atomic la/const-move macro (a split addiu would
  be delay-slot filled, as cases 11–14 show).
- If-chain spellings of the arm: identical const moves on both sides, but
  stale REG_DEAD notes name different registers and the walk finds no label,
  so no merge fires (this alone cost the session most of its time).

**Takeaway.** When a diff shows a dead HIGH in front of a cross-jumped
shared constant, reconstruct BOTH consumers of the constant and ask what
gives the merged side a label: a nested switch is the period-natural answer.
Do not chase the orphan itself — it is a byproduct of jump2's equivalence
rewrite, not of any statement.
