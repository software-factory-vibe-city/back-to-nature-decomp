#include "common.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void func_80024A10(s32 arg0, s16 arg1, s16 arg2, s16 arg3);
u16 *func_8001AA7C(s32 arg0, u16 *arg1);

void ovl_11_func_800FA6CC(s32 arg0, s16 arg1, s16 arg2) {
    s16 var_a0;
    s16 var_s2;

    var_s2 = arg2;
    *(u16 *) func_8001A970(arg1 + 1, &D_80129FF0, 2) = 0xFFFF;
    func_80017B3C(arg0, (s32) &D_80129FF0, 0x1F, 0x34);
    func_80017B3C(arg0, (s32) ((void *) ((u8 *) &D_80051B9A + *D_80054BBC)), 0x39, 0x34);
    if (var_s2 >= 0) {
        var_a0 = (var_s2 < 4) ? var_s2 : 3;
    } else {
        var_a0 = 0;
    }
    var_s2 = var_a0;
    func_80024A10(arg0, 0x8E, 0x34, var_s2);
    *func_8001AA7C((s32) var_s2, (u16 *) &D_80129FF0) = 0xFFFF;
    func_80017B3C(arg0, (s32) &D_80129FF0, 0x9E, 0x34);
}
