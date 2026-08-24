#include "common.h"

extern s32 *D_80128A80;

void ovl_11_func_800BFF00(void) {
    char *base;
    s32 *src = D_80128A80;

    base = (char *)&D_8006C838;
    base += 0x8000;
    *(s32 *)(base + 0x6748) = src[0];
    *(s32 *)(base + 0x6750) = src[2];
    *(s32 *)(base + 0x674C) = src[1];
    *(s32 *)(base + 0x6754) = 0;
    *(s32 *)(base + 0x675C) = 0;
    *(s32 *)(base + 0x6758) = 0;
    *(s32 *)(base + 0x6764) = 0;
    *(s32 *)(base + 0x6760) = 0;
    *(s32 *)(base + 0x6768) = 0;
}
