# Per-file compiler flag overrides
#
# Format:  CC1FLAGS_<stem> := <extra flags>
#   where <stem> is the source filename without path or .c extension
#
# These flags are APPENDED to the base CC1FLAGS in the FlagsSwitch macro.
#
# POLICY (softened 2026-08-06, owner-approved): flag overrides are a
# legitimate, evidence-gated matching tool — original TUs really were built
# with per-file flags, and a flag can be the TU's true state rather than a
# workaround (proof: -mno-split-addresses on func_80016C08/func_800165D8).
# An agent may add an entry itself when the psx_flag_probe escalation bar is
# met: a target fingerprint, a flag column that dominates baseline, and no
# contrary witness in the same region. Every entry must carry a comment
# stating that evidence, and the matching allowlist entry in
# .pi/autoloop.json (sourcePolicy.allowlist, kind "flag-override") must be
# added in the same change — the allowlist is the audit trail, and the gate
# enforces that it exists. Speculative flag-shopping without a fingerprint
# remains forbidden. The two -fno-schedule-insns entries below are legacy
# and pending re-validation
# (see notes/next-steps-for-revisiting-the-project.md).
#
# The pattern they work around: self-clobbering loads — the target binary
# has sequential lui/lw pairs (lui v0 / lw v0,off(v0)) where the lw
# overwrites the base register. GCC's scheduler groups the lui
# instructions together and uses extra registers, preventing this pattern.





# func_80011370: NO override. The -mno-split-addresses entry that used to sit
# here was withdrawn 2026-08-08 — it was fitted to the 21 self-clobber lui/lw
# pairs, but the target proves split addresses were ON for this TU:
#   0x8001143C / 0x80011444  lui $s0,%hi(D_8005E5E8) and addiu $s0,$s0,%lo()
#                            occupy the delay slots of two *different* jal
#   0x800116B0               lui $v0,%hi(jtbl_80010008) sits in a beqz slot
#   0x8001189C               sw $zero,%lo(D_80070CC4)($v1) sits in a j slot
# A single assembler macro cannot straddle a delay slot, so those lui/%lo
# halves are separate RTL insns. Removing the override took the exact-index
# match from 63/566 to 224/557. The self-clobber pairs are an assembler
# question (see the D_80010098 comment in src/func_80011370.c), not a
# compiler-flag question.

# func_80016C08 / func_800165D8: the -mno-split-addresses overrides that used
# to sit here were withdrawn 2026-08-08. They existed to force the unsplit
# assembler macro for D_8005E3C0 (lui $v1,%hi / lw $v1,%lo($v1), one
# register). That was the wrong lever: the symbol is a 4-byte scalar, so cc1
# already leaves it unsplit — the pair was being broken by GNU as resolving it
# GP-relatively, because this TU does not own it. Ownership is now stated in C:
# a TU that owns a global defines it tentatively, and one that does not leaves
# it extern and gets absolute addressing (ADR-0001 §2.4). Both functions match
# under baseline flags.
# `make check` passes with no per-file compiler flag overrides in the project.

