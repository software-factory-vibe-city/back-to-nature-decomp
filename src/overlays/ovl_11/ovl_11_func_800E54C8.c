#include "common.h"

void ovl_11_func_800E54C8(void) {
    char *base;
    s16 *p;
    s32 i;
    s32 val;

    val = -1;
    base = (char *)&D_8006C838;
    p = (s16 *)(base + 0x443C);
    for (i = 0; i < 5; i++) {
        p[-1] = val;
        p[0] = val;
        p += 2;
    }
}
