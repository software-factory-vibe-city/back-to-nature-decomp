#include "common.h"

extern s16 D_800BFE46;

void func_800132F0(s32 arg0, s32 arg1, s32 arg2);
s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);

void ovl_25_func_800BA9A4(void) {
    func_8002261C(4, 0x34);
    if (func_800226A4() == 2) {
        func_800132F0(0xA, 0, 2);
        D_800BFE46 = 5;
    }
}
