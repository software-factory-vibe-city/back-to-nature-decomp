#include "common.h"

s32 ovl_11_func_800FEB14(void) {
    s32 count = 0;
    u32 mask = 0x02000000;
    char *base = (char *)&D_8006C838;
    s8 *p = (s8 *)(base + 0x7AE8);
    s32 n = 9;

    do {
        if (*(u16 *)(p - 0x34) != 0u && !(*(u32 *)p & mask)) {
            count++;
        }
        p += 0xB4;
        n--;
    } while (n >= 0);
    return count;
}
