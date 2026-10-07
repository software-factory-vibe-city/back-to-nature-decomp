#include "common.h"

void ovl_11_func_8011FEA0(s16 arg0, s16 arg1) {
    char *base;
    char *q;
    char *p;
    s32 limit;
    s32 current;
    u32 value;
    s32 total;
    s32 delta;
    s32 cap;

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
