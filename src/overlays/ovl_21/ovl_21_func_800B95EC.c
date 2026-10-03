#include "common.h"

void ovl_21_func_800BA4C0(void);
s32 func_80013394(void);
void func_800132B8(s32 arg0, s32 arg1, s32 arg2);

void ovl_21_func_800B95EC(void) {
    ovl_21_func_800BA4C0();
    if (func_80013394() == 1) {
        func_800132B8(10, 0, 2);
        D_800C0448[0] = 0;
        D_800C0448[1] += 1;
    }
}
