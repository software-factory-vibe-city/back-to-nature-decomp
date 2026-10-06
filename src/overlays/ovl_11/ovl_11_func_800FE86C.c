#include "common.h"

void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_11_func_800FE86C(s32 arg0, s16 arg1, s16 arg2, s16 arg3) {
    s16 var_a2;
    s32 i;

    var_a2 = arg2;
    for (i = 0; i < arg0; i++) {
        func_80015EE8(D_8005E3C0->field_D8 + 0x68, ((s32) D_8012CE88), (u8) arg1, 0, var_a2, arg3);
        var_a2 -= 8;
    }
}
