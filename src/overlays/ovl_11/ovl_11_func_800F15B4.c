#include "common.h"

s32 ovl_11_func_800EEBF4(s32 arg0);

s32 ovl_11_func_800F15B4(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4) {
    s32 var_v1;
    s32 temp_a3;
    u32 temp_a0;
    u32 temp_a1;
    u32 temp_s0;
    u32 temp_s1;
    u32 temp_v0;

    temp_a0 = arg0 & 0xFF;
    temp_a1 = arg1 & 0xFF;
    temp_s0 = arg2 & 0xFFFF;
    temp_s1 = arg3 & 0xFFFF;
    if ((temp_a0 == 0xFF) || (temp_a1 == 0xFF)) {
        temp_v0 = arg4 & 0x400;
        return temp_v0 == 0;
    }
    temp_v0 = ovl_11_func_800EEBF4(temp_a0);
    var_v1 = 0;
    temp_v0 = temp_v0 & 0xFF;
    if (temp_s0 == 0xFF) {
        if (temp_s1 == temp_s0) {
            var_v1 = 1;
        } else if (temp_s1 >= temp_v0) {
            var_v1 = 1;
        }
    } else if (temp_s1 == 0xFF) {
        if (temp_v0 >= temp_s0) {
            var_v1 = 1;
        }
    } else {
        temp_a3 = (u16)temp_v0;
        if (temp_a3 >= temp_s0) {
            if (temp_s1 >= temp_a3) {
                var_v1 = 1;
            }
        }
    }
    if (arg4 & 0x400) {
        return var_v1 ^ 1;
    }
    return var_v1;
}
