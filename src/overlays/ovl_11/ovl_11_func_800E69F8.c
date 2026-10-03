#include "common.h"

s32 ovl_11_func_800EFE34(s32 *ptr, s32 arg1, s32 arg2);

s32 ovl_11_func_800E69F8(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 *ptr;
    s32 temp_a1;

    ptr = &D_80129560[arg0];
    if (arg1 != 0) {
        temp_a1 = D_80129560[arg2];
    } else {
        temp_a1 = arg2;
    }
    ovl_11_func_800EFE34(ptr, temp_a1, arg3);
    return 1;
}
