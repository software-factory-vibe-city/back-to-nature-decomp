#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

/* Callee prototypes as the original caller TU saw them. func_80014CBC took
 * plain words for arg4/arg5 (sw into the outgoing area). */
u8 *func_80014CBC(s32 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5);
void func_8001719C(u8 *arg0);

void ovl_25_func_800BAF20(void) {
    DrawSync(0);
    ClearOTagR((u32 *) D_8005E3C0->field_120, 0x800);
    func_80014CBC(0, 0, 0x2000, (u8 *)(D_8005E3B0 + 0x4290), 1, 1);
    do {

    } while (func_80014CBC(0, 0, 0x2000, (u8 *)(D_8005E3B0 + 0x4290), 1, 0) == 0);
    func_8001719C((u8 *)(D_8005E3B0 + 0x4290));
}
