#include "common.h"

extern u16 D_80071318[11];

s32 ovl_11_func_80100E68(u16 arg0);
s32 ovl_11_func_80100EB8(s32 arg0);

s32 ovl_11_func_80100A8C(s32 arg0) {
    u8 *base;
    s32 mask;
    s32 count;
    s32 i;
    u16 *p;

    base = (u8 *)&D_80071318[0] + ((arg0 & 0xFF) * 0x16);
    mask = 1;
    count = 0;
    do {
        if ((*(u16 *)(base + 4) & mask) && ovl_11_func_80100E68(mask) == 0) {
            return 0;
        }
        mask = (mask * 2) & 0xFFFE;
        count++;
    } while (count < 12);
    i = 0;
    p = (u16 *)(base + 6);
    for (; i < 8; i++) {
        if (ovl_11_func_80100EB8(*p) == 0) {
            return 0;
        }
        p++;
    }
    return 1;
}
