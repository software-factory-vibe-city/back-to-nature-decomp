#include "common.h"

extern s16 D_80070CF0;
extern s16 D_800BF4C8;
extern u16 D_800BCFE4[];

u32 func_80012A34(s32 arg0);

s32 ovl_19_func_800B85F4(void) {
    s16 s0;
    s16 s1;
    s32 v;

    s0 = D_80070CF0;
    s1 = D_800BF4C8;
    if (s0 >= 2) {
        s0 = 1;
    }
    if (s1 >= 3) {
        s0 = 2;
    }
    v = (s16)func_80012A34(D_800BCFE4[s0 * 3 + s1]);
    if (s0 != 0 && s1 == 2) {
        v = (s16)(v + 0xAB);
    }
    return v;
}
