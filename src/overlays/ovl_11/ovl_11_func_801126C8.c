#include "common.h"

void ovl_11_func_801126C8(void) {
    s32 *base;
    u8 *p;
    u8 *c;
    s32 flags;

    base = &D_800719F8;
    *base &= 0xFFFC7FFF;

    p = (u8 *)base - 0x51C0;
    if (*(u16 *)(p + 0x44D2) != 0) {
        if ((*(s32 *)(p + 0x44F8) & 0x100000) == 0) {
            *base |= 0x10000;
            return;
        }
    }

    c = (u8 *)&D_8006C838;
    if (*(u16 *)(c + 0x44D0) == 0) {
        return;
    }

    flags = *(s32 *)(c + 0x44F8);
    if ((flags & 0x100000) == 0) {
        return;
    }
    if ((flags & 0x100) == 0) {
        *base |= 0x8000;
    } else if ((flags & 0x200) == 0) {
        *base |= 0x20000;
    }
}
