#include "common.h"
#include "game_types.h"

/* Counts how many of the first x.index u32 words of the by-value record are
 * non-zero, returning the count. */
s32 ovl_11_func_8011D934(StructD548 x) {
    s32 sel = 0;
    s32 n = (s32)x.index;
    s32 pos;
    s32 step;
    s32 tmp;
    s32 i;
    u32 *p;

    if (n > 0) {
        p = (u32 *)&x;
        pos = 0x10000;
        step = 0x10000;
        for (i = 0; i < n; i++) {
            if (*p != 0) {
                tmp = pos;
                pos += step;
                sel = tmp >> 16;
            }
            p++;
        }
    }
    return sel;
}
