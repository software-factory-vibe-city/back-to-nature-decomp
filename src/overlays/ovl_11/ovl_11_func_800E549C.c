#include "common.h"

void ovl_11_func_800E549C(void) {
    s32 i;
    struct_80076220 *p;

    p = &D_80076220;
    i = 0x24;
    do {
        p->unk1E &= ~0x1800;
        i--;
        p++;
    } while (i >= 0);
}
