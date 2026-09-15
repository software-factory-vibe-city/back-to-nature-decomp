#include "common.h"

extern s32 D_80071B00[];
extern s32 D_80076280[];

s32 ovl_11_func_800EDEB8(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 *p;

    if (arg0 == 0x29) {
        p = D_80071B00;
    } else {
        p = (s32 *)((char *)D_80076280 + arg0 * 0x1D4);
    }
    p[1] += arg1 * 2;
    p[0] += arg2 * 2;
    p[2] += arg3 * 2;
    return 1;
}
