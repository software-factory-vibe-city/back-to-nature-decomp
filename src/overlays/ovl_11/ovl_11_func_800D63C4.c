#include "common.h"

s32 ovl_11_func_800D63C4(s8 arg0, s8 arg1) {
    char *base = (char *)&D_80071A00;
    char *p;
    s32 temp;
    s32 var;
    s32 value;

    if (arg0 != 0) {
        temp = *(u16 *)(base + 0x14) + arg0;
        *(u16 *)(base + 0x14) = temp;
        if ((s16)temp < 0) {
            var = 0;
        } else {
            var = temp;
        }
        *(u16 *)(base + 0x14) = var;
        value = var;
        if ((s16)value >= 0x100) {
            value = 0xFF;
        }
        *(u16 *)(base + 0x14) = value;
        *(u16 *)(base + 0x12) = value;
        p = base - 0x51C8;
        *(u16 *)(p + 0x4A84) = *(u16 *)(p + 0x4A84) + 1;
    }
    if (arg1 != 0) {
        temp = *(u16 *)(base + 0x16) + arg1;
        *(u16 *)(base + 0x16) = temp;
        if ((s16)temp < 0) {
            var = 0;
        } else {
            var = temp;
        }
        *(u16 *)(base + 0x16) = var;
        if ((s16)var >= 0x65) {
            var = 0x64;
        }
        *(u16 *)(base + 0x16) = var;
    }
    return 1;
}
