#include "common.h"

s32 ovl_11_func_800D60D4(s16 *arg0);
s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);
void func_80022738(void);

void ovl_11_func_800FB0C4(s16 *arg0) {
    s32 var_a1 = arg0[0];

    if (var_a1 == 0xA4) {
        var_a1 = ovl_11_func_800D60D4(arg0) + 0x3E8;
    }
    func_8002261C(3, var_a1);
    if (func_800226A4() == 2) {
        D_80126FE0 = 1;
        func_80022738();
    }
}
