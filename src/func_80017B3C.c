#include "common.h"

/* Game callees. */
extern s32 func_80011F5C(s32 arg0);
extern void func_80011FD8(s32 arg0);
extern s32 func_80018B98(s32 arg0, s32 arg1, s32 arg2, s16 arg3, s16 arg4,
                         s32 arg5, s32 arg6, s32 arg7, s32 arg8, s32 arg9);

void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 x = (s16)arg2;
    s32 y = (s16)arg3;

    func_80011FD8(func_80018B98(arg0, func_80011F5C(0), arg1, x, y, 0x1000, 0,
                                0, 0, 0));
}
