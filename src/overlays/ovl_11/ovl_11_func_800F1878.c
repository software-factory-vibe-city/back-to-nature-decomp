#include "common.h"

void ovl_11_func_800F1E44(u32 arg0, s16 *arg1, s32 arg2);
s32 func_8001AF44(u32 arg0);

s32 ovl_11_func_800F1878(u32 arg0, s32 arg1) {
    s16 sp10;
    s16 *var_s0;
    s32 var_s1;
    s32 var_s2;
    u16 temp_a0;
    u16 mask;
    s32 one;

    ovl_11_func_800F1E44(arg0, &sp10, arg1);
    var_s1 = 1;
    var_s2 = 0;
    mask = 0x3FF;
    var_s0 = &sp10;
    for (;;) {
        one = 1;
        if (arg1 == one) {
            temp_a0 = (u16) *var_s0;
            if ((temp_a0 != mask) && (func_8001AF44((temp_a0 + 0xFB) & 0xFFFF) != arg1)) {
                var_s1 = 0;
            }
        } else {
            temp_a0 = (u16) *var_s0;
            if ((temp_a0 != mask) && (func_8001AF44((temp_a0 + 0xFB) & 0xFFFF) != 0)) {
                var_s1 = 0;
            }
        }
        var_s2 += 1;
        if (var_s1 == 0) {
            break;
        }
        if (var_s2 < 3) {
            var_s0 += 1;
            continue;
        }
        break;
    }
    return var_s1;
}
