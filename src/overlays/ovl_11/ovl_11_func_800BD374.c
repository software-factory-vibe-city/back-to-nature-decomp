#include "common.h"

extern s32 D_801217A8;

/* Callee prototype as the original caller TU saw it: arg4/arg5 are plain
 * words in the outgoing area (functions.h holds the callee-side 4-byte
 * aggregate type). */
u8 *func_80014CBC(s32 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5);

s32 ovl_11_func_800BD374(s32 arg0, s32 arg1) {
    u8 *temp_v1;
    s32 temp_a1;

    temp_v1 = (arg0 * 0x10) + (u8 *)&D_801217A8;
    temp_a1 = *(s32 *)temp_v1;
    return func_80014CBC(0, temp_a1, *(s32 *)(temp_v1 + 4) - temp_a1,
                         (u8 *)D_8007AFF0, 1, arg1) != 0;
}
