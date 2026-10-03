#include "common.h"

void ovl_21_func_800BA4C0(void);
s32 func_800226A4(void);
s32 func_800225B8(void);

void ovl_21_func_800B9538(void) {
    if (func_800226A4() == 2) {
        if (func_800225B8() == 1) {
            D_800C0448[0] = 5;
        } else {
            D_800C0448[0] = 0xF;
        }
    }
    ovl_21_func_800BA4C0();
}
