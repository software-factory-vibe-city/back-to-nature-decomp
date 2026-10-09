#include "common.h"

extern s16 D_80071A8A;
extern s16 D_801248CC[][5];

s32 ovl_11_func_800D60D4(s16 *arg0);
s32 ovl_11_func_800EC354(s16 arg0, s16 arg1, s32 arg2, s32 arg3);

s16 ovl_11_func_800F0734(s16 arg0, s32 arg1, s16 arg2) {
    s16 var_s0;
    s16 var_v0;

    var_s0 = D_801248CC[arg1][arg2];
    if (ovl_11_func_800D60D4(&D_80071A8A) != 0) {
        if (arg1 & 1) {
            var_v0 = var_s0 + 0x14;
        } else {
            var_v0 = var_s0 + 2;
        }
        var_s0 = var_v0;
    }
    if (ovl_11_func_800EC354(arg0, 0, -1, -1) != 0) {
        var_s0 *= 5;
    }
    return var_s0;
}
