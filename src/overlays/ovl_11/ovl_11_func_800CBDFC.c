#include "common.h"

extern s32 D_80071A6C;

s32 ovl_11_func_800CBDFC(void) {
    s32 t = D_80071A6C & 0x20000000;
    return t == 0;
}