# func_80014494: -fno-cse-skip-blocks.
#
# Fingerprint (decoded from the original bytes, no source needed): at
# 0x800144F4 the join block of the inner `if` re-forms the address of
# D_8005EA18 with `addiu $v0,$t2,%lo(D_8005EA18)` from the CSE-shared %hi in
# $t2, even though the dominating block at 0x800144C4 already materialised
# the very same symbol address in $v0 and no call or clobber sits between
# them. Under -fcse-skip-blocks CSE follows the `beqz` around the one-block
# if-body (cse.c cse_end_of_basic_block, "detect a branch around a block of
# code") and carries that pseudo into the join, so the lo_sum there is
# always folded away — the target's re-materialised lo_sum is unreachable
# from any C shape at baseline. The same block reuses the dominating block's
# `sll` result in $a0, so the target is not merely CSE-starved: it is CSE
# with the skipped-block path switched off.
#
# Flag column: -fno-cse-skip-blocks takes the natural array-form source from
# 47 instructions / 13-of-48 to a byte-exact 48/48 MATCH; baseline cannot
# reach it (verified over 21 source shapes covering pointer-increment,
# two-pointer, row-pointer, offset-local and cast address families).
#
# No contrary regional witness: the other matched members of the
# 0x80013B04-0x80014554 pad group still match byte-for-byte with this flag
# applied (checked 2026-08-09).
# func_800231E8: -mno-split-addresses.
#
# Fingerprint (decoded from the original bytes, no source needed): the target
# loads D_800A3FB4/D_800A3FB0 (extern arrays, >8 bytes, absolute) via self-
# clobbering unsplit assembler-macro loads (lui $v1 / lh $v1,%lo($v1), lui
# $a3 / lh $a3,%lo($a3), and lui $v0 / lw $v0,%lo($v0) for D_8005E3C0).
# Under baseline -msplit-addresses the lui is an independent RTL insn that
# sched2 lifts to a different register (lui $2 / lh $5). psx_flag_probe
# matrix: -mno-split-addresses 40/40 masked vs baseline 29/40 — the only
# row beating baseline. Regional witnesses func_800229F4/func_80024030 show
# the same self-clobber load shape in matched neighbours; no contrary
# regional witness. D_8005E3C0's self-clobber is automatic (4-byte extern
# scalar), the flag is required for the two D_800A3FBx halfword loads.
CC1FLAGS_func_800231E8 := -mno-split-addresses

# func_80023060: -mno-split-addresses.
#
# Same TU fingerprint as func_800231E8 (byte-identical call block at
# 0x80023070-0x800230A8): the target loads D_800A3FB4/D_800A3FB0 (extern
# arrays, >8 bytes, absolute) and D_8005E3C0 (4-byte extern scalar) via
# self-clobbering unsplit assembler-macro loads (lui $v1 / lh $v1,%lo($v1),
# lui $a3 / lh $a3,%lo($a3), lui $v0 / lw $v0,%lo($v0)). Under baseline
# -msplit-addresses the lui is an independent RTL insn that sched2 lifts to
# a different register (lui $2 / lh $5) and reorders the whole block.
# psx_flag_probe matrix: -mno-split-addresses 40/40 masked vs baseline
# 29/40 — the only row beating baseline. Regional witness: the target at
# 0x80023060 is adjacent to func_800231E8 (0x800231E8), which requires the
# same flag with the same self-clobber fingerprint; no contrary regional
# witness.
CC1FLAGS_func_80023060 := -mno-split-addresses

CC1FLAGS_func_80014494 := -fno-cse-skip-blocks

# func_80018B98: -fno-gcse.
#
# Fingerprint (proved unreachable from any C shape at baseline, no source
# needed): the target reloads D_8005E446 at the post-arg8 merge point
# (0x80018C98 lhu v0,%gp_rel(D_8005E446)) and pairs `addiu v0,v0,-7` /
# `sltiu s5,v0,3` with the `bne s2,v1,.L80018CEC` in its delay slot. Under
# -fgcse (default) the D_8005E446 load and the flag computation are
# loop-invariant-hoisted to the entry block, above the arg8-block calls, and
# the flag's sltiu cannot occupy that delay slot — verified over the
# semantics-preserving source closure (184320 candidates, all still diverged
# at prologue allocation) and over micro-compilations showing the hoist is
# robust to source statement position. -fno-gcse removes exactly that hoist:
# the merge-point reload and sltiu-in-delay-slot reappear.
#
# Flag column: -fno-gcse takes the natural source from 42/292 to 86/294
# byte-matched words and lands the instruction count exactly at the target's
# 294 (the only matrix row to do so; baseline is 292).
#
# No contrary regional witness: func_80018B98.c is its own TU (single
# function per src file), so the override cannot disturb the matched
# neighbours; the source family was scored at baseline and only -fno-gcse
# beats it.
CC1FLAGS_func_80018B98 := -fno-gcse


