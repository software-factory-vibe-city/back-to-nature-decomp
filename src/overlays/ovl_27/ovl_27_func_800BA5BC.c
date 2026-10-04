#include "common.h"

/* Callee prototype as the original caller TU saw it. */
u8 *func_80014CBC(s32 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5);

void ovl_27_func_800BA5BC(void) {
    DrawSync(0);
    ClearOTagR((unsigned long *)D_8005E3C0->field_120, 0x800);
    func_80014CBC(0, 0x25000, 0x5800, (u8 *)(D_8005E3B0 + 0x4290), 1, 1);
}
