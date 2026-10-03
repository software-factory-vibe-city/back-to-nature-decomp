#include "common.h"

s32 ovl_17_func_800BB020(void *arg0);

void ovl_17_func_800BB050(void) {
    u8 *base;
    s32 i;

    base = D_800BD870;
    for (i = 5; i >= 0; i--) {
        ovl_17_func_800BB020(base);
        base += 0x50;
    }
}
