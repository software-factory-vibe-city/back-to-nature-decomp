#include "common.h"

extern s32 D_801273DC;
extern void ovl_11_func_80103714(void);

s32 func_80013394(void);
s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);

void ovl_11_func_801033D4(void) {
    if (func_80013394() != 0) {
        func_8002261C(3, 0x3C0);
        if (func_800226A4() == 2) {
            D_801273DC = (s32)ovl_11_func_80103714;
        }
    }
}
