#include "common.h"

extern s32 D_800BB9E4;

void func_80017A48(u32 arg0);
u32 func_80017A64(void);

void ovl_23_func_800B7EA4(void) {
    s32 *base;
    u32 temp_s0;

    temp_s0 = func_80017A64();
    func_80017A48(3U);
    base = &D_800BB9E4;
    ((void (*)(s32 *))base[D_80070CC4])(base);
    func_80017A48(temp_s0);
}
