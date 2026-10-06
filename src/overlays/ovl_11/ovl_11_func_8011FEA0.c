#include "common.h"

/* User-authorized parked recovery: constrain real input, field-pointer,
 * limit and result register roles; all operations remain C. */

void ovl_11_func_8011FEA0(s16 arg0, s16 arg1) {
    char *base;
    char *q;
    register char *p __asm__("$4");
    s32 limit;
    s32 current;
    register u32 value __asm__("$5");
    register s32 total __asm__("$2");
    register s32 delta __asm__("$7");
    register s32 cap __asm__("$6");

    delta = arg1;
    base = (char *)&D_8006C838;
    q = base + arg0 * 0x1D4;
    p = q + 0x8000;
    cap = 0xFF;
    limit = cap - delta;
    current = *(s16 *)(p + 0x19EA);
    value = *(u16 *)(p + 0x19EA);
    if (current < limit) {
        total = delta + value;
        *(s16 *)(p + 0x19EA) = total;
    } else {
        *(s16 *)(p + 0x19EA) = cap;
    }
}
