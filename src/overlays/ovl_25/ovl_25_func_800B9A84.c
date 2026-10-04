#include "common.h"

extern s16 D_800BCC90;
extern s16 D_800BCC92;
extern s16 D_800BCC94;
extern s16 D_800BCC96;

s32 ovl_25_func_800B9A84(s32 arg0) {
    s32 x;

    if (arg0 < 0) {
        arg0 += 0xFFF;
    }
    x = (arg0 << 4) >> 16;
    if (x >= 0x28) {
        return D_800BCC90;
    }
    if (x >= 0x1E) {
        return D_800BCC92;
    }
    if (x >= 0x14) {
        return D_800BCC94;
    }
    if (x >= 0xA) {
        return D_800BCC96;
    }
    return 0;
}
