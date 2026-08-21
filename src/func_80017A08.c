#include "common.h"

void func_80017A08(s32 arg0, s32 arg1) {
    s32 var_a0;
    s32 idx;

    var_a0 = arg0;
    idx = var_a0 & 0xFFFF;
    if ((u32) (var_a0 & 0xFFFF) >= 0xB) {
        var_a0 = 0xA;
    }
    idx = var_a0 & 0xFFFF;
    D_8005F0C8[idx] = arg1;
}
