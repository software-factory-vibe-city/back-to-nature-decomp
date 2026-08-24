#include "common.h"

extern s32 *D_80127FD4[5];

s32 ovl_11_func_80112A84(void) {
    s32 **base = &D_80127FD4[0];
    s16 *p = (s16 *)D_8006C838;

    return base[p[0x73BB]];
}