# func_80022794: -fno-rerun-cse-after-loop (+ allowlisted register pin / empty asm in src).
#
# Evidence: at baseline the else-branch register copy that carries the pre-
# shift quotient into $a0 ("move a0,v0) is unreachable from any clean-C shape.
# cse2 (rerun-cse-after-loop) folds the (set temp prod) copy into the product
# mult — combine merges the hoisted copy, cse2 then rewrites the +0xFFF in-
# place so the temp never materialises (6/6 else-branch respellings — ternary,
# unconditional-copy-first, in-place shift, shared product/temp variable,
# var_a0-reuse, products split/merged — all compile byte-identically folded;
# instrumented compiler-oracle derives no scheduler edge and no forced local
# assignment). The target KEEPS that copy (move a0,v0 / addiu a0,v0,0xFFF /
# sra v1,a0,12) and the whole residual under baseline is its absence.
#
# With the override restoring the copy, the copy still incarnates in $v1 not
# $a0: cse1 canonicalizes the copy into the round branch (temp outlives the
# shared prod web; .rtl/.jump bgez v0 -> .cse bgez v1), which pins the copy
# before the branch and hands find_reg the numeric-order $v1. The completion
# is the allowlisted hybrid in src/ (user-authorized): `register s32 
# temp_v1 asm("$4")` pins the round temp to $a0, and `__asm__("" : : 
# "r"(prod))` (a zero-byte use-only asm that survives cse) gives prod a
# later last-use so cse1 leaves the branch on v0 and the copy lands in the
# bgez delay slot. With that, the whole remaining diff is a 4-position move
# of a2=arg2 into the mult->mflo gap, fixed by sourcing var_a2 = arg2 before
# the round; residual went [0,0,0,1] -> EXACT 116/116.
#
# Flag column: -fno-rerun-cse-after-loop is the only matrix row reaching the
# target's instruction shape — 110/116 masked vs 59/116 baseline, and the only
# row whose instruction count equals the target's 116. CSE2 is the pass that
# folds the copy (see retros/2026-08-09-func_800142D8 for the same pass
# deleting a kept copy), matching the observed folded vs kept asymmetry.
#
# No contrary regional witness: func_80022794.c is its own TU (single function
# per src file) in the 0x8002261C-0x80022B20 "unknown group B" region.
CC1FLAGS_func_80022794 := -fno-rerun-cse-after-loop

# func_8002495C: -fno-schedule-insns2.
#
# Flag probe matrix (psx_flag_probe, fork-A s32/temp_v0 shape): the only row
# that reaches the target's instruction count (25) and dominates the mask
# score is -fno-schedule-insns2, 19/25 masked vs 4/25 baseline; every other
# row (gcse/cse/rerun-cse/mno-split-addresses) stays at the baseline count.
#
# Target fingerprint: the target's post-branch sequence loads the DIVISION
# CONSTANT 0x88888889 into the raw-load register $v0 only AFTER the andi
# truncation has died (lbu v0 / addiu v0,1 / andi a0,v0,0xff / lui v0 / ori v0
# / multu a0,v0), i.e. the constant inherits the dying raw byte's register.
# That forces an explicit load-delay nop after the lbu and pins block 1's
# allocation (raw=$v0, trunc=$a0, const=$v0). Under baseline -fschedule-insns2
# the post-reload scheduler instead hoists the constant load into the lbu's
# load-delay gap (constant lives in $v1, truncated byte in $v0) and the whole
# block rotates: the residual is a pure local-alloc/sched2 rotation that the
# local-allocation solver and the instrumented compiler oracle both prove
# UNREACHABLE from clean C under baseline (solver UNSAT_WITHIN_BOUNDS; oracle
# forcedLocalRejected for every target assignment; ~24 semantics- and
# spelling-preserving variants all compile to the same words). The constant's
# late birth in $v0 is precisely the allocation sched2 would undo, so a
# post-reload scheduler being off is the natural prime-fact state.
#
# The completed match additionally requires -fno-schedule-insns (sched1 off):
# the matched source reuses one variable for the block-0 sentinel (-1, a real
# materialised addiu v0,zero,-1 feeding the beq) and the block-1 raw byte, so
# that pseudo is set twice in the function; sched1 refuses to promote
# multi-set destinations and drifts that set insn to the top of block 0
# (v63.i.combine has the target's sll/sra/li/beq order; v63.i.sched shows the
# scheduler moving the li above the sll). The target keeps the li between the
# sra and the beq, i.e. it is built with no pre-reload scheduling pass.
#
# No contrary regional witness: the same division-constant idiom appears in
# sibling funcs 0x800247C0/0x80024810/0x800249C0 with the same late constant
# birth and empty delay slots; none is matched yet, and none shows a
# sched2-filled delay slot.
CC1FLAGS_func_8002495C := -fno-schedule-insns -fno-schedule-insns2

