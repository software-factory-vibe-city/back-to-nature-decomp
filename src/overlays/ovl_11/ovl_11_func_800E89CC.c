#include "common.h"

s32 ovl_11_func_800E89CC(s16 arg0, s32 arg1) {
    s32 *base;
    s32 *base2;
    u8 *ptr;
    u16 *p;
    s32 scaled;
    s32 cond;

    cond = arg1 << 0x10;

    base = (s32 *)&D_8006C838;
    base2 = base + (0x8000 >> 2);
    scaled = arg0 * 3;
    ptr = (u8 *)base2[0x5DD0 >> 2];
    p = (u16 *)(ptr + (scaled << 3));

    if (cond == 0) {
        p[2] &= 0xFFFE;
    } else {
        p[2] |= 1;
    }
    return 1;
}
