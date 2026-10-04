#include "common.h"

extern s16 D_8013759E;
extern s16 D_80140F90[];

s32 ovl_15_func_801340B8(s32 arg0, s16 arg1) {
    s16 *p;
    s16 v;
    s32 i;
    s32 idx;

    v = D_8013759E;
    i = 0;
    idx = (arg0 != (s32)&D_800742EC);
    p = D_80140F90;
    p += idx * 0x14;
    for (; i < 5; i++) {
        if (p[i * 4] == v && p[i * 4 + 1] == arg1) {
            return 1;
        }
    }
    return 0;
}