# func_8002470C: -fno-schedule-insns -fno-schedule-insns2.
#
# Flag probe matrix (psx_flag_probe, current clean C): the only row reaching
# the target's full masked score is -fno-schedule-insns{,2} at 25/25 vs 22/25
# baseline; every other row (gcse/cse/rerun-cse/mno-split-addresses) stays at
# the baseline 22. That row also lands the instruction count exactly (25) at
# the same 25-everything count every other row already has.
#
# Target fingerprint: the head of block 0 materialises the sentinel
# -1 (addiu v0,zero,-1) between the sra (sign-extension to s16) and the beq,
# i.e. sll a0 / sra a0 / addiu v0,zero,-1 / beq a0,v0,taken — the constant
# keeps its expand-time position, after the s16 extension and before the
# branch. Under baseline -fschedule-insns (sched1 on), the shared pseudo that
# is set twice in the function (tv = -1 for the sentinel, then tv = D_8005E5D0
# + 1 for the raw byte) is a multi-set destination, and sched1 drifts its
# first set (the li -1) to the top of block 0, above the sll/sra extension:
# candidate emits li v0,-1 / sll a0 / sra a0 / beq and only the li position
# differs (23/24 words). The same mechisism and override are documented on the
# sibling func_8002495C (mod-60 counter, same-TU idiom cluster, same shared
# sentinel/raw-byte pseudo reuse); psx_reverse_pipeline for this function
# confirms a single sched2 owner with the li at target position 2 vs
# candidate 0.
#
# No contrary regional witness: func_8002470C.c is its own TU (single function
# per src file) in the 0x8002470C-0x800249C0 counter cluster; the sibling
# func_8002495C carries the identical override.
CC1FLAGS_func_8002470C := -fno-schedule-insns -fno-schedule-insns2


# ovl_11_func_800F3D40: -fno-gcse. The target materializes D_8006C838+0x4AD5
# and +0x4ADF as two independent lui %hi(D_8006C838) / addiu %lo / addiu-offset
# preheaders. Under baseline gcse+rerun-cse-after-loop the two offsets collapse
# (loop2 re-derived as (D+0x4AD5)+10 through the loop-1 biv final-value
# REG_EQUAL) or the two identical %hi(D_8006C838) halves merge into one register
# live across loop1 — both provably unreachable from any natural C spelling
# (residual-source-space search exhausted all 6 candidates; ~15 hand variants
# across pointer/index/count-up/countdown forms failed). Flag-probe matrix on the
# matching source: baseline 3/18, every other flag <= 11/18, -fno-gcse 18/18
# (18 instructions = target 18); diffFunc VERDICT MATCH. Precedent: func_80018B98
# already carries -fno-gcse in this project's exe; per-TU flags exist in ovl_11
# (ovl_11_func_8011FF74: -fno-schedule-insns).
CC1FLAGS_ovl_11_func_800F3D40 := -fno-gcse

# ovl_11_func_800F00E4: -fno-gcse. Same fingerprint as ovl_11_func_800F3D40 in
# this overlay: the target materializes D_8006C838+0x78EE and D_8006C838+0x55C6
# as two independent lui %hi(D_8006C838) / addiu %lo / addiu-offset preheaders.
# Under baseline gcse the two identical %hi(D_8006C838) halves merge into one
# register live across the first loop, so the function needs an eighth saved
# register and one fewer preheader statement (frame 56 vs target 48; the
# residual-space search over the natural C closure was exhausted with no exact
# candidate). With -fno-gcse the symbol halves are recomputed per preheader and
# the frame is 48. Precedent: ovl_11_func_800F3D40 in this same overlay carries
# the same flag for the identical D_8006C838+offset materialization.
CC1FLAGS_ovl_11_func_800F00E4 := -fno-gcse

