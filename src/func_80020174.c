#include "common.h"

extern s32 D_8005E550;

s32 func_80020174(s32 arg0, s32 arg1) {
    s32 idx;

    idx = D_8005E550;
    _D_8006BF48[idx] = arg0 * 2;
    _D_8006BF68[idx] = 1;
    _D_8006BF88[idx] = arg1;
    D_8005E550 = idx + 1;
    return 0;
}
