#include "common.h"

void func_8001AF70(u16 arg0, u16 arg1) {
    u32 *p;
    u32 word_idx;
    u32 bit_idx;
    u32 mask;
    u32 scaled;
    char *base;

    word_idx = arg0 >> 5;
    bit_idx = arg0 & 0x1F;

    if (arg1) {
        base = (char *)&D_8006C838;
        scaled = word_idx << 2;
        base += 0x38;
        p = (u32 *)(base + scaled);
        mask = 1 << bit_idx;
        *p |= mask;
    } else {
        base = (char *)&D_8006C838;
        scaled = word_idx << 2;
        base += 0x38;
        p = (u32 *)(base + scaled);
        mask = 1 << bit_idx;
        *p &= ~mask;
    }
}
