#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

/* D_80137828 is an ovl_15 data word not yet classified by the generated
 * globals; the target loads it absolutely (lui + lw) and passes the loaded
 * pointer to func_80014CBC. */
extern u8 *D_80137828;

/* Callee prototype as the original caller TU saw it: the result is tested as
 * a full word and arg4/arg5 are plain words in the outgoing area. */
s32 func_80014CBC(s16 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5);

s32 ovl_15_func_80137300(void) {
    s32 temp_v0;

    DrawSync(0);
    ClearOTagR((u_long *)D_8005E3C0->field_120, 0x800);
    func_80014CBC(0x10, 0, 0x900, D_80137828, 1, 1);
    do {
        temp_v0 = func_80014CBC(0x10, 0, 0x900, D_80137828, 1, 0);
    } while (temp_v0 == 0);
    return temp_v0;
}
