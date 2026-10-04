#include "common.h"
#include "game_types.h"

void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_11_func_800FE704(void) {
    s32 v = (((s16)D_80127212) / 30) & 0xFF;

    func_80015EE8(D_8005E3C0->field_D8 + 0x68, ((s32)(&D_8012CE88)), 1, v, 0x120,
                  0x30);
}
