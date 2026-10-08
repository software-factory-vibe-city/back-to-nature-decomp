#include "common.h"

void ovl_11_func_800C08E8(s32 arg0);

s32 ovl_11_func_800E99EC(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 var_a3;
    s32 var_t0;
    s16 var_t1;
    s32 temp_a0;
    s32 var_v0;

    if (arg3 & 1) {
        var_t0 = *(s16 *)((u8 *)D_80129560 + (arg0 * 4));
        var_t1 = var_t0;
    } else {
        var_t0 = arg0;
        var_t1 = var_t0;
    }
    if (arg3 & 2) {
        var_a3 = *(s16 *)((u8 *)D_80129560 + (arg1 * 4));
    } else {
        var_a3 = arg1;
    }
    if (arg2 != 0) {
        ovl_11_func_800C08E8((var_t0 * 0x3C) + var_a3);
        return 1;
    }
    if (((struct struct_8006C838_time *)D_8006C838)->field_44C0 < 6) {
        if (var_t0 >= 6) {
            return 0;
        }
    } else if (var_t0 < 6) {
        var_t1 = var_t0 + 0x18;
    }
    temp_a0 = ((var_t1 - ((struct struct_8006C838_time *)D_8006C838)->field_44C0) * 0x3C) + (var_a3 - ((struct struct_8006C838_time *)D_8006C838)->field_44C2);
    if (temp_a0 < 0) {
        var_v0 = 0;
    } else {
        ovl_11_func_800C08E8(temp_a0);
        var_v0 = 1;
    }
    return var_v0;
}
