#include "common.h"

s16 ovl_11_func_800F5108(u16 arg0, s16 arg1, s16 arg2, s16 arg3) {
    s32 tmp[2];
    CAPTURE_PREV_RET(phantom);

    tmp[0] = phantom;
    if (arg0 & 0x2000) {
        return arg1;
    }
    if (arg0 & 0x800) {
        return arg2;
    }
    if (arg0 & 0x1000) {
        return arg3;
    }
    return 0;
}
