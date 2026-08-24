#include "common.h"

extern s16 D_80070CF2;

s32 ovl_11_func_800D2E20(void) {
    switch (D_80070CF2) {
    case 0:
    default:
        return 1;
    case 1:
        return 2;
    case 2:
        return 4;
    case 3:
        return 8;
    }
}
