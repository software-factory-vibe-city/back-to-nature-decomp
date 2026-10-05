#include "common.h"

s32 func_80012A34(s32 arg0);

void ovl_11_func_800C056C(void) {
    char *base;
    char *base2;
    char *far_base;
    u16 val;
    s32 r;

    base = (char *)&D_8006C838;
    if (*(u32 *)(base + 0xC) & 0x08000000) {
        return;
    }
    base2 = base + 0x8000;
    val = *(u16 *)(base2 + 0x64C8);
    if ((u32)(val - 3) >= 2) {
        return;
    }
    if ((*(u32 *)(base + 0x8) & 7) != 3) {
        return;
    }
    r = func_80012A34(0x64);
    far_base = (char *)&D_8007AFF0;
    *(u16 *)(far_base + 0x253B8) = *(u16 *)(far_base + 0x253B8) - (r - 0x32);
}
