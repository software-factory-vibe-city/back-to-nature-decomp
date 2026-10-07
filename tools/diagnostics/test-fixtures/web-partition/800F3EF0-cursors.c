#include "common.h"

s32 ovl_11_func_800F3EF0(void) {
    u16 *base;
    u16 *pending;
    u16 *src;
    u16 *dst;
    s32 i;
    u32 sum;

    base = D_800711C4;
    pending = base + 0x7E;
    if (*pending == 0) {
        return 0;
    }
    src = base + 0x7F;
    dst = base;
    i = 24;
    do {
        sum = *dst + *src;
        *dst = sum;
        if ((u16)sum >= 1000) {
            *dst = 999;
        }
        *src = 0;
        src++;
        i--;
        dst++;
    } while (i >= 0);
    *(s32 *)&base[0x1A] += *(s32 *)&pending[0x1A];
    pending[0] = 0;
    *(s32 *)&pending[0x1A] = 0;
    return 1;
}
