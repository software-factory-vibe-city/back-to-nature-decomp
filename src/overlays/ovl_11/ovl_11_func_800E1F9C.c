#include "common.h"

s32 *ovl_11_func_800D0CD8(void);
s32 ovl_11_func_800E2934(void *arg0);
s32 ovl_11_func_800E2968(s16 *arg0, s32 arg1);
void ovl_11_func_800D075C();

s16 *ovl_11_func_800E1F9C(s32 arg0, s32 arg1, s32 arg2) {
    u16 *var_a0;
    u16 *var_s0_2;
    u16 *var_v0;
    u16 *var_v1;
    s32 *var_s0;
    s32 var_s1;

    var_s1 = 0;
    if ((u32) (arg0 - 0x109) >= 2U) {
        goto ret;
    }
    if (arg2 == 1) {
        if (arg1 != -1) {
            var_s0 = (s32 *) ((u8 *) &D_800742EC + (arg1 * 0xB4));
        } else {
            var_s0 = ovl_11_func_800D0CD8();
        }
        if (var_s0 == 0) {
            return 0;
        }
        var_s1 = ovl_11_func_800E2934(var_s0);
        ovl_11_func_800E2968((s16 *) var_s0, arg0);
        ovl_11_func_800D075C((s32) var_s0, (s16) var_s1, 0);
        return (s16 *) var_s0;
    }
    var_s0_2 = &D_80075FE4;
    if (D_80075FE4 != 0) {
        var_a0 = &D_80075FE4;
        var_v1 = &D_80075FE4;
loop_9:
        var_a0 += 0x5A;
        var_s1 += 1;
        var_v1 += 0x5A;
        if (var_s1 < 3) {
            var_s0_2 = var_v1;
            if (*var_a0 != 0) {
                goto loop_9;
            }
        }
    }
    if (var_s1 == 3) {
ret:
        return 0;
    }
    ovl_11_func_800E2968((s16 *) var_s0_2, arg0);
    var_v0 = var_s0_2;
    return (s16 *) var_v0;
}
