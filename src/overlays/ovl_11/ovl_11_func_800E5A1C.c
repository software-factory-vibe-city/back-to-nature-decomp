#include "common.h"

s32 ovl_11_func_800E5A1C(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 limit;
    s32 var_t4;

    var_t4 = 0;
    limit = D_80129560[arg1];
    if (arg2 != 0 ? D_80129560[arg0] / 2 < limit : arg0 / 2 < limit) {
        var_t4 = 1;
    }
    if (arg3 == 0 || (D_8006C844 & 0x8000000) == 0) {
        D_80129560[arg1] += 1;
    }
    return var_t4;
}
