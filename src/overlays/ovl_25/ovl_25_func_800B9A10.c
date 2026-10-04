#include "common.h"

extern s16 D_800BCC98;
extern s16 D_800BCC9A;
extern s16 D_800BCC9C;
extern s16 D_800BCC9E;

s32 ovl_25_func_800B9A10(s32 arg0) {
    s32 x;

    if (arg0 < 0) {
        arg0 += 0xFFF;
    }
    x = (arg0 << 4) >> 16;
    if (x >= 0x28) {
        x = D_800BCC98;
    } else if (x >= 0x1E) {
        x = D_800BCC9A;
    } else if (x >= 0x14) {
        x = D_800BCC9C;
    } else {
        x = D_800BCC9E;
    }
    return x;
}
