#include "common.h"

s16 ovl_11_func_80115F38(void) {
    s16 var_a1;
    s32 var_v1;
    u32 *var_a0;
    u32 var_a2;
    char *base;

    var_a1 = -1;
    var_v1 = 0;
    var_a2 = 0x20000;
    base = (char *)&D_8006C838;
    base += 0x7AE8;
    var_a0 = (u32 *)base;
    do {
        if (*var_a0 & var_a2) {
            var_a1 = var_v1;
        }
        var_v1 += 1;
        var_a0 += 0x2D;
    } while (var_v1 < 0xA);
    return var_a1;
}
