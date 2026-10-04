#include "common.h"

extern s32 D_801273DC;
extern s8 D_801273E4;
extern void ovl_11_func_8010289C(void);

s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);
s32 func_800225B8(void);
void func_800132F0(s32 arg0, s32 arg1, s32 arg2);

void ovl_11_func_801022E8(void) {
    func_8002261C(3, 0x3BF);
    if (func_800226A4() == 2) {
        if ((s16)func_800225B8() == 1) {
            func_800132F0(0xA, 0, 2);
            D_801273DC = (s32)ovl_11_func_8010289C;
        } else {
            D_801273E4 = 3;
        }
    }
}
