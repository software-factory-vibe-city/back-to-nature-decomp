#include "common.h"

s32 func_8001A6FC(s32 arg0) {
    u16 *var_a0;
    s32 var_s0;
    s32 i;

    var_a0 = D_8005F0F8;
    var_s0 = (s32)&D_800749F4;
    for (i = 0; i < 20; i++) {
        if (*(s32 *)((char *)var_s0 + 0x34) & 0x10000) {
            var_a0 = func_8001A808(var_a0, var_s0, arg0);
        }
        var_s0 += 0xB8;
    }
    return var_a0 - D_8005F0F8;
}
