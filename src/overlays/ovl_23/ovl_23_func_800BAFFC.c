#include "common.h"

s32 ovl_23_func_800BAFFC(s32 arg0) {
    s32 idx;

    idx = (0x28 - (arg0 / 4096 - 0x40) / 4) * 4;
    return D_8005E3C0->field_D8 + idx;
}
