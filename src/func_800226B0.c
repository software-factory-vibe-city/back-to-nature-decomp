#include "common.h"

s32 D_8005E5B4;

s32 func_800226B0(void) {
    s32 temp_v1;
    s32 var_a0;

    temp_v1 = D_8005E5B4;
    var_a0 = 0;
    if (temp_v1 == 2) {
        var_a0 = 1;
    } else if (temp_v1 == 5) {
        var_a0 = 1;
    }
    return var_a0;
}
