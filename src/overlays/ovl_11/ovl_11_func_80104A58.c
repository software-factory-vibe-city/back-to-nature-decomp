#include "common.h"

extern s32 D_8009CBF8;

void ovl_11_func_80104A58(void) {
    u32 i;
    s32 *p;

    p = &D_8009CBF8;
    for (i = 0; i < 0x680; i++) {
        *p = 0;
        p++;
    }
}
