#include "common.h"

extern u16 D_800BCC10[];

void ovl_25_func_800BAA5C(void) {
    char *base;
    char *p;
    char *src;

    base = (char *)&D_8007AFF0;
    p = base + 0x20000;
    src = (char *)D_800BCC10;
    *(s32 *)(p + 0x5394) = -0x2328;
    *(s32 *)(p + 0x5398) = -0x1194;
    *(s32 *)(p + 0x539C) = 0;
    *(s32 *)(p + 0x53A0) = 0x200;
    *(s32 *)(p + 0x53A4) = 0;
    *(s16 *)(p + 0x53B6) = 0;
    *(s16 *)(p + 0x53B4) = *(u16 *)(src + 0);
    *(s16 *)(p + 0x53B8) = *(u16 *)(src + 4);
}
