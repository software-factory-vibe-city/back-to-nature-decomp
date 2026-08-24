#include "common.h"

s32 ovl_11_func_800CD534(s32 arg0) {
    s32 var_v0;

    var_v0 = -((arg0 / 60) * 2) - 5;
    if (var_v0 < -0x80) {
        var_v0 = -0x80;
    }
    return var_v0;
}