# ovl_11_func_80103B24: the original keeps separate positive/negative
# read-modify-write arms on the same work-area field, including a jump after
# the positive store and a delayed a2=a3 pointer copy. Baseline CSE folds
# these arms into one store (49 instructions); -fno-cse-skip-blocks retains
# them and produces all 55 original words from clean C. The flagProbe matrix
# for the matched source has a single dominant column (55/55 versus baseline
# 10/55); matched ovl_11_func_80104394 and ovl_11_func_801037EC remain exact
# under this flag, so there is no contrary witness in the suspected TU group.
CC1FLAGS_ovl_11_func_80103B24 := -fno-cse-skip-blocks

# ovl_21_func_800B98CC: -fno-schedule-insns.
#
# Target fingerprint (assembly-level, stronger than the flag probe's structural
# detectors): the target's two return tails each compute the comparison into
# $v0, store it, and return it with NO register copy (sltiu v0,v0,3 / jr ra /
# sw v0,24(a0) in both arms). Under baseline sched1 the return copy (v0<-value)
# is drifted ahead of the store because the store is class-3 (independent of
# the epilogue use) and the copy is class-1 (data-dependent on it); local-alloc
# then sees v0 live across the value range and cannot tie the value to v0, so
# every baseline C spelling of this function emits two extra `move v0,v1` and
# 18 instructions. Disabling pre-reload scheduling keeps the expand-time
# store-before-return-copy order, local-alloc ties the value to v0, and the
# function emits exactly the target's 16 words. Same mechanism as the
# allowlisted ovl_11_func_8011FF74 (sched1 drifts an independently-birthed
# value out of its expand-time position).
#
# Flag-probe matrix on the matching source: baseline 6/16 masked, 18 instrs;
# -fno-schedule-insns{,2} 16/16 masked, 16 instrs (target 16). Fresh recovery
# checks confirm -fno-schedule-insns alone is 16/16 byte-exact. The adjacent
# matched 800B9844's assembled text is unchanged under that flag (136 bytes),
# so it supplies no contrary regional witness. This does not infer a TU
# boundary from the repository's one-function-per-file source layout.
CC1FLAGS_ovl_21_func_800B98CC := -fno-schedule-insns

# ovl_17_func_800B9158: -fno-cse-skip-blocks.
#
# Target fingerprint (proved unreachable from clean C at baseline, no source
# needed): block 1 computes the record address as `addu v0,a2,v0` (base first)
# while block 2 computes the same address as `addu v1,v1,a2` (index first).
# Every baseline source shape tried for block 1 (direct `base + idx*8`, index-
# first, `<<3`, integer-cast, struct/array indexing, pointer local, scaled-offset
# local, s16/s32/u32 offset) compiles to the SAME object, and the
# experimentLedger records one identical outputHash for all of them: CSE's
# fold_rtx canonicalises the plus to index-first whenever the base's constant
# equivalent is known, so the target's base-first order is not a spelling.
#
# Flag column: on the scaled-offset source shape (offset variable shifted in
# place, so CSE sees a plain register), -fno-cse-skip-blocks scores 24/24
# against the target while baseline scores 23/24 and every other matrix row
# scores <= 23 (psx_flag_probe matrix, two sources). diffFunc with the override
# reports VERDICT: MATCH, 24/24 byte-identical words.
#
# Mechanism: the guard `if (count >= 0x5A) count = 0;` is a branch around a
# one-statement block. With -fcse-skip-blocks (default) cse.c
# cse_end_of_basic_block follows that branch and carries the base address's
# constant equivalence across it, which is what forces the index-first
# canonicalisation; -fno-cse-skip-blocks keeps the base's state local to the
# join and the target's base-first `addu` appears. The same flag is already a
# project precedent (func_80014494, ovl_11_func_80103B24).
#
# Fresh regional checks: matched ovl_17 neighbours 800B9F10, 800B9F44,
# 800B9CAC and 800BAEF0 have byte-identical assembled text under this flag
# versus baseline (52, 52, 56 and 96 bytes). They supply no contrary witness;
# this does not infer an original TU boundary from today's source-file layout.
# The flag-override audit entry is present in .pi/autoloop.json.
CC1FLAGS_ovl_17_func_800B9158 := -fno-cse-skip-blocks

