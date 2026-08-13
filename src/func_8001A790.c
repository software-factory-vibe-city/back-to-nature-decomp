#include "common.h"

s32 func_8001A790(s32 arg0) {
    u16 *var_a0;
    s32 var_s1;
    s32 i;

    var_a0 = D_8005F0F8;
    var_s1 = (s32)&D_800742EC;
    for (i = 0; i < 10; i++) {
        var_a0 = func_8001A808(var_a0, var_s1, arg0);
        var_s1 += 0xB4;
    }
    return var_a0 - D_8005F0F8;
}
