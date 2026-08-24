#include "common.h"

s32 ovl_11_func_800F6578(s32 arg0, s32 *arg1, s32 *arg2) {
    s32 var_v1;

    var_v1 = 1;
    *arg1 = 0;
    *arg2 = 0;
    switch (arg0) {
    case 0x64:
        *arg2 = 0x11;
        break;
    case 0x65:
        *arg2 = 0x13;
        break;
    default:
        var_v1 = 0;
        break;
    }
    return var_v1;
}
