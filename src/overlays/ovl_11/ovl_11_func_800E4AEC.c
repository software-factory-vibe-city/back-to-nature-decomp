#include "common.h"

s32 ovl_11_func_800E4AEC(s32 arg0) {
    s32 i;
    s16 v;

    for (i = 2; i < 0x1A; i++) {
        v = *(s16 *)(arg0 + i * 2);
        if ((v & 0x3C00) == 0) {
            break;
        }
    }
    if (i == 0x1A) {
        return 0;
    }
    return ovl_11_func_800E4B58(arg0, i - 2);
}
