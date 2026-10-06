#include "common.h"

extern s16 D_80070C70;

s32 ovl_11_func_800E6D2C(s16 arg0, s16 arg1, s32 arg2, s32 arg3);
s32 ovl_11_func_800E6BDC(s16 arg0, s32 arg1, s32 arg2, s32 arg3);
s32 ovl_11_func_800E6CAC(s16 arg0, s16 arg1, s32 arg2, s32 arg3);

s32 ovl_11_func_800E6B18(s16 arg0, s32 arg1, s32 arg2) {
    char *far_base;

    if ((arg1 << 0x10) != 0) {
        ovl_11_func_800E6D2C(1, 0x30, 1, 0);
    }
    far_base = (char *)&D_8007AFF0;
    if ((*(s32 *) (far_base + 0x2549C)) != arg0) {
        D_80070C70 = arg0;
        goto fail;
    }
    if (arg2 == 1) {
        ovl_11_func_800E6BDC(0, 0, 0, 0);
        return 1;
    }
    if (arg2 == -1) {
        ovl_11_func_800E6CAC(0, 2, 0, 0);
        return 1;
    }
    return 1;
fail:
    return 0;
}
