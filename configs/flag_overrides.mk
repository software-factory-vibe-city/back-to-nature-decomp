# Per-file compiler flag overrides
#
# Format:  CC1FLAGS_<stem> := <extra flags>
#   where <stem> is the source filename without path or .c extension
#
# These flags are APPENDED to the base CC1FLAGS in the FlagsSwitch macro.
# Use sparingly — most functions match with the default -O2 flags.
#
# Escalation strategy (try in order):
#   1. Clean C: reorder declarations, swap operands, use natural idioms
#   2. Scheduling barriers: __asm__ volatile("" : "=r"(var) : "0"(var))
#   3. register __asm__("v0"): force specific register allocation
#   4. Flag overrides (this file): disable scheduler or other passes
#
# Only use flag overrides when steps 1-3 cannot produce a match.
# The most common case is self-clobbering loads: the target binary has
# sequential lui/lw pairs (lui v0 / lw v0,off(v0)) where the lw
# overwrites the base register. GCC's scheduler groups the lui
# instructions together and uses extra registers, preventing this pattern.
# Disabling scheduling with -fno-schedule-insns -fno-schedule-insns2
# combined with register __asm__ produces exact matches.

# SetGfxClip: sequential pointer loads with self-clobbering lw pattern
# Target: lui v0 / lw v0,0(v0) / lui v1 / lw v1,0(v1) (sequential)
# GCC -O2: lui v0 / lui v1 / lw v0,0(v0) / lw v1,0(v1) (interleaved)
# Barriers can't fix this because the interleaving happens at the lui level.
CC1FLAGS_SetGfxClip := -fno-schedule-insns -fno-schedule-insns2
