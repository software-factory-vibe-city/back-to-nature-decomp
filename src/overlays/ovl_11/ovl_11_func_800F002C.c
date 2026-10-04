#include "common.h"

s32 ovl_11_func_800F002C(void) {
    s32 i;

    if (func_8001AF44(0x1B) == 1) {
        return -1;
    }
    for (i = 0; i < 5; i++) {
        if (func_8001AF44((u32) (i + 0x1C) << 16 >> 16) == 1) {
            return i;
        }
    }
    return -1;
}
