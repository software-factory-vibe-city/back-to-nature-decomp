#include "common.h"

extern s16 D_800A0494[];

s32 ovl_11_func_800D6730(s16 value, s16 row) {
    s16 *p;
    u32 i;

    p = D_800A0494 + row * 9;
    for (i = 0; i < 9; i++) {
        if (*p == 0) {
            *p = value;
            return i;
        }
        p++;
    }
    return -1;
}
