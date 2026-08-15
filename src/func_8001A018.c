#include "common.h"
#include "psyq/libapi.h"

/* GP-relative CD table state reached GP-relatively by this TU.
 * Tentative definitions merged via -fcommon with sibling definitions. */
u32 D_8005E440;
u32 D_8005E45C;
s16 D_8005E460;
u32 D_8005E46C;

/* Callee prototypes as the original caller TU saw them. func_80014CBC took
 * plain words for arg4/arg5 (sw into the outgoing area), the same ABI
 * placement as the 4-byte aggregate ReadFlag parameters in its definition. */
u8 *func_80014CBC(s32 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5);
s32 *func_80021FE4(void);

void func_8001A018(s32 arg0, s32 arg1) {
    s32 slot;
    s32 offset;
    u8 *buf;

    slot = (s16) arg0;
    if (slot == D_8005E460) {
        return;
    }
    if (slot < 0) {
        return;
    }
    offset = slot * 3 * 2048;
    if (arg1 != 0 && D_8005E45C != 0) {
        goto retry;
    }
    if (func_80021FE4() == NULL) {
        SystemError(0x54, 0);
    }
    func_80014CBC(1, offset, 0x1800, (u8 *)&D_8006C910, 1, 1);
    D_8005E45C = 1;
    D_8005E440 = slot;
retry:
    while (1) {
        buf = func_80014CBC(1, offset, 0x1800, (u8 *)&D_8006C910, 1, 0);
        D_8005E46C = (u32) buf;
        if (buf != NULL) {
            D_8005E460 = *(u16 *)&D_8005E440;
            return;
        }
        if (arg1 != 0) {
            return;
        }
    }
}
