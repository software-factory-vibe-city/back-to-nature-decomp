#include "common.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void ovl_11_func_800FA950(s16 arg0, s16 arg1, s16 *arg2, s16 *arg3);
u32 func_80017A64(void);
void func_80017A48(u32 arg0);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

void ovl_11_func_800FA87C(s32 arg0, s16 arg1, s16 arg2, s16 arg3) {
    s16 sp10;
    s16 sp12;
    u32 temp_s0;
    u32 var_a0;

    *((u16 *)func_8001A970(arg1 + 1, &D_80129FF0, 2)) = 0xFFFF;
    ovl_11_func_800FA950(arg1, arg2, &sp10, &sp12);
    temp_s0 = func_80017A64();
    var_a0 = 5;
    if (arg3 != 1) {
        var_a0 = temp_s0;
        if (arg3 == 2) {
            var_a0 = 4;
        }
    }
    func_80017A48(var_a0);
    func_80017B3C(arg0, (s32) &D_80129FF0, (s32) sp10, (s32) sp12);
    func_80017A48(temp_s0);
}
