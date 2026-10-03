#include "common.h"

void ovl_17_func_800B9CAC(void) {
    u8 *base;
    s32 i;

    base = D_800BD848;
    for (i = 5; i >= 0; i--) {
        if (*(s16 *)(base + 0x2A) < 0xFF) {
            *(s16 *)(base + 0x2A) = *(u16 *)(base + 0x2A) + 5;
        }
        base += 0x50;
    }
}
