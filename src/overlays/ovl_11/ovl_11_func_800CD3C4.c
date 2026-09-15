#include "common.h"

s32 ovl_11_func_800CD3C4(s32 arg0) {
    char *base = (char *)&D_80071A00;
    char *p1 = base + 0x2E38;
    char *p2 = base - 0x51C8;
    u16 var;

    if (*(s16 *)(p1 + 0x64C8) != 0) {
        arg0 += 1;
    }
    var = *(u16 *)(p2 + 0x44C0);
    if ((u32)(var - 0x16) < 2) {
        arg0 += 1;
    }
    if (var < 6) {
        arg0 += 2;
    }
    if (*(s16 *)(base + 0x12) == 0) {
        arg0 += 2;
    }
    if (*(s32 *)(base + 0x6C) & 0x200) {
        arg0 /= 2;
    }
    if (*(u16 *)(base + 0x36) & 8) {
        arg0 = 0;
    }
    return arg0;
}
