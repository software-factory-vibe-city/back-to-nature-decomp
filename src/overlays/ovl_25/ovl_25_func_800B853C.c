#include "common.h"

extern s16 D_800BFE44[];
extern void (*D_800BCBF8[])(void);

void ovl_25_func_800B93E4(void);
s32 func_80013394(void);

void ovl_25_func_800B853C(void) {
    s32 temp_v0;
    s32 q;
    s32 temp;

    ovl_25_func_800B93E4();
    if (D_800BFE44[1] == 6) {
        temp_v0 = func_80013394();
        if (temp_v0 == 1) {
            D_800BFE44[1] = 0;
            D_800BFE44[0] = (s16) temp_v0;
        }
    } else {
        D_800BCBF8[D_800BFE44[1]]();
        __asm__ volatile("" ::: "memory");
        q = (D_800BFE44[6] + 1) / 10000;
        temp = q * 0x2710 - 1;
        D_800BFE44[6] = (u16) D_800BFE44[6] - temp;
    }
}
