#include "common.h"

s32 ovl_11_func_800E6CAC(s16 arg0, s16 arg1) {
    s32 var_s1;

    var_s1 = 0;
    if (arg1 == 0) {
        func_8001FE34(arg0 ? arg0 : 10);
    } else if (func_8001FE6C() == 0 || arg1 == 2) {
        func_8001FBBC(0);
        var_s1 = 1;
    }
    return var_s1;
}
