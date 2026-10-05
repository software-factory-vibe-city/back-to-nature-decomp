#include "common.h"

/* Callee prototype as the original caller TU saw it. */
void func_800245F4(s32 arg0, s16 arg1, s16 arg2);

void ovl_11_func_801170E4(s16 arg0, s32 arg1, s16 arg2, s16 arg3) {
    s16 var_a2;
    s32 var_s1;
    s32 temp_v0;
    s32 var_s0;

    var_a2 = arg2;
    if (arg0 > 0) {
        var_s1 = arg0;
        var_s0 = (var_a2 << 0x10) + 0xFFF80000;
        do {
            func_800245F4(arg1, var_a2, arg3);
            temp_v0 = var_s0 >> 0x10;
            var_s0 += 0xFFF80000;
            var_s1 -= 1;
            var_a2 = (s16) temp_v0;
        } while (var_s1 != 0);
    }
}
