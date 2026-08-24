#include "common.h"

s32 ovl_11_func_801075C0(s32 arg0, s32 arg1) {
    char *base;
    char *p;

    base = (char *)&D_8006C838;
    p = base + arg0 * 0x1D4;
    return *(s16 *)(p + 0x8000 + 0x1A16) != arg1;
}
