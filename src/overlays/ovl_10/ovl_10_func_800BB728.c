#include "common.h"

s32 ovl_10_func_800BB728(s32 arg0) {
    s32 var_v0 = 0;
    s32 q;

    if (arg0 < 0x51) {
        if (((arg0 / 40) * 0x28) != (arg0 - 1)) {
            var_v0 = 0;
            goto ret;
        }
        goto block_4;
    }

    q = (arg0 - 0x50) / 15;
    arg0 -= 0x50;
    var_v0 = 0;
    if ((q * 0xF) == arg0 - 1) {
block_4:
        var_v0 = 1;
    }
ret:
    return var_v0;
}
