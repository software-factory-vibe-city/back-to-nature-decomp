#include "common.h"

s32 ovl_11_func_800F3BCC(u16 arg0) {
    u16 *base;
    u16 *p;
    u16 *slot;
    s32 id;
    s32 res;
    s32 v;
    s32 w;

    base = D_800711C4;
    id = arg0 & 0xFFFF;
    if ((u32) (id - 0xA1) < 3U) {
        p = base - 0x24C6;
        v = *(u16 *) ((u8 *) p + 0x44DC) + 1;
        *(u16 *) ((u8 *) p + 0x44DC) = v;
        if ((s16) v >= 0xC8) {
            func_8001AF70(0x5FU, 1U);
        }
    }
    *(s32 *) ((u8 *) base + 0x34) = *(s32 *) ((u8 *) base + 0x34) + ovl_11_func_800D603C(id);
    res = ovl_11_func_800F3C9C((u16) id);
    if (res == -1) {
        return 0;
    }
    slot = &base[res];
    w = *slot + 1;
    *slot = w;
    if ((u32) (w & 0xFFFF) >= 0x3E8U) {
        *slot = 0x3E7;
    }
    return 1;
}
