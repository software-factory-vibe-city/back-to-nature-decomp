#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, s8 arg1);
void func_8001585C(ObjectState *obj, s8 arg1);
void func_80015F80(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5, s32 arg6, s32 arg7, u16 arg8);

void ovl_11_func_800F6F7C(s32 arg0, s16 arg1, s16 arg2) {
    func_80015840((ObjectState *)&D_800A0728, 0xB);
    func_8001585C((ObjectState *)&D_800A0728, 0);
    func_80015F80(arg0, (s32)&D_800A0728, (s32)*(u8 *)((u8 *)&D_800A0728 + 4), (s32)*(u8 *)((u8 *)&D_800A0728 + 5), arg1, arg2, 0x1000, 0, 0);
}
