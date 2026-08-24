#include "common.h"

void ovl_11_func_8011D400(s32 *arg0) {
    s32 i;
    s16 *b;
    s8 *c;

    i = 0;
    c = (s8 *)arg0 + 0x3C;
    b = (s16 *)((s8 *)arg0 + 0x28);
    do {
        *arg0 = 0;
        *b = 0;
        b++;
        arg0++;
        c[i] = 0;
    } while (++i < 10);
}
