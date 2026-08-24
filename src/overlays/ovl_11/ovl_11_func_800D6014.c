#include "common.h"

/* Return the s16 field at offset 0x10 of the u16-indexed item table entry
 * (D_8006C858 points at an array of 0x28-byte ItemData records). Index is
 * masked to 16 bits (andi a0,a0,0xFFFF) before the *40 stride multiply. */
s32 ovl_11_func_800D6014(u16 arg0) {
    return D_8006C858[arg0].field_10;
}
