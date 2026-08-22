#include "common.h"

extern s32 D_800B8500;

void ovl_08_func_800B8014(void) {
    s32 *base = &D_800B7E24;

    ((void (*)(s32 *))base[D_800B8500])(base);
}
