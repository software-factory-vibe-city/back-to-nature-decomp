#include "common.h"

s32 ovl_11_func_800F1EE4(s32 arg0) {
    u32 temp_v1;

    temp_v1 = arg0 & 0xFFFF;
    switch (temp_v1) {
    case 0:
        return 3;
    case 1:
        return 7;
    case 2:
        return 9;
    case 3:
        return 0xE;
    case 4:
        return 0x14;
    default:
        return 3;
    }
}
