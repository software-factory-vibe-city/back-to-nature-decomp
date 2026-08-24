#include "common.h"

s32 ovl_11_func_800F3BA0(u16 arg0) {
    u16 current;

    current = D_80070D40;
    if (current < arg0)
        return 0;

    D_80070D40 = current - arg0;
    return 1;
}
