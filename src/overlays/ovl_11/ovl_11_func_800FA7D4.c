#include "common.h"

void ovl_11_func_800FA87C(s32 arg0, s16 arg1, s16 arg2, s16 arg3);

void ovl_11_func_800FA7D4(s32 arg0, s16 arg1) {
    s16 var_a3;
    s32 var_s0;

    for (var_s0 = 0; var_s0 < 0x1E; var_s0++) {
        var_a3 = 2;
        if ((arg1 + var_s0) % 7 != 0) {
            var_a3 = (arg1 + var_s0) % 7 == 6;
        }
        ovl_11_func_800FA87C(arg0, var_s0, arg1, var_a3);
    }
}
