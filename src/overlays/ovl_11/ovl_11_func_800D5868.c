#include "common.h"

/* Return whether the bit 0x40 of the flags word at offset 0x00 of the
 * s16-indexed item table entry (D_8006C858 points at an array of 0x28-byte
 * ItemData records) is set. Index is sign-extended to 16 bits (sll+sra)
 * before the *40 stride multiply. The comparison keeps the zero operand in a
 * pseudo -- a direct "!= 0" on the masked value would fold to a shift
 * (srl/andi 1), whereas here cc1 emits the real "andi" + "sltu" of the
 * target. */
s32 ovl_11_func_800D5868(s16 arg0) {
    s32 flags = D_8006C858[arg0].u0.field_00;
    u32 zero = 0;

    return (flags & 0x40) > zero;
}
