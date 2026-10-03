#include "common.h"

s32 ovl_17_func_800B9F44(s16 arg0) {
    u8 *base;
    s32 scaled;

    base = D_800BD848;
    scaled = arg0 * 0x50;
    return *(s16 *)(base + scaled + 0x36) >= 0x51;
}
