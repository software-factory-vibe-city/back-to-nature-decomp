#include "common.h"

s32 ovl_11_func_800CD578(s32 arg0) {
    s32 var_v1;

    var_v1 = ((arg0 / 60) * 7) + 0x32;
    if (var_v1 >= 0x80) {
        var_v1 = 0x7F;
    }
    return var_v1;
}
