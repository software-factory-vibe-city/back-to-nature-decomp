#include "common.h"

extern u16 D_800A03B0;

void ovl_11_func_800DB23C(s16 arg0) {
    u16 *p;
    s32 i;

    p = &D_800A03B0;
    i = 0;
    do {
        if (*p == arg0) {
            memset(p, 0, 0x16);
            *p = 0xFFFF;
            break;
        }
        i++;
    } while (i < 8);
}
