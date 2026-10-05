#include "common.h"

s32 ovl_11_func_8010775C(u32 arg0) {
    s32 var_a0;
    s32 var_a1;

    switch (arg0) {
    case 0:
        var_a0 = 9;
        var_a1 = 0xC;
        break;
    case 1:
    case 3:
        var_a0 = 9;
        var_a1 = 0x10;
        break;
    case 2:
        var_a0 = 9;
        var_a1 = 0x11;
        break;
    case 4:
        var_a0 = 0xD;
        var_a1 = 0x10;
        break;
    case 5:
        var_a0 = 9;
        var_a1 = 0x12;
        break;
    case 6:
        var_a0 = 8;
        var_a1 = 0x15;
        break;
    case 7:
        var_a0 = 0x12;
        var_a1 = 0x18;
        break;
    case 8:
        var_a0 = 0xB;
        var_a1 = 0x11;
        break;
    default:
        return 0;
    }
    return ovl_11_func_80107B54(var_a0, var_a1);
}
