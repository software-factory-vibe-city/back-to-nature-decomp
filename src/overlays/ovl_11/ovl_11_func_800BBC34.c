#include "common.h"

extern s32 D_80121780;

void ovl_11_func_800BBC34(void) {
    s32 *base = &D_80121780;

    ((void (*)(s32 *))base[D_80070CC0])(base);
}
