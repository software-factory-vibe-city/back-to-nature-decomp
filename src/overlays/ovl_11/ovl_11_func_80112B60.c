#include "common.h"

void func_8001AF70(u16 arg0, u16 arg1);

void ovl_11_func_80112B60(void) {
    s32 value;
    unsigned char *base;
    u16 var_a0;

    value = (s32)&D_8006C838;
    base = (unsigned char *)(value + 0x8000);
    if (*(u16 *)(base + 0x676E) < 0x12D) {
        func_8001AF70(0x50, 0);
        func_8001AF70(0x51, 0);
        func_8001AF70(0x52, 0);
        if (*(u16 *)(base + 0x676E) < 0x12C) {
            *(u16 *)(base + 0x676E) = *(u16 *)(base + 0x676E) + 1;
        }
        if (*(u16 *)(base + 0x676E) >= 0x78) {
            *(s16 *)(base + 0x677C) = 2;
            var_a0 = 0x52;
            goto block_7;
        }
        if (*(u16 *)(base + 0x676E) >= 0x3C) {
            *(s16 *)(base + 0x677C) = 1;
            var_a0 = 0x51;
block_7:
            func_8001AF70(var_a0, 1);
            return;
        }
        func_8001AF70(0x50, 1);
    }
}
