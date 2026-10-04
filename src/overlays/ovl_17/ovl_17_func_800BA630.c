#include "common.h"

void ovl_17_func_800BA630(void) {
    s32 i;
    s32 j;
    u8 *src;
    u8 *base;
    s16 *dst;

    i = 0;
    base = D_800BD848;
    src = D_800BB710;
    dst = (s16 *)(base + 0x208);
    for (; i < 3; i++) {
        for (j = 0; j < 6; j++) {
            dst[i * 6 + j] = src[i * 6 + j];
        }
    }
}
