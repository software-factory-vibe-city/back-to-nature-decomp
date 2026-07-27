#include "common.h"

s32 func_800198E0(u16 *arg0, s32 arg1, s16 arg2) {
    s32 temp_a0_2;
    s32 var_s1;
    s32 var_v0;
    s32 var_v0_2;
    s32 var_v0_3;
    u16 *var_s0;
    u16 temp_a0;

    var_s0 = arg0;
    var_s1 = 0;
    if ((u32) ((*var_s0 + 2) & 0xFFFF) >= 2U) {
        do {
            temp_a0 = *var_s0;
            if ((temp_a0 & 0xF000) == 0x4000) {
                temp_a0_2 = D_8005F0C8[temp_a0 & 0xFFF];
                if (temp_a0_2 != 0) {
                    var_s1 += func_800198E0((u16 *)temp_a0_2, arg1, arg2);
                }
            } else {
                var_v0_2 = arg1;
                if (arg1 < 0) {
                    var_v0_2 = arg1 + 0x1FF;
                }
                var_s1 += var_v0_2 >> 9;
                var_s1 += arg2;
            }
            var_s0++;
        } while ((u32) ((*var_s0 + 2) & 0xFFFF) >= 2U);
    }
    if ((var_s0[-1] & 0xFFF) == 0x6C) {
        var_v0_3 = arg1 * 3;
        if (var_v0_3 < 0) {
            var_v0_3 += 0xFFF;
        }
        var_s1 -= var_v0_3 >> 0xC;
    }
    return var_s1 - arg2;
}
