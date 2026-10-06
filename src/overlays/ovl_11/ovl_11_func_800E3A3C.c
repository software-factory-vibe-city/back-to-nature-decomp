#include "common.h"

s32 ovl_11_func_800E3A3C(void) {
    char *base;
    s32 idx;
    s32 result;
    s32 (**pp)(void);

    base = (char *)&D_8006C838;
    *(s32 *)(base + 0x522C) = 0;
    *(s32 *)(base + 0x5230) = 0;
    idx = *(s32 *)(base + 0x7A74);
    pp = &D_800B9920[idx];
    result = (*pp)();
    *(s32 *)(base + 0x4450) &= ~0x20;
    return result;
}
