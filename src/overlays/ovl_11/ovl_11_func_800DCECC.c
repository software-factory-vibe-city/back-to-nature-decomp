#include "common.h"

extern u8 D_801290D8[];

void ovl_11_func_800DCECC(void) {
    u8 *base;
    s32 i;

    base = D_801290D8;
    for (i = 2; i >= 0; i--) {
        ovl_11_func_800DCE98(base);
        base += 0x34;
    }
}
