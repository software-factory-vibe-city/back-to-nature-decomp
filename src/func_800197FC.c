#include "common.h"

s32 func_80018B98(s32, s32, u16 *, s16, s16, s32, s32, s32, s32, s32); /* extern */

void func_800197FC(s32 arg0, s32 arg1, s32 arg2, s16 arg3, s16 arg4, s16 arg5, s32 arg6, s16 arg7) {
    s32 temp_s0;
    s32 temp_s1;

    func_80017A38(arg7, 0);
    temp_s0 = (s32) (arg5 - func_800198E0(arg2, arg6, arg7)) / 2;
    temp_s1 = (s32) arg3 + temp_s0;
    func_80011FD8(func_80018B98(arg0, func_80011F5C(0), arg2, (s16) temp_s1, arg4, arg6, 0, 0, 0, 0));
    func_80011F5C(0);
}
