#include "common.h"

void ovl_11_func_800BCF28(void) {
    char *base = (char *)&D_8006C838;

    *(s32 *)(base + 0xC) &= 0xE7FFFFFF;
    *(u16 *)(base + 0x51FE) |= 0x40;
}