# ovl_11_func_800E4BA4: -fno-rerun-loop-opt.
#
# Target fingerprint: the function has two loop-invariant global address
# computations (lui %hi(D_80129410) used at 0x800E4BF0 and lui
# %hi(D_80129412) used at 0x800E4BF4) but only the first is hoisted into a
# callee-saved register ($s3, saved in the prologue); the second stays in the
# loop as `lui $v0,0x8013` immediately before `lh $a2,-27630($v0)`. psx_loop_trace
# (candidate-side) shows why the first loop_optimize call leaves it: it moves
# insn 42 (reg 91, D_80129410) and reports insn 50 (reg 96, D_80129412) "not
# desirable" because move_movables compares threshold*savings*lifetime against
# insn_count and the threshold has already lost 3 to the first move (26*1*1 <
# 29). The second loop_optimize call (toplev.c:3952, gated by
# flag_rerun_loop_opt) re-runs on the smaller loop (28 real insns) and hoists
# reg 96 unconditionally (29*1*1 >= 28), producing the extra $s4 save/restore
# the target does not have. flag_rerun_loop_opt is on under -O2 (toplev.c), so
# the second pass is baseline state and the one-hoist shape is unreachable at
# baseline: pass 2 hoists any invariant `high` movable at this loop size.
#
# Flag column: -fno-rerun-loop-opt produces exactly the target's 35 words from
# the natural source (build/exp/ovl_11_func_800E4BA4/fl/final.norl.o) with the
# target's register choice ($s3 for D_80129410, $v0 re-materialised in-loop for
# D_80129412); baseline emits 37 (extra `sw/lui` for the second hoist and a
# shifted $ra slot).
#
# No contrary regional witness: the five matched members of the contiguous
# 0x800E48CC-0x800E5078 pointer-getter run (ovl_11_func_800E4AEC, 800E4B58,
# 800E4C30, 800E4C84, 800E4D08) are byte-identical under -fno-rerun-loop-opt
# (only the cc1 option comment line differs), so none witnesses rerun-loop-opt
# ON. Each src file is its own translation unit, so the override cannot disturb
# them.
CC1FLAGS_ovl_11_func_800E4BA4 := -fno-rerun-loop-opt

# ovl_21_func_800B90C4: -fno-schedule-insns (ALLOWLIST DECISION REQUESTED).
#
# Target fingerprint (from the original bytes, no source needed): the read
# block at 0x800B9118 is in its exact expand-time order. The candidate's
# own .rtl dump (cc1 -da) shows the same order; with sched1 ON the ready-list
# priority hoists the D_800BCCD4 %hi past the D_800C0448 base chain and the
# block transposes by one instruction (lui at position 6, target 5). Turning
# pre-reload scheduling off reproduces every position and opcode and takes the
# residual from 36/44 with a schedule term to 38/45 with schedule 0.
#
# The same mechanism and prime-fact state as the allowlisted
# ovl_21_func_800B98CC / ovl_11_func_8011FF74 siblings (sched1 drifts an
# independently-birthed value out of its expand-time position). This src file
# is its own TU (one function per file), so the override cannot disturb the
# matched ovl_21 neighbours.
#
# Remaining residual under this flag (4 allocation words + 1 operand order) is
# NOT a flag question: the plus is base-first at expand time
# (cc1 .rtl: set reg83 = plus(reg83, reg89)) and CSE's simplify_rtx canonicalises
# it to index-first because the base's value is the constant SYMBOL_REF
# (cc1 .cse: set reg83 = plus(reg89, reg83)); -fno-cse-skip-blocks restores
# base-first only when the base equivalence crosses a skipped one-statement
# block, which the target's block layout does not contain. Needs the allowlist
# entry under sourcePolicy.allowlist (kind "flag-override") before this can be
# used as a match.
CC1FLAGS_ovl_21_func_800B90C4 := -fno-schedule-insns

