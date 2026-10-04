#include "common.h"

extern s16 D_80122F0C[];

s32 ovl_11_func_800C1224(s16 arg0, s16 arg1);

s16 ovl_11_func_800C141C(s16 arg0) {
    u8 *base;
    s16 var_s0;
    s32 temp_v0;
    s16 temp_v0_2;

    var_s0 = arg0;
    if ((u32)(var_s0 - 0x34) < 4U) {
        base = (u8 *)&D_8006C838;
        temp_v0 = ovl_11_func_800C1224(*(s16 *)(base + 0x44BA), *(s16 *)(base + 0x44BC));
        if (temp_v0 != 0) {
            temp_v0_2 = D_80122F0C[(temp_v0 - 1) * 3 + 2];
            if (temp_v0_2 != -1) {
                var_s0 = temp_v0_2;
            }
        }
    }
    return var_s0;
}
