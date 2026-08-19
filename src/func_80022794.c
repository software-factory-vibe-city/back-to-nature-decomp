#include "common.h"

void func_80022580(u32 *arg0, s32 arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5);

s32 func_80022794(s32 arg0, s32 arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5, s32 *arg6, s32 arg7, s32 arg8) {
    s32 q1;
    s32 q2;
    s32 shifte;
    s32 var_a2;
    s32 var_a3;
    s32 var_t1;
    s32 var_v1;
    register s32 temp_v1 asm("$4");
    s32 prod;
    s32 r;
    s32 tmp6;
    s32 var_a0;
    s32 var_s0;
    s32 keep;

loop_1:
    var_a3 = arg3 + (arg5 / 2);
    var_a2 = arg2 + (arg4 / 2);
    shifte = arg5 << 11;
    q1 = shifte / arg7;
    q2 = (arg4 << 11) / 6;
    if (arg8 == 1) {
        var_a0 = *arg6;
        keep = *arg6;
    } else {
        tmp6 = *arg6 - 6;
        var_a0 = arg7 - tmp6;
        keep = *arg6;
    }
    if (var_a0 < 6) {
        prod = q2 * var_a0;
        if (prod < 0) {
            r = prod + 0xFFF;
        } else {
            r = prod;
        }
        r = r >> 12;
        var_a2 -= r;
        var_v1 = 4;
        var_t1 = r * 2;
    } else {
        prod = q1 * (var_a0 - 6);
        var_a2 = arg2;
        if (prod < 0) {
            temp_v1 = prod + 0xFFF;
        } else {
            temp_v1 = prod;
        }
        var_v1 = temp_v1 >> 12;
        __asm__("" : : "r"(prod));
        var_a3 -= var_v1;
        var_v1 = var_v1 * 2;
        var_t1 = arg4;
        if (var_v1 < 3) {
            *arg6 += 1;
            goto loop_1;
        }
        if (var_v1 < 4) {
            var_v1 = 4;
        }
    }
    var_s0 = arg7 + 6;
    if (keep >= var_s0) {
        if (arg8 == 1) {
            func_80022580(arg0, 0, arg2, arg3, (s32) arg4, (s32) arg5);
        }
        *arg6 = var_s0;
        return 1;
    }
    func_80022580(arg0, 0, var_a2, var_a3, (s32) var_t1, (s32) var_v1);
    *arg6 += 1;
    return 0;
}
