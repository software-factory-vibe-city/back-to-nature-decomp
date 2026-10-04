#include "common.h"

void ovl_17_func_800BA698(void) {
    s16 *p;
    s32 i;
    s32 v;

    p = (s16 *)D_800BD758;
    p[1] = 5;
    p[4] = 0;
    p[7] = 4;
    p[10] = 3;
    p[13] = 1;
    p[16] = 2;
    for (i = 0; i < 6; i++) {
        v = 0x4D + i * 0x1A;
        p[i * 3] = v;
        p[i * 3 + 2] = 0x14 - i;
    }
}
