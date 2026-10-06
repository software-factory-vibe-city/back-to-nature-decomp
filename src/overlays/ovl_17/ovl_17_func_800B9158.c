#include "common.h"

void ovl_17_func_800B9158(s32 arg0, s16 arg1) {
    u8 *base;
    s32 off;

    base = D_800BD848;
    if (*(s16 *)(base + 0x5A8) >= 0x5A) {
        *(s16 *)(base + 0x5A8) = 0;
    }
    off = *(s16 *)(base + 0x5A8) * 8;
    *(s32 *)(base + off + 0x2D8) = arg0;
    *(s16 *)(base + *(s16 *)(base + 0x5A8) * 8 + 0x2DC) = arg1;
    *(u16 *)(base + 0x5A8) = *(u16 *)(base + 0x5A8) + 1;
}
