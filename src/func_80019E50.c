#include "common.h"

extern s32 D_80049058[4];

s32 func_80019E50(s32 arg0) {
    register u32 var_v1 __asm__("v1");
    register u32 temp __asm__("a0");

    temp = (arg0 - 1);
    __asm__ volatile("" : "=r"(temp) : "0"(temp));
    var_v1 = temp & 0xFFFF;
    if (var_v1 >= 4U) {
        var_v1 = 0;
    }
    return D_80049058[var_v1];
}
