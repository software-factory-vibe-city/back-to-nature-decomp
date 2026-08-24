#include "common.h"

extern s32 D_80070D30;

s32 ovl_11_func_800F3F7C(void) {
    if ((D_80070D30 & 0x04000400) == 0x400) {
        D_80070D30 |= 0x04000000;
        return 1;
    }
    return 0;
}
