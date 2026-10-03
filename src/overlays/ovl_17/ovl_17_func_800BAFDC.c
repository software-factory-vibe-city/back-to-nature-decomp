#include "common.h"

s32 ovl_17_func_800BAFAC(void *arg0);

void ovl_17_func_800BAFDC(void) {
    u8 *base;
    s32 i;

    base = D_800BD870;
    for (i = 5; i >= 0; i--) {
        ovl_17_func_800BAFAC(base);
        base += 0x50;
    }
}
