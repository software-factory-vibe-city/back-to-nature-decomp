#include "common.h"

extern s32 ovl_11_func_800F3E00(s16 arg0);

void ovl_11_func_801123AC(void) {
    s32 *base;
    s16 *p;
    s32 i;

    base = &D_800719F8;
    i = 0;
    p = &D_80127F90;
    *base &= ~0x10;
    while (i < 4 && ovl_11_func_800F3E00(*p) >= 0x65) {
        p++;
        i++;
    }
    if (i < 4) {
        return;
    }
    *base |= 0x10;
}
