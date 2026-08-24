#include "common.h"

s32 ovl_11_func_800CDF4C(u8 *arg0) {
    u8 *a1;
    s16 *a2;
    u32 a3;
    s32 c5;

    a3 = 0;
    c5 = 5;
    a1 = arg0;
    a2 = (s16 *)(a1 + 0x3D6);
    do {
        a2[-1] = (s16)c5;
        a2[0] = (s16)(a3 & 1);
        *(s32 *)(a1 + 0x1C0) = *(s32 *)(arg0 + 0x100);
        *(s32 *)(a1 + 0x1C4) = *(s32 *)(arg0 + 0x104);
        a2 += 2;
        *(s32 *)(a1 + 0x1C8) = *(s32 *)(arg0 + 0x108);
        a3 += 1;
        *(s32 *)(a1 + 0x1CC) = *(s32 *)(arg0 + 0x10C);
        a1 += 0x10;
    } while (a3 < 10);
    return 0;
}
