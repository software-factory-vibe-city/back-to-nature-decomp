#include "common.h"

extern s32 D_800719F8;
extern s32 ovl_11_func_800F3E00(u16 arg0);

void ovl_11_func_80112440(void) {
    s32 *base;

    base = &D_800719F8;
    *base &= ~1;

    if (ovl_11_func_800F3E00(0x5D) >= 0x33) {
        *base |= 1;
    }
}
