#include "common.h"

extern s32 D_80049058[4];

s32 func_80019E50(s32 arg0) {
    u32 var_v1;

    var_v1 = (arg0 - 1) & 0xFFFF;
    if (var_v1 >= 4U) {
        var_v1 = 0;
    }
    return D_80049058[var_v1];
}
