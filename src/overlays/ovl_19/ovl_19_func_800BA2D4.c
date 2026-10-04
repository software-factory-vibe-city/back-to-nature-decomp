#include "common.h"

extern s16 D_800BF4D0[];

u32 func_80012A34(s32 arg0);

s32 ovl_19_func_800BA2D4(void) {
    s32 var_s0;

    if (D_800BF4D0[4] != D_800BF4D0[0x28]) {
        var_s0 = D_800BF4D0[4] <= D_800BF4D0[0x28];
        if (func_80012A34(100) >= 0x5B) {
            var_s0 = !var_s0;
        }
    } else {
        var_s0 = func_80012A34(2) != 0;
    }
    return var_s0;
}
