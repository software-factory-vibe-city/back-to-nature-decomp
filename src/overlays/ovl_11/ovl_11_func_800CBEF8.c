#include "common.h"

extern u8 D_80128BB0[];

void ovl_11_func_800CBEF8(void) {
    u8 *var_s0;
    u32 var_s1;

    var_s1 = 0;
    var_s0 = D_80128BB0;
    do {
        ovl_11_func_800CBF40(var_s0);
        var_s1 += 1;
        var_s0 += 0x34;
    } while (var_s1 < 3U);
}
