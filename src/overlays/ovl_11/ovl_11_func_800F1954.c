#include "common.h"

s32 ovl_11_func_800F1954(s32 arg0) {
    s32 v;
    s32 one = 1;
    s32 f;

    f = arg0 & 0x3FF;
    if (f != 0x3FF) {
        v = func_8001AF44(f + 0xC8);
        if (v != one) {
            return 0;
        }
    }
    f = ((u32) arg0 >> 10) & 0x3FF;
    if (f != 0x3FF) {
        v = func_8001AF44(f + 0xC8);
        if (v != 0) {
            return 0;
        }
    }
    return 1;
}
