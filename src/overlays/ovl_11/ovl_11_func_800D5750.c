#include "common.h"

/* Classify the flags halfword at offset 0x00 of the s16-indexed item table
 * entry (D_8006C858 points at an array of 0x28-byte ItemData records).
 * Index is sign-extended to 16 bits (sll+sra) before the *40 stride
 * multiply. Bit 0x4000 wins with value 0, bit 0x8100 gives 1, otherwise 2. */
s32 ovl_11_func_800D5750(s16 arg0) {
    s32 flags = D_8006C858[arg0].u0.field_00;
    s32 result;

    result = 2;
    if (flags & 0x4000) {
        result = 0;
    } else if (flags & 0x8100) {
        result = 1;
    }
    return result;
}
