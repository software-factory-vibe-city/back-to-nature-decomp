#include "common.h"

s32 ovl_11_func_800D8320(s16 arg0, s16 arg1, s16 arg2, s16 arg3);

void ovl_11_func_800BF844(void) {
    u32 var_v1;
    u32 var_s0;

    for (var_v1 = 0; var_v1 < 0x19U; var_v1++) {
        for (var_s0 = 0; var_s0 < 0x2DU; var_s0++) {
            ovl_11_func_800D8320(0, (s16) var_s0, (s16) var_v1, 1);
        }
    }
}
