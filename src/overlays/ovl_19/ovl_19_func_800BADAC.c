#include "common.h"

extern s32 D_800BCFF8[];

s32 ovl_19_func_800BADAC(s16 arg0) {
    s16 idx;

    if (arg0 >= 0) {
        idx = (arg0 < 20) ? arg0 : 19;
    } else {
        idx = 0;
    }
    return D_800BCFF8[idx];
}
