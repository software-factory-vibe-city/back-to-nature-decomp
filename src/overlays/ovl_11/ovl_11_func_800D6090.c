#include "common.h"

/* Return whether the type byte at offset 0x02 of the u16-indexed item table
 * entry (D_8006C858 points at an array of 0x28-byte ItemData records) is not
 * 1, but only while the 0x8100 flag halfword equals 0x8000 (bit 15 set, bit 8
 * clear). Index is masked to 16 bits before the *40 stride multiply. */
s32 ovl_11_func_800D6090(u16 arg0) {
    s8 type = D_8006C858[arg0].type;

    if ((D_8006C858[arg0].u0.flags & 0x8100) != 0x8000)
        return 0;
    return type != 1;
}
