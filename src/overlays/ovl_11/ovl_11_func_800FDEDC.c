#include "common.h"

extern s16 D_800719FE;

s32 ovl_11_func_800FDFD8(s16 arg0);
s32 ovl_11_func_800FDFA8(s16 arg0);

s16 ovl_11_func_800FDEDC(s16 arg0) {
    s32 (*var_s2)(s16);
    s32 var_s5;
    s16 var_s3;
    s32 var_s0;

    var_s3 = 1;
    if ((u32) (D_800719FE - arg0) < 5U) {
        var_s2 = ovl_11_func_800FDFD8;
        var_s5 = 1;
    } else {
        var_s2 = ovl_11_func_800FDFA8;
        var_s5 = 0;
    }
    var_s0 = 0;
    do {
        if (var_s2((s16) (arg0 + var_s0)) == 1) {
            var_s3 = var_s0 + 1;
        }
        var_s0 += 1;
    } while (var_s0 < 5);
    if (var_s5 != 0) {
        var_s3 = -var_s3;
    }
    return var_s3;
}
