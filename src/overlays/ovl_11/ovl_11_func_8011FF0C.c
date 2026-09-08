#include "common.h"

void ovl_11_func_8011FF0C(s16 arg0, s16 arg1) {
    char *base;
    char *p;
    u16 x;

    base = (char *)&D_8006C838;
    p = base + arg0 * 0x1D4;
    x = *(u16 *)(p + 0x8000 + 0x19EC);
    if (x < 0xFFFF - arg1) {
        *(u16 *)(p + 0x8000 + 0x19EC) = x + arg1;
    } else {
        *(u16 *)(p + 0x8000 + 0x19EC) = 0xFFFF;
    }
}
