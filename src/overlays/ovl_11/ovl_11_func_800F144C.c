#include "common.h"

s32 ovl_11_func_800F144C(u16 arg0, u16 arg1, s16 *arg2) {
    s32 temp_a0;
    s32 var_a2;
    s32 var_t0;
    s32 var_v1;
    u32 var_a1;
    s32 temp_a3;

    temp_a0 = arg0 & 0xFFFF;
    var_a1 = arg1 & 0xFFFF;
    if ((temp_a0 == 0x1F) || (var_a1 == 0x1F)) {
        return 1;
    }
    temp_a3 = arg2[0];
    if (var_a1 >= 0x19U) {
        var_a1 = 0x18;
    }
    var_t0 = 0;
    if (var_a1 != 0) {
        for (var_a2 = 0; var_a2 < (s32) var_a1; var_a2++) {
            var_v1 = temp_a0 + var_a2;
            if (var_v1 >= 0x18) {
                var_v1 -= 0x18;
            }
            if (var_v1 == temp_a3) {
                var_t0 = 1;
                break;
            }
        }
    } else if ((temp_a0 == temp_a3) && (arg2[1] == 0)) {
        var_t0 = 1;
    }
    return var_t0;
}
