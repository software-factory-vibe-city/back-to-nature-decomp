#include "common.h"

s32 ovl_11_func_800E8BA0(s16 arg0, s16 arg1) {
    s32 *base;
    s32 *base2;
    u8 *ptr;
    s32 scaled;
    s32 value;

    base = (s32 *)&D_8006C838;
    base2 = base + (0x8000 >> 2);
    ptr = (u8 *)base2[0x5DD0 >> 2];
    scaled = arg0 * 0x18;

    value = *(u16 *)(ptr + scaled + 2);
    D_80129560[arg1] = value;
    return 1;
}
