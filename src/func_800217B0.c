#include "common.h"

extern s32 D_80049A10[3];

s32 func_800217B0(s32 arg0, s32 arg1, s32 arg2, u8 *arg3) {
    s32 *var_v1;
    s32 var_a1;
    u8 temp_v0;

    var_a1 = arg1;
    if (arg2 < var_a1) {
        return -1;
    }
    var_v1 = &D_80049A10[var_a1];
loop_2:
    temp_v0 = arg3[var_a1];
    if (((temp_v0 == 0) || (temp_v0 == 3)) && ((u32) (*var_v1 - arg0) >= 2U)) {
        return var_a1;
    }
    var_a1 += 1;
    var_v1++;
    if (arg2 >= var_a1) {
        goto loop_2;
    }
    return -1;
}
