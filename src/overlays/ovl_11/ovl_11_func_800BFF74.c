#include "common.h"

extern u8 D_8007AF80[];

void func_8001316C(u32 arg0, u32 arg1, u32 arg2);

void ovl_11_func_800BFF74(void) {
    s32 *p = (s32 *)D_8007AF80;
    if ((p[0] + p[1] + p[2]) != 0) {
        func_8001316C(p[0], p[1], p[2]);
    }
    if (p[7] > p[6]) {
        p[6] = p[6] + 1;
        p[0] = p[0] + p[3];
        p[1] = p[1] + p[4];
        p[2] = p[2] + p[5];
    }
}
