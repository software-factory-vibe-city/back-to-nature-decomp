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
# GP-relatively, because this TU does not own it. configs/tu_externs.txt now
# records that, and both functions match under baseline flags.
# `make check` passes with no per-file compiler flag overrides in the project.
