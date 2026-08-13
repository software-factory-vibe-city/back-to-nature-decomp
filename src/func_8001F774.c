#include "common.h"

/* Game callee (signature from include/functions.h; local declaration per project convention). */
void func_8001F278(s32 arg0, s32 arg1, s32 *arg2, s32 *arg3, s32 *arg4);

/* func_8001F774 — MATCH (76/76)
 *
 * Gradient interpolator over 16 steps: extracts 5-bit fields from two u16
 * inputs, interpolates them via func_8001F278, packs the three interpolated
 * 5-bit fields into one u16 (bit 15 set when non-zero), and writes the
 * result to the u16 output array.
 *
 * Matching notes:
 * - func_8001F278 must be declared void in scope: the target reuses $v0 as
 *   scratch immediately after the call (first packing load), which is
 *   positive evidence of a void callee; an implicit-int declaration poisons
 *   post-call $v0 allocation and rotates the packing load registers.
 * - field2/field3 addresses are born at their declaration initializers,
 *   before the arg0/arg1/arg2 pointer copies, reproducing the target's
 *   prologue save order (s5/s4 saved before s2/s1/s0).
 */
void func_8001F774(u16 *arg0, u16 *arg1, u16 *arg2, s32 arg3, s32 arg4) {
    s32 field1[3];
    s32 field2[3];
    s32 field3[3];
    s32 *tmp2 = field2;
    s32 *tmp3 = field3;
    u16 *var_s0;
    u16 *var_s1;
    u16 *var_s2;
    s32 var_s3;
    u32 temp_v1;
    u32 temp_v1_masked;
    u32 temp_a0;
    u32 temp_a0_masked;
    s16 var_a0;
    u16 f3_1;

    var_s2 = arg0;
    var_s1 = arg2;
    var_s0 = arg1;
    var_s3 = 0xF;
    do {
        temp_v1 = *var_s0;
        temp_v1_masked = temp_v1 & 0xFFFF;
        field1[2] = temp_v1 & 0x1F;
        field1[1] = (temp_v1_masked >> 5) & 0x1F;
        field1[0] = (temp_v1_masked >> 0xA) & 0x1F;
        temp_a0 = *var_s1;
        temp_a0_masked = temp_a0 & 0xFFFF;
        field2[2] = temp_a0 & 0x1F;
        field2[1] = (temp_a0_masked >> 5) & 0x1F;
        field2[0] = (temp_a0_masked >> 0xA) & 0x1F;
        func_8001F278(arg3, arg4, field1, tmp2, tmp3);
        var_a0 = field3[0] & 0x1F;
        f3_1 = field3[1];
        var_a0 <<= 5;
        var_a0 |= f3_1 & 0x1F;
        var_a0 <<= 5;
        var_a0 |= field3[2] & 0x1F;
        if (var_a0 != 0) {
            var_a0 |= ~0x7FFF;
        }
        *var_s2 = var_a0;
        var_s2++;
        var_s1++;
        var_s3--;
        var_s0++;
    } while (var_s3 >= 0);
}
