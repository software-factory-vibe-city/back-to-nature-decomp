#include "common.h"
#include "game_types.h"

void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_11_func_800FDFF4(u16 arg0, s16 arg1, s16 arg2) {
    if (arg0 >= 5) {
        arg0 = 4;
    }
    func_80015EE8(D_8005E3C0->field_D8 + 0x68, ((s32)(&D_8012CEB8)), D_8012737C[arg0 * 2], 0, arg1, arg2);
}
