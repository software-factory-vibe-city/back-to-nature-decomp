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
# .pi/autodecomp.json (sourcePolicy.allowlist, kind "flag-override") must be
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
