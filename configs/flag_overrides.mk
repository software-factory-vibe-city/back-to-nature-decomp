# Per-file compiler flag overrides
#
# Format:  CC1FLAGS_<stem> := <extra flags>
#   where <stem> is the source filename without path or .c extension
#
# These flags are APPENDED to the base CC1FLAGS in the FlagsSwitch macro.
#
# POLICY: flag overrides are GOVERNED WORKAROUNDS, not a decompilation tool.
# The compiler is proven byte-identical to the original CC1PSX.EXE, so a
# flag override means the C source is (probably) still wrong. New entries
# require explicit human approval and a comment explaining why clean C
# cannot match. The two entries below are legacy and pending re-validation
# (see notes/next-steps-for-revisiting-the-project.md).
#
# The pattern they work around: self-clobbering loads — the target binary
# has sequential lui/lw pairs (lui v0 / lw v0,off(v0)) where the lw
# overwrites the base register. GCC's scheduler groups the lui
# instructions together and uses extra registers, preventing this pattern.

# SetGfxClip: sequential pointer loads with self-clobbering lw pattern
# Target: lui v0 / lw v0,0(v0) / lui v1 / lw v1,0(v1) (sequential)
# GCC -O2: lui v0 / lui v1 / lw v0,0(v0) / lw v1,0(v1) (interleaved)
# Barriers can't fix this because the interleaving happens at the lui level.
CC1FLAGS_SetGfxClip := -fno-schedule-insns -fno-schedule-insns2

# SetGfxOffset: same pattern as SetGfxClip - sequential lui/lw with self-clobbering loads
# Target has lui v0 / lw v0,-7252(v0) / lui v1 / lw v1,-7256(v1)
# Needs scheduling disabled to prevent lui grouping and register __asm__ for v0/v1.
CC1FLAGS_SetGfxOffset := -fno-schedule-insns -fno-schedule-insns2

# func_80016C08: split-address materialization of D_8005E3C0 at the loop tail.
# Target: lui v1,%hi(D_8005E3C0) / lw v1,%lo(D_8005E3C0)(v1)  (one register)
# GCC -O2: lui v0 / sw / sw / lw v1,%lo(...)(v0)              (two registers)
# The address is emitted as its own RTL insn, so sched2 advances the lui across
# the two tail stores; once the pair is not adjacent it cannot share a register.
# Approved by the project owner 2026-08-05 after the clean-C space was measured
# unreachable: all 20 dependence-valid tail orders, four live-range reshapes,
# and the nine hypotheses in section 11 of
# notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md.
# Section 11 row 7 objects to this override on historical grounds; that
# objection is recorded and overridden, not resolved.
CC1FLAGS_func_80016C08 := -mno-split-addresses
