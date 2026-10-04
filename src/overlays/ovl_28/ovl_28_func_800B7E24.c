#include "common.h"

extern s32 D_800B95F8;

void func_80017A48(u32 arg0);
u32 func_80017A64(void);

void ovl_28_func_800B7E24(void) {
    s32 *base;
    u32 temp_s0;

    temp_s0 = func_80017A64();
    func_80017A48(3U);
    base = &D_800B95F8;
    ((void (*)(s32 *))base[D_80070CC0])(base);
    func_80017A48(temp_s0);
}
