#include "common.h"

s32 ovl_11_func_800C1224(s16 arg0, s16 arg1);

s32 ovl_11_func_800DE76C(void) {
    u8 *base;

    base = (u8 *)&D_8006C838;
    if (ovl_11_func_800C1224(*(s16 *)(base + 0x44BA), *(s16 *)(base + 0x44BC)) != 0) {
        *(s32 *)(base + 0x4450) |= 1;
    } else {
        *(s32 *)(base + 0x4450) &= ~1;
    }
    return 1;
}
