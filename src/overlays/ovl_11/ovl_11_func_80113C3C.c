#include "common.h"

extern u8 D_8012D110[];

void ovl_11_func_80113C3C(void) {
    char *base;
    char *p;
    char *b;

    if (*(s16 *)D_8012D110 == 0) {
        return;
    }
    base = (char *)&D_8007AFF0;
    p = base + 0x20000;
    b = (char *)D_8012D110;
    *(s32 *)(p + 0x50E4) &= ~0x1000;
    *(s16 *)(p + 0x50FA) = 0;
    *(s16 *)(p + 0x50F8) = *(s16 *)(b + 8) * 400 - 2000;
    *(s16 *)(p + 0x50FC) = 1800 - *(s16 *)(b + 0xA) * 400;
    *(u16 *)(b + 4) = *(u16 *)(b + 8);
    *(u16 *)(b + 6) = *(u16 *)(b + 0xA);
}
