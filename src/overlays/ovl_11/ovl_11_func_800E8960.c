#include "common.h"

s32 ovl_11_func_800E8960(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 *base;
    s32 *base2;
    u8 *ptr;
    char *far_base;
    s32 scaled;
    u16 value;

    base = (s32 *)&D_8006C838;
    base2 = base + (0x8000 >> 2);
    scaled = arg0 * 0x18;
    far_base = (char *)&D_8007AFF0;
    value = *(u16 *)(far_base + 0x25476);
    ptr = (u8 *)base2[0x5DD0 >> 2] + scaled;

    *(u16 *)ptr = value;
    *(s32 *)(ptr + 0xC) = arg1;
    *(s32 *)(ptr + 0x8) = arg2;
    *(s32 *)(ptr + 0x10) = arg3;
    *(u16 *)(ptr + 0x4) |= 1;
    return 1;
}