# ovl_11_func_800F1678: -fno-cse-skip-blocks.
#
# Fingerprint (decoded from the original bytes, no source needed): the field
# load materialises D_8006C838 in $v0 (lui a0,%hi / addiu v0,a0,%lo /
# lh a1,0x5492(v0)) and then a post-call join re-forms the SAME symbol address
# from the CSE-shared %hi with `addiu a1,s1,%lo(D_8006C838)` (s1 holds the %hi
# copied out of $a0 by `move s1,a0`), rather than reusing the full-address
# pseudo. At baseline CSE carries the full lo_sum across the call and every
# natural C spelling of the field and the `base + idx*0x1D4` sum compiles to a
# single full-base pseudo in $s1 (`addiu s1,v0,%lo` ... `addu v1,v1,s1`); the
# target's re-formed lo_sum is unreachable from any C shape at baseline
# (21 source shapes tried: pointer local, array decay, char/struct member
# offset, base assigned before/after the call, m2c control structure).
#
# Flag column: psx_flag_probe matrix on the current source: baseline 7/51
# masked; -fno-cse-skip-blocks 11/51 and the only row that reproduces the
# target's lui a0 / addiu v0 / lh / move s1 prologue and the later
# `addiu a1,s1,%lo` re-materialisation; every other row (gcse, rerun-cse,
# split-addresses, schedule) stays at baseline.
#
# No contrary regional witness: this src file is its own TU (one function per
# file); the already-matched ovl_11 neighbours do not reference D_8006C838.
# The same flag is an established project precedent (func_80014494,
# ovl_11_func_80103B24, ovl_17_func_800B9158).
CC1FLAGS_ovl_11_func_800F1678 := -fno-cse-skip-blocks

# ovl_11_func_800F8224: -fno-strength-reduce.
#
# Target fingerprint (decoded from the original bytes, no source needed): the
# inner scan recomputes the element address from its index every iteration --
# `sll v1,a1,1 / addu v1,v1,a1 / sll v1,v1,1` (6*j) and, for the loop-invariant
# part, `addu v0,t1,a2 / sll v0,v0,1` (6*i) -- then adds the two (`addu
# v1,v0,v1`). The target carries no strength-reduced induction variable and no
# `addiu <reg>,<reg>,6` walker update for the inner scan. Under baseline flags
# loop.c reduces `j*6` to exactly that `addiu ...,6` induction (keeping a
# second counter register), so the target's redundant arithmetic is unreachable
# from any C spelling at baseline.
#
# Flag column: -fno-strength-reduce is the only measured column reaching the
# target's 54 words. The matched source (a single reused `p` pointer threaded
# through the outer check and the inner scan, with `dst = p` copied before the
# scan) is byte-exact 54/54 under this flag; masked baseline is 42/52 with the
# giv present, and -fno-rerun-loop-opt (53 insns), -fno-gcse (52) and
# -fno-peephole (53) are all non-exact.
#
# No contrary regional witness: this src file is its own TU (one function per
# file), so the override cannot disturb the matched ovl_11 neighbours.
CC1FLAGS_ovl_11_func_800F8224 := -fno-strength-reduce

