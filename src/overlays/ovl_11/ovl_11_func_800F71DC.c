#include "common.h"

/* Callee prototype as the original caller TU saw it: arg4/arg5 are plain
 * words in the outgoing area (functions.h holds the callee-side 4-byte
 * aggregate type). */
u8 *func_80014CBC(s32 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5);

s32 ovl_11_func_800F71DC(s32 arg0) {
    return func_80014CBC(0, (arg0 << 0x10 >> 5) + 0x3C19000, 0x28000, D_8005E3B0 + 0x4290, 1, 1);
}
