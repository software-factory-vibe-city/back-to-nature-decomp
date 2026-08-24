#include "common.h"

extern s16 D_80071A22;

s32 ovl_11_func_800F19C8(s32 arg0) {
    return D_80071A22 == (arg0 & 0xFF);
}
