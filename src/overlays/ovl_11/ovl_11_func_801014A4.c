#include "common.h"

extern s8 D_801273E4;
extern u16 D_801273F4[];

s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);

void ovl_11_func_801014A4(s8 arg0) {
    func_8002261C(3, D_801273F4[arg0]);
    if (func_800226A4() == 2) {
        D_801273E4 = 3;
    }
}
