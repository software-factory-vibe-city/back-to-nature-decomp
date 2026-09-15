#include "common.h"

extern u8 D_8007AF80[];

s32 ovl_11_func_800C0010(s32 arg0, s32 arg1) {
    s32 *p = (s32 *)D_8007AF80;
    s32 *v = (s32 *)arg1;
    p[6] = 0;
    p[7] = arg0;
    p[3] = (v[0] - p[0]) / arg0;
    p[4] = (v[1] - p[1]) / arg0;
    p[5] = (v[2] - p[2]) / arg0;
    return p[5];
}
