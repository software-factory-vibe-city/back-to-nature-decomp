#include "common.h"

s32 func_80012A34(s32 arg0);

void ovl_11_func_800E78E4(s32 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 temp;

    temp = func_80012A34(arg0 & 0xFFFF);
    if (arg1 != -1) {
        D_80129560[arg1] = temp;
    }
    ovl_11_func_800EFDA0(temp, arg3, arg2);
}
