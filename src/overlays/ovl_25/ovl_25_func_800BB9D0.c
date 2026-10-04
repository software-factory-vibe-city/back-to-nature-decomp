#include "common.h"

void ovl_25_func_800BB9D0(s16 arg0) {
    char *base;
    char *p;
    u16 x;

    base = (char *)&D_8006C838;
    p = base + arg0 * 0x1D4;
    x = *(u16 *)(p + 0x8000 + 0x19EC);
    if (x <= 0xFE0Au) {
        *(u16 *)(p + 0x8000 + 0x19EC) = x + 0x1F4;
    } else {
        *(u16 *)(p + 0x8000 + 0x19EC) = 0xFFFF;
    }
}
