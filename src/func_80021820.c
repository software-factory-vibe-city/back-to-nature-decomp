#include "common.h"

s32 func_80021820(s32 arg0, s32 arg1) {
    s32 best_idx;
    s32 pass;
    s32 neg1;
    s32 *base0;
    s32 *base1;
    s32 idx4;
    register s32 i __asm__("a3");
    s32 best_val;
    s32 *p1;
    s32 *p0;

    best_idx = -1;
    pass = 0;
    neg1 = -1;
    base0 = &D_8006C0C8;
    base1 = &D_8006C128;
    idx4 = arg0 << 2;
    i = arg0;

    for (; pass < 4; pass++) {
        if (!(arg1 < i)) {
            best_val = 0x1000000;
            p1 = (s32 *)(idx4 + (s32)base1);
            p0 = (s32 *)(idx4 + (s32)base0);
            do {
                s32 val;
                val = *p0;
                if (val == pass) {
                    s32 c128_val;
                    c128_val = *p1;
                    if (c128_val < best_val) {
                        best_idx = i;
                        best_val = c128_val;
                    }
                }
                p1++;
                i++;
                p0++;
            } while (!(arg1 < i));
        }

        if (best_idx != neg1) {
            return best_idx;
        }
        i = arg0;
    }

    return -1;
}
