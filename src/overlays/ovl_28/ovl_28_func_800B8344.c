#include "common.h"

s32 func_80013394(void);
s32 func_8001FE6C(void);
s32 func_8001FBBC(s16 arg0);
s32 func_80020818(void);
s32 func_80020B80(s32 arg0, s32 arg1);

s32 ovl_28_func_800B8344(void) {
    s32 *base;
    u8 x;
    s32 ret;

    x = (func_80013394() ^ 1) == 0;
    if (func_8001FE6C() == 0) {
        x = (x + 1) & 0xFF;
    }
    ret = 2;
    if (x == 2) {
        func_8001FBBC(0);
        func_80020818();
        func_80020B80(2, 0);
        base = (s32 *)&D_8006C838;
        ret = base[0x4488 >> 2] + 1;
        base[0x4488 >> 2] = ret;
    }
    return ret;
}
