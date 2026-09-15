#include "common.h"

void ovl_11_func_801124E8(void) {
    s32 *base;
    u8 *p;

    base = &D_800719F8;
    *base &= ~0xE0;

    p = (u8 *)base - 0x51C0;
    if (!(*(s32 *)(p + 0x44F8) & 0x800)) {
        *base |= 0x20;
    }

    if (*(s16 *)(p + 0x51E6) == 0) {
        *base |= 0x40;
        return;
    }
    if (*(s16 *)(p + 0x51E6) == 2) {
        return;
    }
    if (*(s16 *)(p + 0x51C4) > 0) {
        return;
    }
    *base |= 0x80;
}
