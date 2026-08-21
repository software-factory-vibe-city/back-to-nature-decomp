#include "common.h"

void func_80024A4C(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4);

u8 D_8005E5D0;

void func_80024770(s32 arg0, s16 arg1, s16 arg2) {
    func_80024A4C(arg0, 0x29, D_8005E5D0 / 30, arg1, arg2);
}
