#include "common.h"

s32 ovl_11_func_80103D44(void) {
    s32 temp_a0;
    s32 temp_a0_2;
    s32 temp_v0;
    s32 var_s0;

    if (func_800226B0() != 0) {
        var_s0 = 0;
        temp_a0 = *(s32 *) ((u8 *) D_8005E3A8 + 0);
        if (temp_a0 & 0x1000) {
            var_s0 = -1;
        } else if (temp_a0 & 0x4000) {
            var_s0 = 1;
        }
        if (var_s0 != 0) {
            func_8001FABC(5);
            temp_v0 = D_8012742C + var_s0;
            D_8012742C = temp_v0;
            if (temp_v0 < 0) {
                D_8012742C = 6;
            }
            if (D_8012742C >= 7) {
                D_8012742C = 0;
            }
        }
        temp_a0_2 = *(s32 *) ((u8 *) D_8005E3A8 + 8);
        if (temp_a0_2 & 0x800) {
            if (ovl_11_func_80104394() == 1) {
                goto block_18;
            }
            goto block_19;
        }
        if (!(temp_a0_2 & 0x20)) {
            if (temp_a0_2 & 0x40) {
                if (D_8012742C != 6) {
                    D_8012CF1C = D_8012CF10[D_8012742C];
                    D_8012CF24 = D_8012CF20;
                    func_8001FABC(0);
                    return 2;
                }
                if (ovl_11_func_80104394() != 1) {
                    goto block_19;
                }
            } else {
                goto block_20;
            }
        }
block_18:
        func_8001FABC(1);
        return -1;
block_19:
        func_8001FABC(0);
        return 1;
    }
block_20:
    return 0;
}
