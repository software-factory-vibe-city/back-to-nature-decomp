#include "common.h"

/* Callee prototype as the original caller TU saw it: arg4/arg5 are plain
 * words in the outgoing area (functions.h holds the callee-side 4-byte
 * aggregate type). */
u8 *func_80014CBC(s32 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5);

void ovl_19_func_800BB848(void) {
    DrawSync(0);
    ClearOTagR(D_8005E3C0->field_120, 0x800);
    func_80014CBC(0, 0, 0x2000, (u8 *)(D_8005E3B0 + 0x4290), 1, 1);
    do {
    } while (func_80014CBC(0, 0, 0x2000, (u8 *)(D_8005E3B0 + 0x4290), 1, 0) == 0);
    func_8001719C((u8 *)(D_8005E3B0 + 0x4290));
}
