#include "common.h"

s32 func_80013394(void);

void func_8001AF70(u16 arg0, u16 arg1);

s32 ovl_11_func_800E7660(s32 arg0, s32 arg1, s32 arg2) {
    s16 var_a0;
    s16 var_a1;
    s16 var_a3;
    s16 var_t0;
    s32 var_s0;
    s32 var_v0;

    var_t0 = ((struct struct_8006C838_time *)D_8006C838)->field_44C0;
    var_a0 = arg0;
    var_a1 = arg1;
    if (var_a0 == -1) {
        if (var_t0 == 6) {
            if (((struct struct_8006C838_time *)D_8006C838)->field_44C2 == 0) {
                if (func_80013394() == 0) {
                    return 1;
                }
            }
        }
        return 0;
    }
    if (arg2 & 1) {
        var_a0 = *(s16 *)((u8 *)D_80129560 + (var_a0 * 4));
    }
    var_a3 = var_a0;
    if (arg2 & 2) {
        var_a1 = *(s16 *)((u8 *)D_80129560 + (var_a1 * 4));
    }
    if (var_a0 < 6) {
        var_a3 = var_a0 + 0x18;
    }
    if (var_t0 < 6) {
        var_t0 += 0x18;
    }
    var_s0 = 0;
    if ((var_a3 < var_t0) || ((var_a3 == var_t0) && (((struct struct_8006C838_time *)D_8006C838)->field_44C2 >= var_a1))) {
        var_s0 = 1;
    }
    var_v0 = var_s0;
    if (var_s0 == 1) {
        ((struct struct_8006C838_800E7660 *)D_8006C838)->field_51EA = -1;
        func_8001AF70(0x46U, 0U);
        var_v0 = var_s0;
    }
    return var_v0;
}
