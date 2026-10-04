#include "common.h"

extern s32 D_800BCB58;

void ovl_21_func_800B7E3C(void) {
    s32 *base;
    u32 temp_s0;

    temp_s0 = func_80017A64();
    func_80017A48(3U);
    base = &D_800BCB58;
    ((void (*)(s32 *))base[D_80070CC4])(base);
    func_80017A48(temp_s0);
}
