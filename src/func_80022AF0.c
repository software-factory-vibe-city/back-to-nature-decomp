#include "common.h"

extern s16 D_8005597C[];
u32 D_8005E5AC;

s16 func_80022AF0(void) {
    u32 var_v1;

    var_v1 = D_8005E5AC;
    if (var_v1 >= 5U) {
        var_v1 = 0;
    }
    return D_8005597C[var_v1];
}
