#include "common.h"

void ovl_21_func_800BA4C0(void);
s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);
s32 func_800225B8(void);

void ovl_21_func_800B9590(void) {
    func_8002261C(4, 0x18);
    if (func_800226A4() == 2) {
        if (func_800225B8() == 1) {
            D_800C0448[0] = 5;
        }
    }
    ovl_21_func_800BA4C0();
}
