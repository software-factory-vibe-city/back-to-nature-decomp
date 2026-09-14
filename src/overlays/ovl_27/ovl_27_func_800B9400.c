#include "common.h"
#include "game_types.h"

void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_27_func_800B9400(s16 arg0) {
    func_80015EE8(D_8005E3C0->field_D8 + 0x88, ((s32)(&D_800C4BD0)), 0x21, 0, arg0, 0);
}
