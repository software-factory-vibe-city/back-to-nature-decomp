#include "common.h"

extern s32 D_80071B00[];
extern s32 D_80076280[];

s32 ovl_11_func_800E9778(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 *p;

    if (arg0 == 0x29) {
        p = D_80071B00;
    } else if ((u32)(arg0 - 1) < 0x24) {
        p = (s32 *)((char *)D_80076280 + arg0 * 0x1D4);
    } else {
        return 0;
    }
    if (arg1 != -1) {
        D_80129560[arg1] = p[1];
    }
    if (arg2 != -1) {
        D_80129560[arg2] = p[0];
    }
    if (arg3 != -1) {
        D_80129560[arg3] = p[2];
    }
    return 1;
}
