#include "common.h"

void ovl_17_func_800BB394(s16 arg0) {
    char *base;
    char *p;

    base = (char *)&D_8006C838;
    p = base + arg0 * 0x1D4;
    if (*(s16 *)(p + 0x8000 + 0x19EA) < 0xEB) {
        *(s16 *)(p + 0x8000 + 0x19EA) = (s16)(0x14 + *(u16 *)(p + 0x8000 + 0x19EA));
    } else {
        *(s16 *)(p + 0x8000 + 0x19EA) = 0xFF;
    }
}
