#include "common.h"

s32 ovl_11_func_80111CC4(s16 arg0, s16 arg1) {
    s16 temp_v0;
    s32 temp_a1;
    s32 var_a2;

    var_a2 = 3;
    temp_v0 = arg1 + 2;
    if ((u32) (arg0 - 5) < 2U) {
        var_a2 = 0;
    }
    temp_a1 = arg0 < arg1;
    if (arg0 >= 7) {
        if (temp_a1 != 0) {
            var_a2 = 1;
            goto block_5;
        }
        goto block_6;
    }
block_5:
    if (temp_a1 == 0) {
block_6:
        if (arg0 < temp_v0) {
            var_a2 = 2;
        }
    }
    return var_a2;
}
