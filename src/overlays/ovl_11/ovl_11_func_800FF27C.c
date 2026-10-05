#include "common.h"

extern s32 D_801273B0;

s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);
void func_80022738(void);
void func_800226D8(s32 arg0);
void func_80017B18(s32 arg0);

void ovl_11_func_800FF27C(s16 arg0, s16 arg1) {
    s32 var_a1;

    if (D_801273B0 == 0x11) {
        var_a1 = arg0 * 5 + 0x367;
        func_8002261C(3, arg1 + var_a1);
        if (func_800226A4() == 2) {
            func_80022738();
            D_801273B0 = 0x10;
        }
    }
    if (D_801273B0 == 0x10) {
        func_800226D8(0);
        func_80017B18(0);
        func_8002261C(3, 0x3B2);
    }
}
