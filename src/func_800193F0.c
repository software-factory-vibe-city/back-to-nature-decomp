#include "common.h"

/* Extern callees (matched definitions: src/func_800191B4.c, src/func_8001945C.c). */
s32 func_800191B4(u16 *arg0, u16 arg1, s32 arg2, s32 arg3);
s32 func_8001945C(u16 *arg0, u16 arg1, s16 arg2);

/* Shared u16 global — tentative definition (project idiom for GP-relative
 * access; also defined in func_80019030.c and func_80018B98.c). */
u16 D_8005E444;

s32 func_800193F0(u16 *arg0, s32 arg1) {
    s32 result;
    s32 temp;

    result = func_800191B4(arg0, 0xFFFE, arg1, 0);
    temp = (func_8001945C(arg0, 0xFFFE, 0) + 1) & 0xFFFF;
    if (result != 0) {
        result += 2;
        D_8005E444 -= temp;
    }
    return result;
}
