#include "common.h"

s32 ovl_17_func_800B9F10(s16 arg0, s16 arg1) {
    u8 *base;
    s32 scaled;

    base = D_800BD848;
    scaled = arg0 * 0x50;
    return (s16)arg1 < *(s16 *)(base + scaled + 0x2A);
}
