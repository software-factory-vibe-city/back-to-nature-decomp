#include "common.h"

/* Return the type byte at offset 0x02 of the s16-indexed item table entry
 * (D_8006C858 points at an array of 0x28-byte ItemData records). Index is
 * sign-extended to 16 bits (sll+sra) before the *40 stride multiply. */
s8 ovl_11_func_800D583C(s16 arg0) {
    return D_8006C858[arg0].type;
}
