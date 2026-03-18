#include "common.h"

extern u32 D_8005E290;

/*
 * Linear congruential generator (LCG) matching the glibc/ANSI C rand() parameters:
 *   multiplier 0x41C64E6D (1103515245) and addend 0x3039 (12345).
 * The upper 16 bits of the raw seed are used as the random bits (standard LCG
 * practice to discard the low-quality low bits).  The result is scaled into the
 * range [0, arg0) by multiplying those 16 bits by arg0 and taking the top 16 bits
 * of the 32-bit product (i.e. a fixed-point fraction of arg0).
 */
u32 Rand(s32 arg0) {
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
