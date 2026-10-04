#include "common.h"

extern s8 D_801273E4;

s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);
s32 ovl_11_func_800D60D4(s16 *arg0);
void *ovl_11_func_80102844(s8 arg0, s8 arg1);

void ovl_11_func_80102268(s8 arg0, s8 arg1) {
    s16 *p;
    s32 v;

    p = ovl_11_func_80102844(arg1, arg0);
    v = p[0];
    if (v == 0xA4) {
        func_8002261C(3, ovl_11_func_800D60D4(p) + 0x3E8);
    } else {
        func_8002261C(3, v);
    }
    if (func_800226A4() == 2) {
        D_801273E4 = 3;
    }
}
