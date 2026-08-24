#include "common.h"

s32 ovl_11_func_800E20B8(void) {
    s32 count = 0;
    s8 *p = (s8 *)&D_800742EC;
    s32 n = 9;

    do {
        if (*(u16 *)p != 0u) {
            count++;
        }
        p += 0xB4;
        n--;
    } while (n >= 0);
    return count;
}
