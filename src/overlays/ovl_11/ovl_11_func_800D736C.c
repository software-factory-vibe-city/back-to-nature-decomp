#include "common.h"

/* Classify the s16-indexed item table entry (D_8006C858 points at an array of
 * 0x28-byte ItemData records): bit tests on the flags halfword at offset 0x00
 * take priority, then the entry's s16 index itself is compared against a set
 * of special values. */
s32 ovl_11_func_800D736C(s16 *arg0) {
    s16 h = *arg0;
    u16 flags = D_8006C858[h].u0.flags;

    if (flags & 0x400) {
        return 4;
    }
    if (flags & 0x1800) {
        return 3;
    }
    if (flags & 0x40) {
        return 1;
    }
    if (flags & 0x100) {
        return 0;
    }
    if (h == 0x65 || h == 0x3F || h == 0x3A || h == 0x3E || h == 0x64) {
        return 5;
    }
    return 2;
}
