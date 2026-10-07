#include "common.h"

extern u8 D_8012CDF8[];

void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_11_func_800FE834(s16 arg0, s16 arg1, s16 arg2);

void ovl_11_func_800FC7F0(s32 arg0, s32 arg1, u8 arg2, u8 arg3, s32 arg4, s16 arg5, s16 arg6) {
    func_80015EE8(D_8005E3C0->field_D8 + 0x68, (s32)(D_8012CDF8 + arg1 * 0x30), arg2 & 0xFF, arg3 & 0xFF, arg5, arg6);
    func_80017B3C(D_8005E3C0->field_D8 + 0x54, arg4, (s16)(arg5 + 0x18), (s16)(arg6 + 2));
    ovl_11_func_800FE834((s16)arg0, (s16)(arg5 + 0x60), (s16)(arg6 + 0x10));
}
