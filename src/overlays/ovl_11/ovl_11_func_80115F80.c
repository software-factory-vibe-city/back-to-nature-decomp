#include "common.h"

s16 ovl_11_func_80115F38(void);

s32 ovl_11_func_80115F80(void) {
    s32 ret;
    u32 *var_a0;
    char *base;
    u32 word;

    ret = ovl_11_func_80115F38();
    base = (char *)&D_8006C838;
    base += 0x7AE8;
    var_a0 = (u32 *)base;
    word = var_a0[ret * 0x2D] & 0x40;
    return word != 0;
}
