#include "common.h"
#include "game_types.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void func_80024A10(s32 arg0, s16 arg1, s16 arg2, s16 arg3);

void ovl_11_func_800FD21C(s32 arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5) {
    s32 var_v1;
    s16 *base;

    for (var_v1 = 0; var_v1 < 0xF; var_v1++) {
        (&D_8012A028)[var_v1] = 0xFFD;
    }
    if (arg0 != 0) {
        D_8012A028 = 0x90;
    }
    base = &D_8012A028;
    base[4] = 0x71;
    func_8001A970((s32) arg2, base + 5, 2);
    base[8] = 0;
    base[9] = 0x26;
    base[10] = 0x24;
    *((u16 *)func_8001A970((s32) arg3, base + 0xB, 2)) = 0xFFFF;
    func_80017B3C(D_8005E3C0->field_D8 + 0x54, (s32) base, (s32) arg4, (s32) arg5);
    func_80024A10(D_8005E3C0->field_D8 + 0x68, (s16) (arg4 + 0x10), arg5, arg1);
}
