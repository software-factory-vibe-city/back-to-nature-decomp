#include "common.h"

void func_80021FD0(void) {
    s32 *base;

    base = &D_8006C838;
    *(s32 *)((char *)base + 0x4488) = 0;
    *(s32 *)((char *)base + 0x448C) = 0;
}
