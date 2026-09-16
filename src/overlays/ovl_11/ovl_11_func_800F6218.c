#include "common.h"

s32 ovl_11_func_800F6218(s32 arg0, s32 *arg1, s32 *arg2) {
    s32 var_v1;

    var_v1 = 1;
    *arg1 = 0;
    *arg2 = 0;
    switch (arg0) {
    case 0x68:
        *arg2 = 4;
        break;
    case 0x69:
        *arg2 = 7;
        break;
    case 0x64:
        *arg2 = 2;
        break;
    case 0x65:
        *arg2 = 3;
        break;
    case 0xE8:
        *arg2 = 6;
        break;
    case 0x122:
    case 0x123:
    case 0x124:
        *arg2 = 5;
        break;
    default:
        var_v1 = 0;
        break;
    }
    return var_v1;
}
