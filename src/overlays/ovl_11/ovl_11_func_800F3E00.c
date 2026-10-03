#include "common.h"

s32 ovl_11_func_800F3E00(u16 arg0) {
    u16 *base;
    s32 idx;

    base = D_800711C4;
    idx = ovl_11_func_800F3C9C(arg0);
    if (idx == -1) {
        return -1;
    }
    return base[idx];
}
