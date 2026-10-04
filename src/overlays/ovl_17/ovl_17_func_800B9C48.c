#include "common.h"

s16 ovl_17_func_800B9C48(s16 arg0) {
    u8 *base;
    s16 a;
    s16 b;
    s16 c;

    base = D_800BD848;
    a = *(s16 *)(base + 0x8);
    b = *(s16 *)(base + 0xA);
    c = *(s16 *)(base + 0xC);

    return (s16)(*(u16 *)(base + 0x8) + (a * (arg0 + b) * c) / 25500);
}
