#include "common.h"

s32 ovl_11_func_800E7504(s16 arg0, s16 arg1, s32 arg2, s32 arg3);

s32 ovl_11_func_800E946C(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s16 var_a0;
    s16 var_a1;
    s32 var_a2;
    s32 var_a3;

    if (arg0 != -1) {
        var_a0 = *((s16 *)&D_80129560[arg0]);
    } else {
        var_a0 = -1;
    }
    if (arg1 != -1) {
        var_a1 = *((s16 *)&D_80129560[arg1]);
    } else {
        var_a1 = -1;
    }
    if (arg2 != -1) {
        var_a2 = D_80129560[arg2];
    } else {
        var_a2 = -1;
    }
    if (arg3 != -1) {
        var_a3 = D_80129560[arg3];
    } else {
        var_a3 = -1;
    }
    ovl_11_func_800E7504(var_a0, var_a1, var_a2, var_a3);
    return 1;
}