# ovl_15_func_8013345C: -fno-gcse.
#
# Fingerprint (decoded from the original bytes / provable unreachability):
# the target TU's function is exactly 55 instructions, and no clean-C source
# shape reachable from the current reconstruction (roughly 250 measured
# variants: goto/for/while/do-while, merged/separate found/count/result webs,
# mask variable vs literal, scoped per-case masks, and a 128-way cross product)
# produces 55 instructions under baseline flags -- all produce 54 (the found
# loop-temp copy is deleted by coalescing). The flag matrix measured by
# psx_flag_probe shows exactly one row that reaches 55 instructions and
# dominates baseline: -fno-gcse (38/55 masked and 54/55 opcodes, vs 14/55 for
# baseline with 54 instructions). -fno-gcse is the only column that reproduces
# both the instruction count and the opcode stream, i.e. the count is a
# property no source shape can reach under baseline flags.
#
# Regional precedent: ovl_11_func_800F3D40 is an overlay TU in this project
# that also requires -fno-gcse, so disabling global CSE is an observed per-TU
# fact of this build, not a workaround.
#
# Under -fno-gcse the mismatch is residual allocation only (cfg 0, population
# 0, schedule 0); the remaining register choices are ordinary local/global
# allocation ordering.
CC1FLAGS_ovl_15_func_8013345C := -fno-gcse

# ovl_11_func_800FE068: -fno-strength-reduce.
#
# Target fingerprint (decoded from the original bytes, no source needed): the
# loop test recomputes the element address from its index every iteration --
# `sll v0,s0,1 / addu v0,v0,s6` -- and psx_target_loop_emission shows the
# preheader carries no giv init at all (its classes are source movables only).
# Under baseline flags loop.c strength-reduces `D_80127214[i]` into a second
# induction register initialized in the preheader (`addu $18,base,2` then
# `addu $18,$18,2`), which the target does not carry; the redundant `sll`/
# `addu` per iteration is unreachable from any C spelling at baseline.
#
# Flag column: -fno-strength-reduce is the only measured column reaching the
# target's words. At baseline the same source is 35/45 masked with the giv
# present (the `addu $18,base,2` / `addu $18,$18,2` walker); under
# -fno-strength-reduce the final source (explicit `u16 *p = D_80127214`,
# do-while whose top computes `p[var_a2 + 1]`) is byte-exact 57/57. Regional
# precedent: ovl_11_func_800F8224 in this same overlay is a matched TU whose
# override is also -fno-strength-reduce, so disabling strength reduction is an
# observed per-TU fact of this build, not a workaround.
#
# No contrary regional witness: this src file is its own TU (one function per
# file), so the override cannot disturb the matched ovl_11 neighbours.
CC1FLAGS_ovl_11_func_800FE068 := -fno-strength-reduce




# ovl_11_func_800E7660: -fno-cse-skip-blocks.
#
# Target fingerprint (decoded from the original bytes, no source needed): the
# dominating block at 0x800E7664 materializes D_8006C838 in $a3
# (`lui $v1,%hi(D_8006C838)` / `addiu $a3,$v1,%lo(D_8006C838)`), and the join
# block at 0x800E7744 re-forms only the low half from the CSE-shared %hi held
# in $t1 — `addiu $v1,$t1,%lo(D_8006C838)` — even though no call or clobber
# sits on the fall-through path between them. Under baseline -fcse-skip-blocks
# cse.c follows the branch around the one-block `if` in the arg0 == -1 arm and
# carries the base pseudo into the join, so the lo_sum there is folded away and
# the whole base stays in one register; the target's re-materialised lo_sum is
# unreachable from any C shape at baseline. Same mechanism as func_80014494 and
# ovl_17_func_800B9158 (both already carry this flag).
#
# Flag column: on the final source, baseline is 59/78 words (15 words differ);
# -fno-cse-skip-blocks is 78/78 byte-identical (`diffFunc` VERDICT MATCH). Every
# other measured column is far below: the flagProbe matrix over the candidate
# family scores -fno-gcse 1/78, -mno-split-addresses 1/78, -fno-cse-follow-jumps
# 21/78, -fno-schedule-insns{,2} 26/78, -fno-rerun-cse-after-loop 41/78, and
# -fno-cse-skip-blocks 72/78 masked on the pre-final spelling.
#
# No contrary regional witness: this src file is its own TU (one function per
# file), so the override cannot disturb the matched ovl_11 neighbours.
CC1FLAGS_ovl_11_func_800E7660 := -fno-cse-skip-blocks
