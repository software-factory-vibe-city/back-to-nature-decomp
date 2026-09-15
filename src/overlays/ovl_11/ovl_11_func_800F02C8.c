#include "common.h"

extern s16 D_80124DD8[];

s32 ovl_11_func_800F02C8(void) {
    char *p;
    u16 val;
    s32 i;
    s32 best;
    s32 max;

    max = 0;
    best = 0;
    i = 0;
    for (; i < 5; i++) {
        p = (char *)&D_8006C838 + D_80124DD8[i] * 0x1D4;
        val = *(u16 *)(p + 0x8000 + 0x19EC);
        if (max < val) {
            best = i;
            max = val;
        }
    }
    if (max >= 0x1F4) {
        return best;
    }
    return -1;
}
