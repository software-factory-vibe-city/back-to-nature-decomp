#include "common.h"

s32 ovl_11_func_800D0BC8(s32 arg0);
void ovl_11_func_800F501C(s32 arg0, s32 arg1, s16 arg2);

void ovl_11_func_800F4618(void) {
    u8 *base;
    s16 *var_s2;
    s16 var_s0;
    s32 var_s1;

    var_s1 = 2;
    base = (u8 *) D_8006C838;
    var_s2 = (s16 *) (base + 0x99D2);
    do {
        var_s0 = *var_s2;
        if (var_s0 != 1) {
            var_s0 = 0;
        }
        ovl_11_func_800F501C(var_s1 - 2, ovl_11_func_800D0BC8(var_s1) == 1, var_s0);
        var_s1 += 1;
        var_s2 += 2;
    } while (var_s1 < 4);
}
