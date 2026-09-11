#include "common.h"

s32 ovl_11_func_800E6914(s16 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 temp_a1;
    s32 temp_a2;
    s32 temp_a3;

    temp_a1 = D_80129560[(s16)arg1];
    if (arg0 & 1) {
        temp_a2 = D_80129560[arg2];
    } else {
        temp_a2 = arg2;
    }
    if (arg0 & 2) {
        temp_a3 = D_80129560[arg3];
    } else {
        temp_a3 = arg3;
    }
    return temp_a1 >= temp_a2 && temp_a3 >= temp_a1;
}