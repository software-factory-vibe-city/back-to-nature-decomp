#include "common.h"

extern s32 D_800BF88C;

s32 ovl_23_func_800BB040(s32 arg0) {
    s32 v;

    v = (s16)((HWD0 / 2) - (arg0 / 4096 - D_800BF88C / 4096));
    if (v < -HWD0 || v > HWD0) {
        return (s16)(-(u16)HWD0);
    }
    return v;
}
