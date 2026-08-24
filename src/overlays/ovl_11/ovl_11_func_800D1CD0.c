#include "common.h"

s32 ovl_11_func_800D1CD0(s32 arg0, s32 arg1) {
    s32 tmp[2];
    CAPTURE_PREV_RET(phantom);

    tmp[0] = phantom;
    if (arg0 == arg1) {
        return 0;
    }
    if (arg0 < arg1) {
        return 1;
    }
    return 2;
}
