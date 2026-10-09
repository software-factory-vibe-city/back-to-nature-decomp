#include "common.h"

s32 ovl_11_func_800C3548(s32 arg0);

s32 ovl_11_func_800F1744(u8 arg0, u16 arg1, s32 arg2) {
    s32 temp_s0;
    s32 var_a0;
    u16 var_v1;
    u32 temp_s1;

    temp_s0 = arg0 & 0xFF;
    temp_s1 = arg1 & 0xFFFF;
    if (temp_s0 == 0xFF) {
        return 1;
    }
    if (temp_s0 == 0x32) {
        char *base = (char *) &D_8006C838;
        var_v1 = *(u16 *) (base + 0x8000 + 0x12B2);
    } else if (temp_s0 == 0x33) {
        char *base = (char *) &D_8006C838;
        var_v1 = *(u16 *) (base + 0x8000 + 0x11C2);
    } else {
        if (ovl_11_func_800C3548(temp_s0) == 0) {
            char *base = (char *) &D_8006C838;
            char *q = base + temp_s0 * 0x1D4;
            var_v1 = *(u16 *) (q + 0x8000 + 0x19EA);
        } else {
            char *base = (char *) &D_8006C838;
            char *q = base + temp_s0 * 0x1D4;
            var_v1 = *(u16 *) (q + 0x8000 + 0x19EC);
        }
    }
    var_a0 = 0;
    if (arg2 & 0x4000) {
        var_a0 = temp_s1 >= var_v1;
    } else if (var_v1 >= temp_s1) {
        var_a0 = 1;
    }
    return var_a0;
}
