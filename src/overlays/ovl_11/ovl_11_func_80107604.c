#include "common.h"

s32 ovl_11_func_800C3548(s32 arg0);
s32 ovl_11_func_80107B54(s32 arg0, s32 arg1);

s32 ovl_11_func_80107604(s32 arg0, s32 arg1) {
    s32 var_a0;
    s32 var_a1;
    s32 var_a1_2;
    s32 var_a3;
    s32 var_a2;
    char *p;
    char *base;
    char *base_1;

    if (ovl_11_func_800C3548((s16)arg0) == 1) {
        base = (char *)&D_8006C838;
        p = base + arg0 * 0x1D4;
        p += 0x8000;
        var_a2 = *(u16 *)(p + 0x19EC);
        var_a1_2 = 0x2710;
        var_a3 = 0x7530;
    } else {
        base_1 = (char *)&D_8006C838;
        p = base_1 + arg0 * 0x1D4;
        p += 0x8000;
        var_a2 = *(s16 *)(p + 0x19EA);
        var_a1_2 = 0x64;
        var_a3 = 0xC8;
    }
    switch (arg1) {
    case 0:
        if (var_a1_2 >= var_a2) {
            var_a0 = 0xA;
            var_a1 = 0x12;
        } else {
            var_a0 = 6;
            if (var_a3 >= var_a2) {
                var_a0 = 8;
                var_a1 = 0x14;
            } else {
                var_a1 = 0x16;
            }
        }
        return ovl_11_func_80107B54(var_a0, var_a1);
    case 1:
        return var_a1_2 >= var_a2;
    case 2:
        return var_a3 >= var_a2;
    case 3:
        var_a0 = 0x12;
        if (var_a1_2 >= var_a2) {
            return 1;
        }
        var_a1 = 0x18;
        return ovl_11_func_80107B54(var_a0, var_a1);
    case 4:
        return 0;
    default:
        return 0;
    }
}
