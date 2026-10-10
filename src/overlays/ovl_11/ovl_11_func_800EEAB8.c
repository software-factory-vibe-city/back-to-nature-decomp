#include "common.h"

s32 ovl_11_func_800EE7BC(s16 arg0, s16 arg1, s32 arg2, s32 arg3);

s16 ovl_11_func_800EEAB8(s16 arg0, s16 arg1, s32 arg2) {
    s32 *base;
    s32 *temp_a0;
    s32 *temp_s0;
    s32 var_t0;
    s32 var_v0;
    s32 var_v1;

    ovl_11_func_800EE7BC(1, arg0, 0, 0);
    base = D_80129560;
    temp_s0 = (s32 *) ((u8 *) base + (arg0 * 4));
    var_v1 = *temp_s0;
    if (var_v1 >= 0xA) {
        var_v1 = 0;
    }
    var_v0 = var_v1 < 5;
    var_t0 = 0;
    if (var_v0 == 0) {
        var_v1 -= 5;
        var_t0 = 1;
    }
    *temp_s0 = (s32) *((s16 *) ((u8 *) D_801249F8 + (var_v1 * 6)));
    *((s32 *) ((u8 *) base + (arg1 * 4))) = (s32) *((s16 *) ((u8 *) D_801249F8 + (var_v1 * 6) + 2));
    temp_a0 = (s32 *) ((u8 *) base + (arg2 * 4));
    *temp_a0 = (s32) *((s16 *) ((u8 *) D_801249F8 + (var_v1 * 6) + 4));
    if (var_t0 != 0) {
        *temp_s0 += 5;
        *temp_a0 += 5;
    }
    return 1;
}
