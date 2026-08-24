#include "common.h"

s32 ovl_11_func_800C0834(s16 arg0) {
    s32 var_v1;

    var_v1 = 3;
    if ((u32) (arg0 - 5) < 2U) {
        var_v1 = 0;
    }
    if ((u32) (arg0 - 7) < 8U) {
        var_v1 = 1;
    }
    if ((u32) (arg0 - 0xF) < 2U) {
        var_v1 = 2;
    }
    return var_v1;
}
