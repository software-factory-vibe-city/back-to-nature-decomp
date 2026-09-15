#include "common.h"

void ovl_11_func_801125DC(void) {
    s32 *base;
    u8 *p;
    s32 v;
    u16 d6;

    base = &D_800719F8;
    v = *base & ~0x3E00;
    *base = v;

    p = (u8 *)base - 0x51C0;
    if (*(u16 *)(p + 0x44D2) == 0) {
        *base = v | 0x200;
        return;
    }
    d6 = *(u16 *)(p + 0x44CE);
    if (d6 == 0) {
        *base = v | 0x400;
        return;
    }
    if (*(u16 *)(p + 0x44D0) == 0) {
        *base = v | 0x800;
        return;
    }
    if (d6 == 1) {
        *base = v | 0x1000;
        return;
    }
    if (*(u16 *)(p + 0x44D4) == 0) {
        *base = v | 0x2000;
    }
}
