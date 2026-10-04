#include "common.h"

/* Callee prototype as the original caller TU saw it. */
u8 *func_80014CBC(s32 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5);

void ovl_28_func_800B8B0C(void) {
    DrawSync(0);
    ClearOTagR((unsigned long *)D_8005E3C0->field_120, 0x800);
    func_80014CBC(0, 0x3D77000, 0x6000, (u8 *)(D_8005E3B0 + 0x4290), 1, 1);
}
