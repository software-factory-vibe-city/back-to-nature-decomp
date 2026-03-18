#include "common.h"

extern u32 D_8005E290;

u32 func_80012A34(s32 arg0) {
    u32 seed;
    u32 mult_const;
    u32 temp;

    mult_const = 0x41C64E6D;
    seed = D_8005E290;
    seed = seed * mult_const;
    seed = seed + 0x3039;
    D_8005E290 = seed;
    temp = seed >> 0x10;
    temp = temp * (arg0 & 0xFFFF);
    return temp >> 0x10;
}
