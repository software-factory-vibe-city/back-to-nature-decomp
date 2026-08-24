#include "common.h"

/* Return whether the status word at offset 0x18 of the s16-indexed item table
 * entry (D_8006C858 points at an array of 0x28-byte ItemData records) is
 * negative. Index is sign-extended to 16 bits (sll+sra) before the *40 stride
 * multiply. The comparison keeps the zero operand in a pseudo -- a direct
 * "< 0" would lower to "srl <reg>,<reg>,31" via the sign-bit trick, whereas
 * here cc1 emits a real "slti <reg>,<reg>,0" (as in the target). */
s32 ovl_11_func_800D5810(s16 arg0) {
    s32 zero = 0;

    return D_8006C858[arg0].field_18 < zero;
}
