#include "common.h"

s32 ovl_11_func_800C3548(s32 arg0) {
    s32 temp_v1;
    s32 var_a1;

    temp_v1 = (s32) ((arg0 << 0x10) + 0xFFFD0000) >> 0x10;
    var_a1 = 0;
    switch (temp_v1) {
    case 0:
    case 4:
    case 6:
    case 11:
    case 17:
        var_a1 = 1;
        break;
    }
    return var_a1;
}
