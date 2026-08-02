#include "common.h"

s32 func_80011F5C(s32);
void func_80011FD8(s32);
s32 func_800165D8(s32, s32, s32, s32, s32, s32, s32, s32, s32, s32, s32, s32, s32, s32, s32);

void func_800160C8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5, s32 arg6, s32 arg7, u16 arg8, s16 arg9, s16 arg10, s16 arg11, s16 arg12) {
    s32 temp_a2;
    s32 temp_s3;

    temp_a2 = arg2 & 0xFF;
    temp_s3 = arg3 & 0xFF;
    func_80011FD8(func_800165D8(arg0, func_80011F5C(0), arg1, temp_a2, temp_s3, (s32)arg4, (s32)arg5, arg6, arg6, arg7, (s32)arg8, (s32)arg9, (s32)arg10, (s32)arg11, (s32)arg12));
}
