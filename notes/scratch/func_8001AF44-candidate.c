/* De-superstition sweep candidate for func_8001AF44 — 90.9%, NOT matching.
 * Remaining diff: ONE instruction, commutative operand order only:
 *   target: addu v1,v1,v0   (base first)
 *   ours:   addu v1,v0,v1   (offset first)
 * Everything else (instruction selection, schedule, allocation) matches.
 * Diff class: same instructions / operand canonicalization. Tried: swapping
 * source operand order (canonicalized away), base-first statements, fresh
 * temp for sum, constant-fused base, pointer-index arithmetic, index offset
 * (+14). Each fix for operand order breaks schedule/allocation elsewhere. */
#include "common.h"

s32 func_8001AF44(u32 arg0) {
    u32 temp_v0;
    u32 *temp_v1;

    arg0 = arg0 & 0xFFFF;
    temp_v0 = arg0 >> 5;
    temp_v1 = (u32 *)&D_8006C838;
    temp_v0 <<= 2;
    temp_v1 = (u32 *)((char *)temp_v1 + temp_v0);
    return (*(u32 *)((char *)temp_v1 + 0x38) >> (arg0 & 0x1F)) & 1;
}
