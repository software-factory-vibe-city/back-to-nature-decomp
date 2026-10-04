#include "common.h"

s32 func_8001AF44(u32 arg0);

void ovl_11_func_800C087C(s32 arg0);

void func_8001AF70(u16 arg0, u16 arg1);

void ovl_11_func_800DE46C(void) {
    char *base;

    if (func_8001AF44(0x49) != 0) {
        base = (char *)&D_8006C838;
        *(u16 *)(base + 0x51F4) = *(u16 *)(base + 0x44CA);
        *(s32 *)(base + 0x4450) |= 4;
        ovl_11_func_800C087C(0x168);
        func_8001AF70(0x49, 0);
    }
}
