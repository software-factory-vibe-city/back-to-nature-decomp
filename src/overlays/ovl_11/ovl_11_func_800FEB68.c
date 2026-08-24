#include "common.h"

s32 ovl_11_func_800FEB68(void) {
    s32 count;
    char *base;
    s32 n;
    u16 *p;

    count = 0;
    base = (char *)&D_8006C838;
    base += 0x81BC;
    p = (u16 *)base;
    n = 19;
    do {
        if ((*p - 0x160) < 4u) {
            count += 1;
        }
        p = (u16 *)((char *)p + 0xB8);
        n -= 1;
    } while (n >= 0);
    return count;
}
