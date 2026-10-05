#include "common.h"

void ovl_17_func_800B9594(void) {
    u8 *base;
    u8 *p;
    s32 i;
    s16 q;

    base = D_800BD848;
    p = base;
    for (i = 5; i >= 0; i--) {
        q = (s16) ((*(s16 *) (p + 0x2E) - *(s16 *) (p + 0x2C)) * 0xFF / (((*(s16 *) (p + 0x2A)) + 1) * (*(s16 *) (base + 0x14))));
        *(s16 *) (p + 0x2E) = (u16) (*(s16 *) (p + 0x2E)) - q;
        if (*(s16 *) (p + 0x2C) >= *(s16 *) (p + 0x2E)) {
            *(u16 *) (p + 0x2E) = *(u16 *) (p + 0x2C);
        }
        p += 0x50;
    }
}
