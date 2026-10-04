#include "common.h"

s32 ovl_11_func_800F2354(s32 arg0, s32 arg1);

s32 ovl_11_func_800E7CCC(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 selected;
    s16 temp;

    if (arg3 != 0) {
        selected = D_80129560[arg2];
    } else {
        selected = arg2;
    }
    temp = ovl_11_func_800F2354(selected, arg0);
    if (arg1 != -1) {
        D_80129560[arg1] = temp;
    }
    return temp == 0;
}
