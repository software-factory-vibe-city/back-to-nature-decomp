#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, s8 arg1);
void func_8001585C(ObjectState *obj, s32 arg1);
void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_11_func_800F7094(s32 arg0, s16 arg1, s16 arg2, s32 arg3) {
    s32 var_s1;

    func_80015840((ObjectState *)&D_800A0728, 0xA);
    arg1 += 2;
    arg2 += 0x16;
    func_8001585C((ObjectState *)&D_800A0728, 0xA);
    func_80015EE8(arg0, (s32)&D_800A0728, (s32)*(u8 *)((u8 *)&D_800A0728 + 4), (s32)*(u8 *)((u8 *)&D_800A0728 + 5), arg1, arg2);

    arg1 += 0xA;
    var_s1 = arg3 / 10;
    if (var_s1 != 0) {
        func_8001585C((ObjectState *)&D_800A0728, var_s1 & 0xFF);
        func_80015EE8(arg0, (s32)&D_800A0728, (s32)*(u8 *)((u8 *)&D_800A0728 + 4), (s32)*(u8 *)((u8 *)&D_800A0728 + 5), arg1, arg2);
    }

    arg1 += 0xA;
    func_8001585C((ObjectState *)&D_800A0728, (arg3 % 10) & 0xFF);
    func_80015EE8(arg0, (s32)&D_800A0728, (s32)*(u8 *)((u8 *)&D_800A0728 + 4), (s32)*(u8 *)((u8 *)&D_800A0728 + 5), arg1, arg2);
}
