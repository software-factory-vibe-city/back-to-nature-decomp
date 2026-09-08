#include "common.h"

/* Classify the status word at offset 0x18 of the s16-indexed item table
 * entry (D_8006C858 points at an array of 0x28-byte ItemData records).
 * Index is sign-extended to 16 bits (sll+sra) before the *40 stride
 * multiply. Bit 0x10000000 gives 0, bit 0x20000000 gives 1, bit
 * 0x40000000 gives 2, otherwise 3. */
s32 ovl_11_func_800D57A4(s16 arg0) {
    s32 status = D_8006C858[arg0].field_18;
    s32 result;

    result = 3;
    if (status & 0x10000000) {
        result = 0;
    } else if (status & 0x20000000) {
        result = 1;
    } else if (status & 0x40000000) {
        result = 2;
    }
    return result;
}
