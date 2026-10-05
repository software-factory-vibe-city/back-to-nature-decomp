#include "common.h"
#include "game_types.h"

extern s16 D_8012A028;

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);

void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

void ovl_11_func_800FCAF4(s16 arg0, s16 arg1, s16 arg2) {
    s16 var_a0;

    var_a0 = arg0;
    if (var_a0 >= 0x3E8) {
        var_a0 = 0x3E7;
    }
    *((u16 *)func_8001A970((s32) var_a0, &D_8012A028, 3)) = 0xFFFF;
    func_80017B3C(D_8005E3C0->field_D8 + 0x54, (s32) &D_8012A028, (s32) arg1, (s32) arg2);
}
