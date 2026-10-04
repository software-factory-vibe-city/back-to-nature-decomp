#include "common.h"

extern s32 D_80128B5C;

void ovl_11_func_800C0D9C(s32 arg0);

s32 ovl_11_func_800C087C(s32 arg0) {
    char *base;
    s32 temp_v0;
    s32 var_s0;
    s32 var_a1;

    base = (char *)&D_8006C838;
    var_a1 = 5 - *(s16 *)(base + 0x44C0);
    if (var_a1 < 0) {
        var_a1 += 0x18;
    }
    D_80128B5C = 0;
    var_s0 = 0x3C - *(s16 *)(base + 0x44C2);
    temp_v0 = var_a1 * 0x3C + arg0;
    var_s0 += temp_v0;
    ovl_11_func_800C0D9C(var_s0);
    return var_s0;
}
