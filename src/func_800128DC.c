#include "common.h"

/* TU-owned globals (GP-relative in target) */
s32 D_8005E380;
s32 D_8005E398;
struct_8005E3C0 *D_8005E3C0;

void func_800128DC(s32 arg0, s32 arg1) {
    s32 var_a1;
    s32 var_a2;

    if (arg0 == 0) {
        var_a1 = 0;
        if (arg1 == 0) {
            var_a1 = 1;
            var_a2 = 0x10000;
        } else {
            var_a2 = *(s32 *)((char *)D_8005E3C0 + 0x11C) * 2;
        }
        memcpy(D_8005E5E8[var_a1].field_130, (void *)D_8001009C, var_a2);
        D_8005E398 = 1;
        D_8005E380 = arg1;
        return;
    }
    var_a1 = 0;
    if (D_8005E380 == 0) {
        var_a1 = 1;
        var_a2 = 0x10000;
    } else {
        var_a2 = *(s32 *)((char *)D_8005E3C0 + 0x11C) * 2;
    }
    memcpy((void *)D_8001009C, D_8005E5E8[var_a1].field_130, var_a2);
    D_8005E398 = 0;
}
