#include "common.h"

extern s8 D_801273E4;

void ovl_11_func_800BCF28(void);
void func_800226F0(void);

void ovl_11_func_80103714(void) {
    char *base;

    D_801273E4 = 0;
    base = (char *)&D_8006C838;
    *(s32 *)(base + 0xC) |= 0x40000;
    ovl_11_func_800BCF28();
    func_8001FABC(3);
    *(s32 *)(base + 0x5234) |= 0x2000;
    func_800226F0();
}
