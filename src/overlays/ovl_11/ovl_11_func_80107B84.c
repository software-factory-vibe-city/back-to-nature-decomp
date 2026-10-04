#include "common.h"

s32 ovl_11_func_80107BE4(s32 arg0, s16 arg1, s16 arg2);
s32 ovl_11_func_800C1224(s16 arg0, s16 arg1);

s32 ovl_11_func_80107B84(s32 arg0) {
    u8 *base;
    s16 v0;
    s16 v1;

    base = (u8 *)&D_8006C838;
    v0 = *(s16 *)(base + 0x44BA);
    v1 = *(s16 *)(base + 0x44BC);
    if (ovl_11_func_80107BE4(arg0, v0, v1) == 1) {
        return 0;
    }
    return ovl_11_func_800C1224(v0, v1) != 0;
}
