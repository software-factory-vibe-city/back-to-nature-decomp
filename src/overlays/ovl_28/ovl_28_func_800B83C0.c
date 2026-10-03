#include "common.h"

void func_80011EF0(s32);

void ovl_28_func_800B83C0(void) {
    char *base;
    char *hi;

    base = (char *)&D_8006C838;
    *(s32 *)(base + 0x4488) = 0;
    hi = base + 0x8000;
    if (*(u16 *)(hi + 0x67A0) >= 10) {
        func_80011EF0(0xD);
    } else {
        func_80011EF0(0x14);
    }
}
