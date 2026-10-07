#include "common.h"

s32 ovl_17_func_800B9E94(s16 arg0);
s32 ovl_17_func_800B9E0C(s16 arg0);
s32 ovl_17_func_800B9DB8(s16 arg0);
s32 ovl_17_func_800B9DE0(s16 arg0);

s32 ovl_17_func_800B9CE4(s16 arg0) {
    s32 var_v0;
    s32 var_v1;
    s32 (*var_a1)(s16);
    u8 *base;
    u8 *base3;
    u8 *p38;
    u8 *temp_s2;

    base = D_800BD848;
    p38 = base + 0x38;
    if (*(s32 *)(p38 + *(s16 *)(base + 0x2BC) * 0x50) >= (*(s16 *)(base + 0x2D2) << 12)) {
        var_a1 = ovl_17_func_800B9DB8;
    } else {
        var_a1 = ovl_17_func_800B9DE0;
    }
    base3 = D_800BD848;
    temp_s2 = base3 + arg0 * 0x50;
    var_v1 = (var_a1(*(s16 *)(temp_s2 + 0x42)) != 0) ? 1 : 2;
    var_v0 = var_v1;
    if (ovl_17_func_800B9E94(arg0) != 0) {
        if (ovl_17_func_800B9E0C(*(s16 *)(temp_s2 + 0x44)) != 0) {
            var_v0 = var_v1 - 1;
        }
    }
    return var_v0;
}
